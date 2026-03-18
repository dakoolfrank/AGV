"""
CampaignRunner — S5 双 Campaign 循环编排器

将 S5 的 AgentOps 包装在自动回退循环中：
- MM-Campaign: 心跳模式（30s 无限循环，零 LLM）
- Arb-Campaign: 因子驱动（有限 cycle，LLM 辅助诊断，三级回退）

设计要点:
- CampaignRunner 位于 Orchestrator **上方**
- 诊断驱动定向修复（确定性检测 → Flash → Pro）
- 预算硬限（日上限 + 单笔上限 + 亏损熔断）
- trace_id 通过 S2 lineage 关联回主干

使用示例::

    # MM-Campaign（心跳模式）
    runner = CampaignRunner(profile=S5_MM_PROFILE, config=mm_config)
    result = runner.run(goal_config={"pool_address": "0x..."})

    # Arb-Campaign（因子驱动）
    runner = CampaignRunner(profile=S5_ARB_PROFILE, config=arb_config)
    result = runner.run(goal_config={"factor_combination": "volume_momentum"})

参照: WQ-YI ``_shared/engines/campaign.py``（CampaignRunner + fail-pivot）
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from nexrur.engines.protocols import PipelineProfile

from .diagnosis import (
    DiagnosisEngine,
    HaltDecision,
    RepairDiagnosis,
    validate_diagnosis,
    LEVEL_TO_TARGET_STEP,
    DIAGNOSIS_REASON_CODES,
    _load_campaign_prompts,
)

logger = logging.getLogger(__name__)


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
# CampaignRunner
# ============================================================

class CampaignRunner:
    """S5 双 Campaign 循环编排器

    模式适配:
    - MM-Campaign (max_cycles=None): 无限心跳循环，step_fn 是确定性操作
    - Arb-Campaign (max_cycles=N): 有限因子套利循环，支持三级回退诊断
    """

    def __init__(
        self,
        *,
        profile: PipelineProfile,
        config: dict[str, Any] | None = None,
        diagnosis_engine: DiagnosisEngine | None = None,
    ) -> None:
        self._profile = profile
        self._config = config or {}
        self._diagnosis = diagnosis_engine
        self._state = CampaignState()

    @property
    def state(self) -> CampaignState:
        return self._state

    def run(
        self,
        *,
        step_fn: Any = None,
        goal_config: dict[str, Any] | None = None,
    ) -> CampaignResult:
        """执行 Campaign 循环

        Args:
            step_fn: 单次 cycle 的执行函数。
                签名: (cycle_index: int, config: dict) -> CycleMetrics
                若为 None，使用内置 stub（demo 用）。
            goal_config: 目标配置（传递给 step_fn）
        """
        max_cycles = self._config.get("max_cycles")
        interval = self._config.get("cycle_interval_seconds", 30)
        max_daily = self._config.get("max_daily_usd", float("inf"))
        budget_halt_ratio = self._config.get("budget_halt_ratio", 1.0)
        max_failures = self._config.get("max_consecutive_failures", float("inf"))

        merged_config = {**self._config, **(goal_config or {})}

        while True:
            self._state.current_cycle += 1
            cycle_idx = self._state.current_cycle

            # ── 预算检查 ──
            if abs(self._state.cumulative_pnl_usd) > max_daily * budget_halt_ratio:
                if self._state.cumulative_pnl_usd < 0:
                    logger.warning(
                        "[Campaign] 亏损熔断: $%.1f > $%.1f (cycle=%d)",
                        abs(self._state.cumulative_pnl_usd),
                        max_daily * budget_halt_ratio,
                        cycle_idx,
                    )
                    return CampaignResult(
                        status="budget_exhausted",
                        total_cycles=cycle_idx,
                        cumulative_pnl_usd=self._state.cumulative_pnl_usd,
                        cycles=self._state.cycles,
                    )

            # ── 连续失败检查 ──
            if self._state.consecutive_failures >= max_failures:
                halt = HaltDecision(
                    reason="max_consecutive_failures",
                    strategy_id=merged_config.get("strategy_id", "unknown"),
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

            # ── 执行 cycle ──
            if step_fn is not None:
                metrics = step_fn(cycle_idx, merged_config)
            else:
                metrics = self._stub_cycle(cycle_idx, merged_config)

            self._state.cycles.append(metrics)
            self._state.cumulative_pnl_usd += metrics.pnl_usd
            self._state.cumulative_gas_usd += metrics.gas_cost_usd

            # ── 成功/失败计数 ──
            if metrics.trades_failed > 0 and metrics.trades_executed == 0:
                self._state.consecutive_failures += 1

                # Arb: 诊断驱动回退
                if self._diagnosis is not None:
                    diag = self._diagnosis.diagnose(
                        evidence={
                            "strategy_id": merged_config.get("strategy_id", "unknown"),
                            "pnl_usd": metrics.pnl_usd,
                            "consecutive_failures": self._state.consecutive_failures,
                            "cumulative_loss_usd": abs(min(self._state.cumulative_pnl_usd, 0)),
                        },
                        strategy_id=merged_config.get("strategy_id", "unknown"),
                    )
                    halt_reason = validate_diagnosis(diag)
                    if halt_reason:
                        halt = HaltDecision(
                            reason=halt_reason,
                            strategy_id=merged_config.get("strategy_id", "unknown"),
                            diagnosis=diag,
                            message=f"诊断失败: {halt_reason}",
                        )
                        self._state.halts.append(halt)
                        return CampaignResult(
                            status="halted",
                            total_cycles=cycle_idx,
                            cumulative_pnl_usd=self._state.cumulative_pnl_usd,
                            cycles=self._state.cycles,
                            halt=halt,
                        )

                    if diag is not None:
                        metrics.retreat_level = diag.retreat_level
                        logger.info(
                            "[Campaign] 诊断回退: Level %s → %s (strategy=%s)",
                            diag.retreat_level,
                            diag.target_step,
                            diag.strategy_id,
                        )
            else:
                self._state.consecutive_failures = 0

            # ── 心跳间隔 ──
            if max_cycles is None:
                # MM 模式：无限循环 — demo 中跳出避免死循环
                break
            if interval > 0 and cycle_idx < (max_cycles or float("inf")):
                time.sleep(0)  # demo stub — 实际用 asyncio.sleep(interval)

        return CampaignResult(
            status="completed",
            total_cycles=self._state.current_cycle,
            cumulative_pnl_usd=self._state.cumulative_pnl_usd,
            cycles=self._state.cycles,
        )

    @staticmethod
    def _stub_cycle(cycle_idx: int, config: dict[str, Any]) -> CycleMetrics:
        """Demo stub — 模拟单次 cycle 执行"""
        return CycleMetrics(
            cycle_index=cycle_idx,
            pnl_usd=0.0,
            gas_cost_usd=0.0,
            trades_executed=1,
            trades_failed=0,
        )
