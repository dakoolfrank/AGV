"""
AGV PipelineProfile 定义

拓扑：
  S1→S2 ─┬→ S3.L1→S3.L2→S4  (主干 — Orchestrator 编排)
          └→ S5 MM/Arb        (分支 — 独立 CampaignRunner)

三个 Profile:
  AGV_TRUNK_PROFILE  — 主干 5 步 (Orchestrator)
  S5_MM_PROFILE      — MM-Campaign 心跳 5 步 (CampaignRunner)
  S5_ARB_PROFILE     — Arb-Campaign 因子 5 步 (CampaignRunner)
"""
from __future__ import annotations

from nexrur.engines.protocols import (
    PipelineProfile,
    LifecycleProfile,
    ForkPoint,
    ProfileRegistry,
)

# ─── 主干 asset_kind 枚举 ───
_TRUNK_ASSET_KINDS = frozenset({
    # S1
    "daily_snapshot", "monthly_settlement", "station_status",
    # S2
    "token_state", "nft_state", "lp_state", "tx_receipt",
    # S3.L1
    "chain_data_snapshot", "api_response",
    # S3.L2
    "deploy_receipt", "build_artifact",
    # S4
    "content_draft", "campaign_record",
})

# ─── S5 asset_kind 枚举 ───
_S5_ASSET_KINDS = frozenset({
    "lp_state",                                                      # 从 S2 分叉消费
    "pool_state", "anomaly_signal", "heartbeat_log", "tx_result",  # MM
    "market_signal", "arb_strategy", "execution_result",            # Arb
})


# ═══════════════════════════════════════════════════════════════
# 主干 Profile  (S1→S2→S3.L1→S3.L2→S4)
# ═══════════════════════════════════════════════════════════════
AGV_TRUNK_PROFILE = PipelineProfile(
    name="agv-trunk",
    step_order=(
        "asset_oracle",     # S1
        "chain_ops",        # S2 (分叉点)
        "digital_ops_l1",   # S3.L1 Web3
        "digital_ops_l2",   # S3.L2 Web2
        "kol",              # S4
    ),
    step_to_skill={
        "asset_oracle":   "agv-asset-oracle",
        "chain_ops":      "agv-chain-ops",
        "digital_ops_l1": "agv-digital-ops",
        "digital_ops_l2": "agv-digital-ops",
        "kol":            "agv-kol",
    },
    step_to_policy={
        "asset_oracle":   "asset_oracle",
        "chain_ops":      "chain_ops",
        "digital_ops_l1": "digital_ops",
        "digital_ops_l2": "digital_ops",
        "kol":            "kol",
    },
    step_deps={
        "asset_oracle":   [],
        "chain_ops":      ["asset_oracle"],
        "digital_ops_l1": ["chain_ops"],
        "digital_ops_l2": ["digital_ops_l1"],
        "kol":            ["digital_ops_l2"],
    },
    optional_steps=frozenset({"kol"}),
    asset_kinds=_TRUNK_ASSET_KINDS,
    step_produces={
        "asset_oracle":   frozenset({"daily_snapshot", "monthly_settlement", "station_status"}),
        "chain_ops":      frozenset({"token_state", "nft_state", "lp_state", "tx_receipt"}),
        "digital_ops_l1": frozenset({"chain_data_snapshot", "api_response"}),
        "digital_ops_l2": frozenset({"deploy_receipt", "build_artifact"}),
        "kol":            frozenset({"content_draft", "campaign_record"}),
    },
    step_consumes={
        "asset_oracle":   frozenset(),
        "chain_ops":      frozenset({"monthly_settlement"}),
        "digital_ops_l1": frozenset({"token_state", "nft_state", "lp_state"}),
        "digital_ops_l2": frozenset({"chain_data_snapshot"}),
        "kol":            frozenset({"deploy_receipt", "chain_data_snapshot"}),
    },
    upstream_chain={
        "asset_oracle":   [],
        "chain_ops":      ["asset_oracle"],
        "digital_ops_l1": ["asset_oracle", "chain_ops"],
        "digital_ops_l2": ["asset_oracle", "chain_ops", "digital_ops_l1"],
        "kol":            ["asset_oracle", "chain_ops", "digital_ops_l1", "digital_ops_l2"],
    },
    step_evidence_level={
        "asset_oracle":   "recommended",
        "chain_ops":      "required",
        "digital_ops_l1": "required",
        "digital_ops_l2": "required",
        "kol":            "audit_only",
    },
)


# ═══════════════════════════════════════════════════════════════
# S5-MM Profile  (monitor→detect→decide→execute→log)
# 心跳模式，CampaignRunner 编排，零 LLM 依赖
# ═══════════════════════════════════════════════════════════════
S5_MM_PROFILE = PipelineProfile(
    name="s5-mm",
    step_order=("monitor", "detect", "decide", "execute", "log"),
    step_to_skill={
        "monitor": "agv-mm-arb",
        "detect":  "agv-mm-arb",
        "decide":  "agv-mm-arb",
        "execute": "agv-mm-arb",
        "log":     "agv-mm-arb",
    },
    step_to_policy={
        "monitor": "monitor",
        "detect":  "detect",
        "decide":  "decide",
        "execute": "execute",
        "log":     "log",
    },
    step_deps={
        "monitor": [],
        "detect":  ["monitor"],
        "decide":  ["detect"],
        "execute": ["decide"],
        "log":     ["execute"],
    },
    optional_steps=frozenset({"log"}),
    asset_kinds=frozenset({
        "lp_state",  # 从 S2 分叉消费
        "pool_state", "anomaly_signal", "heartbeat_log", "tx_result",
    }),
    step_produces={
        "monitor": frozenset({"pool_state"}),
        "detect":  frozenset({"anomaly_signal"}),
        "decide":  frozenset(),                    # 决策内联于 execute
        "execute": frozenset({"heartbeat_log", "tx_result"}),
        "log":     frozenset(),
    },
    step_consumes={
        "monitor": frozenset({"lp_state"}),        # ← 从 S2 分叉消费
        "detect":  frozenset({"pool_state"}),
        "decide":  frozenset({"anomaly_signal"}),
        "execute": frozenset({"pool_state", "anomaly_signal"}),
        "log":     frozenset({"heartbeat_log"}),
    },
    upstream_chain={
        "monitor": [],
        "detect":  ["monitor"],
        "decide":  ["monitor", "detect"],
        "execute": ["monitor", "detect", "decide"],
        "log":     ["monitor", "detect", "decide", "execute"],
    },
    step_evidence_level={
        "monitor": "required",
        "detect":  "required",
        "decide":  "recommended",
        "execute": "required",
        "log":     "audit_only",
    },
)


# ═══════════════════════════════════════════════════════════════
# S5-Arb Profile  (collect→curate→dataset→execute→fix)
# 因子驱动套利，CampaignRunner 编排，LLM 定期校准
# ═══════════════════════════════════════════════════════════════
S5_ARB_PROFILE = PipelineProfile(
    name="s5-arb",
    step_order=("collect", "curate", "dataset", "execute", "fix"),
    step_to_skill={
        "collect":    "agv-mm-arb",
        "curate":  "agv-mm-arb",
        "dataset": "agv-mm-arb",
        "execute": "agv-mm-arb",
        "fix":     "agv-mm-arb",
    },
    step_to_policy={
        "collect":    "collect",
        "curate":  "curate",
        "dataset": "dataset",
        "execute": "execute",
        "fix":     "fix",
    },
    step_deps={
        "collect":    [],
        "curate":  ["collect"],
        "dataset": ["curate"],
        "execute": ["dataset"],
        "fix":     ["execute"],
    },
    optional_steps=frozenset({"fix"}),
    asset_kinds=frozenset({
        "lp_state",  # 从 S2 分叉消费
        "market_signal", "arb_strategy", "execution_result",
    }),
    step_produces={
        "collect":    frozenset({"market_signal"}),
        "curate":  frozenset({"arb_strategy"}),
        "dataset": frozenset(),                     # 参数集内联
        "execute": frozenset({"execution_result"}),
        "fix":     frozenset(),
    },
    step_consumes={
        "collect":    frozenset({"lp_state"}),          # ← 从 S2 分叉消费
        "curate":  frozenset({"market_signal"}),
        "dataset": frozenset({"arb_strategy"}),
        "execute": frozenset({"arb_strategy"}),
        "fix":     frozenset({"execution_result"}),
    },
    upstream_chain={
        "collect":    [],
        "curate":  ["collect"],
        "dataset": ["collect", "curate"],
        "execute": ["collect", "curate", "dataset"],
        "fix":     ["collect", "curate", "dataset", "execute"],
    },
    step_evidence_level={
        "collect":    "required",
        "curate":  "recommended",
        "dataset": "recommended",
        "execute": "required",
        "fix":     "required",
    },
)


# ═══════════════════════════════════════════════════════════════
# 主干 LifecycleProfile  (资产十态生命周期)
# ═══════════════════════════════════════════════════════════════
AGV_TRUNK_LIFECYCLE = LifecycleProfile(
    states=(
        "pending",
        "oracle_done",
        "chain_done",
        "l1_done",
        "l2_done",
        "kol_done",
        # 进行中
        "oracle_running", "chain_running", "l1_running", "l2_running", "kol_running",
        # 终态
        "terminal_pass", "terminal_exhausted", "terminal_interrupt",
    ),
    terminal_states=frozenset({"terminal_pass", "terminal_exhausted", "terminal_interrupt"}),
    in_progress_states=frozenset({"oracle_running", "chain_running", "l1_running", "l2_running", "kol_running"}),
    stable_states=frozenset({"pending", "oracle_done", "chain_done", "l1_done", "l2_done", "kol_done"}),
    state_order={
        "pending": 0,
        "oracle_running": 1, "oracle_done": 2,
        "chain_running": 3, "chain_done": 4,
        "l1_running": 5, "l1_done": 6,
        "l2_running": 7, "l2_done": 8,
        "kol_running": 9, "kol_done": 10,
        "terminal_pass": 99, "terminal_exhausted": 98, "terminal_interrupt": 97,
    },
    step_required_state={
        "asset_oracle":   "pending",
        "chain_ops":      "oracle_done",
        "digital_ops_l1": "chain_done",
        "digital_ops_l2": "l1_done",
        "kol":            "l2_done",
    },
    step_entry_state={
        "asset_oracle":   "oracle_running",
        "chain_ops":      "chain_running",
        "digital_ops_l1": "l1_running",
        "digital_ops_l2": "l2_running",
        "kol":            "kol_running",
    },
    step_success_state={
        "asset_oracle":   "oracle_done",
        "chain_ops":      "chain_done",
        "digital_ops_l1": "l1_done",
        "digital_ops_l2": "l2_done",
        "kol":            "kol_done",
    },
    step_failure_rollback={
        "asset_oracle":   "pending",
        "chain_ops":      "oracle_done",
        "digital_ops_l1": "chain_done",
        "digital_ops_l2": "l1_done",
        "kol":            "l2_done",
    },
)


# ═══════════════════════════════════════════════════════════════
# 导出清单
# ═══════════════════════════════════════════════════════════════
ALL_PROFILES = {
    "agv-trunk": AGV_TRUNK_PROFILE,
    "s5-mm":     S5_MM_PROFILE,
    "s5-arb":    S5_ARB_PROFILE,
}


# ═══════════════════════════════════════════════════════════════
# ProfileRegistry 工厂（底座多管线管理）
# ═══════════════════════════════════════════════════════════════

def create_agv_registry() -> ProfileRegistry:
    """
    构建 AGV 完整管线拓扑注册表。

    拓扑：agv-trunk 为根，s5-mm 和 s5-arb 在 chain_ops 后分叉，
    共享 lp_state 资产。
    """
    reg = ProfileRegistry()

    # 注册管线
    reg.register_pipeline(AGV_TRUNK_PROFILE)
    reg.register_pipeline(S5_MM_PROFILE)
    reg.register_pipeline(S5_ARB_PROFILE)

    # 注册生命周期
    reg.register_lifecycle("agv-trunk", AGV_TRUNK_LIFECYCLE)

    # 声明分叉：s5-mm 和 s5-arb 都从 agv-trunk 的 chain_ops 后分叉
    _s5_fork = ForkPoint(
        source_profile="agv-trunk",
        fork_after_step="chain_ops",
        shared_asset_kinds=frozenset({"lp_state"}),
    )
    reg.register_fork("s5-mm", _s5_fork)
    reg.register_fork("s5-arb", _s5_fork)

    return reg
