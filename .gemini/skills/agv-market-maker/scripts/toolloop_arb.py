"""
Arb-Campaign Tool Loop — 5 步管线 (DESIGN.md §3)

scan → curate → dataset → execute → fix

调用方式对齐 WQ-YI:
  WQ-YI 不使用 AgentOps。Skill 的调用方式是直接实例化类 + 调方法:
    KnowledgeBaseSkill(paper_dict, ctx=ctx).run()
    DatasetExplorerSkill(ctx=ctx).generate_all_L1(skeleton_file)
    DatasetExplorerSkill(ctx=ctx).bind_all_l2_for_skeleton(skel_id)
  AGV 的 curate/dataset 步骤直接调用 WQ-YI 的 Skill 类，不经过 AgentOps。

管线步骤:
  - scan:    modules/scan/ 子模块（自建 — GeckoTerminal + Moralis）
  - curate:  直接调 WQ-YI KnowledgeBaseSkill
  - dataset: 直接调 WQ-YI DatasetExplorerSkill (L1 + L2)
  - execute: 共享执行层（toolloop_mm.py 中的 DexExecutor）
  - fix:     三级回退诊断

AssetRef kind 映射（§3.7）:
  scan → market_signal → curate → arb_skeleton → dataset → arb_strategy
  → execute → execution_result → fix → fix_patch

三级回退（§3.6）:
  A: 参数调整 → execute（同策略重试，零 LLM）
  B: 因子切换 → curate（重新提取骨架，LLM 辅助）
  C: 策略重构 → scan（从头扫描，LLM 主导）
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# ── 三级回退（§3.6）──────────────────────────────────
RETREAT_LEVELS = {
    "A": {"target_step": "execute", "llm": False, "trigger": "param_drift"},
    "B": {"target_step": "curate",  "llm": True,  "trigger": "factor_exhausted"},
    "C": {"target_step": "scan",    "llm": True,  "trigger": "structural_change"},
}


# ── 轻量 AssetRef（§3.7 kind 枚举）─────────────────
@dataclass
class SignalRef:
    """scan 产出 — 市场信号"""
    sig_id: str
    signal_type: str          # price_divergence / volume_spike / lp_imbalance / ...
    strength: float = 0.0
    source: str = "gecko"
    pool_address: str = ""
    timestamp: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    @property
    def is_fresh(self) -> bool:
        """信号有效期 2min（§3.5 signal_freshness）"""
        return (time.time() - self.timestamp) < 120.0


@dataclass
class StrategyRef:
    """dataset 产出 — 可执行策略"""
    strategy_id: str
    strategy_type: str        # cross_pool_arbitrage / volume_momentum / lp_imbalance_arb
    signal: SignalRef | None = None
    entry: dict = field(default_factory=dict)
    sizing: dict = field(default_factory=dict)
    exit_rules: dict = field(default_factory=dict)
    confidence: float = 0.0
    metadata: dict = field(default_factory=dict)


# ── DiagnosisProfile（§3.6 + §7.3）─────────────────
@dataclass
class DiagnosisProfile:
    """Arb-Campaign 诊断配置"""
    max_consecutive_failures: int = 5
    budget_halt_threshold: float = 0.5    # 亏损 > 50% 日预算 → 暂停
    cooldown_minutes: int = 30            # C 级回退后冷静期
    max_level_a_retries: int = 3          # A 级最大重试（超过升级到 B）


class ArbCampaignLoop:
    """Arb-Campaign 5 步管线循环（§3）"""

    STEPS = ["scan", "curate", "dataset", "execute", "fix"]

    def __init__(
        self,
        *,
        config: dict | None = None,
        executor: Any = None,
        budget: Any = None,
        preauth: Any = None,
        notify: Any = None,
        diagnosis: DiagnosisProfile | None = None,
    ):
        self.config = config or {}
        self._executor = executor
        self._budget = budget
        self._preauth = preauth
        self._notify = notify
        self._diagnosis = diagnosis or DiagnosisProfile()
        # 运行状态
        self._running = False
        self._cycle_count = 0
        self._consecutive_failures = 0
        self._current_retreat_level: str | None = None
        self._cooldown_until: float = 0.0

    # ── Step 1: scan ─────────────────────────────────
    async def _step_scan(self) -> list[SignalRef]:
        """市场信号扫描 — modules/scan/ (Arb 版)

        使用 ArbScanSkill 三阶段管线:
          discover → enrich → persist → 读 registry → 转 SignalRef
        """
        import sys
        from pathlib import Path
        scan_dir = Path(__file__).resolve().parent.parent / "modules" / "scan" / "scripts"
        if str(scan_dir) not in sys.path:
            sys.path.insert(0, str(scan_dir))
        from toolloop_arb_scan import ArbScanSkill

        skill = ArbScanSkill(config=self.config.get("scan", {}))
        outcome = await skill.run()

        # 从 registry 读取已持久化的 pending 池对 → 转 SignalRef
        signals = []
        for pair_id in skill.registry.list_pending():
            entry = skill.registry.get(pair_id) or {}
            signals.append(SignalRef(
                sig_id=pair_id,
                signal_type="pool_discovery",
                strength=0.0,
                source="arb_scan",
                pool_address=entry.get("pool_address", ""),
                metadata={"discovery_method": entry.get("discovery_method", ""), **entry},
            ))

        logger.info("scan: %d persisted (discovered=%d, enriched=%d, skipped=%d)",
                     len(signals), outcome.pools_discovered,
                     outcome.pools_enriched, outcome.pools_skipped)
        return signals

    # ── Step 2: curate ───────────────────────────────
    async def _step_curate(self, signals: list[SignalRef]) -> list[dict]:
        """指标提取 — modules/scan/（v1.2: curate 计算层已合并到 scan）

        Phase 2: 此步将由 WQ-YI brain-curate-knowledge agent-ops 接管。
        当前使用 scan 模块内合并的 CurateArbSkill。
        """
        import sys as _sys
        from pathlib import Path as _Path
        scan_dir = _Path(__file__).resolve().parent.parent / "modules" / "scan" / "scripts"
        if str(scan_dir) not in _sys.path:
            _sys.path.insert(0, str(scan_dir))
        from skill_scan import CurateArbSkill

        # 将 SignalRef 转为 scan_outputs 格式
        scan_outputs = []
        for sig in signals:
            scan_outputs.append({
                "pool_address": sig.pool_address,
                "price_usd": sig.metadata.get("price_usd", 0),
                "tvl": sig.metadata.get("tvl", 0),
                "volume_24h": sig.metadata.get("volume_24h", 0),
                "fee_bps": sig.metadata.get("fee_bps", 25),
                "ohlcv_5m": sig.metadata.get("ohlcv_5m", []),
            })

        skill = CurateArbSkill()
        curated_context = skill.run(scan_outputs)
        self._curated_context = curated_context  # 供 step_dataset 使用

        # 向后兼容：转为 skeletons 列表
        skeletons = []
        for pool in curated_context.pools:
            skeletons.append({
                "id": f"skel-{pool.address[:8]}",
                "type": "curated_pool",
                "pool": pool,
            })
        logger.info("curate: %d pools curated from %d signals", len(curated_context.pools), len(signals))
        return skeletons

    # ── Step 3: dataset ──────────────────────────────
    async def _step_dataset(self, skeletons: list[dict]) -> list[StrategyRef]:
        """信号打分 + 交易计划 — WQ-YI brain-dataset-explorer

        v1.2: L1(信号打分) + L2(交易计划+风控) 已迁移到 WQ-YI:
          - toolloop_arb_l1.py (SignalScorer)
          - toolloop_arb_l2.py (TradePlanner + RiskSizer)

        Phase 2: 此步将由 WQ-YI brain-dataset-explorer agent-ops 接管。
        当前使用本地 stub 直接调用迁移后的类。
        """
        curated_context = getattr(self, "_curated_context", None)
        if curated_context is None:
            logger.warning("dataset: no curated_context, skipped")
            return []

        # 本地 stub: 直接导入 WQ-YI 迁移后的 L1/L2
        try:
            import sys as _sys
            from pathlib import Path as _Path
            wqyi_scripts = _Path(__file__).resolve().parents[4] / "WQ-YI" / ".gemini" / "skills" / "brain-dataset-explorer" / "scripts"
            if str(wqyi_scripts) not in _sys.path:
                _sys.path.insert(0, str(wqyi_scripts))
            from toolloop_arb_l1 import SignalScorer
            from toolloop_arb_l2 import TradePlanner
        except ImportError:
            logger.warning("dataset: WQ-YI L1/L2 not available, returning empty")
            return []

        # L1: 信号打分
        scorer = SignalScorer()
        scored = scorer.score_all(curated_context)

        # L2: 交易计划
        planner = TradePlanner()
        plans = planner.plan_all(scored, curated_context)

        # 转为 StrategyRef（向后兼容 execute 步骤）
        strategies = []
        for plan in plans:
            strategies.append(StrategyRef(
                strategy_id=plan.plan_id,
                strategy_type=plan.strategy_type,
                signal=None,
                confidence=plan.confidence,
                entry={"direction": plan.direction, "amount_usd": plan.amount_in_usd},
                sizing={"amount_in_usd": plan.amount_in_usd, "gas_usd": plan.gas_estimate_usd},
                exit_rules={"condition": plan.exit_condition, "ttl": plan.ttl_seconds},
                metadata={"trade_plan": plan},
            ))
        logger.info("dataset: %d strategies from curated context", len(strategies))
        return strategies

    # ── Step 4: execute ──────────────────────────────
    async def _step_execute(self, strategies: list[StrategyRef]) -> list[dict]:
        """实盘执行 — DexExecutor（§3.5）"""
        results = []
        for strategy in strategies:
            pre = await self.pre_flight(strategy)
            if not pre["passed"]:
                results.append({
                    "strategy_id": strategy.strategy_id,
                    "status": "blocked",
                    "reason": pre["reason"],
                })
                continue
            # Phase 2: tx_result = await self._executor.swap(...)
            results.append({
                "strategy_id": strategy.strategy_id,
                "status": "pending_execution",
                "reason": "DexExecutor chain interaction: Phase 2",
            })
        logger.info("execute: %d results", len(results))
        return results

    # ── Step 5: fix ──────────────────────────────────
    async def _step_fix(self, results: list[dict]) -> str | None:
        """策略修复 — 三级回退诊断（§3.6）

        Returns:
            回退目标步骤名（scan/curate/execute），或 None（无需修复）
        """
        failures = [r for r in results if r.get("status") not in ("executed", "pending_execution")]
        if not failures:
            self._consecutive_failures = 0
            self._current_retreat_level = None
            return None

        self._consecutive_failures += 1

        # 判定回退级别
        if self._consecutive_failures <= self._diagnosis.max_level_a_retries:
            level = "A"
        elif self._consecutive_failures <= self._diagnosis.max_consecutive_failures:
            level = "B"
        else:
            level = "C"

        self._current_retreat_level = level
        retreat = RETREAT_LEVELS[level]
        target = retreat["target_step"]

        logger.warning(
            "fix: level %s retreat → %s (consecutive=%d, trigger=%s)",
            level, target, self._consecutive_failures, retreat["trigger"],
        )

        # C 级回退 → 冷静期
        if level == "C":
            self._cooldown_until = time.monotonic() + self._diagnosis.cooldown_minutes * 60
            logger.warning("fix: C-level cooldown for %d minutes", self._diagnosis.cooldown_minutes)

        return target

    # ── 前置检查（§3.5 pre_flight）───────────────────
    async def pre_flight(self, strategy: Any) -> dict:
        """确定性前置检查 — 零 LLM，5 项门控"""
        reasons = []

        # 1. 预算检查
        if self._budget:
            ok, reason = self._budget.can_trade()
            if not ok:
                reasons.append(reason)

        # 2. 信号新鲜度 (< 2min)
        sig = getattr(strategy, "signal", None)
        if sig and hasattr(sig, "is_fresh") and not sig.is_fresh:
            reasons.append("signal_stale")

        # 3. 置信度阈值 (≥ 0.85)
        confidence = getattr(strategy, "confidence", 0.0)
        if confidence < 0.85:
            reasons.append(f"low_confidence ({confidence:.2f} < 0.85)")

        # 4. 池深度检查（需 preauth + executor）
        if self._preauth and hasattr(strategy, "signal"):
            pool = getattr(strategy.signal, "pool_address", "")
            if pool and not self._preauth.is_pool_approved(pool):
                reasons.append(f"pool_not_approved ({pool[:10]}...)")

        # 5. 冷静期检查
        if time.monotonic() < self._cooldown_until:
            remaining = self._cooldown_until - time.monotonic()
            reasons.append(f"cooldown_active ({remaining:.0f}s remaining)")

        if reasons:
            return {"passed": False, "reason": "; ".join(reasons)}
        return {"passed": True, "reason": None}

    # ── 单次循环 ─────────────────────────────────────
    async def run_cycle(self, *, start_step: str | None = None) -> dict:
        """单次 5 步循环（支持回退重入）

        Args:
            start_step: 回退时从此步开始（默认 scan）
        """
        self._cycle_count += 1
        start = start_step or "scan"
        start_idx = self.STEPS.index(start) if start in self.STEPS else 0

        signals: list[SignalRef] = []
        skeletons: list[dict] = []
        strategies: list[StrategyRef] = []
        results: list[dict] = []
        retreat_target: str | None = None

        for step_name in self.STEPS[start_idx:]:
            try:
                if step_name == "scan":
                    signals = await self._step_scan()
                    if not signals:
                        return {"cycle": self._cycle_count, "outcome": "no_signals"}
                elif step_name == "curate":
                    skeletons = await self._step_curate(signals)
                    if not skeletons:
                        return {"cycle": self._cycle_count, "outcome": "no_skeletons"}
                elif step_name == "dataset":
                    strategies = await self._step_dataset(skeletons)
                    if not strategies:
                        return {"cycle": self._cycle_count, "outcome": "no_strategies"}
                elif step_name == "execute":
                    results = await self._step_execute(strategies)
                elif step_name == "fix":
                    retreat_target = await self._step_fix(results)
            except Exception as exc:
                logger.error("step %s failed: %s", step_name, exc)
                return {
                    "cycle": self._cycle_count,
                    "outcome": "step_error",
                    "failed_step": step_name,
                    "error": str(exc),
                }

        return {
            "cycle": self._cycle_count,
            "outcome": "completed",
            "signals": len(signals),
            "skeletons": len(skeletons),
            "strategies": len(strategies),
            "results": len(results),
            "retreat_target": retreat_target,
        }

    # ── Campaign 主循环 ──────────────────────────────
    async def run_campaign(self, *, max_cycles: int = 100):
        """Campaign 主循环 — 包含预算检查 + 回退重入 + 诊断"""
        import asyncio

        self._running = True
        retreat_from: str | None = None
        interval = self.config.get("cycle_interval_seconds", 60)

        try:
            while self._running and self._cycle_count < max_cycles:
                # 冷静期
                if time.monotonic() < self._cooldown_until:
                    wait = self._cooldown_until - time.monotonic()
                    logger.info("campaign: cooldown %.0fs remaining", wait)
                    await asyncio.sleep(min(wait, interval))
                    continue

                # 预算检查
                if self._budget:
                    ok, reason = self._budget.can_trade()
                    if not ok:
                        logger.warning("campaign: budget blocked — %s", reason)
                        break

                # 执行循环（支持回退重入）
                result = await self.run_cycle(start_step=retreat_from)
                retreat_from = result.get("retreat_target")

                logger.info(
                    "campaign: cycle %d → %s (retreat=%s)",
                    self._cycle_count, result["outcome"], retreat_from,
                )

                # 诊断升级
                if (self._consecutive_failures
                        >= self._diagnosis.max_consecutive_failures
                        and self._current_retreat_level != "C"):
                    logger.error("campaign: max failures reached, halting")
                    break

                await asyncio.sleep(interval)
        finally:
            self._running = False
            logger.info("campaign: stopped after %d cycles", self._cycle_count)

    def stop(self):
        """优雅停止"""
        self._running = False
