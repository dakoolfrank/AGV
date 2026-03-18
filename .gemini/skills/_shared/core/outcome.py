# Re-export from nexrur kernel — keeps relative imports working
from nexrur.core.outcome import *  # noqa: F401,F403
from nexrur.core.outcome import StepOutcome, OUTCOME_REASON_CODES, is_valid_reason_code  # noqa: F401

# AGV-specific reason codes (populate the kernel's empty dict)
if not OUTCOME_REASON_CODES:
    OUTCOME_REASON_CODES.update({
        # MM-Campaign: 心跳护盘
        "monitor": [
            "rpc_unreachable", "pool_not_found", "data_stale",
        ],
        "detect": [
            "no_anomaly", "signal_conflict",
        ],
        "decide": [
            "budget_exceeded", "preauth_rejected", "emergency_cooldown",
        ],
        "execute": [
            "slippage_exceed", "mev_detected", "tvl_breaker",
            "gas_exceed", "tx_reverted", "approve_failed",
        ],
        # Arb-Campaign: 因子套利
        "scan": [
            "no_opportunity", "source_timeout", "data_fusion_fail",
        ],
        "curate": [
            "factor_insufficient", "confidence_low",
        ],
        "dataset": [
            "liquidity_insufficient", "pool_depth_low",
        ],
        "fix": [
            "strategy_exhausted", "max_retries",
        ],
    })
