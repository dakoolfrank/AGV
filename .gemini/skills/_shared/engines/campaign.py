"""
CampaignRunner — S5 双 Campaign 循环编排器 (WQ-YI aligned)

与 WQ-YI CampaignRunner 对齐的架构：
- CampaignRunner 内部持有 Orchestrator (self.orch)
- Arb 模式: orch.run → 诊断回退 → orch.reset_from_step + orch.resume
- MM 模式: 简单心跳循环（无 Orchestrator 依赖）

设计要点:
- CampaignRunner 位于 Orchestrator **上方**
- 当 orchestrator 注入时走编排路径 (collect→execute 循环 + 诊断回退)
- 当 orchestrator 缺失时走心跳路径 (MM 单 cycle stub)
- 诊断驱动定向修复（确定性检测 → Flash → Pro）
- 预算硬限（日上限 + 亏损熔断 + 连续失败上限）

使用示例::

    # Arb-Campaign（因子驱动 — 注入 Orchestrator）
    orch = create_orchestrator(profile=S5_ARB_PROFILE, ops_registry=reg)
    runner = CampaignRunner(profile=S5_ARB_PROFILE, config=arb_config,
                            orchestrator=orch, diagnosis_engine=engine)
    result = runner.run(goal_config={"factor_combination": "volume_momentum"})

    # MM-Campaign（心跳模式 — 无 Orchestrator）
    runner = CampaignRunner(profile=S5_MM_PROFILE, config=mm_config)
    result = runner.run(goal_config={"pool_address": "0x..."})

参照: WQ-YI ``_shared/engines/campaign.py``（CampaignRunner + fail-pivot）
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from nexrur.engines.orchestrator import (
    Orchestrator,
    Checkpoint,
    TraceResult,
    TraceStatus,
    AssetRef,
)
from nexrur.engines.protocols import PipelineProfile

# Memory (MP7/MP8) — 可选导入，缺失时优雅降级
try:
    from nexrur.memory.pipeline import RAGPipeline, retrieve_lessons, distill_asset_lessons
    _HAS_MEMORY = True
except ImportError:
    _HAS_MEMORY = False

from .diagnosis import (
    DiagnosisEngine,
    HaltDecision,
    RepairDiagnosis,
    validate_diagnosis,
    LEVEL_TO_TARGET_STEP,
    DIAGNOSIS_REASON_CODES,
    _load_campaign_prompts,
)
from ..core.registry import campaign_finalize as _campaign_finalize

logger = logging.getLogger(__name__)


# ============================================================
# 常量（对标 WQ-YI LOOP_END_STEP / FINALIZE_STEPS）
# ============================================================

LOOP_END_STEP = "execute"
"""Arb 循环终止步骤 — 对标 WQ-YI 的 ``evaluate``"""

FINALIZE_STEPS = ["fix"]
"""循环外的最终化步骤 — 仅在 execute 成功后运行"""


# ============================================================
# 默认配置
# ============================================================

DEFAULT_MM_CONFIG: dict[str, Any] = {
    "max_cycles": None,              # 无限循环（心跳模式）
    "cycle_interval_seconds": 30,    # 心跳间隔
    "max_daily_usd": 5.0,           # 日 gas 预算
    "max_single_usd": 10.0,         # 单次操作上限
    "halt_on_exceed": True,
}

DEFAULT_ARB_CONFIG: dict[str, Any] = {
    "max_cycles": 100,               # 日内最大循环
    "cycle_interval_seconds": 60,    # 1 分钟循环
    "max_daily_usd": 500.0,         # 日交易量上限
    "max_single_usd": 50.0,         # 单笔上限
    "budget_halt_ratio": 0.5,       # 亏损 > 50% 日预算 → 暂停
    "max_consecutive_failures": 5,   # 连续失败上限
    "cooldown_minutes": 30,          # Level C 回退冷静期
    "max_inner_retries": 3,          # 单策略最大回退次数
}


# ============================================================
# Campaign 数据结构
# ============================================================

@dataclass
class CycleMetrics:
    """单个 cycle 的统计"""
    cycle_index: int
    pnl_usd: float = 0.0
    gas_cost_usd: float = 0.0
    trades_executed: int = 0
    trades_failed: int = 0
    retreat_level: str | None = None    # 本轮触发的回退级别


@dataclass
class CampaignState:
    """Campaign 运行状态"""
    current_cycle: int = 0
    cumulative_pnl_usd: float = 0.0
    cumulative_gas_usd: float = 0.0
    consecutive_failures: int = 0
    cycles: list[CycleMetrics] = field(default_factory=list)
    halts: list[HaltDecision] = field(default_factory=list)


@dataclass
class CampaignResult:
    """Campaign 完成后输出"""
    status: str                          # "completed" | "halted" | "budget_exhausted"
    total_cycles: int
    cumulative_pnl_usd: float
    cycles: list[CycleMetrics]
    halt: HaltDecision | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "total_cycles": self.total_cycles,
            "cumulative_pnl_usd": self.cumulative_pnl_usd,
            "halt": self.halt.to_dict() if self.halt else None,
        }


# ============================================================
# CampaignRunner (WQ-YI aligned — self.orch 模式)
# ============================================================

class CampaignRunner:
    """S5 双 Campaign 循环编排器

    架构对齐 WQ-YI CampaignRunner:
    - ``self.orch``: 内部持有的 Orchestrator 实例
    - Arb 模式 (orch 注入): orch.run → 诊断 → orch.reset_from_step + orch.resume
    - MM 模式 (无 orch): 简单心跳 stub（单 cycle 返回）
    """

    def __init__(
        self,
        *,
        profile: PipelineProfile,
        config: dict[str, Any] | None = None,
        diagnosis_engine: DiagnosisEngine | None = None,
        orchestrator: Orchestrator | None = None,
    ) -> None:
        self._profile = profile
        self._config = config or {}
        self._diagnosis = diagnosis_engine
        self._state = CampaignState()
        self.orch = orchestrator

    @property
    def state(self) -> CampaignState:
        return self._state

    # ────────────────────────────────────────────────────────
    # 公开入口
    # ────────────────────────────────────────────────────────

    def run(
        self,
        *,
        goal_config: dict[str, Any] | None = None,
        workspace: Path | None = None,
    ) -> CampaignResult:
        """执行 Campaign 循环

        dispatcher:
        - orch 存在 → ``_run_orchestrated`` (Arb 编排路径)
        - orch 缺失 → ``_run_heartbeat`` (MM 心跳路径)
        """
        if self.orch is not None:
            return self._run_orchestrated(goal_config=goal_config, workspace=workspace)
        return self._run_heartbeat(goal_config=goal_config)

    # ────────────────────────────────────────────────────────
    # Arb 编排路径 (WQ-YI aligned)
    # ────────────────────────────────────────────────────────

    def _run_orchestrated(
        self,
        *,
        goal_config: dict[str, Any] | None = None,
        workspace: Path | None = None,
    ) -> CampaignResult:
        """WQ-YI aligned 编排执行:

        每个 cycle = 一次完整 pipeline (collect→execute)。
        成功 → 进入下一 cycle（直到 max_cycles）。
        失败 → 诊断 → reset_from_step → resume（同一 cycle 内重试）。

        Returns 前自动调用 ``_archive_on_complete()`` 归档产物。
        """
        result = self._run_orchestrated_loop(
            goal_config=goal_config, workspace=workspace,
        )
        self._archive_on_complete(result, workspace)
        return result

    def _run_orchestrated_loop(
        self,
        *,
        goal_config: dict[str, Any] | None = None,
        workspace: Path | None = None,
    ) -> CampaignResult:
        """Orchestrated 主循环（内部实现，由 _run_orchestrated 包装）。"""
        merged = {**self._config, **(goal_config or {})}
        max_cycles = merged.get("max_cycles", 100)
        interval = merged.get("cycle_interval_seconds", 0)
        max_daily = merged.get("max_daily_usd", float("inf"))
        budget_halt_ratio = merged.get("budget_halt_ratio", 1.0)
        max_failures = merged.get("max_consecutive_failures", float("inf"))

        trace: TraceResult | None = None

        while True:
            self._state.current_cycle += 1
            cycle_idx = self._state.current_cycle

            # ── 预算检查 ──
            budget_result = self._check_budget(cycle_idx, max_daily, budget_halt_ratio)
            if budget_result is not None:
                return budget_result

            # ── 连续失败检查 ──
            if self._state.consecutive_failures >= max_failures:
                halt = HaltDecision(
                    reason="max_consecutive_failures",
                    strategy_id=merged.get("strategy_id", "unknown"),
                    message=f"连续失败 {self._state.consecutive_failures} 次",
                )
                return CampaignResult(
                    status="halted",
                    total_cycles=cycle_idx,
                    cumulative_pnl_usd=self._state.cumulative_pnl_usd,
                    cycles=self._state.cycles,
                    halt=halt,
                )

            # ── 最大 cycle 检查 ──
            if max_cycles is not None and cycle_idx > max_cycles:
                return CampaignResult(
                    status="completed",
                    total_cycles=cycle_idx - 1,
                    cumulative_pnl_usd=self._state.cumulative_pnl_usd,
                    cycles=self._state.cycles,
                )

            # ── 执行 cycle (通过 Orchestrator) ──
            if trace is None or trace.status == TraceStatus.COMPLETED:
                # 新 cycle: 全新 pipeline run
                trace = self.orch.run(
                    goal_config=merged,
                    end_step=LOOP_END_STEP,
                    skip_steps=FINALIZE_STEPS,
                )
            else:
                # 失败重试: 从上次 checkpoint resume
                if trace.checkpoint_path:
                    trace = self.orch.resume(
                        trace.checkpoint_path,
                        end_step=LOOP_END_STEP,
                    )
                else:
                    trace = self.orch.run(
                        goal_config=merged,
                        end_step=LOOP_END_STEP,
                        skip_steps=FINALIZE_STEPS,
                    )

            # ── 提取 metrics ──
            metrics = self._extract_metrics(trace, cycle_idx)
            self._state.cycles.append(metrics)
            self._state.cumulative_pnl_usd += metrics.pnl_usd
            self._state.cumulative_gas_usd += metrics.gas_cost_usd

            # ── 成功/失败处理 ──
            if trace.status == TraceStatus.FAILED:
                self._state.consecutive_failures += 1
                self._handle_failure(metrics, merged, trace)
                # 诊断停机检查
                if self._state.halts:
                    return CampaignResult(
                        status="halted",
                        total_cycles=cycle_idx,
                        cumulative_pnl_usd=self._state.cumulative_pnl_usd,
                        cycles=self._state.cycles,
                        halt=self._state.halts[-1],
                    )
            else:
                self._state.consecutive_failures = 0

            # ── 已达上限则立即返回，不再 sleep ──
            if max_cycles is not None and cycle_idx >= max_cycles:
                return CampaignResult(
                    status="completed",
                    total_cycles=cycle_idx,
                    cumulative_pnl_usd=self._state.cumulative_pnl_usd,
                    cycles=self._state.cycles,
                )

            # ── 心跳间隔 ──
            if interval > 0:
                time.sleep(interval)

        # unreachable — while True 由 return 退出

    # ────────────────────────────────────────────────────────
    # 归档 (WQ-YI aligned — campaign_finalize)
    # ────────────────────────────────────────────────────────

    def _archive_on_complete(
        self,
        result: CampaignResult,
        workspace: Path | None,
    ) -> None:
        """Campaign 结束后自动归档（对标 WQ-YI campaign_finalize）

        - completed + 有成功 execute → terminal_pass (不归档)
        - completed + 无成功 execute → terminal_exhausted (归档)
        - halted / budget_exhausted → 全部 terminal_exhausted (归档)

        **simulate 模式跳过归档** — simulate 仅模拟执行，不产生不可逆文件操作。
        """
        # ── simulate 模式安全门: 禁止归档生产数据 ──
        if self._config.get("simulate", False):
            logger.info("[archive] simulate 模式，跳过归档")
            return

        asset_root = getattr(self.orch, "asset_root", None) if self.orch else None
        if asset_root is None:
            asset_root = workspace
        if asset_root is None:
            logger.debug("[archive] 无 asset_root，跳过归档")
            return

        # 从 orchestrator 最新 trace 提取所有 pair_ids
        all_pairs: list[str] = []
        qualified_pairs: list[str] = []

        if self.orch and hasattr(self.orch, "_last_trace_result"):
            trace = self.orch._last_trace_result
            if trace:
                seen: set[str] = set()
                for asset in trace.final_assets:
                    if asset.id and asset.id not in seen:
                        seen.add(asset.id)
                        all_pairs.append(asset.id)
                    if asset.kind == "execution_result":
                        md = asset.metadata or {}
                        if md.get("success", 0) > 0:
                            qualified_pairs.append(asset.id)

        # fallback: 扫磁盘
        if not all_pairs:
            all_pairs = self._discover_pairs_on_disk(asset_root)

        if not all_pairs:
            logger.debug("[archive] 无 pairs 可归档")
            return

        trace_id = None
        if self.orch and hasattr(self.orch, "trace_id"):
            trace_id = self.orch.trace_id

        summary = _campaign_finalize(
            asset_root=asset_root,
            campaign_status=result.status,
            all_pairs=all_pairs,
            qualified_pairs=qualified_pairs,
            trace_id=trace_id,
        )

        archived_count = len(summary.get("archived", []))
        pass_count = len(summary.get("terminal_pass", []))
        logger.info(
            "[archive] campaign_finalize: pass=%d, exhausted=%d, archived=%d",
            pass_count, len(summary.get("terminal_exhausted", [])), archived_count,
        )

        # ── MP5: 经验蒸馏 — Campaign 终止时提炼可复用模式 ──
        self._distill_lessons(all_pairs, asset_root)

    @staticmethod
    def _discover_pairs_on_disk(asset_root: Path) -> list[str]:
        """从 collect/pending/ 扫描存活 pair 目录名"""
        pending = asset_root / ".docs/ai-skills/collect/pending"
        if not pending.is_dir():
            return []
        return sorted(
            d.name for d in pending.iterdir()
            if d.is_dir() and d.name != "__pycache__"
        )

    def _distill_lessons(
        self, all_pairs: list[str], asset_root: Path,
    ) -> None:
        """MP5: Campaign 终止时对每个 pair 提炼可复用经验

        对齐 WQ-YI campaign.py ``distill_asset_lessons()`` 写入路径。
        """
        if not _HAS_MEMORY:
            return

        policy = self._get_policy()
        if policy and not policy.get("memory_distill_enabled", step="defaults"):
            logger.debug("[MP5] memory_distill_enabled=false, 跳过蒸馏")
            return

        workspace = None
        if self.orch and hasattr(self.orch, "workspace"):
            workspace = self.orch.workspace
        if workspace is None:
            workspace = asset_root
        if workspace is None:
            return

        rag = self._get_rag_pipeline()
        distilled = 0
        for pair_id in all_pairs:
            try:
                lessons = distill_asset_lessons(
                    asset_id=pair_id,
                    workspace=workspace,
                    rag=rag,
                    policy=policy,
                )
                distilled += len(lessons)
            except Exception:
                logger.debug("[MP5] distill 失败: %s", pair_id, exc_info=True)

        if distilled:
            logger.info("[MP5] 蒸馏 %d 条 lessons (pairs=%d)", distilled, len(all_pairs))

    def _handle_failure(
        self,
        metrics: CycleMetrics,
        config: dict[str, Any],
        trace: TraceResult,
    ) -> None:
        """失败后诊断 + 回退 (就地修改 metrics.retreat_level)

        MP7/MP8: 诊断前注入记忆 — retrieve_lessons + tier-boosted RAG history
        """
        if self._diagnosis is None:
            return

        evidence = self._build_evidence(metrics, config)

        # ── MP7+MP8: 注入历史记忆到诊断证据 ──
        self._enrich_evidence_with_memory(evidence, config)

        diag = self._diagnosis.diagnose(
            evidence=evidence,
            strategy_id=config.get("strategy_id", "unknown"),
        )
        halt_reason = validate_diagnosis(diag)
        if halt_reason:
            halt = HaltDecision(
                reason=halt_reason,
                strategy_id=config.get("strategy_id", "unknown"),
                diagnosis=diag,
                message=f"诊断停机: {halt_reason}",
            )
            self._state.halts.append(halt)
            return  # 由上层循环检查 halts

        if diag is not None:
            metrics.retreat_level = diag.retreat_level
            logger.info(
                "[Campaign] 诊断回退: Level %s → %s (strategy=%s)",
                diag.retreat_level, diag.target_step, diag.strategy_id,
            )
            # Reset checkpoint — 下次循环 resume 时从 target_step 重跑
            if trace.checkpoint_path:
                cp = Checkpoint.load(Path(trace.checkpoint_path))
                self.orch.reset_from_step(
                    cp, diag.target_step, trace.checkpoint_path,
                )

    def _try_finalize(self, trace: TraceResult) -> None:
        """Phase 3: 运行 fix 步骤（可选 — FINALIZE_STEPS 中的步骤）"""
        if "fix" not in self._profile.step_order:
            return
        if not trace.checkpoint_path:
            return
        try:
            self.orch.resume(trace.checkpoint_path)
        except Exception:
            logger.warning("[Campaign] fix 步骤失败，跳过", exc_info=True)

    def _check_budget(
        self,
        cycle_idx: int,
        max_daily: float,
        budget_halt_ratio: float,
    ) -> CampaignResult | None:
        """预算检查 — 累计亏损超阈值则熔断"""
        threshold = max_daily * budget_halt_ratio
        if abs(self._state.cumulative_pnl_usd) > threshold:
            if self._state.cumulative_pnl_usd < 0:
                logger.warning(
                    "[Campaign] 亏损熔断: $%.1f > $%.1f (cycle=%d)",
                    abs(self._state.cumulative_pnl_usd),
                    threshold, cycle_idx,
                )
                return CampaignResult(
                    status="budget_exhausted",
                    total_cycles=cycle_idx,
                    cumulative_pnl_usd=self._state.cumulative_pnl_usd,
                    cycles=self._state.cycles,
                )
        return None

    # ────────────────────────────────────────────────────────
    # MM 心跳路径 (无 Orchestrator)
    # ────────────────────────────────────────────────────────

    def _run_heartbeat(
        self,
        *,
        goal_config: dict[str, Any] | None = None,
    ) -> CampaignResult:
        """MM 心跳模式 — 单 cycle stub（无 Orchestrator 依赖）"""
        self._state.current_cycle = 1
        m = CycleMetrics(cycle_index=1, trades_executed=1)
        self._state.cycles.append(m)
        return CampaignResult(
            status="completed",
            total_cycles=1,
            cumulative_pnl_usd=0.0,
            cycles=self._state.cycles,
        )

    # ────────────────────────────────────────────────────────
    # 内部工具方法
    # ────────────────────────────────────────────────────────

    @staticmethod
    def _extract_metrics(trace: TraceResult, cycle_idx: int) -> CycleMetrics:
        """从 Orchestrator TraceResult 提取 CycleMetrics"""
        if trace.status != TraceStatus.COMPLETED:
            return CycleMetrics(
                cycle_index=cycle_idx,
                trades_executed=0,
                trades_failed=1,
            )

        pnl = 0.0
        gas = 0.0
        executed = 0
        total = 0

        for asset in trace.final_assets:
            if asset.kind == "execution_result":
                md = asset.metadata
                for r in md.get("results", []):
                    pnl += r.get("profit_usd", 0)
                    gas += r.get("gas_usd", 0)
                ok = md.get("success", 0)
                executed += ok
                total += md.get("total", ok)

        return CycleMetrics(
            cycle_index=cycle_idx,
            pnl_usd=pnl,
            gas_cost_usd=gas,
            trades_executed=max(executed, 1),  # pipeline 完成 → 至少 1
            trades_failed=max(total - executed, 0),
        )

    @staticmethod
    def _build_evidence(
        metrics: CycleMetrics,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """构建诊断引擎消费的证据包"""
        return {
            "strategy_id": config.get("strategy_id", "unknown"),
            "pnl_usd": metrics.pnl_usd,
            "gas_cost_usd": metrics.gas_cost_usd,
            "consecutive_failures": 0,  # 由 CampaignRunner 状态补充
            "cumulative_loss_usd": 0,   # 由 CampaignRunner 状态补充
            "actual_slippage_pct": 0,
            "mev_detected": False,
            "pool_tvl_usd": config.get("pool_tvl_usd", float("inf")),
            "volume_24h_usd": config.get("volume_24h_usd", 0),
        }

    # ────────────────────────────────────────────────────────
    # MP7+MP8: 记忆增强 (WQ-YI aligned)
    # ────────────────────────────────────────────────────────

    def _enrich_evidence_with_memory(
        self,
        evidence: dict[str, Any],
        config: dict[str, Any],
    ) -> None:
        """注入 MP7 lessons + MP8 tier-boosted history 到证据包

        对齐 WQ-YI campaign.py ``_diagnose_with_evidence()`` 的记忆注入模式。
        依赖 policy.yml ``memory_read_enabled`` 总开关，缺失→跳过。
        """
        if not _HAS_MEMORY:
            return

        policy = self._get_policy()
        if not policy:
            return
        if not policy.get("memory_read_enabled", step="defaults"):
            return

        strategy_id = config.get("strategy_id", "unknown")
        rag = self._get_rag_pipeline()

        # ── MP7: retrieve_lessons — 历史经验提取 ──
        try:
            lesson_top_k = policy.get("memory_lesson_top_k", step="defaults") or 5
            lessons = retrieve_lessons(
                query=strategy_id,
                rag=rag,
                top_k=lesson_top_k,
                category="defi_diagnosis",
            )
            if lessons:
                evidence["memory_lessons"] = lessons
                logger.info("[MP7] 注入 %d 条 lessons (strategy=%s)", len(lessons), strategy_id)
            else:
                logger.debug("[MP7] 无匹配 lessons (strategy=%s)", strategy_id)
        except Exception:
            logger.debug("[MP7] retrieve_lessons 异常，跳过", exc_info=True)

        # ── MP8: tier-boosted RAG history — 历史诊断检索 ──
        if rag is None:
            return
        try:
            tier_boost_map = policy.get("memory_tier_boost", step="defaults") or {}
            retreat_level = evidence.get("retreat_level", "B")
            tier_boost = tier_boost_map.get(retreat_level, 1.0)
            history_top_k = policy.get("memory_history_top_k", step="defaults") or 3
            max_chars = policy.get("memory_history_max_chars", step="defaults") or 1500

            history = rag.retrieve(
                f"diagnosis {strategy_id} retreat failure",
                top_k=history_top_k,
                tier_boost=tier_boost,
            )
            if history:
                text = "\n".join(
                    getattr(h, "text", str(h))[:max_chars // max(len(history), 1)]
                    for h in history
                )
                evidence["memory_history"] = text
                logger.info("[MP8] 注入 %d 条 history (tier_boost=%.1f)", len(history), tier_boost)
            else:
                logger.debug("[MP8] 无匹配 history (strategy=%s)", strategy_id)
        except Exception:
            logger.debug("[MP8] RAG retrieve 异常，跳过", exc_info=True)

    def _get_policy(self):
        """获取 policy — 从 profile 或 orchestrator"""
        try:
            if self.orch and hasattr(self.orch, "_policy"):
                return self.orch._policy
            if hasattr(self._profile, "policy"):
                return self._profile.policy
        except Exception:
            pass
        return None

    def _get_rag_pipeline(self):
        """获取 RAGPipeline 实例 — 优先从 orchestrator ctx 获取"""
        if not _HAS_MEMORY:
            return None
        try:
            # 优先: 从 orchestrator 的 RunContext 获取已初始化的 RAG
            if self.orch and hasattr(self.orch, "_ctx"):
                ctx = self.orch._ctx
                if ctx and hasattr(ctx, "rag") and ctx.rag is not None:
                    return ctx.rag
            return None
        except Exception:
            logger.debug("[Memory] RAGPipeline 获取失败", exc_info=True)
            return None
