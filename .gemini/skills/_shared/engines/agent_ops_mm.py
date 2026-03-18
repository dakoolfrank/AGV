"""
S5-MM AgentOps 桥接层

MM-Campaign 心跳模式（5 步循环 monitor→detect→decide→execute→log）
每个 Ops 遵守 nexrur AgentOpsProtocol: (*) → StepResult
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from nexrur.engines.orchestrator import AssetRef, StepResult


# ─── 共享安全配置（MM + Arb 共用）───
@dataclass
class ExecutorConfig:
    """DexExecutor 安全底线 — 硬编码，不可被 LLM/policy 覆盖"""
    max_single_usd: float = 50.0
    max_slippage_pct: float = 0.02
    daily_cap_usd: float = 500.0
    approve_multiplier: float = 2.0     # 需求量 × 2，禁止 MAX_UINT256

    def validate_trade(self, amount_usd: float, slippage: float) -> bool:
        return amount_usd <= self.max_single_usd and slippage <= self.max_slippage_pct


# ─── 三大安全护甲（MM + Arb 共用）───
@dataclass
class SlippageGuard:
    threshold: float = 0.02

    def check(self, expected: float, actual: float) -> bool:
        return abs(actual - expected) / max(expected, 1e-18) <= self.threshold


@dataclass
class MEVGuard:
    """检测三明治攻击（前后交易 gas 异常 + 价格影响 > 阈值）"""
    price_impact_threshold: float = 0.005

    def is_sandwiched(self, price_before: float, price_after: float) -> bool:
        if price_before <= 0:
            return False
        impact = abs(price_after - price_before) / price_before
        return impact > self.price_impact_threshold


@dataclass
class TVLCircuitBreaker:
    floor_usd: float = 30.0

    def is_safe(self, tvl_usd: float) -> bool:
        return tvl_usd >= self.floor_usd


# ─── Safety Armor 聚合 ───
@dataclass
class SafetyArmor:
    slippage: SlippageGuard = field(default_factory=SlippageGuard)
    mev: MEVGuard = field(default_factory=MEVGuard)
    tvl: TVLCircuitBreaker = field(default_factory=TVLCircuitBreaker)
    config: ExecutorConfig = field(default_factory=ExecutorConfig)


# ─── MonitorOps（S5-MM Step 1）───
class MonitorOps:
    """读取链上 LP 状态，产出 pool_state"""

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        # Phase 1 stub — 从 S2 的 lp_state 读取 + 产出 pool_state
        return StepResult(
            success=True,
            assets_produced=[
                AssetRef(kind="pool_state", id="pool-snapshot", metadata={"source": "monitor"}),
            ],
            metadata={"step": "monitor", "trace_id": trace_id},
        )


# ─── DetectOps（S5-MM Step 2）───
class DetectOps:
    """异常检测：价差偏移 / MEV 信号 / TVL 骤降"""

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        return StepResult(
            success=True,
            assets_produced=[
                AssetRef(kind="anomaly_signal", id="detect-result", metadata={"source": "detect"}),
            ],
            metadata={"step": "detect", "trace_id": trace_id},
        )


# ─── DecideOps（S5-MM Step 3）───
class DecideOps:
    """确定性决策：根据 pool_state + anomaly_signal 判断是否调仓"""

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        return StepResult(
            success=True,
            metadata={"step": "decide", "decision": "hold", "trace_id": trace_id},
        )


# ─── ExecuteOps（S5-MM Step 4）───
class ExecuteOps:
    """执行调仓 — 通过 DexExecutor + SafetyArmor"""

    def __init__(self, safety: SafetyArmor | None = None):
        self.safety = safety or SafetyArmor()

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        return StepResult(
            success=True,
            assets_produced=[
                AssetRef(kind="heartbeat_log", id="hb-log", metadata={"source": "execute"}),
                AssetRef(kind="tx_result", id="tx-result", metadata={"source": "execute"}),
            ],
            metadata={"step": "execute", "trace_id": trace_id},
        )


# ─── LogOps（S5-MM Step 5）───
class LogOps:
    """心跳日志 — 写入 audit + evidence"""

    def __call__(
        self, *,
        pipeline_run_id: str,
        step_run_id: str,
        trace_id: str,
        assets_input: list[AssetRef],
        config: dict[str, Any],
        workspace: Path,
    ) -> StepResult:
        return StepResult(
            success=True,
            metadata={"step": "log", "trace_id": trace_id},
        )


# ─── 注册帮助器 ───
def register_mm_ops(registry: Any) -> None:
    """将 MM-Campaign 5 个 Ops 注册到 OpsRegistry"""
    safety = SafetyArmor()
    registry.register("monitor", MonitorOps())
    registry.register("detect", DetectOps())
    registry.register("decide", DecideOps())
    registry.register("execute", ExecuteOps(safety=safety))
    registry.register("log", LogOps())


# ─── 导出 ───
MM_OPS_MAP = {
    "monitor": MonitorOps,
    "detect":  DetectOps,
    "decide":  DecideOps,
    "execute": ExecuteOps,
    "log":     LogOps,
}
