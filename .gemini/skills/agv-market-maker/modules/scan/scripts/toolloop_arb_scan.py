"""
Arb Scan Tool Loop — 全网池发现 + 信号富集 + 持久化

对齐 WQ-YI collect-papers 三阶段：
  Phase 1: Pool Discovery  → GeckoTerminal trending / new pools
  Phase 2: Signal Enrichment → OHLCV + indicators + cross-pool analysis
  Phase 3: Persist          → signal_packet.yml + pool_hints.yml + registry

产出目录（对齐 collect-papers pending/{ABBR}/）：
  {output_root}/
  ├── pending/{PAIR_ID}/
  │   ├── signal_packet.yml     ← 主证据包（对齐 idea_packet.yml）
  │   ├── pool_hints.yml        ← 轻量提示（对齐 asset_hints.yml）
  │   └── raw_snapshot.json     ← API 原始响应（对齐 content.md）
  ├── pool_registry.yml         ← 全局注册表（对齐 abbreviations.yml）
  └── archived/                 ← 终态池对

文件职责对齐（1 skill + 2 toolloop 模式）：
  skill_scan.py          ← 共享 skill（clients, fusion, thresholds）
  toolloop_scan.py       ← MM toolloop（indicators, AMM math, ScanLoop）
  toolloop_arb_scan.py   ← Arb toolloop（本文件: discover → enrich → persist）

Phase 2 路线: GeckoTerminal + Moralis 做成 MCP 服务
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 共享数据层导入
try:
    from skill_scan import (
        GeckoTerminalClient,
        MoralisClient,
        DataFusion,
        _safe_float,
        _make_signal,
        _load_default_thresholds,
        _parse_jsonapi_data,
    )
    from toolloop_scan import (
        PoolState,
        DivergenceResult,
        IndicatorSnapshot,
        compute_all,
        scan_all_pairs,
        spread_zscore,
    )
except ImportError:
    from .skill_scan import (  # type: ignore[no-redef]
        GeckoTerminalClient,
        MoralisClient,
        DataFusion,
        _safe_float,
        _make_signal,
        _load_default_thresholds,
        _parse_jsonapi_data,
    )
    from .toolloop_scan import (  # type: ignore[no-redef]
        PoolState,
        DivergenceResult,
        IndicatorSnapshot,
        compute_all,
        scan_all_pairs,
        spread_zscore,
    )

_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"

# ── 产出物路径（nexrur 统一观测点）────────────────────
_NEXRUR_ROOT = Path("/workspaces/nexrur")
_DEFAULT_OUTPUT_ROOT = _NEXRUR_ROOT / "docs" / "ai-skills" / "scan"
_DEFAULT_RUNS_ROOT = _NEXRUR_ROOT / "docs" / "ai-runs" / "scan"


# ── 数据类 ─────────────────────────────────────────────

@dataclass
class PoolAsset:
    """发现的池对资产（对齐 abbreviations.yml 条目）

    pair_id 规则: {BASE}_{QUOTE}_{ADDR6}
    示例: WBNB_USDT_0x58F8, CAKE_BNB_0x0eD7
    """
    pair_id: str
    pool_address: str
    network: str = "bsc"
    dex: str = ""
    base_token: str = ""
    quote_token: str = ""
    base_token_address: str = ""
    quote_token_address: str = ""
    discovered_at: str = ""
    discovery_method: str = ""              # trending / new_pool
    lifecycle_state: str = "pending"        # pending / curating / evaluated / terminal_*
    status: str = "pending"                 # pending / archived
    signal_quality: str = "none"            # strong / moderate / weak / none
    scan_count: int = 0
    last_scan: str = ""
    dir: str = ""                           # directory name in pending/


@dataclass
class SignalPacket:
    """主证据包（对齐 idea_packet.yml）"""
    pair_id: str
    version: str = "1.0"
    source_evidence: dict = field(default_factory=dict)
    market_data: dict = field(default_factory=dict)
    signals: list[dict] = field(default_factory=list)
    indicators: dict = field(default_factory=dict)
    cross_pool_analysis: dict = field(default_factory=dict)
    validation: dict = field(default_factory=dict)
    decision: dict = field(default_factory=dict)
    execution_hints: dict = field(default_factory=dict)


@dataclass
class PoolHints:
    """轻量提示（对齐 asset_hints.yml）"""
    pair_id: str
    pool_address: str = ""
    network: str = "bsc"
    dex: str = ""
    base_token: str = ""
    quote_token: str = ""
    signal_quality: str = "none"
    top_signal: str = ""
    signal_strength: float = 0.0
    tvl_usd: float = 0.0
    volume_24h_usd: float = 0.0
    discovered_at: str = ""


@dataclass
class ScanOutcome:
    """运行结果（对齐 StepOutcome）"""
    status: str = "success"                 # success / partial / failed
    reason_code: str | None = None
    pools_discovered: int = 0
    pools_enriched: int = 0
    pools_persisted: int = 0
    pools_skipped: int = 0
    run_id: str = ""
    timestamp: str = ""


# ── 注册表 ──────────────────────────────────────────────

class ArbPoolRegistry:
    """池对注册表（对齐 abbreviations.yml）"""

    def __init__(self, registry_path: Path):
        self._path = registry_path
        self._data: dict = {"version": 1, "last_updated": "", "pools": {}}
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            try:
                import yaml
                with open(self._path) as f:
                    data = yaml.safe_load(f) or {}
                self._data = data
            except Exception as exc:
                logger.warning("registry load failed: %s", exc)

    def save(self) -> None:
        self._data["last_updated"] = _utcnow()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        import yaml
        with open(self._path, "w") as f:
            yaml.dump(self._data, f, default_flow_style=False,
                      allow_unicode=True, sort_keys=False)

    def register(self, asset: PoolAsset) -> None:
        self._data.setdefault("pools", {})[asset.pair_id] = {
            "pool_address": asset.pool_address,
            "network": asset.network,
            "dex": asset.dex,
            "base_token": asset.base_token,
            "quote_token": asset.quote_token,
            "discovered_date": asset.discovered_at[:10] if asset.discovered_at else "",
            "lifecycle_state": asset.lifecycle_state,
            "status": asset.status,
            "signal_quality": asset.signal_quality,
            "last_scan": asset.last_scan,
            "scan_count": asset.scan_count,
            "dir": asset.dir,
            "discovery_method": asset.discovery_method,
        }

    def get(self, pair_id: str) -> dict | None:
        return self._data.get("pools", {}).get(pair_id)

    def exists(self, pair_id: str) -> bool:
        return pair_id in self._data.get("pools", {})

    def is_terminal(self, pair_id: str) -> bool:
        entry = self.get(pair_id)
        if not entry:
            return False
        return entry.get("lifecycle_state", "").startswith("terminal_")

    def list_pending(self) -> list[str]:
        return [pid for pid, entry in self._data.get("pools", {}).items()
                if entry.get("status") == "pending"]

    @property
    def pending_count(self) -> int:
        return len(self.list_pending())

    @property
    def pools(self) -> dict:
        return self._data.get("pools", {})


# ── ArbScanSkill ────────────────────────────────────────

class ArbScanSkill:
    """全网池发现 + 信号富集 + 持久化

    对齐 WQ-YI CollectOps 接口。

    调用方式:
        skill = ArbScanSkill(ctx=ctx, config=config)
        outcome = await skill.run()
    """

    DISCOVERY_METHODS = ["trending", "new_pool"]

    def __init__(self, *, ctx: Any = None, config: dict | None = None):
        self._ctx = ctx
        self.config = config or {}

        # 共享数据层
        self._gecko = self.config.get("gecko_client") or GeckoTerminalClient()
        self._moralis = self.config.get("moralis_client")
        self._fusion = DataFusion(
            gecko_client=self._gecko,
            moralis_client=self._moralis,
        )
        self._thresholds = self.config.get("thresholds") or _load_default_thresholds()

        # Arb 发现配置
        disc = self._load_discovery_config()
        self._disc = disc
        self._min_tvl = disc.get("min_tvl_usd", 10_000)
        self._min_volume = disc.get("min_volume_24h_usd", 5_000)
        self._max_fee = disc.get("max_fee_bps", 100)
        self._max_pending = disc.get("max_pending", 50)

        qt = disc.get("quality_thresholds", {})
        self._strong_min_signals = qt.get("strong", {}).get("min_signals", 2)
        self._strong_min_score = qt.get("strong", {}).get("min_score", 70)
        self._moderate_min_signals = qt.get("moderate", {}).get("min_signals", 1)
        self._moderate_min_score = qt.get("moderate", {}).get("min_score", 40)

        # 输出路径
        output_root = self.config.get("output_root") or disc.get("output_root")
        self._output_root = Path(output_root) if output_root else _DEFAULT_OUTPUT_ROOT

        # 注册表
        self._registry = ArbPoolRegistry(self._output_root / "pool_registry.yml")

    def _load_discovery_config(self) -> dict:
        try:
            import yaml
            yml = _KNOWLEDGE_DIR / "scan_sources.yml"
            if yml.exists():
                with open(yml) as f:
                    data = yaml.safe_load(f) or {}
                return data.get("arb_discovery", {})
        except Exception:
            pass
        return {}

    # ── Phase 1: Pool Discovery ──────────────────────

    async def discover_pools(self) -> list[PoolAsset]:
        """Phase 1: 从 GeckoTerminal 发现候选池"""
        candidates: list[PoolAsset] = []
        seen: set[str] = set()
        now = _utcnow()

        # Strategy 1: Trending pools
        if self._is_strategy_enabled("trending"):
            limit = self._get_strategy_param("trending", "max_pools", 20)
            for asset in await self._discover_trending(limit, now):
                if asset.pool_address not in seen:
                    seen.add(asset.pool_address)
                    candidates.append(asset)

        # Strategy 2: New pools
        if self._is_strategy_enabled("new_pool"):
            limit = self._get_strategy_param("new_pool", "max_pools", 10)
            for asset in await self._discover_new(limit, now):
                if asset.pool_address not in seen:
                    seen.add(asset.pool_address)
                    candidates.append(asset)

        # 基础过滤（地址合法性）
        filtered = [a for a in candidates if a.pool_address and len(a.pool_address) >= 10]

        # 跳过已注册的终态池
        deduped = [a for a in filtered if not self._registry.is_terminal(a.pair_id)]

        logger.info("discover: %d raw → %d filtered → %d deduped",
                     len(candidates), len(filtered), len(deduped))
        return deduped

    async def _discover_trending(self, limit: int, now: str) -> list[PoolAsset]:
        try:
            trending = await self._gecko.get_trending_pools()
        except Exception as exc:
            logger.warning("trending discovery failed: %s", exc)
            return []
        return [a for p in trending[:limit] if (a := self._pool_to_asset(p, "trending", now))]

    async def _discover_new(self, limit: int, now: str) -> list[PoolAsset]:
        try:
            raw = await self._gecko._get("/networks/bsc/new_pools")
            pools = _parse_jsonapi_data(raw)
        except Exception as exc:
            logger.warning("new_pool discovery failed: %s", exc)
            return []
        return [a for p in pools[:limit] if (a := self._pool_to_asset(p, "new_pool", now))]

    def _pool_to_asset(self, pool: dict, method: str, now: str) -> PoolAsset | None:
        addr = pool.get("address", "")
        if not addr:
            return None
        name = pool.get("name", "")
        base, quote = self._parse_pair_name(name)
        pair_id = self._generate_pair_id(base, quote, addr)
        dex = pool.get("dex_id", "")
        if not dex and isinstance(pool.get("dex"), dict):
            dex = pool["dex"].get("identifier", "")
        return PoolAsset(
            pair_id=pair_id,
            pool_address=addr,
            dex=dex,
            base_token=base,
            quote_token=quote,
            discovered_at=now,
            discovery_method=method,
            dir=pair_id,
        )

    # ── Phase 2: Signal Enrichment ───────────────────

    async def enrich_pool(self, asset: PoolAsset) -> SignalPacket | None:
        """Phase 2: 拉取市场数据 + 信号检测 + 指标计算 + 质量评分

        Returns None if quality < moderate（不持久化弱信号）
        """
        now = _utcnow()

        # 2a: 完整市场数据
        try:
            merged = await self._fusion.fetch_merged(
                pool_address=asset.pool_address,
                token_address=asset.base_token_address or None,
            )
        except Exception as exc:
            logger.warning("enrich %s failed: %s", asset.pair_id, exc)
            return None

        pool_info = merged.get("pool_info", {})
        ohlcv = merged.get("ohlcv", [])

        # 2b: 最低门槛（有完整数据后）
        tvl = _safe_float(pool_info.get("reserve_in_usd"))
        vol24 = _safe_float(
            pool_info.get("volume_usd")
            or pool_info.get("volume_usd_24h")
            or pool_info.get("volume_usd_h24")
        )
        if tvl < self._min_tvl:
            logger.debug("skip %s: TVL $%.0f < $%.0f", asset.pair_id, tvl, self._min_tvl)
            return None
        if vol24 < self._min_volume:
            logger.debug("skip %s: vol24h $%.0f < $%.0f", asset.pair_id, vol24, self._min_volume)
            return None

        # 2c: 信号检测
        signals = await self._fusion.detect_signals(
            pool_address=asset.pool_address,
            token_address=asset.base_token_address or None,
            thresholds=self._thresholds,
        )

        # 2d: 技术指标
        ind_list = compute_all(ohlcv) if ohlcv else []
        latest_ind = ind_list[-1] if ind_list else None

        # 2e: 质量评分
        quality, score = self._score_quality(signals, latest_ind, tvl, vol24)
        if quality in ("none", "weak"):
            logger.debug("skip %s: quality=%s score=%d", asset.pair_id, quality, score)
            return None

        # 2f: 构建 SignalPacket
        snap_hash = hashlib.sha256(
            json.dumps(merged, default=str, sort_keys=True).encode()
        ).hexdigest()[:16]

        packet = SignalPacket(
            pair_id=asset.pair_id,
            source_evidence={
                "discovery_method": asset.discovery_method,
                "network": asset.network,
                "dex": asset.dex,
                "pool_address": asset.pool_address,
                "base_token": {"symbol": asset.base_token, "address": asset.base_token_address},
                "quote_token": {"symbol": asset.quote_token, "address": asset.quote_token_address},
                "raw_snapshot_hash": f"sha256:{snap_hash}",
            },
            market_data={
                "price_usd": _safe_float(pool_info.get("base_token_price_usd")),
                "tvl_usd": tvl,
                "volume_24h_usd": vol24,
                "fee_bps": _safe_int(pool_info.get("pool_fee"), 25),
                "ohlcv_summary": _summarize_ohlcv(ohlcv),
            },
            signals=[{
                "signal_type": s["type"],
                "strength": s["strength"],
                "source": s["source"],
                "details": s.get("details", {}),
            } for s in signals],
            indicators=_format_indicators(latest_ind),
            validation={
                "dual_source_met": (
                    merged["source_status"].get("gecko", False)
                    and merged["source_status"].get("moralis", False)
                ),
                "signal_count": len(signals),
                "min_tvl_met": tvl >= self._min_tvl,
                "min_volume_met": vol24 >= self._min_volume,
                "data_freshness_seconds": 0,
                "warnings": merged.get("warnings", []),
            },
            decision={
                "quality": quality,
                "score": score,
                "reasons": _build_reasons(signals, tvl, vol24),
            },
            execution_hints={
                "suggested_strategy": _suggest_strategy(signals),
                "urgency": "high" if quality == "strong" else "medium",
            },
        )

        # 更新 asset
        asset.signal_quality = quality
        asset.scan_count += 1
        asset.last_scan = now

        # 保存原始快照供 persist
        self._last_raw_snapshot = merged
        return packet

    def _score_quality(
        self, signals: list[dict], ind: IndicatorSnapshot | None,
        tvl: float, vol24: float,
    ) -> tuple[str, int]:
        """信号质量评分 → (quality_label, score_0_100)"""
        score = 0
        # 信号数量（每个 +15，上限 45）
        score += min(len(signals) * 15, 45)
        # 最强信号 strength（+0~30）
        if signals:
            mx = max(s.get("strength", 0) for s in signals)
            score += min(int(mx * 0.3), 30)
        # TVL（+0~15）
        if tvl >= 1_000_000:
            score += 15
        elif tvl >= 100_000:
            score += 10
        elif tvl >= 10_000:
            score += 5
        # Volume（+0~10）
        if vol24 >= 500_000:
            score += 10
        elif vol24 >= 50_000:
            score += 7
        elif vol24 >= 5_000:
            score += 3

        n = len(signals)
        if n >= self._strong_min_signals and score >= self._strong_min_score:
            return ("strong", score)
        if n >= self._moderate_min_signals and score >= self._moderate_min_score:
            return ("moderate", score)
        if signals:
            return ("weak", score)
        return ("none", score)

    # ── Phase 3: Persist ─────────────────────────────

    def persist_asset(
        self, asset: PoolAsset, packet: SignalPacket,
        raw_snapshot: dict | None = None,
    ) -> Path:
        """Phase 3: 持久化到 pending/{PAIR_ID}/"""
        import yaml

        asset_dir = self._output_root / "pending" / asset.pair_id
        asset_dir.mkdir(parents=True, exist_ok=True)

        # 1. signal_packet.yml
        with open(asset_dir / "signal_packet.yml", "w") as f:
            yaml.dump(asdict(packet), f, default_flow_style=False,
                      allow_unicode=True, sort_keys=False)

        # 2. pool_hints.yml
        hints = PoolHints(
            pair_id=asset.pair_id,
            pool_address=asset.pool_address,
            network=asset.network,
            dex=asset.dex,
            base_token=asset.base_token,
            quote_token=asset.quote_token,
            signal_quality=asset.signal_quality,
            top_signal=packet.signals[0]["signal_type"] if packet.signals else "",
            signal_strength=packet.signals[0]["strength"] if packet.signals else 0.0,
            tvl_usd=packet.market_data.get("tvl_usd", 0.0),
            volume_24h_usd=packet.market_data.get("volume_24h_usd", 0.0),
            discovered_at=asset.discovered_at,
        )
        with open(asset_dir / "pool_hints.yml", "w") as f:
            yaml.dump(asdict(hints), f, default_flow_style=False,
                      allow_unicode=True, sort_keys=False)

        # 3. raw_snapshot.json
        if raw_snapshot:
            with open(asset_dir / "raw_snapshot.json", "w") as f:
                json.dump(raw_snapshot, f, default=str, indent=2)

        # 4. 注册表
        self._registry.register(asset)
        self._registry.save()

        logger.info("persist: %s → %s", asset.pair_id, asset_dir)
        return asset_dir

    # ── 完整管线 ──────────────────────────────────────

    async def run(self) -> ScanOutcome:
        """三阶段完整管线: discover → enrich → persist"""
        now = _utcnow()
        outcome = ScanOutcome(run_id=f"scan-{now}", timestamp=now)

        try:
            # Phase 1
            candidates = await self.discover_pools()
            outcome.pools_discovered = len(candidates)
            if not candidates:
                outcome.status = "partial"
                outcome.reason_code = "no_candidates"
                return outcome

            # Phase 2 + 3
            for asset in candidates:
                if self._registry.pending_count >= self._max_pending:
                    logger.info("max pending (%d) reached, stopping", self._max_pending)
                    break

                self._last_raw_snapshot = None
                packet = await self.enrich_pool(asset)
                if packet is None:
                    outcome.pools_skipped += 1
                    continue

                outcome.pools_enriched += 1
                self.persist_asset(asset, packet, raw_snapshot=self._last_raw_snapshot)
                outcome.pools_persisted += 1

            if outcome.pools_persisted == 0:
                outcome.status = "partial"
                outcome.reason_code = "no_quality_signals"
            else:
                outcome.status = "success"
        except Exception as exc:
            logger.error("arb scan failed: %s", exc)
            outcome.status = "failed"
            outcome.reason_code = "scan_error"

        return outcome

    # ── Helpers ───────────────────────────────────────

    @staticmethod
    def _generate_pair_id(base: str, quote: str, address: str) -> str:
        """BASE_QUOTE_ADDR6 — 人类可读 + 地址前缀防碰撞"""
        b = (base or "UNK").upper().replace(" ", "")[:10]
        q = (quote or "UNK").upper().replace(" ", "")[:10]
        prefix = address[:6] if address else "000000"
        return f"{b}_{q}_{prefix}"

    @staticmethod
    def _parse_pair_name(name: str) -> tuple[str, str]:
        """'WBNB / USDT' → ('WBNB', 'USDT')"""
        if not name:
            return ("UNK", "UNK")
        for sep in (" / ", "/", " - ", "-"):
            if sep in name:
                parts = name.split(sep, 1)
                return (parts[0].strip(), parts[1].strip())
        return (name.strip(), "UNK")

    def _is_strategy_enabled(self, name: str) -> bool:
        for s in self._disc.get("strategies", []):
            if s.get("name") == name:
                return s.get("enabled", True)
        return True

    def _get_strategy_param(self, name: str, param: str, default: int) -> int:
        for s in self._disc.get("strategies", []):
            if s.get("name") == name:
                return s.get(param, default)
        return default

    @property
    def registry(self) -> ArbPoolRegistry:
        return self._registry


# ── 模块级工具函数 ──────────────────────────────────────

def _utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_int(v: Any, default: int = 0) -> int:
    if v is None:
        return default
    try:
        return int(v)
    except (ValueError, TypeError):
        return default


def _summarize_ohlcv(ohlcv: list[dict]) -> dict:
    if not ohlcv:
        return {}
    closes = [b.get("close", 0) for b in ohlcv if b.get("close")]
    highs = [b.get("high", 0) for b in ohlcv if b.get("high")]
    lows = [b.get("low", 0) for b in ohlcv if b.get("low")]
    return {
        "period": f"5m x {len(ohlcv)} bars",
        "high": max(highs) if highs else 0,
        "low": min(lows) if lows else 0,
        "close": closes[-1] if closes else 0,
        "bar_count": len(ohlcv),
    }


def _format_indicators(ind: IndicatorSnapshot | None) -> dict:
    if ind is None:
        return {}
    result: dict[str, float] = {}
    for attr, key in [
        ("rsi_14", "rsi_14"), ("ema_12", "ema_12"), ("ema_26", "ema_26"),
        ("vwap_val", "vwap"), ("bb_upper", "bollinger_upper"),
        ("bb_lower", "bollinger_lower"), ("bb_middle", "bollinger_middle"),
        ("macd_hist", "macd_histogram"), ("atr_14", "atr_14"),
    ]:
        val = getattr(ind, attr, None)
        if val is not None and not (isinstance(val, float) and math.isnan(val)):
            result[key] = round(val, 6)
    return result


def _build_reasons(signals: list[dict], tvl: float, vol: float) -> list[str]:
    reasons = []
    for s in signals:
        reasons.append(f"{s['type']} strength={s['strength']:.1f}")
    if tvl >= 1_000_000:
        reasons.append(f"TVL ${tvl / 1e6:.1f}M sufficient")
    elif tvl >= 10_000:
        reasons.append(f"TVL ${tvl / 1e3:.0f}K above minimum")
    if vol >= 100_000:
        reasons.append(f"Volume ${vol / 1e3:.0f}K healthy")
    return reasons


def _suggest_strategy(signals: list[dict]) -> str:
    if not signals:
        return "unknown"
    types = {s.get("type") or s.get("signal_type") for s in signals}
    if "price_divergence" in types:
        return "cross_pool_arbitrage"
    if "volume_spike" in types:
        return "volume_momentum"
    if "lp_imbalance" in types:
        return "lp_imbalance_arb"
    return "opportunistic"
