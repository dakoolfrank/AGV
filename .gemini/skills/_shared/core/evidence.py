"""
AGV adapter: 证据拓扑

双 Campaign 上游链：
  MM:  monitor → detect → decide → execute → log
  Arb: scan → curate → dataset → execute → fix
"""
from nexrur.core.evidence import *  # noqa: F401,F403
from nexrur.core.evidence import EvidenceStore, EvidenceLevel  # noqa: F401
from enum import Enum

# AGV 步骤的证据级别回退映射（policy.yml 未配置时使用）
STEP_EVIDENCE_LEVEL: dict[str, EvidenceLevel] = {
    # MM-Campaign
    "monitor": EvidenceLevel.REQUIRED,
    "detect": EvidenceLevel.REQUIRED,
    "decide": EvidenceLevel.RECOMMENDED,
    "execute": EvidenceLevel.REQUIRED,
    "log": EvidenceLevel.AUDIT_ONLY,
    # Arb-Campaign
    "scan": EvidenceLevel.REQUIRED,
    "curate": EvidenceLevel.RECOMMENDED,
    "dataset": EvidenceLevel.RECOMMENDED,
    "fix": EvidenceLevel.REQUIRED,
}

# AGV 上游链路拓扑（每步可看到的上游步骤）
UPSTREAM_CHAIN: dict[str, list[str]] = {
    # MM-Campaign
    "monitor": [],
    "detect": ["monitor"],
    "decide": ["monitor", "detect"],
    "execute": ["monitor", "detect", "decide"],
    "log": ["monitor", "detect", "decide", "execute"],
    # Arb-Campaign
    "scan": [],
    "curate": ["scan"],
    "dataset": ["scan", "curate"],
    # execute 在 Arb 可看到 scan→curate→dataset
    # (execute 被两个 Campaign 共用，取最大上游集)
    "fix": ["scan", "curate", "dataset", "execute"],
}
