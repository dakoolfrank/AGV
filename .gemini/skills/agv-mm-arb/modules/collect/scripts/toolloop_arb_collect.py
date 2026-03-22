"""
Arb Collect Tool Loop — 全网池发现 + 信号富集 + 持久化

对齐 WQ-YI collect-papers 三阶段：
  Phase 1: Pool Discovery  → GeckoTerminal trending / new pools
  Phase 2: Signal Enrichment → OHLCV + indicators + cross-pool analysis
  Phase 3: Persist          → idea_packet.yml + asset_hints.yml + registry

产出目录（完全对齐 collect-papers pending/{ABBR}/）：
  {output_root}/
  ├── pending/{PAIR_ID}/
  │   ├── idea_packet.yml       ← 主证据包（= collect idea_packet.yml）
  │   ├── asset_hints.yml       ← 轻量提示（= collect asset_hints.yml）
  │   └── content.md            ← API 原始响应（= collect content.md）
  ├── abbreviations.yml         ← 全局注册表（= collect abbreviations.yml）
  └── archived/                 ← 终态池对

文件职责对齐（1 skill + 2 toolloop 模式）：
  skill_collect.py          ← 共享 skill（clients, fusion, thresholds）
  toolloop_mm_collect.py       ← MM toolloop（indicators, AMM math, CollectLoop）
  toolloop_arb_collect.py   ← Arb toolloop（本文件: discover → enrich → persist）

Phase 2 路线: GeckoTerminal + Moralis 做成 MCP 服务
"""
from __future__ import annotations

import asyncio
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
    from skill_collect import (
        GeckoTerminalClient,
        DexScreenerClient,
        MoralisClient,
        DataFusion,
        _safe_float,
        _make_signal,
        _load_default_thresholds,
        _parse_jsonapi_data,
        compute_onchain_factors,
        compute_lp_dynamics,
        compute_liquidity_depth,
    )
    from toolloop_mm_collect import (
        PoolState,
        DivergenceResult,
        IndicatorSnapshot,
        compute_all,
        scan_all_pairs,
        spread_zscore,
    )
except ImportError:
    from .skill_collect import (  # type: ignore[no-redef]
        GeckoTerminalClient,
        DexScreenerClient,
        MoralisClient,
        DataFusion,
        _safe_float,
        _make_signal,
        _load_default_thresholds,
        _parse_jsonapi_data,
        compute_onchain_factors,
        compute_lp_dynamics,
        compute_liquidity_depth,
    )
    from .toolloop_mm_collect import (  # type: ignore[no-redef]
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
_DEFAULT_OUTPUT_ROOT = _NEXRUR_ROOT / "docs" / "ai-skills" / "collect"
_DEFAULT_RUNS_ROOT = _NEXRUR_ROOT / "docs" / "ai-runs" / "collect"


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
    tvl_usd: float = 0.0                    # discover 阶段预填
    volume_24h_usd: float = 0.0             # discover 阶段预填


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
    # ── Flash+Pro LLM 判断层（对齐 WQ-YI IdeaPacket claims/theory_evidence/decision） ──
    llm_classification: dict = field(default_factory=dict)   # Flash 池分类
    llm_strategies: list[dict] = field(default_factory=list)  # 策略候选（含 Pro 仲裁）
    llm_risk_flags: list[str] = field(default_factory=list)
    llm_flash_raw: dict = field(default_factory=dict)        # Flash 原始输出
    llm_pro_final: dict = field(default_factory=dict)        # Pro 仲裁输出
    llm_verdict: str = ""                                     # 最终判定: strong/moderate/weak/reject
    llm_score: int = 0                                        # LLM 综合评分 0-100
    hypotheses: list[dict] = field(default_factory=list)      # 策略假设（对齐 WQ-YI claims）
    claims: list[dict] = field(default_factory=list)          # 可验证声明（curate gate 兼容）


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
    # ── LLM 判断层（对齐 WQ-YI AssetHints） ──
    asset_class: str = ""             # stablecoin_pair / blue_chip / ...
    liquidity_profile: str = ""       # deep / moderate / shallow / critical
    strategy_type: str = ""           # 最高置信策略
    strategy_confidence: float = 0.0  # 最高置信度
    llm_verdict: str = ""             # Flash+Pro 最终判定
    llm_score: int = 0                # LLM 综合评分


@dataclass
class CollectOutcome:
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


# ── Flash+Pro LLM 判断层 ────────────────────────────────

class CollectLLMJudge:
    """双层 LLM 评估器（对齐 WQ-YI CollectToolLoop 三阶段 Flash+Pro 模式）

    Phase A (Flash): 快速池分类 + 策略适配性评估
    Phase B (Pro):   仲裁 Flash 结果 + 参数建议（仅 score≥60 或 strong 时触发）

    LLMClient Protocol:
        generate_json(*, system_prompt, user_prompt, model, temperature, schema) -> dict
    PromptStore Protocol:
        get(name) -> str, has(name) -> bool
    """

    # Pro 触发阈值
    PRO_SCORE_THRESHOLD = 60    # Flash score ≥ 此值时触发 Pro
    PRO_SAMPLE_EVERY = 3        # 每 N 个池强制 Pro 抽检

    def __init__(
        self,
        *,
        llm_client: Any = None,
        prompt_store: Any = None,
        enable_pro: bool = True,
    ) -> None:
        self._llm = llm_client
        self._prompts = prompt_store
        self._enable_pro = enable_pro
        self._call_count = 0  # 用于 Pro 抽检计数

    @property
    def available(self) -> bool:
        """LLM + Prompt 都可用时才启用"""
        return self._llm is not None and self._prompts is not None

    def evaluate(
        self,
        asset: "PoolAsset",
        signals: list[dict],
        market_data: dict,
        indicators: dict,
        deterministic_quality: str,
        deterministic_score: int,
    ) -> dict:
        """双层 LLM 评估，返回可直接注入 SignalPacket 的字段集

        Returns:
            {
                "llm_classification": {...},
                "llm_strategies": [...],
                "llm_risk_flags": [...],
                "llm_flash_raw": {...},
                "llm_pro_final": {...},
                "llm_verdict": "strong|moderate|weak|reject",
                "llm_score": 0-100,
            }
        """
        if not self.available:
            return self._deterministic_fallback(
                asset, signals, market_data, deterministic_quality, deterministic_score,
            )

        self._call_count += 1

        # ── Phase A: Flash 快速分类 ──
        flash_result = self._run_flash(asset, signals, market_data, indicators)
        if flash_result is None:
            return self._empty_result()

        flash_score = flash_result.get("flash_score", 0)
        flash_verdict = flash_result.get("flash_verdict", "weak")

        # ── Phase B: Pro 仲裁（条件触发） ──
        pro_result: dict | None = None
        need_pro = self._should_trigger_pro(
            flash_score, flash_verdict, deterministic_score,
        )
        if need_pro and self._enable_pro:
            pro_result = self._run_pro(
                asset, signals, indicators, market_data, flash_result,
            )

        # ── 合并最终判定 ──
        return self._merge_results(flash_result, pro_result)

    def _should_trigger_pro(
        self, flash_score: int, flash_verdict: str, det_score: int,
    ) -> bool:
        """确定性 Pro 触发规则（零 LLM，对齐 WQ-YI L2 Pro 触发）"""
        # Rule 1: Flash score 达标
        if flash_score >= self.PRO_SCORE_THRESHOLD:
            return True
        # Rule 2: Flash verdict 为 strong
        if flash_verdict == "strong":
            return True
        # Rule 3: 确定性评分高但 Flash 评分低 → 分歧仲裁
        if det_score >= 70 and flash_score < 40:
            return True
        # Rule 4: 抽样审查
        if self._call_count % self.PRO_SAMPLE_EVERY == 0:
            return True
        return False

    def _run_flash(
        self,
        asset: "PoolAsset",
        signals: list[dict],
        market_data: dict,
        indicators: dict,
    ) -> dict | None:
        """Flash LLM 快速分类"""
        if not self._prompts or not self._prompts.has("scan_flash_classify_system"):
            return None

        ohlcv_summary = market_data.get("ohlcv_summary", {})
        ohlcv_text = json.dumps(ohlcv_summary, default=str) if ohlcv_summary else "(无数据)"

        system_prompt = self._prompts.get("scan_flash_classify_system")
        user_prompt = self._prompts.get("scan_flash_classify_user").format(
            pair_id=asset.pair_id,
            dex=asset.dex or "(未知)",
            base_token=asset.base_token,
            base_token_address=asset.base_token_address or "(未知)",
            quote_token=asset.quote_token,
            quote_token_address=asset.quote_token_address or "(未知)",
            discovery_method=asset.discovery_method,
            price_usd=market_data.get("price_usd", 0),
            tvl_usd=market_data.get("tvl_usd", 0),
            volume_24h_usd=market_data.get("volume_24h_usd", 0),
            fee_bps=market_data.get("fee_bps", 25),
            ohlcv_summary=ohlcv_text,
            signals_json=json.dumps(signals, default=str, indent=2),
            indicators_json=json.dumps(indicators, default=str, indent=2),
        )

        try:
            result = self._llm.generate_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2,
            )
            # 校验基本结构
            if not isinstance(result, dict) or "flash_verdict" not in result:
                logger.warning("flash: invalid response for %s", asset.pair_id)
                return None
            return result
        except Exception as exc:
            logger.warning("flash LLM failed for %s: %s", asset.pair_id, exc)
            return None

    def _run_pro(
        self,
        asset: "PoolAsset",
        signals: list[dict],
        indicators: dict,
        market_data: dict,
        flash_result: dict,
    ) -> dict | None:
        """Pro LLM 仲裁"""
        if not self._prompts or not self._prompts.has("scan_pro_arbitrate_system"):
            return None

        price_usd = market_data.get("price_usd", 0)
        ohlcv = market_data.get("ohlcv_summary", {})

        system_prompt = self._prompts.get("scan_pro_arbitrate_system")
        user_prompt = self._prompts.get("scan_pro_arbitrate_user").format(
            pair_id=asset.pair_id,
            dex=asset.dex or "(未知)",
            tvl_usd=market_data.get("tvl_usd", 0),
            volume_24h_usd=market_data.get("volume_24h_usd", 0),
            flash_result_json=json.dumps(flash_result, default=str, indent=2),
            signals_json=json.dumps(signals, default=str, indent=2),
            indicators_json=json.dumps(indicators, default=str, indent=2),
            price_valid="是" if price_usd and price_usd > 0 else "否",
            ohlcv_valid="是" if ohlcv else "否",
            dual_source="是",
        )

        try:
            result = self._llm.generate_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.0,
            )
            if not isinstance(result, dict) or "pro_verdict" not in result:
                logger.warning("pro: invalid response for %s", asset.pair_id)
                return None
            return result
        except Exception as exc:
            logger.warning("pro LLM failed for %s: %s", asset.pair_id, exc)
            return None

    def _merge_results(
        self, flash: dict, pro: dict | None,
    ) -> dict:
        """合并 Flash+Pro 结果（Pro 覆盖 Flash — 对齐 diagnosis.py 模式）"""
        classification = flash.get("pool_classification", {})
        strategies = flash.get("strategy_candidates", [])
        risk_flags = flash.get("risk_flags", [])
        verdict = flash.get("flash_verdict", "weak")
        score = flash.get("flash_score", 0)

        merged = {
            "llm_classification": classification,
            "llm_strategies": strategies,
            "llm_risk_flags": risk_flags,
            "llm_flash_raw": flash,
            "llm_pro_final": {},
            "llm_verdict": verdict,
            "llm_score": score,
        }

        if pro is not None:
            merged["llm_pro_final"] = pro

            # Pro 覆盖分类（如果不同意）
            if not pro.get("agree_classification", True):
                revised = pro.get("revised_classification")
                if isinstance(revised, dict):
                    merged["llm_classification"] = revised

            # Pro 覆盖策略列表（更详细，含 parameter_hints）
            pro_strategies = pro.get("strategy_verdict", [])
            if pro_strategies:
                merged["llm_strategies"] = pro_strategies

            # Pro verdict 覆盖 Flash verdict
            pro_verdict = pro.get("pro_verdict", "")
            if pro_verdict:
                merged["llm_verdict"] = pro_verdict

            pro_score = pro.get("pro_score", 0)
            if pro_score > 0:
                merged["llm_score"] = pro_score

        return merged

    def _deterministic_fallback(
        self,
        asset: "PoolAsset",
        signals: list[dict],
        market_data: dict,
        quality: str,
        score: int,
    ) -> dict:
        """LLM 不可用时的确定性分类（保证 asset_hints.yml 字段非空）"""
        tvl = market_data.get("tvl_usd", 0.0)
        vol = market_data.get("volume_24h_usd", 0.0)

        # asset_class — TVL + token 启发式
        base = (asset.base_token or "").upper()
        quote = (asset.quote_token or "").upper()
        stables = {"USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD"}
        if base in stables and quote in stables:
            asset_class = "stablecoin_pair"
        elif tvl >= 1_000_000:
            asset_class = "blue_chip"
        elif tvl >= 100_000:
            asset_class = "mid_cap"
        elif tvl >= 10_000:
            asset_class = "small_cap"
        else:
            asset_class = "micro_cap"

        # liquidity_profile — TVL 分层
        if tvl >= 1_000_000:
            liq = "deep"
        elif tvl >= 100_000:
            liq = "moderate"
        elif tvl >= 10_000:
            liq = "shallow"
        else:
            liq = "critical"

        # strategy — 复用 _suggest_strategy
        strategy = _suggest_strategy(signals)

        # risk_flags
        risk_flags: list[str] = []
        if tvl < 50_000:
            risk_flags.append("low_tvl")
        if vol < 10_000:
            risk_flags.append("low_volume")

        return {
            "llm_classification": {
                "asset_class": asset_class,
                "liquidity_profile": liq,
                "amm_type": asset.dex or "unknown",
                "activity_profile": "active" if vol > 50_000 else "low",
            },
            "llm_strategies": [{
                "strategy_type": strategy,
                "confidence": min(score / 100.0, 1.0),
                "source": "deterministic",
            }],
            "llm_risk_flags": risk_flags,
            "llm_flash_raw": {},
            "llm_pro_final": {},
            "llm_verdict": quality,
            "llm_score": score,
        }

    @staticmethod
    def _empty_result() -> dict:
        return {
            "llm_classification": {},
            "llm_strategies": [],
            "llm_risk_flags": [],
            "llm_flash_raw": {},
            "llm_pro_final": {},
            "llm_verdict": "",
            "llm_score": 0,
        }


# ── ArbCollectSkill ────────────────────────────────────────

class ArbCollectSkill:
    """全网池发现 + 信号富集 + 持久化

    对齐 WQ-YI CollectOps 接口。

    调用方式:
        skill = ArbCollectSkill(ctx=ctx, config=config)
        outcome = await skill.run()
    """

    DISCOVERY_METHODS = ["trending", "new_pool", "volume_ranked"]

    def __init__(self, *, ctx: Any = None, config: dict | None = None):
        self._ctx = ctx
        self.config = config or {}

        # 共享数据层
        self._gecko = self.config.get("gecko_client") or GeckoTerminalClient()
        self._moralis = self.config.get("moralis_client") or self._auto_moralis()
        self._dexscreener = self.config.get("dexscreener_client") or DexScreenerClient()
        self._fusion = DataFusion(
            gecko_client=self._gecko,
            moralis_client=self._moralis,
            dexscreener_client=self._dexscreener,
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

        # Quote token 过滤器（量化策略跨截面分析需要同一 quote）
        qt_filter = disc.get("quote_token_filter", {})
        self._quote_filter_enabled = qt_filter.get("enabled", False)
        self._allowed_quotes: set[str] = {
            a.lower() for a in qt_filter.get("allowed_quotes", [])
        }

        # 输出路径
        output_root = self.config.get("output_root") or disc.get("output_root")
        self._output_root = Path(output_root) if output_root else _DEFAULT_OUTPUT_ROOT

        # 注册表
        self._registry = ArbPoolRegistry(self._output_root / "abbreviations.yml")

        # Flash+Pro LLM 判断层
        self._llm_judge = CollectLLMJudge(
            llm_client=self.config.get("llm_client"),
            prompt_store=self.config.get("prompt_store"),
            enable_pro=self.config.get("enable_pro", True),
        )

    @staticmethod
    def _auto_moralis() -> MoralisClient | None:
        """自动从 .env.s5 加载 MORALIS_API_KEY 创建 MoralisClient"""
        agv_root = Path(__file__).resolve().parents[6]  # → /workspaces/AGV
        for env_name in (".env.s5", ".env"):
            env_file = agv_root / env_name
            if not env_file.exists():
                continue
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line.startswith("MORALIS_API_KEY=") and len(line) > 16:
                    key = line.split("=", 1)[1].strip()
                    if key:
                        logger.info("Moralis client initialized from %s", env_name)
                        return MoralisClient(api_key=key)
        # 最后尝试 os.environ
        import os
        key = os.environ.get("MORALIS_API_KEY", "")
        if key:
            logger.info("Moralis client initialized from os.environ")
            return MoralisClient(api_key=key)
        return None

    def _load_discovery_config(self) -> dict:
        try:
            import yaml
            yml = _KNOWLEDGE_DIR / "collect_sources.yml"
            if yml.exists():
                with open(yml) as f:
                    data = yaml.safe_load(f) or {}
                return data.get("arb_discovery", {})
        except Exception:
            pass
        return {}

    # ── Phase 1: Pool Discovery ──────────────────────

    async def discover_pools(self) -> list[PoolAsset]:
        """Phase 1: GeckoTerminal 全网发现"""
        candidates: list[PoolAsset] = []
        seen: set[str] = set()
        now = _utcnow()

        # Strategy 1: Volume-ranked pools（按 24h 交易量遍历全网）
        if self._is_strategy_enabled("volume_ranked"):
            max_pages = self._get_strategy_param("volume_ranked", "max_pages", 5)
            max_pools = self._get_strategy_param("volume_ranked", "max_pools", 100)
            delay = self._get_strategy_float("volume_ranked", "page_delay_sec", 1.0)
            for asset in await self._discover_volume_ranked(max_pages, max_pools, delay, now):
                if asset.pool_address not in seen:
                    seen.add(asset.pool_address)
                    candidates.append(asset)

        # Strategy 2: Trending pools
        if self._is_strategy_enabled("trending"):
            limit = self._get_strategy_param("trending", "max_pools", 20)
            for asset in await self._discover_trending(limit, now):
                if asset.pool_address not in seen:
                    seen.add(asset.pool_address)
                    candidates.append(asset)

        # Strategy 3: New pools
        if self._is_strategy_enabled("new_pool"):
            limit = self._get_strategy_param("new_pool", "max_pools", 10)
            for asset in await self._discover_new(limit, now):
                if asset.pool_address not in seen:
                    seen.add(asset.pool_address)
                    candidates.append(asset)

        # Strategy 4: DexScreener（Gecko 的补充/后备数据源）
        if self._is_strategy_enabled("dexscreener"):
            limit = self._get_strategy_param("dexscreener", "max_pools", 30)
            for asset in await self._discover_dexscreener(limit, now):
                if asset.pool_address not in seen:
                    seen.add(asset.pool_address)
                    candidates.append(asset)

        # 基础过滤（地址合法性）
        filtered = [a for a in candidates if a.pool_address and len(a.pool_address) >= 10]

        # Quote token 过滤
        if self._quote_filter_enabled:
            filtered = [a for a in filtered if self._matches_quote_filter(a)]

        # 跳过已注册的终态池
        deduped = [a for a in filtered if not self._registry.is_terminal(a.pair_id)]

        logger.info("discover: %d candidates → %d filtered → %d deduped",
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

    async def _discover_volume_ranked(
        self, max_pages: int, max_pools: int, delay: float, now: str,
    ) -> list[PoolAsset]:
        """按 24h 交易量降序遍历 BSC 池，返回符合 TVL/Volume 门槛的池。"""
        results: list[PoolAsset] = []
        for page in range(1, max_pages + 1):
            try:
                pools = await self._gecko.get_pools_by_volume(page=page)
            except Exception as exc:
                logger.warning("volume_ranked page %d failed: %s", page, exc)
                break
            if not pools:
                break
            for p in pools:
                asset = self._pool_to_asset(p, "volume_ranked", now)
                if asset is not None:
                    results.append(asset)
            if len(results) >= max_pools:
                results = results[:max_pools]
                break
            if page < max_pages:
                await asyncio.sleep(delay)
        logger.info("volume_ranked: %d pools from %d pages", len(results), min(page, max_pages))
        return results

    async def _discover_dexscreener(self, limit: int, now: str) -> list[PoolAsset]:
        """DexScreener 发现 — 通过 WBNB/USDT token 端点获取 BSC 热门池"""
        results: list[PoolAsset] = []
        seen_addr: set[str] = set()

        # 核心发现: 查询 BSC 主流 token 的所有交易对
        # WBNB 和 USDT 覆盖 BSC 上绝大多数活跃池
        _BSC_SEED_TOKENS = [
            "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",  # WBNB
            "0x55d398326f99059fF775485246999027B3197955",  # USDT
        ]
        for token_addr in _BSC_SEED_TOKENS:
            if len(results) >= limit:
                break
            try:
                pairs = await self._dexscreener.get_token_pairs(
                    token_address=token_addr,
                )
                for pair in pairs:
                    pool = self._dexscreener.normalize_pair_to_pool(pair)
                    addr = pool.get("address", "")
                    if addr and addr not in seen_addr:
                        seen_addr.add(addr)
                        asset = self._pool_to_asset(pool, "dexscreener", now)
                        if asset is not None:
                            results.append(asset)
                    if len(results) >= limit:
                        break
            except Exception as exc:
                logger.warning("dexscreener token %s failed: %s", token_addr[:10], exc)

        # 补充: boosted（热门推广池）
        if len(results) < limit:
            try:
                boosted = await self._dexscreener.get_top_boosted()
                for pair in boosted[:max(limit - len(results), 0)]:
                    pool = self._dexscreener.normalize_pair_to_pool(pair)
                    addr = pool.get("address", "")
                    if addr and addr not in seen_addr:
                        seen_addr.add(addr)
                        asset = self._pool_to_asset(pool, "dexscreener_boosted", now)
                        if asset is not None:
                            results.append(asset)
            except Exception as exc:
                logger.warning("dexscreener boosted discovery failed: %s", exc)
        logger.info("dexscreener: %d pools discovered", len(results))
        return results

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

        # 从 JSON:API relationships 提取 token 地址
        base_addr = pool.get("base_token_address", "")
        quote_addr = pool.get("quote_token_address", "")
        if not base_addr:
            rels = pool.get("relationships", {})
            base_id = rels.get("base_token", {}).get("data", {}).get("id", "")
            quote_id = rels.get("quote_token", {}).get("data", {}).get("id", "")
            # JSON:API id 格式: "bsc_0xAddress"
            if "_" in base_id:
                base_addr = base_id.split("_", 1)[1]
            if "_" in quote_id:
                quote_addr = quote_id.split("_", 1)[1]

        # 从 discover 原始数据提取 TVL/Volume
        raw_tvl = _safe_float(pool.get("reserve_in_usd"))
        # volume_usd 可能是 dict (含 h24) 或直接数值
        raw_vol = pool.get("volume_usd")
        if isinstance(raw_vol, dict):
            vol_24h = _safe_float(raw_vol.get("h24"))
        else:
            vol_24h = _safe_float(raw_vol)

        return PoolAsset(
            pair_id=pair_id,
            pool_address=addr,
            dex=dex,
            base_token=base,
            quote_token=quote,
            base_token_address=base_addr,
            quote_token_address=quote_addr,
            discovered_at=now,
            discovery_method=method,
            dir=pair_id,
            tvl_usd=raw_tvl,
            volume_24h_usd=vol_24h,
        )

    def _matches_quote_filter(self, asset: PoolAsset) -> bool:
        """检查池的 quote token 是否在允许列表中"""
        if not self._allowed_quotes:
            return True
        qt = asset.quote_token_address.lower()
        bt = asset.base_token_address.lower()
        # quote 或 base 中任一匹配即可（有些池 USDT 在 base 侧）
        return qt in self._allowed_quotes or bt in self._allowed_quotes

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
            logger.info("enrich %s failed: %s", asset.pair_id, exc)
            return None

        pool_info = merged.get("pool_info", {})
        ohlcv = merged.get("ohlcv", [])

        # Q6: 从 enriched pool_info 回填 dex（discover 阶段可能为空）
        if not asset.dex:
            _dex = pool_info.get("dex_id", "")
            if not _dex and isinstance(pool_info.get("dex"), dict):
                _dex = pool_info["dex"].get("identifier", "")
            # GeckoTerminal relationships.dex.data.id 格式如 "pancakeswap_v3"
            # _parse_jsonapi_single 已注入 dex_id 字段
            if not _dex:
                # 尝试从 pool name 推断 (如 "Uniswap V3: ...")
                _name = pool_info.get("name", "")
                if "pancake" in _name.lower():
                    _dex = "pancakeswap"
                elif "uniswap" in _name.lower():
                    _dex = "uniswap"
                elif "thena" in _name.lower():
                    _dex = "thena"
            if _dex:
                asset.dex = _dex

        # 2b: 最低门槛（种子池豁免 TVL/Volume 过滤）
        tvl = _safe_float(pool_info.get("reserve_in_usd")) or asset.tvl_usd
        vol24 = _safe_float(
            pool_info.get("volume_usd")
            or pool_info.get("volume_usd_24h")
            or pool_info.get("volume_usd_h24")
        ) or asset.volume_24h_usd
        if tvl < self._min_tvl:
            logger.debug("skip %s: TVL $%.0f < $%.0f", asset.pair_id, tvl, self._min_tvl)
            return None
        if vol24 < self._min_volume:
            logger.debug("skip %s: vol24h $%.0f < $%.0f", asset.pair_id, vol24, self._min_volume)
            return None

        # 2c: 信号检测（复用已获取的 merged，避免双倍 API 调用）
        signals = await self._fusion.detect_signals(
            pool_address=asset.pool_address,
            token_address=asset.base_token_address or None,
            thresholds=self._thresholds,
            merged=merged,
        )

        # 2d: 技术指标
        ind_list = compute_all(ohlcv) if ohlcv else []
        latest_ind = ind_list[-1] if ind_list else None

        # 2e: 因子计算（Step 2 — arb_factors.yml 全覆盖）
        base_price = _safe_float(pool_info.get("base_token_price_usd"))
        onchain = compute_onchain_factors(
            merged.get("transfers", []), base_price=base_price,
        )
        lp_dyn = compute_lp_dynamics(merged.get("pair_events", []))
        liq_depth = compute_liquidity_depth(pool_info)

        # 2f: 因子驱动的附加信号
        factor_signals = self._detect_factor_signals(
            onchain, lp_dyn, liq_depth, asset.pool_address,
        )
        signals.extend(factor_signals)

        # 2g: 质量评分（含因子维度）
        quality, score = self._score_quality(
            signals, latest_ind, tvl, vol24,
            onchain=onchain, lp_dyn=lp_dyn, liq_depth=liq_depth,
        )
        if quality in ("none", "weak"):
            logger.debug("skip %s: quality=%s score=%d", asset.pair_id, quality, score)
            return None

        # 2h: Flash+Pro LLM 判断（确定性评分已达标后追加 LLM 判断层）
        _market_data_for_llm = {
            "price_usd": _safe_float(pool_info.get("base_token_price_usd")),
            "tvl_usd": tvl,
            "volume_24h_usd": vol24,
            "fee_bps": _safe_int(pool_info.get("pool_fee"), 25),
            "ohlcv_summary": _summarize_ohlcv(ohlcv, pool_info),
        }
        _indicators_for_llm = _format_all_indicators(
            latest_ind, onchain=onchain, lp_dyn=lp_dyn, liq_depth=liq_depth,
        )
        _signals_for_llm = [{
            "signal_type": s["type"],
            "strength": s["strength"],
            "source": s["source"],
            "details": s.get("details", {}),
        } for s in signals]

        llm_result = self._llm_judge.evaluate(
            asset=asset,
            signals=_signals_for_llm,
            market_data=_market_data_for_llm,
            indicators=_indicators_for_llm,
            deterministic_quality=quality,
            deterministic_score=score,
        )

        # LLM reject → 降级为 None（不持久化）
        if llm_result.get("llm_verdict") == "reject":
            logger.info("skip %s: LLM verdict=reject", asset.pair_id)
            return None

        # 2i: 构建 SignalPacket
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
                "primary_excerpt": (
                    f"Pool {asset.pair_id} on {asset.network}/{asset.dex}. "
                    f"TVL: ${tvl:,.0f}, 24h Volume: ${vol24:,.0f}. "
                    + "; ".join(f"{s['type']}(str={s.get('strength', 0):.1f})" for s in signals[:5])
                ),
            },
            market_data={
                "price_usd": _safe_float(pool_info.get("base_token_price_usd")),
                "tvl_usd": tvl,
                "volume_24h_usd": vol24,
                "fee_bps": _safe_int(pool_info.get("pool_fee"), 25),
                "ohlcv_summary": _summarize_ohlcv(ohlcv, pool_info),
            },
            signals=[{
                "signal_type": s["type"],
                "strength": s["strength"],
                "source": s["source"],
                "details": s.get("details", {}),
            } for s in signals],
            indicators=_format_all_indicators(
                latest_ind, onchain=onchain, lp_dyn=lp_dyn, liq_depth=liq_depth,
            ),
            validation={
                "dual_source_met": (
                    (merged["source_status"].get("gecko", False)
                     or merged["source_status"].get("dexscreener", False))
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
                "status": "validated" if llm_result.get("llm_verdict") in ("strong", "moderate") else "weak",
                "reasons": _build_reasons(signals, tvl, vol24),
            },
            execution_hints=_build_execution_hints(signals, quality, llm_result),
            # Flash+Pro LLM 层
            llm_classification=llm_result.get("llm_classification", {}),
            llm_strategies=llm_result.get("llm_strategies", []),
            llm_risk_flags=llm_result.get("llm_risk_flags", []),
            llm_flash_raw=llm_result.get("llm_flash_raw", {}),
            llm_pro_final=llm_result.get("llm_pro_final", {}),
            llm_verdict=llm_result.get("llm_verdict", ""),
            llm_score=llm_result.get("llm_score", 0),
            hypotheses=(_hyps := _build_hypotheses(
                _signals_for_llm, _market_data_for_llm, _indicators_for_llm,
            )),
            claims=[{"claim_id": f"c{i+1}", "text": h["hypothesis"],
                     "strategy": h.get("strategy", ""), "confidence": h.get("confidence", 0)}
                    for i, h in enumerate(_hyps)],
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
        *,
        onchain: dict | None = None,
        lp_dyn: dict | None = None,
        liq_depth: dict | None = None,
    ) -> tuple[str, int]:
        """信号质量评分 → (quality_label, score_0_100)

        维度: 信号(45) + 强度(30) + TVL(10) + Volume(5) + 因子(10)
        """
        score = 0
        # 信号数量（每个 +10，上限 40）
        score += min(len(signals) * 10, 40)
        # 最强信号 strength（+0~25）
        if signals:
            mx = max(s.get("strength", 0) for s in signals)
            score += min(int(mx * 0.25), 25)
        # TVL（+0~10）
        if tvl >= 1_000_000:
            score += 10
        elif tvl >= 100_000:
            score += 7
        elif tvl >= 10_000:
            score += 4
        # Volume（+0~5）
        if vol24 >= 500_000:
            score += 5
        elif vol24 >= 50_000:
            score += 3
        elif vol24 >= 5_000:
            score += 2

        # 因子维度（+0~20）— 链上活跃度 + LP 健康度 + 深度
        factor_bonus = 0
        if onchain:
            if onchain.get("unique_wallets", 0) >= 5:
                factor_bonus += 5
            elif onchain.get("unique_wallets", 0) >= 2:
                factor_bonus += 2
            if onchain.get("tx_count", 0) >= 10:
                factor_bonus += 3
        if lp_dyn:
            if lp_dyn.get("net_flow_direction") == "inflow":
                factor_bonus += 4
            elif lp_dyn.get("net_flow_direction") == "outflow":
                factor_bonus -= 2  # penalty
        if liq_depth:
            if liq_depth.get("depth_2pct_usd", 0) >= 500:
                factor_bonus += 5
            elif liq_depth.get("depth_2pct_usd", 0) >= 100:
                factor_bonus += 2
            rr = liq_depth.get("reserve_ratio", 1.0)
            if rr < 0.5:
                factor_bonus += 3  # imbalanced = arb opportunity
        score += max(factor_bonus, 0)  # floor at 0

        n = len(signals)
        if n >= self._strong_min_signals and score >= self._strong_min_score:
            return ("strong", score)
        if n >= self._moderate_min_signals and score >= self._moderate_min_score:
            return ("moderate", score)
        if signals:
            return ("weak", score)
        return ("none", score)

    def _detect_factor_signals(
        self, onchain: dict, lp_dyn: dict, liq_depth: dict,
        pool_address: str,
    ) -> list[dict]:
        """因子驱动的附加信号生成"""
        signals: list[dict] = []
        now_ts = time.time()

        th = self._thresholds
        min_tx = th.get("onchain_activity_min_tx", 10)
        min_wallets = th.get("onchain_activity_min_wallets", 5)
        outflow_usd = th.get("lp_outflow_threshold_usd", 1000.0)

        # high_onchain_activity: 链上活跃（多钱包 + 多交易）
        if (onchain.get("tx_count", 0) >= min_tx
                and onchain.get("unique_wallets", 0) >= min_wallets):
            strength = min(
                (onchain["tx_count"] / min_tx) * 25
                + (onchain["unique_wallets"] / min_wallets) * 25,
                100.0,
            )
            signals.append(_make_signal(
                "high_onchain_activity", pool_address, now_ts,
                strength=strength, source="moralis",
                details={
                    "tx_count": onchain["tx_count"],
                    "unique_wallets": onchain["unique_wallets"],
                    "avg_trade_size_usd": onchain.get("avg_trade_size_usd", 0),
                },
            ))

        # lp_outflow: LP 资金外流（smart money 撤退信号）
        if (lp_dyn.get("net_flow_direction") == "outflow"
                and abs(lp_dyn.get("net_flow_usd", 0)) >= outflow_usd):
            strength = min(abs(lp_dyn["net_flow_usd"]) / outflow_usd * 20, 100.0)
            signals.append(_make_signal(
                "lp_outflow", pool_address, now_ts,
                strength=strength, source="moralis",
                details={
                    "net_flow_usd": lp_dyn["net_flow_usd"],
                    "add_count": lp_dyn.get("add_count", 0),
                    "remove_count": lp_dyn.get("remove_count", 0),
                },
            ))

        # shallow_depth: ±2% 深度不足（利于套利但风险高）
        depth = liq_depth.get("depth_2pct_usd", 0)
        reserve = liq_depth.get("reserve_usd_total", 0)
        if reserve > 0 and depth < 200:
            strength = max(0.0, min((200 - depth) / 200 * 80, 80.0))
            signals.append(_make_signal(
                "shallow_depth", pool_address, now_ts,
                strength=strength, source="computed",
                details={
                    "depth_2pct_usd": depth,
                    "reserve_ratio": liq_depth.get("reserve_ratio", 0),
                },
            ))

        return signals

    # ── Phase 3: Persist ─────────────────────────────

    def persist_asset(
        self, asset: PoolAsset, packet: SignalPacket,
        raw_snapshot: dict | None = None,
    ) -> Path:
        """Phase 3: 持久化到 pending/{PAIR_ID}/"""
        import yaml

        asset_dir = self._output_root / "pending" / asset.pair_id
        asset_dir.mkdir(parents=True, exist_ok=True)

        # 1. idea_packet.yml (对齐 collect-papers)
        with open(asset_dir / "idea_packet.yml", "w") as f:
            yaml.dump(asdict(packet), f, default_flow_style=False,
                      allow_unicode=True, sort_keys=False)

        # 2. asset_hints.yml (对齐 collect-papers)
        # 提取 LLM 层最高置信策略
        _best_strat_type = ""
        _best_strat_conf = 0.0
        for strat in (packet.llm_strategies or []):
            conf = strat.get("pro_confidence", strat.get("confidence", 0))
            if conf > _best_strat_conf:
                _best_strat_conf = conf
                _best_strat_type = strat.get("strategy_type", "")
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
            asset_class=packet.llm_classification.get("asset_class", ""),
            liquidity_profile=packet.llm_classification.get("liquidity_profile", ""),
            strategy_type=_best_strat_type or packet.execution_hints.get("suggested_strategy", ""),
            strategy_confidence=_best_strat_conf or min(packet.decision.get("score", 0) / 100.0, 1.0),
            llm_verdict=packet.llm_verdict or packet.decision.get("quality", ""),
            llm_score=packet.llm_score or packet.decision.get("score", 0),
        )
        with open(asset_dir / "asset_hints.yml", "w") as f:
            yaml.dump(asdict(hints), f, default_flow_style=False,
                      allow_unicode=True, sort_keys=False)

        # 3. content.md (对齐 collect-papers — 结构化 Markdown)
        if raw_snapshot:
            self._write_structured_content(
                asset_dir / "content.md", asset, packet, raw_snapshot,
            )

        # 4. 注册表
        self._registry.register(asset)
        self._registry.save()

        logger.info("persist: %s → %s", asset.pair_id, asset_dir)
        return asset_dir

    @staticmethod
    def _write_structured_content(
        path: Path, asset: PoolAsset, packet: SignalPacket,
        raw: dict,
    ) -> None:
        """生成结构化 content.md（人类可读 + 可折叠 raw JSON）"""
        pi = raw.get("pool_info", {})
        pcp = pi.get("price_change_percentage") or {}
        lines = [
            f"# {asset.pair_id}",
            "",
            f"> 发现方式: {asset.discovery_method} | 网络: {asset.network}"
            f" | DEX: {asset.dex or '(未知)'}",
            "",
            "## Pool Overview",
            "",
            "| 指标 | 值 |",
            "|------|-----|",
            f"| Pool Address | `{asset.pool_address}` |",
            f"| Base Token | {asset.base_token}"
            f" (`{asset.base_token_address or 'N/A'}`) |",
            f"| Quote Token | {asset.quote_token}"
            f" (`{asset.quote_token_address or 'N/A'}`) |",
            f"| TVL (USD) | ${packet.market_data.get('tvl_usd', 0):,.0f} |",
            f"| 24h Volume | ${packet.market_data.get('volume_24h_usd', 0):,.0f} |",
            f"| Price (USD) | ${packet.market_data.get('price_usd', 0):.6f} |",
            f"| Fee (bps) | {packet.market_data.get('fee_bps', 'N/A')} |",
            "",
            "## Price Changes",
            "",
            "| 时间窗口 | 变化率 |",
            "|----------|--------|",
        ]
        for k in ("m5", "m15", "m30", "h1", "h6", "h24"):
            v = pcp.get(k)
            if v is not None:
                lines.append(f"| {k} | {float(v):+.2f}% |")
        lines.append("")

        # Signals
        lines.append("## Top Signals")
        lines.append("")
        lines.append("| Signal | Strength | Source | Details |")
        lines.append("|--------|----------|--------|---------|")
        for sig in (packet.signals or [])[:10]:
            det = sig.get("details", {})
            det_str = ", ".join(f"{k}={v}" for k, v in det.items()) if det else "-"
            lines.append(
                f"| {sig.get('signal_type', '')} | {sig.get('strength', 0):.1f}"
                f" | {sig.get('source', '')} | {det_str} |"
            )
        lines.append("")

        # Hypotheses
        if packet.hypotheses:
            lines.append("## Hypotheses")
            lines.append("")
            for h in packet.hypotheses:
                lines.append(
                    f"- **{h.get('strategy', '')}**"
                    f" (confidence: {h.get('confidence', 0):.0%})"
                )
                lines.append(f"  {h.get('hypothesis', '')}")
            lines.append("")

        # Indicators
        if packet.indicators:
            lines.append("## Indicators")
            lines.append("")
            lines.append("| Indicator | Value |")
            lines.append("|-----------|-------|")
            for k, v in packet.indicators.items():
                lines.append(f"| {k} | {v} |")
            lines.append("")

        # Decision
        dec = packet.decision
        if dec:
            lines.append("## Decision")
            lines.append("")
            lines.append(
                f"- Quality: **{dec.get('quality', '')}**"
                f" (Score: {dec.get('score', 0)})"
            )
            for r in dec.get("reasons", []):
                lines.append(f"- {r}")
            lines.append("")

        # Raw snapshot (折叠)
        lines.append("<details><summary>Raw API Snapshot</summary>")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(raw, default=str, indent=2))
        lines.append("```")
        lines.append("</details>")

        with open(path, "w") as f:
            f.write("\n".join(lines) + "\n")

    # ── 完整管线 ──────────────────────────────────────

    async def run(self) -> CollectOutcome:
        """三阶段完整管线: discover → enrich → persist"""
        now = _utcnow()
        outcome = CollectOutcome(run_id=f"collect-{now}", timestamp=now)

        # enrich 限速：每次请求间隔（避免 429）
        enrich_delay = float(self._disc.get("enrich_delay_sec", 1.5))

        try:
            # Phase 1
            candidates = await self.discover_pools()
            outcome.pools_discovered = len(candidates)
            if not candidates:
                outcome.status = "partial"
                outcome.reason_code = "no_candidates"
                return outcome

            # Phase 1→2 间隔：等待 rate limit 窗口恢复
            if len(candidates) > 5:
                await asyncio.sleep(enrich_delay * 2)

            # Phase 2 + 3
            for idx, asset in enumerate(candidates):
                if self._registry.pending_count >= self._max_pending:
                    logger.info("max pending (%d) reached, stopping", self._max_pending)
                    break

                self._last_raw_snapshot = None
                packet = await self.enrich_pool(asset)
                if packet is None:
                    outcome.pools_skipped += 1
                else:
                    outcome.pools_enriched += 1
                    self.persist_asset(asset, packet, raw_snapshot=self._last_raw_snapshot)
                    outcome.pools_persisted += 1

                # 限速：非最后一个时等待
                if idx < len(candidates) - 1:
                    await asyncio.sleep(enrich_delay)

            if outcome.pools_persisted == 0:
                outcome.status = "partial"
                outcome.reason_code = "no_quality_signals"
            else:
                outcome.status = "success"
        except Exception as exc:
            logger.error("arb collect failed: %s", exc)
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

    def _get_strategy_float(self, name: str, param: str, default: float) -> float:
        for s in self._disc.get("strategies", []):
            if s.get("name") == name:
                return float(s.get(param, default))
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


def _summarize_ohlcv(ohlcv: list[dict], pool_info: dict | None = None) -> dict:
    if ohlcv:
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
    # Q5 fallback 链: price_change_percentage → volume_usd 时间窗 → 单字段
    if pool_info:
        # 1) price_change_percentage dict (GeckoTerminal / DexScreener 均可提供)
        pcp = pool_info.get("price_change_percentage") or {}
        if pcp and any(_safe_float(pcp.get(k)) for k in ("m5", "h1", "h6", "h24")):
            return {
                "period": "price_change_fallback",
                "price_change_m5": _safe_float(pcp.get("m5")),
                "price_change_h1": _safe_float(pcp.get("h1")),
                "price_change_h6": _safe_float(pcp.get("h6")),
                "price_change_h24": _safe_float(pcp.get("h24")),
                "bar_count": 0,
            }
        # 2) volume_usd 时间窗口 (GeckoTerminal pool attributes)
        vu = pool_info.get("volume_usd") or {}
        if isinstance(vu, dict) and any(_safe_float(vu.get(k)) for k in ("m5", "h1", "h6", "h24")):
            return {
                "period": "volume_window_fallback",
                "volume_m5": _safe_float(vu.get("m5")),
                "volume_h1": _safe_float(vu.get("h1")),
                "volume_h6": _safe_float(vu.get("h6")),
                "volume_h24": _safe_float(vu.get("h24")),
                "bar_count": 0,
            }
        # 3) 单字段兜底 (price_change_h24 / reserve / price)
        pch24 = _safe_float(pool_info.get("price_change_h24"))
        price = _safe_float(pool_info.get("base_token_price_usd"))
        tvl = _safe_float(pool_info.get("reserve_in_usd"))
        if pch24 or price or tvl:
            return {
                "period": "single_field_fallback",
                "price_change_h24": pch24,
                "price_usd": price,
                "tvl_usd": tvl,
                "bar_count": 0,
            }
    return {}


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


def _format_all_indicators(
    ind: IndicatorSnapshot | None, *,
    onchain: dict | None = None,
    lp_dyn: dict | None = None,
    liq_depth: dict | None = None,
) -> dict:
    """技术指标 + 因子指标合并输出"""
    result = _format_indicators(ind)

    # onchain_activity 因子
    if onchain:
        result["onchain_tx_count"] = onchain.get("tx_count", 0)
        result["onchain_unique_wallets"] = onchain.get("unique_wallets", 0)
        result["onchain_avg_trade_size_usd"] = onchain.get("avg_trade_size_usd", 0.0)

    # lp_dynamics 因子
    if lp_dyn:
        result["lp_add_count"] = lp_dyn.get("add_count", 0)
        result["lp_remove_count"] = lp_dyn.get("remove_count", 0)
        result["lp_net_flow_usd"] = lp_dyn.get("net_flow_usd", 0.0)
        result["lp_net_flow_direction"] = lp_dyn.get("net_flow_direction", "neutral")

    # liquidity depth 因子
    if liq_depth:
        result["reserve_ratio"] = liq_depth.get("reserve_ratio", 1.0)
        result["depth_2pct_usd"] = liq_depth.get("depth_2pct_usd", 0.0)

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


def _build_execution_hints(
    signals: list[dict],
    quality: str,
    llm_result: dict,
) -> dict:
    """构建执行提示 — 确定性策略 + LLM 策略双层融合"""
    det_strategy = _suggest_strategy(signals)
    urgency = "high" if quality == "strong" else "medium"

    hints: dict[str, Any] = {
        "suggested_strategy": det_strategy,
        "urgency": urgency,
    }

    # LLM 层覆盖（如果可用且置信度足够）
    llm_strategies = llm_result.get("llm_strategies", [])
    if llm_strategies:
        best = max(
            llm_strategies,
            key=lambda s: s.get("pro_confidence", s.get("confidence", 0)),
        )
        best_conf = best.get("pro_confidence", best.get("confidence", 0))
        if best_conf >= 0.5:
            hints["suggested_strategy"] = best.get("strategy_type", det_strategy)
            hints["strategy_source"] = "llm_pro" if best.get("pro_confidence") else "llm_flash"
        # 参数建议（仅 Pro 提供）
        param_hints = best.get("parameter_hints", {})
        if param_hints:
            hints["parameter_hints"] = param_hints
    else:
        hints["strategy_source"] = "deterministic"

    return hints


def _build_hypotheses(
    signals: list[dict], market_data: dict, indicators: dict,
) -> list[dict]:
    """从信号模式生成策略假设（对齐 WQ-YI claims 层）"""
    hypotheses: list[dict] = []
    signal_types = {s.get("signal_type") or s.get("type", "") for s in signals}
    tvl = market_data.get("tvl_usd", 0)

    if "price_divergence" in signal_types:
        hypotheses.append({
            "hypothesis": "跨池价差套利 — 同一 token 在不同 DEX/池存在价差",
            "strategy": "cross_pool_arbitrage",
            "confidence": 0.8 if tvl >= 100_000 else 0.5,
        })
    if "volume_spike" in signal_types:
        hypotheses.append({
            "hypothesis": "成交量异常放大 — 可能存在信息不对称或即将发生大额交易",
            "strategy": "volume_momentum",
            "confidence": 0.7,
        })
    if "lp_imbalance" in signal_types:
        hypotheses.append({
            "hypothesis": "LP 储备失衡 — 单边流动性偏移可能带来套利机会",
            "strategy": "lp_imbalance_arb",
            "confidence": 0.7 if tvl >= 50_000 else 0.4,
        })
    if "whale_movement" in signal_types:
        hypotheses.append({
            "hypothesis": "鲸鱼大额转账 — 可能引发短期价格波动或滑点套利机会",
            "strategy": "whale_follow",
            "confidence": 0.6,
        })
    if "high_onchain_activity" in signal_types:
        hypotheses.append({
            "hypothesis": "链上活跃度飙升 — 可能预示新资金流入或关注度上升",
            "strategy": "momentum_entry",
            "confidence": 0.5,
        })
    if "lp_outflow" in signal_types:
        hypotheses.append({
            "hypothesis": "LP 净流出 — 流动性收缩可能加剧滑点，短期波动率上升",
            "strategy": "volatility_capture",
            "confidence": 0.5,
        })
    if "shallow_depth" in signal_types:
        hypotheses.append({
            "hypothesis": "流动性深度不足 — 小额交易即可产生大滑点，存在夹层机会",
            "strategy": "depth_exploit",
            "confidence": 0.4,
        })
    # 通用假设（多信号共振但无特定模式匹配）
    if len(signals) >= 2 and not hypotheses:
        hypotheses.append({
            "hypothesis": "多信号共振 — 多个独立数据源同时触发，可视为机会性套利信号",
            "strategy": "opportunistic",
            "confidence": 0.4,
        })

    return hypotheses
