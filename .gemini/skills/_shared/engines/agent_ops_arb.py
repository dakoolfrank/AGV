"""
S5-Arb AgentOps 桥接层

Arb-Campaign 因子套利模式（5 步 scan→curate→dataset→execute→fix）
每个 Ops 遵守 nexrur AgentOpsProtocol: (*) → StepResult
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from nexrur.engines.orchestrator import AssetRef, StepResult

# 安全护甲复用 MM 的共享组件
from _shared.engines.agent_ops_mm import SafetyArmor


# ─── ScanOps（S5-Arb Step 1）───
class ScanOps:
    """扫描外部 DEX 浅池，发现套利机会"""

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
                AssetRef(kind="market_signal", id="arb-signal", metadata={"source": "scan"}),
            ],
            metadata={"step": "scan", "trace_id": trace_id},
        )


# ─── CurateOps（S5-Arb Step 2）───
class CurateOps:
    """从 market_signal 中筛选可行策略 — LLM 辅助因子评估"""

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
                AssetRef(kind="arb_strategy", id="arb-strategy", metadata={"source": "curate"}),
            ],
            metadata={"step": "curate", "trace_id": trace_id},
        )


# ─── DatasetOps（S5-Arb Step 3）───
class DatasetOps:
    """策略参数化 — 计算最优份额/路径/时机"""

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
            metadata={"step": "dataset", "trace_id": trace_id},
        )


# ─── ArbExecuteOps（S5-Arb Step 4）───
class ArbExecuteOps:
    """执行套利交易 — 通过 DexExecutor + SafetyArmor"""

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
                AssetRef(kind="execution_result", id="arb-exec", metadata={"source": "execute"}),
            ],
            metadata={"step": "execute", "trace_id": trace_id},
        )


# ─── FixOps（S5-Arb Step 5）───
class FixOps:
    """策略修复 — 三级回退（权重调整 / curate 回退 / 策略重构）"""

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
            metadata={"step": "fix", "trace_id": trace_id},
        )


# ─── 注册帮助器 ───
def register_arb_ops(registry: Any) -> None:
    """将 Arb-Campaign 5 个 Ops 注册到 OpsRegistry"""
    safety = SafetyArmor()
    registry.register("scan", ScanOps())
    registry.register("curate", CurateOps())
    registry.register("dataset", DatasetOps())
    registry.register("execute", ArbExecuteOps(safety=safety))
    registry.register("fix", FixOps())


# ─── 导出 ───
ARB_OPS_MAP = {
    "scan":    ScanOps,
    "curate":  CurateOps,
    "dataset": DatasetOps,
    "execute": ArbExecuteOps,
    "fix":     FixOps,
}
