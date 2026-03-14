"""
scan — 市场信号扫描 + 指标提取 Skill

双数据源：GeckoTerminal（DEX 交易数据）+ Moralis（链上原始数据）
融合器：DataFusion 双源合并 → SignalBus 信号分发
指标层：CurateArbSkill 从 scan 原始数据提取技术指标 + 跨池分析

调用方式对齐 WQ-YI:
  ScanSkill(ctx=ctx).run(pool_address)             # 原始信号
  CurateArbSkill(ctx=ctx).run(scan_outputs)        # 指标提取（原 curate 模块）

Arb-Campaign 5 步管线:
  scan(AGV) → curate(WQ-YI agent-ops) → dataset(WQ-YI agent-ops) → execute(AGV) → fix(AGV)

v1.2 变更: curate 纯计算层（技术指标/AMM/跨池分析）合并到 scan 模块。
  - CuratedPool / CuratedArbContext / CurateArbSkill 从 modules/curate/ 迁入
  - 计算函数来自 scripts/toolloop_scan.py（从 toolloop_curate_arb.py 完整迁移）
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# scan_sources.yml 路径
_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"


# ── 速率限制器（Token Bucket）────────────────────────
class _TokenBucket:
    """令牌桶速率限制器 — 30 req/min for GeckoTerminal free tier"""

    def __init__(self, rate: int = 30, per_seconds: float = 60.0):
        self._rate = rate
        self._per = per_seconds
        self._tokens = float(rate)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            self._tokens = min(self._rate, self._tokens + elapsed * (self._rate / self._per))
            self._last_refill = now
            if self._tokens < 1.0:
                wait = (1.0 - self._tokens) * (self._per / self._rate)
                await asyncio.sleep(wait)
                self._tokens = 0.0
            else:
                self._tokens -= 1.0


# ── JSON:API 响应解析 ─────────────────────────────────
def _parse_jsonapi_data(raw: dict) -> list[dict]:
    """从 GeckoTerminal JSON:API 响应中提取 data payload"""
    data = raw.get("data")
    if data is None:
        return []
    if isinstance(data, dict):
        return [data.get("attributes", data)]
    if isinstance(data, list):
        return [item.get("attributes", item) if isinstance(item, dict) else item
                for item in data]
    return []


def _parse_jsonapi_single(raw: dict) -> dict:
    """单对象 JSON:API 解析"""
    data = raw.get("data")
    if isinstance(data, dict):
        return data.get("attributes", data)
    return raw


# ── 简易缓存 ─────────────────────────────────────────
class _TTLCache:
    """简单 TTL 缓存（key → (value, expire_at)）"""

    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expire_at = entry
        if time.monotonic() > expire_at:
            del self._store[key]
            return None
        return value

    def put(self, key: str, value: Any, ttl: float) -> None:
        self._store[key] = (value, time.monotonic() + ttl)


# ── GeckoTerminal Client ─────────────────────────────
class GeckoTerminalClient:
    """GeckoTerminal API — DEX 交易数据（30 req/min free tier）

    端点:
      /networks/{net}/pools/{addr}/ohlcv/{tf}   → OHLCV K 线
      /networks/{net}/pools/{addr}/trades        → 最新交易
      /networks/{net}/pools/{addr}               → 池信息
      /networks/{net}/trending_pools             → 趋势池
      /networks/{net}/tokens/{addr}              → Token 信息
    """

    BASE_URL = "https://api.geckoterminal.com/api/v2"

    # 缓存 TTL（秒）
    CACHE_TTL_OHLCV = 60
    CACHE_TTL_POOL_INFO = 300
    CACHE_TTL_TRENDING = 600
    CACHE_TTL_TOKEN_INFO = 300

    def __init__(self, *, session=None, rate_limit: int = 30):
        self.session = session          # aiohttp.ClientSession（外部注入）
        self.rate_limit = rate_limit
        self._bucket = _TokenBucket(rate=rate_limit)
        self._cache = _TTLCache()
        self._req_count = 0
        self._window_start = time.monotonic()

    def _cache_key(self, *parts: str) -> str:
        return hashlib.sha256(":".join(parts).encode()).hexdigest()[:16]

    async def _get(self, path: str, *, params: dict | None = None) -> dict:
        """带速率限制的 GET 请求"""
        await self._bucket.acquire()
        url = f"{self.BASE_URL}{path}"
        headers = {"Accept": "application/json"}
        self._req_count += 1

        if self.session is None:
            try:
                import aiohttp
                async with aiohttp.ClientSession() as sess:
                    async with sess.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                        resp.raise_for_status()
                        return await resp.json()
            except ImportError:
                raise RuntimeError("aiohttp is required: pip install aiohttp")
        else:
            async with self.session.get(url, headers=headers, params=params) as resp:
                resp.raise_for_status()
                return await resp.json()

    async def get_ohlcv(self, *, network: str = "bsc",
                        pool_address: str, timeframe: str = "minute",
                        aggregate: int = 5, limit: int = 100) -> list[dict]:
        """K 线数据 — scan 核心数据源

        timeframe: "minute" | "hour" | "day"
        aggregate: 1/5/15 (minute), 1/4/12 (hour), 1 (day)
        返回: [{timestamp, open, high, low, close, volume_usd}, ...]
        """
        ck = self._cache_key("ohlcv", network, pool_address, timeframe, str(aggregate))
        cached = self._cache.get(ck)
        if cached is not None:
            return cached

        path = f"/networks/{network}/pools/{pool_address}/ohlcv/{timeframe}"
        params = {"aggregate": str(aggregate), "limit": str(min(limit, 1000))}
        raw = await self._get(path, params=params)

        # ohlcv_list 在 data.attributes.ohlcv_list 中
        data = raw.get("data", {})
        attrs = data.get("attributes", {}) if isinstance(data, dict) else {}
        ohlcv_list = attrs.get("ohlcv_list", [])
        result = []
        for bar in ohlcv_list:
            if isinstance(bar, list) and len(bar) >= 6:
                result.append({
                    "timestamp": bar[0],
                    "open": float(bar[1]),
                    "high": float(bar[2]),
                    "low": float(bar[3]),
                    "close": float(bar[4]),
                    "volume_usd": float(bar[5]),
                })
        self._cache.put(ck, result, self.CACHE_TTL_OHLCV)
        return result

    async def get_trades(self, *, network: str = "bsc",
                         pool_address: str, limit: int = 50) -> list[dict]:
        """最新交易 — 异常检测、volume spike 信号

        返回: [{tx_hash, block_number, volume_in_usd, kind, ...}, ...]
        """
        path = f"/networks/{network}/pools/{pool_address}/trades"
        params = {"trade_volume_in_usd_greater_than": "0"}
        raw = await self._get(path, params=params)
        trades = _parse_jsonapi_data(raw)
        return trades[:limit]

    async def get_pool_info(self, *, network: str = "bsc",
                            pool_address: str) -> dict:
        """池信息 — reserve、price、volume_24h、fdv

        返回: {name, address, base_token_price_usd, quote_token_price_usd,
               reserve_in_usd, volume_usd_24h, ...}
        """
        ck = self._cache_key("pool", network, pool_address)
        cached = self._cache.get(ck)
        if cached is not None:
            return cached

        path = f"/networks/{network}/pools/{pool_address}"
        raw = await self._get(path)
        result = _parse_jsonapi_single(raw)
        self._cache.put(ck, result, self.CACHE_TTL_POOL_INFO)
        return result

    async def get_trending_pools(self, *, network: str = "bsc",
                                 page: int = 1) -> list[dict]:
        """趋势池 — 热度信号

        返回: [{name, address, volume_usd_24h, price_change_percentage, ...}, ...]
        """
        ck = self._cache_key("trending", network, str(page))
        cached = self._cache.get(ck)
        if cached is not None:
            return cached

        path = f"/networks/{network}/trending_pools"
        params = {"page": str(page)}
        raw = await self._get(path, params=params)
        result = _parse_jsonapi_data(raw)
        self._cache.put(ck, result, self.CACHE_TTL_TRENDING)
        return result

    async def get_token_info(self, *, network: str = "bsc",
                             token_address: str) -> dict:
        """Token 信息 — 供应量、价格、FDV

        返回: {name, symbol, address, price_usd, fdv_usd, total_supply, ...}
        """
        ck = self._cache_key("token", network, token_address)
        cached = self._cache.get(ck)
        if cached is not None:
            return cached

        path = f"/networks/{network}/tokens/{token_address}"
        raw = await self._get(path)
        result = _parse_jsonapi_single(raw)
        self._cache.put(ck, result, self.CACHE_TTL_TOKEN_INFO)
        return result


# ── Moralis Client ───────────────────────────────────
class MoralisClient:
    """Moralis API — 链上原始数据

    端点:
      /erc20/{addr}/transfers   → 代币转账（鲸鱼监控）
      /{pair}/events            → LP 事件（Sync/Mint/Burn）
      /erc20/{addr}/owners      → 持仓分布（集中度风险）
      /{wallet}/erc20           → 钱包余额
    """

    BASE_URL = "https://deep-index.moralis.io/api/v2.2"

    def __init__(self, *, api_key: str = "", session=None):
        self._api_key = api_key
        self.session = session

    async def _get(self, path: str, *, params: dict | None = None) -> dict:
        """带 API Key 的 GET 请求"""
        if not self._api_key:
            raise RuntimeError("Moralis API key not configured")
        url = f"{self.BASE_URL}{path}"
        headers = {"Accept": "application/json", "X-API-Key": self._api_key}

        if self.session is None:
            try:
                import aiohttp
                async with aiohttp.ClientSession() as sess:
                    async with sess.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                        resp.raise_for_status()
                        return await resp.json()
            except ImportError:
                raise RuntimeError("aiohttp is required: pip install aiohttp")
        else:
            async with self.session.get(url, headers=headers, params=params) as resp:
                resp.raise_for_status()
                return await resp.json()

    async def get_transfers(self, *, token_address: str,
                            from_block: int | None = None,
                            limit: int = 100) -> list[dict]:
        """代币转账 — 鲸鱼监控

        返回: [{transaction_hash, from_address, to_address, value, block_number, ...}, ...]
        """
        path = f"/erc20/{token_address}/transfers"
        params: dict[str, str] = {"chain": "bsc", "limit": str(limit)}
        if from_block is not None:
            params["from_block"] = str(from_block)
        raw = await self._get(path, params=params)
        return raw.get("result", [])

    async def get_pair_events(self, *, pair_address: str,
                              event_types: list[str] | None = None,
                              limit: int = 100) -> list[dict]:
        """LP 事件: Sync / Mint / Burn

        返回: [{transaction_hash, event, data, block_number, ...}, ...]
        """
        path = f"/{pair_address}/events"
        params: dict[str, str] = {"chain": "bsc", "limit": str(limit)}
        if event_types:
            params["topic"] = ",".join(event_types)
        raw = await self._get(path, params=params)
        return raw.get("result", [])

    async def get_holders(self, *, token_address: str,
                          limit: int = 50) -> list[dict]:
        """持仓分布 — 集中度风险

        返回: [{address, balance, percentage, ...}, ...]
        """
        path = f"/erc20/{token_address}/owners"
        params = {"chain": "bsc", "limit": str(limit)}
        raw = await self._get(path, params=params)
        return raw.get("result", [])

    async def get_wallet_balances(self, *, wallet_address: str) -> list[dict]:
        """钱包 ERC20 余额

        返回: [{token_address, name, symbol, balance, decimals, ...}, ...]
        """
        path = f"/{wallet_address}/erc20"
        params = {"chain": "bsc"}
        raw = await self._get(path, params=params)
        return raw if isinstance(raw, list) else raw.get("result", [])


# ── DataFusion ───────────────────────────────────────
class DataFusion:
    """双源融合器 — GeckoTerminal + Moralis 数据对齐合并

    职责:
      1. 时间对齐（统一 UTC 时间戳）
      2. 去重（同笔交易 txHash 去重）
      3. 交叉验证（价格偏差 > 1% → 标记不一致方）
      4. 缺失补全（一方断流 → 另一方兜底）
    """

    PRICE_DIVERGENCE_THRESHOLD = 0.01  # 1% 价格偏差触发交叉验证

    def __init__(self, *, gecko_client=None, moralis_client=None,
                 stale_threshold_seconds: float = 120.0):
        self.gecko: GeckoTerminalClient | None = gecko_client
        self.moralis: MoralisClient | None = moralis_client
        self.stale_threshold_seconds = stale_threshold_seconds

    async def fetch_merged(self, *, pool_address: str,
                           token_address: str | None = None) -> dict:
        """从双源获取数据并合并

        返回: {
            pool_info: dict,         # GeckoTerminal 池信息
            ohlcv: list[dict],       # GeckoTerminal K 线
            trades: list[dict],      # GeckoTerminal 最新交易
            transfers: list[dict],   # Moralis 转账记录
            pair_events: list[dict], # Moralis LP 事件
            source_status: {gecko: bool, moralis: bool},
            warnings: list[str],
        }
        """
        result: dict[str, Any] = {
            "pool_info": {},
            "ohlcv": [],
            "trades": [],
            "transfers": [],
            "pair_events": [],
            "source_status": {"gecko": False, "moralis": False},
            "warnings": [],
        }

        # GeckoTerminal 数据
        if self.gecko is not None:
            try:
                pool_info, ohlcv, trades = await asyncio.gather(
                    self.gecko.get_pool_info(pool_address=pool_address),
                    self.gecko.get_ohlcv(pool_address=pool_address),
                    self.gecko.get_trades(pool_address=pool_address),
                    return_exceptions=True,
                )
                if not isinstance(pool_info, BaseException):
                    result["pool_info"] = pool_info
                if not isinstance(ohlcv, BaseException):
                    result["ohlcv"] = ohlcv
                if not isinstance(trades, BaseException):
                    result["trades"] = trades
                result["source_status"]["gecko"] = True
            except Exception as exc:
                result["warnings"].append(f"GeckoTerminal fetch failed: {exc}")

        # Moralis 数据
        if self.moralis is not None and token_address:
            try:
                transfers, pair_events = await asyncio.gather(
                    self.moralis.get_transfers(token_address=token_address),
                    self.moralis.get_pair_events(pair_address=pool_address),
                    return_exceptions=True,
                )
                if not isinstance(transfers, BaseException):
                    result["transfers"] = transfers
                if not isinstance(pair_events, BaseException):
                    result["pair_events"] = pair_events
                result["source_status"]["moralis"] = True
            except Exception as exc:
                result["warnings"].append(f"Moralis fetch failed: {exc}")

        # 交叉验证（两源都有价格时）
        gecko_price = _extract_price(result.get("pool_info", {}))
        if gecko_price and result["transfers"]:
            # Moralis 不直接给价格，跳过交叉验证
            pass

        # 单源断流告警
        gs = result["source_status"]
        if not gs["gecko"] and not gs["moralis"]:
            result["warnings"].append("CRITICAL: both data sources unavailable")
        elif not gs["gecko"]:
            result["warnings"].append("GeckoTerminal unavailable, degraded mode")
        elif not gs["moralis"]:
            result["warnings"].append("Moralis unavailable, degraded mode")

        return result

    async def detect_signals(self, *, pool_address: str,
                             token_address: str | None = None,
                             thresholds: dict | None = None) -> list[dict]:
        """合并数据 → 检测 5 种信号

        thresholds: signal_thresholds from scan_sources.yml
        """
        merged = await self.fetch_merged(
            pool_address=pool_address, token_address=token_address,
        )
        th = thresholds or _load_default_thresholds()
        signals: list[dict] = []
        now_ts = time.time()

        # 1. price_divergence — 需要多池对比（由 ScanSkill 跨池调用）
        # 此处仅检测池内价格异常（ohlcv close vs pool_info price）
        gecko_price = _extract_price(merged.get("pool_info", {}))
        ohlcv = merged.get("ohlcv", [])
        if gecko_price and ohlcv:
            last_close = ohlcv[-1].get("close", 0)
            if last_close > 0 and gecko_price > 0:
                div = abs(gecko_price - last_close) / last_close
                if div > th.get("price_divergence_pct", 3.0) / 100.0:
                    signals.append(_make_signal(
                        "price_divergence", pool_address, now_ts,
                        strength=min(div * 100, 100.0),
                        source="gecko", details={"price": gecko_price, "last_close": last_close},
                    ))

        # 2. volume_spike — 最近 5min 成交量 vs 24h 均值
        pool_info = merged.get("pool_info", {})
        vol_24h = _safe_float(pool_info.get("volume_usd", pool_info.get("volume_usd_24h")))
        recent_trades = merged.get("trades", [])
        if vol_24h and vol_24h > 0 and recent_trades:
            recent_vol = sum(_safe_float(t.get("volume_in_usd", 0)) for t in recent_trades[:20])
            avg_5min_vol = vol_24h / 288.0  # 24h / 5min = 288 windows
            if avg_5min_vol > 0:
                spike_ratio = recent_vol / avg_5min_vol
                if spike_ratio > th.get("volume_spike_ratio", 5.0):
                    signals.append(_make_signal(
                        "volume_spike", pool_address, now_ts,
                        strength=min(spike_ratio, 100.0),
                        source="gecko", details={"recent_vol": recent_vol, "avg_5min": avg_5min_vol},
                    ))

        # 3. lp_imbalance — reserve 比值偏离
        reserve_usd = _safe_float(pool_info.get("reserve_in_usd"))
        # GeckoTerminal 不直接分两侧 reserve，但可通过 base_token_price 推算
        # 简化: 如果 pool_info 有 reserve 数据则检查
        base_reserve = _safe_float(pool_info.get("base_token_price_native_currency"))
        quote_reserve = _safe_float(pool_info.get("quote_token_price_native_currency"))
        if base_reserve and quote_reserve and (base_reserve + quote_reserve) > 0:
            ratio = min(base_reserve, quote_reserve) / max(base_reserve, quote_reserve)
            if ratio < th.get("lp_imbalance_ratio", 0.10):
                signals.append(_make_signal(
                    "lp_imbalance", pool_address, now_ts,
                    strength=(1.0 - ratio) * 100,
                    source="gecko", details={"reserve_ratio": ratio},
                ))

        # 4. whale_movement — Moralis 大额转账
        whale_threshold = th.get("whale_threshold_usd", 500.0)
        for tx in merged.get("transfers", []):
            val_usd = _safe_float(tx.get("value_usd", 0))
            if val_usd >= whale_threshold:
                signals.append(_make_signal(
                    "whale_movement", pool_address, now_ts,
                    strength=min(val_usd / whale_threshold * 10, 100.0),
                    source="moralis",
                    details={"tx_hash": tx.get("transaction_hash"), "value_usd": val_usd},
                ))

        # 5. trending_momentum — 由 ScanSkill 单独调 get_trending_pools 处理

        return signals


def _extract_price(pool_info: dict) -> float:
    """从 pool_info 提取 base token USD 价格"""
    p = pool_info.get("base_token_price_usd")
    if p is not None:
        try:
            return float(p)
        except (ValueError, TypeError):
            pass
    return 0.0


def _safe_float(v: Any) -> float:
    if v is None:
        return 0.0
    try:
        return float(v)
    except (ValueError, TypeError):
        return 0.0


def _make_signal(sig_type: str, pool_address: str, ts: float,
                 *, strength: float, source: str, details: dict) -> dict:
    return {
        "type": sig_type,
        "pool_address": pool_address,
        "timestamp": ts,
        "strength": round(strength, 2),
        "source": source,
        "details": details,
    }


def _load_default_thresholds() -> dict:
    """从 scan_sources.yml 加载默认阈值，失败则硬编码兜底"""
    try:
        import yaml
        yml = _KNOWLEDGE_DIR / "scan_sources.yml"
        if yml.exists():
            with open(yml) as f:
                data = yaml.safe_load(f)
            return data.get("signal_thresholds", {})
    except Exception:
        pass
    return {
        "price_divergence_pct": 3.0,
        "volume_spike_ratio": 5.0,
        "lp_imbalance_ratio": 0.10,
        "whale_threshold_usd": 500.0,
        "stale_data_seconds": 120.0,
    }


# ── ScanSkill（对齐 WQ-YI 调用方式）──────────────────
class ScanSkill:
    """市场信号扫描 — Arb-Campaign Step 1

    调用方式: ScanSkill(ctx=ctx).run(pool_address)

    产出 AssetRef kind="market_signal" → curate(WQ-YI agent-ops) 消费
    """

    SIGNAL_TYPES = [
        "price_divergence",
        "volume_spike",
        "lp_imbalance",
        "whale_movement",
        "trending_momentum",
    ]

    # pool_address → token_address 映射（已知池）
    KNOWN_TOKENS: dict[str, str] = {
        "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0": "0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",  # pGVT
        "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d": "0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3",  # sGVT
    }

    def __init__(self, *, ctx=None, config: dict | None = None):
        self._ctx = ctx
        self.config = config or {}
        self._gecko = self.config.get("gecko_client") or GeckoTerminalClient()
        self._moralis = self.config.get("moralis_client")  # None if no API key
        self._fusion = DataFusion(
            gecko_client=self._gecko,
            moralis_client=self._moralis,
        )
        self._thresholds = self.config.get("thresholds") or _load_default_thresholds()

    async def run(self, pool_address: str) -> list[dict]:
        """扫描指定池，返回信号列表"""
        token_address = self.KNOWN_TOKENS.get(pool_address)
        signals = await self._fusion.detect_signals(
            pool_address=pool_address,
            token_address=token_address,
            thresholds=self._thresholds,
        )
        # trending_momentum 由 scan_all_pools 统一检测
        logger.info("scan pool=%s signals=%d", pool_address[:10], len(signals))
        return signals

    async def scan_all_pools(self, pool_addresses: list[str]) -> list[dict]:
        """批量扫描多个池 + 跨池 price_divergence + trending_momentum"""
        all_signals: list[dict] = []

        # 并行扫描各池
        tasks = [self.run(addr) for addr in pool_addresses]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, res in enumerate(results):
            if isinstance(res, BaseException):
                logger.warning("scan pool=%s failed: %s", pool_addresses[i][:10], res)
            else:
                all_signals.extend(res)

        # 跨池价格偏差检测
        cross_signals = await self._detect_cross_pool_divergence(pool_addresses)
        all_signals.extend(cross_signals)

        # trending_momentum
        trending_signals = await self._detect_trending(pool_addresses)
        all_signals.extend(trending_signals)

        return all_signals

    async def _detect_cross_pool_divergence(self, pool_addresses: list[str]) -> list[dict]:
        """跨池价格偏差 — pGVT 在不同池的价格差"""
        if len(pool_addresses) < 2:
            return []
        # 当前只有 pGVT-USDT 和 sGVT-USDT，不是同一 token 的不同池
        # 未来如果有同 token 多池，在此检测跨池价差
        return []

    async def _detect_trending(self, pool_addresses: list[str]) -> list[dict]:
        """trending_momentum — 检查目标池是否在趋势榜"""
        try:
            trending = await self._gecko.get_trending_pools()
        except Exception:
            return []

        signals = []
        addr_set = {a.lower() for a in pool_addresses}
        for i, pool in enumerate(trending):
            addr = pool.get("address", "").lower()
            if addr in addr_set:
                signals.append(_make_signal(
                    "trending_momentum", addr, time.time(),
                    strength=max(0, 100 - i * 5),  # 排名越高 strength 越大
                    source="gecko",
                    details={"rank": i + 1},
                ))
        return signals


# ═══════════════════════════════════════════════════════
# Curate 指标提取层（v1.2 从 modules/curate/ 合并）
# ═══════════════════════════════════════════════════════
#
# 原 modules/curate/scripts/skill_curate_arb.py 的数据类与入口类。
# 计算函数来自同目录 toolloop_scan.py（从 toolloop_curate_arb.py 完整迁移）。

try:
    from .toolloop_scan import (
        PoolState, DivergenceResult, IndicatorSnapshot,
        compute_all, scan_all_pairs, spread_zscore,
    )
except ImportError:
    from toolloop_scan import (  # type: ignore[no-redef]
        PoolState, DivergenceResult, IndicatorSnapshot,
        compute_all, scan_all_pairs, spread_zscore,
    )


@dataclass
class CuratedPool:
    """单个池子的 curate 结果"""
    address: str
    name: str = ""
    indicators: list[IndicatorSnapshot] | None = None
    pool_state: PoolState | None = None
    latest_indicator: IndicatorSnapshot | None = None


@dataclass
class CuratedArbContext:
    """全部池子的 curate 上下文 — dataset 步骤的输入"""
    pools: list[CuratedPool] = field(default_factory=list)
    divergences: list[DivergenceResult] = field(default_factory=list)
    spread_zscores: dict[str, list[float]] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    warnings: list[str] = field(default_factory=list)


class CurateArbSkill:
    """指标提取 — scan 原始数据 → 技术指标 + 跨池分析

    v1.2: 从 modules/curate/ 合并到 modules/scan/。
    计算层（toolloop_scan.py）提供纯数学函数，本类做编排。

    调用方式: CurateArbSkill(ctx=ctx).run(scan_outputs)

    Args:
        scan_outputs: list[dict] — 每个 dict 包含:
            pool_address, price_usd, tvl, volume_24h, fee_bps, ohlcv_5m
    """

    def __init__(self, *, ctx: Any = None, config: dict | None = None):
        self._ctx = ctx
        self.config = config or {}

    def run(self, scan_outputs: list[dict]) -> CuratedArbContext:
        """主入口 — scan 原始数据 → CuratedArbContext"""
        curated_pools: list[CuratedPool] = []
        pool_states: list[PoolState] = []
        warnings: list[str] = []

        for raw in scan_outputs:
            pool = self._curate_single_pool(raw)
            if pool:
                curated_pools.append(pool)
                if pool.pool_state and pool.pool_state.is_valid:
                    pool_states.append(pool.pool_state)
            else:
                warnings.append(f"skip pool {raw.get('pool_address', '?')}: insufficient data")

        # 跨池价差
        divergences = scan_all_pairs(pool_states) if len(pool_states) >= 2 else []

        # 价差 Z-score（配对交易信号）
        spread_zscores = self._compute_spread_zscores(curated_pools)

        ctx = CuratedArbContext(
            pools=curated_pools,
            divergences=divergences,
            spread_zscores=spread_zscores,
            warnings=warnings,
        )
        logger.info("curate: %d pools, %d divergences", len(curated_pools), len(divergences))
        return ctx

    def _curate_single_pool(self, raw: dict) -> CuratedPool | None:
        """单池指标提取"""
        addr = raw.get("pool_address", "")
        if not addr:
            return None

        ohlcv = raw.get("ohlcv_5m", [])
        indicators = compute_all(ohlcv) if ohlcv else None
        latest = indicators[-1] if indicators else None

        pool_state = self._build_pool_state(raw)

        return CuratedPool(
            address=addr,
            name=raw.get("name", ""),
            indicators=indicators,
            pool_state=pool_state,
            latest_indicator=latest,
        )

    @staticmethod
    def _build_pool_state(raw: dict) -> PoolState:
        """从 scan 原始数据构建 PoolState"""
        return PoolState(
            address=raw.get("pool_address", ""),
            name=raw.get("name", ""),
            price=_curate_safe_float(raw.get("price_usd")),
            tvl_usd=_curate_safe_float(raw.get("tvl")),
            volume_24h_usd=_curate_safe_float(raw.get("volume_24h")),
            fee_bps=int(raw.get("fee_bps", 25)),
        )

    @staticmethod
    def _compute_spread_zscores(pools: list[CuratedPool]) -> dict[str, list[float]]:
        """计算所有池对的价差 Z-score"""
        result: dict[str, list[float]] = {}
        for i in range(len(pools)):
            for j in range(i + 1, len(pools)):
                pi, pj = pools[i], pools[j]
                if not pi.indicators or not pj.indicators:
                    continue
                prices_i = [s.price for s in pi.indicators if s.price > 0]
                prices_j = [s.price for s in pj.indicators if s.price > 0]
                if len(prices_i) >= 20 and len(prices_j) >= 20:
                    zs = spread_zscore(prices_i, prices_j, window=20)
                    key = f"{pi.address}:{pj.address}"
                    result[key] = zs
        return result


def _curate_safe_float(v: Any) -> float:
    """curate 层 safe_float（避免与 scan 层的 _safe_float 混淆）"""
    if v is None:
        return 0.0
    try:
        return float(v)
    except (ValueError, TypeError):
        return 0.0
