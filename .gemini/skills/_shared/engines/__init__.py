"""
AGV adapter: engines 子包

Re-export nexrur engines API + AGV-specific profiles, ops, campaign & diagnosis.
"""
# ToolLoop schema 注册（幂等，确保在任何 engines 导入时生效）
from . import _bootstrap_schema as _bootstrap_schema  # noqa: F401

# ── nexrur kernel re-exports ──
from nexrur.engines import (  # noqa: F401
    # orchestrator
    Orchestrator,
    Checkpoint,
    StepState,
    StepResult,
    TraceResult,
    StepStatus,
    TraceStatus,
    StepRegistry,
    AssetRef,
    AgentOpsProtocol,
    create_orchestrator,
    build_lineage,
    filter_assets,
    # protocols
    PipelineProfile,
    OpsRegistry,
    LifecycleProfile,
    ForkPoint,
    ProfileRegistry,
    # tool_loop
    ToolSpec,
    ToolLoopRunner,
    ToolLoopConfig,
    create_tool_loop_runner,
)

# ── AGV clients ──
from _shared.clients import GeminiLLMClient, LLMError  # noqa: F401

# ── AGV profiles ──
from _shared.engines._profiles import (  # noqa: F401
    AGV_TRUNK_PROFILE,
    S5_MM_PROFILE,
    S5_ARB_PROFILE,
    AGV_TRUNK_LIFECYCLE,
    ALL_PROFILES,
    create_agv_registry,
)

# ── AGV ops ──
from _shared.engines.agent_ops_mm import (  # noqa: F401
    MonitorOps,
    DetectOps,
    DecideOps,
    ExecuteOps,
    LogOps,
    register_mm_ops,
    SafetyArmor,
    ExecutorConfig,
    SlippageGuard,
    MEVGuard,
    TVLCircuitBreaker,
)
from _shared.engines.agent_ops_arb import (  # noqa: F401
    CollectOps,
    CurateOps,
    DatasetOps,
    ArbExecuteOps,
    FixOps,
    register_arb_ops,
)

# ── AGV diagnosis ──
from _shared.engines.diagnosis import (  # noqa: F401
    DiagnosisEngine,
    RepairDiagnosis,
    HaltDecision,
    make_diagnosis_id,
    validate_diagnosis,
    DIAGNOSIS_REASON_CODES,
    REASON_CODE_LEVEL,
    LEVEL_TO_TARGET_STEP,
    VALID_REPAIR_TARGETS,
    DETERMINISTIC_DETECTORS,
    detect_slippage_issue,
    detect_tvl_drop,
    detect_budget_exceeded,
    detect_mev_attack,
)

# ── AGV campaign ──
from _shared.engines.campaign import (  # noqa: F401
    CampaignRunner,
    CampaignResult,
    CampaignState,
    CycleMetrics,
    DEFAULT_MM_CONFIG,
    DEFAULT_ARB_CONFIG,
    LOOP_END_STEP,
    FINALIZE_STEPS,
)
