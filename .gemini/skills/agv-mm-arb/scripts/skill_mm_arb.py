"""
S5 MarketMaker-Agent — 主程序入口 + 配置中枢

双 Campaign 拓扑（DESIGN.md §1）：
  - MM-Campaign: 护盘 + 反 MEV（心跳模式，确定性管线，零 LLM）
  - Arb-Campaign: 因子驱动套利（collect→curate→dataset→execute→fix）

架构关键点:
  - collect / execute / fix = 自建（AGV 域）
  - curate / dataset   = 直接调 WQ-YI Skill 类（对齐 WQ-YI 调用方式）
  - DexExecutor L2     = 两个 Campaign 共享（在 toolloop_mm.py 中）

配置数据类（§5.4 / §7.3 / §8.2）：
  - ExecutorConfig  — 执行层安全硬顶
  - PreauthConfig   — 预授权额度（人工设定）
  - MMRules         — 确定性规则引擎
  - BudgetTracker   — 日预算追踪

Pipeline 描述（§7.2）：
  - MM_PIPELINE   — 心跳 5 步确定性管线
  - ARB_PIPELINE  — 因子驱动 5 步管线（curate/dataset 指向 WQ-YI Skill）
"""
from __future__ import annotations

import logging
import time
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── 常量 ──────────────────────────────────────────────
SKILL_DIR = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = SKILL_DIR / "knowledge"
SCRIPTS_DIR = SKILL_DIR / "scripts"

# ── D3: .env + .env.s5 双文件加载 ────────────────────
def _load_s5_env() -> dict[str, str]:
    """加载 .env.s5 → .env → os.environ（优先级递减）"""
    agv_root = Path(__file__).resolve().parents[4]  # → /workspaces/AGV
    env_s5 = agv_root / ".env.s5"
    env_base = agv_root / ".env"
    merged: dict[str, str] = {}
    for env_file in [env_base, env_s5]:  # s5 后加载 → 覆盖 base
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, val = line.partition("=")
                    merged[key.strip()] = val.strip()
    return merged

_S5_ENV: dict[str, str] = {}

def get_s5_env(key: str, default: str = "") -> str:
    """从 S5 环境获取配置（.env.s5 > .env > os.environ）"""
    global _S5_ENV
    if not _S5_ENV:
        _S5_ENV = _load_s5_env()
    import os
    return _S5_ENV.get(key, os.environ.get(key, default))

# ── Prompt Store ──────────────────────────────────────
try:
    from _shared.prompts import SkillPromptStore
    _prompts = SkillPromptStore.from_script(__file__)
except ImportError:
    _prompts = None

# ── nexrur 底座（通过 AGV _shared adapter）──────────
_NEXRUR_OK = False
try:
    from nexrur import RunContext, StepOutcome, AuditBus, EvidenceStore
    from _shared.core.outcome import OUTCOME_REASON_CODES  # noqa: F401 — 注册 AGV reason codes
    from _shared.core.policy import PlatformPolicy
    _NEXRUR_OK = True
except ImportError:
    RunContext = None  # type: ignore[assignment,misc]
    StepOutcome = None  # type: ignore[assignment,misc]
    PlatformPolicy = None  # type: ignore[assignment,misc]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  配置数据类（对齐 DESIGN.md §5.4 / §7.3 / §8.2）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class ExecutorConfig:
    """执行层安全配置 — 硬编码底线，不可被 LLM 覆盖 (§5.4)"""

    # 单笔限制
    max_single_trade_usd: float = 50.0
    max_slippage_pct: float = 0.02
    min_pool_depth_usd: float = 50.0
    # 日限制
    max_daily_volume_usd: float = 500.0
    max_daily_gas_usd: float = 5.0
    max_daily_trades: int = 100
    max_daily_loss_usd: float = 50.0
    # 紧急
    emergency_withdraw_enabled: bool = True
    emergency_cooldown_minutes: int = 30
    # 私有 RPC
    private_rpc_url: str | None = None
    use_private_rpc_for_large: bool = True
    large_trade_threshold_usd: float = 20.0
    # Approve 策略
    approve_strategy: str = "demand_x2"

    @classmethod
    def from_yaml(cls, path: Path | None = None) -> "ExecutorConfig":
        if path is None:
            path = KNOWLEDGE_DIR / "safety_thresholds.yml"
        if not path.exists():
            return cls()
        data = yaml.safe_load(path.read_text())
        es = data.get("executor_safety", {})
        l1 = data.get("layer1_slippage", {})
        return cls(
            max_single_trade_usd=es.get("max_single_trade_usd", 50.0),
            max_slippage_pct=l1.get("max_slippage_pct", 0.02),
            min_pool_depth_usd=es.get("min_pool_depth_usd", 50.0),
            max_daily_volume_usd=es.get("max_daily_volume_usd", 500.0),
            max_daily_gas_usd=es.get("max_daily_gas_usd", 5.0),
            max_daily_trades=es.get("max_daily_trades", 100),
            max_daily_loss_usd=es.get("max_daily_loss_usd", 50.0),
            emergency_withdraw_enabled=es.get("emergency_withdraw_enabled", True),
            emergency_cooldown_minutes=es.get("emergency_cooldown_minutes", 30),
            approve_strategy=es.get("approve_strategy", "demand_x2"),
        )


@dataclass
class PreauthConfig:
    """预授权配置 — 人工设定，Agent 不可修改 (§8.2)"""

    approved_tokens: list[str] = field(default_factory=list)
    approved_pools: list[str] = field(default_factory=list)
    unapproved_action: str = "REJECT"
    mm_max_single_rebalance_usd: float = 10.0
    arb_max_single_trade_usd: float = 50.0
    arb_strategy_change_requires_approval: bool = True

    @classmethod
    def from_yaml(cls, path: Path | None = None) -> "PreauthConfig":
        if path is None:
            path = KNOWLEDGE_DIR / "safety_thresholds.yml"
        if not path.exists():
            return cls()
        data = yaml.safe_load(path.read_text())
        pa = data.get("preauth", {})
        return cls(
            approved_tokens=pa.get("approved_tokens", []),
            approved_pools=pa.get("approved_pools", []),
            unapproved_action=pa.get("unapproved_action", "REJECT"),
        )

    def is_token_approved(self, token_address: str) -> bool:
        return token_address.lower() in [t.lower() for t in self.approved_tokens]

    def is_pool_approved(self, pool_address: str) -> bool:
        return pool_address.lower() in [p.lower() for p in self.approved_pools]


@dataclass
class MMRules:
    """MM-Campaign 确定性规则引擎 (§2.3) — 纯 if-else，零 LLM"""

    # 价格偏移阈值
    price_deviation_warn: float = 0.03
    price_deviation_act: float = 0.05
    price_deviation_emergency: float = 0.10
    # 大单检测
    whale_trade_warn_pct: float = 0.10
    whale_trade_emergency_pct: float = 0.30
    # LP 再平衡
    rebalance_threshold: float = 0.05
    max_rebalance_amount_usd: float = 10.0
    # 心跳频率
    heartbeat_normal_interval: int = 30
    heartbeat_degraded_interval: int = 300
    heartbeat_emergency_interval: int = 5
    heartbeat_max_noop: int = 120
    # 日预算
    daily_max_gas_usd: float = 5.0
    daily_max_trades: int = 50

    @classmethod
    def from_yaml(cls, path: Path | None = None) -> "MMRules":
        if path is None:
            path = KNOWLEDGE_DIR / "mm_rules.yml"
        if not path.exists():
            return cls()
        data = yaml.safe_load(path.read_text())
        pd = data.get("price_deviation", {})
        wt = data.get("whale_trade", {})
        rb = data.get("rebalance", {})
        hb = data.get("heartbeat", {})
        dl = data.get("daily_limits", {})
        return cls(
            price_deviation_warn=pd.get("warn", 0.03),
            price_deviation_act=pd.get("act", 0.05),
            price_deviation_emergency=pd.get("emergency", 0.10),
            whale_trade_warn_pct=wt.get("warn_pct", 0.10),
            whale_trade_emergency_pct=wt.get("emergency_pct", 0.30),
            rebalance_threshold=rb.get("threshold", 0.05),
            max_rebalance_amount_usd=rb.get("max_amount_usd", 10.0),
            heartbeat_normal_interval=hb.get("normal_interval_seconds", 30),
            heartbeat_degraded_interval=hb.get("degraded_interval_seconds", 300),
            heartbeat_emergency_interval=hb.get("emergency_interval_seconds", 5),
            heartbeat_max_noop=hb.get("max_consecutive_noop", 120),
            daily_max_gas_usd=dl.get("max_gas_usd", 5.0),
            daily_max_trades=dl.get("max_trades", 50),
        )

    def classify_price_deviation(self, deviation: float) -> str:
        """价格偏移分级 → normal / warn / rebalance / emergency"""
        abs_dev = abs(deviation)
        if abs_dev >= self.price_deviation_emergency:
            return "emergency"
        if abs_dev >= self.price_deviation_act:
            return "rebalance"
        if abs_dev >= self.price_deviation_warn:
            return "warn"
        return "normal"

    def classify_whale(self, trade_pct_of_pool: float) -> str:
        """大单分级 → normal / warn / emergency"""
        if trade_pct_of_pool >= self.whale_trade_emergency_pct:
            return "emergency"
        if trade_pct_of_pool >= self.whale_trade_warn_pct:
            return "warn"
        return "normal"

    def needs_rebalance(self, reserve_ratio_deviation: float) -> bool:
        """两侧偏离 > threshold → 需要再平衡"""
        return abs(reserve_ratio_deviation) > self.rebalance_threshold


class BudgetTracker:
    """日预算追踪 — 跨 Campaign 共享 (§7.3 BudgetConfig)"""

    def __init__(
        self,
        *,
        max_daily_gas_usd: float = 5.0,
        max_daily_volume_usd: float = 500.0,
        max_daily_trades: int = 100,
        max_daily_loss_usd: float = 50.0,
    ):
        self.max_daily_gas_usd = max_daily_gas_usd
        self.max_daily_volume_usd = max_daily_volume_usd
        self.max_daily_trades = max_daily_trades
        self.max_daily_loss_usd = max_daily_loss_usd
        self.reset()

    def reset(self):
        """重置日计数器（每日零点或手动调用）"""
        self._gas_used_usd: float = 0.0
        self._volume_usd: float = 0.0
        self._trade_count: int = 0
        self._net_pnl_usd: float = 0.0
        self._reset_ts: float = time.monotonic()

    def record_trade(
        self, *, gas_usd: float = 0.0, volume_usd: float = 0.0, pnl_usd: float = 0.0,
    ):
        """记录一笔交易"""
        self._gas_used_usd += gas_usd
        self._volume_usd += volume_usd
        self._trade_count += 1
        self._net_pnl_usd += pnl_usd

    def can_trade(
        self, *, estimated_gas_usd: float = 0.0, estimated_volume_usd: float = 0.0,
    ) -> tuple[bool, str | None]:
        """检查是否还有预算 → (allowed, reason_if_blocked)"""
        if self._gas_used_usd + estimated_gas_usd > self.max_daily_gas_usd:
            return False, "daily_gas_exceeded"
        if self._volume_usd + estimated_volume_usd > self.max_daily_volume_usd:
            return False, "daily_volume_exceeded"
        if self._trade_count >= self.max_daily_trades:
            return False, "daily_trades_exceeded"
        if self._net_pnl_usd < -self.max_daily_loss_usd:
            return False, "daily_loss_exceeded"
        return True, None

    @property
    def remaining_gas_usd(self) -> float:
        return max(0.0, self.max_daily_gas_usd - self._gas_used_usd)

    @property
    def remaining_volume_usd(self) -> float:
        return max(0.0, self.max_daily_volume_usd - self._volume_usd)

    @property
    def remaining_trades(self) -> int:
        return max(0, self.max_daily_trades - self._trade_count)

    @property
    def net_pnl_usd(self) -> float:
        return self._net_pnl_usd

    @property
    def summary(self) -> dict:
        return {
            "gas_used_usd": self._gas_used_usd,
            "volume_usd": self._volume_usd,
            "trade_count": self._trade_count,
            "net_pnl_usd": self._net_pnl_usd,
            "remaining_gas_usd": self.remaining_gas_usd,
            "remaining_volume_usd": self.remaining_volume_usd,
            "remaining_trades": self.remaining_trades,
        }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Pipeline 描述 (对齐 DESIGN.md §7.2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MM_PIPELINE = {
    "name": "mm_heartbeat",
    "steps": ["monitor", "detect", "decide", "execute", "log"],
    "step_to_skill": {s: "market-maker" for s in
                      ["monitor", "detect", "decide", "execute", "log"]},
    "optional_steps": [],
    "produces": {
        "monitor": ["pool_state"],
        "detect": ["anomaly_signal"],
        "decide": ["action_plan"],
        "execute": ["tx_result"],
        "log": [],
    },
}

ARB_PIPELINE = {
    "name": "arb_factor",
    "steps": ["collect", "curate", "dataset", "execute", "fix"],
    "step_to_skill": {
        "collect": "market-maker",
        "curate": "brain-curate-knowledge",       # WQ-YI 的 Skill
        "dataset": "brain-dataset-explorer",       # WQ-YI 的 Skill
        "execute": "market-maker",
        "fix": "market-maker",
    },
    "optional_steps": ["fix"],
    "produces": {
        "collect": ["market_signal"],
        "curate": ["arb_skeleton"],
        "dataset": ["arb_strategy"],
        "execute": ["execution_result"],
        "fix": ["fix_patch"],
    },
}

# §7.4 Outcome 扩展码
OUTCOME_REASON_CODES = [
    "heartbeat_noop", "rebalance_executed", "emergency_withdraw",
    "cooldown_active", "daily_gas_exceeded", "daily_volume_exceeded",
    "tx_revert", "slippage_exceeded", "tvl_circuit_break",
    "mev_detected", "signal_stale", "pool_depth_insufficient",
    "param_drift", "factor_exhausted", "structural_change",
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Campaign 入口
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def load_config(config_path: str | Path | None = None) -> dict:
    """加载 Campaign 配置文件"""
    if config_path is None:
        return {}
    path = Path(config_path)
    if path.exists():
        return yaml.safe_load(path.read_text()) or {}
    return {}


def _build_web3():
    """从 .env.s5 构建 web3 实例"""
    rpc_url = get_s5_env("BSC_RPC_URL", "https://bsc-dataseed1.binance.org")
    try:
        from web3 import Web3
        return Web3(Web3.HTTPProvider(rpc_url))
    except ImportError:
        logger.warning("web3 not installed — running in dry-run mode")
        return None


def _build_notify_router():
    """从 .env.s5 构建通知路由（凭据缺失 → 静默跳过）"""
    from toolloop_common import TelegramNotifier, DiscordNotifier, NotifyRouter
    tg = TelegramNotifier(
        bot_token=get_s5_env("TELEGRAM_BOT_TOKEN"),
        chat_id=get_s5_env("TELEGRAM_CHAT_ID"),
    )
    dc = DiscordNotifier(webhook_url=get_s5_env("DISCORD_WEBHOOK_URL"))
    return NotifyRouter(telegram=tg, discord=dc)


async def run_mm_campaign(*, config: dict | None = None, workspace: Path | None = None):
    """启动 MM-Campaign（护盘 + 反 MEV）— §2"""
    from toolloop_common import (
        DexExecutor, PancakeV2Adapter, SlippageGuard, MEVGuard,
        TVLBreaker, NotifyRouter,
    )
    from toolloop_mm import MMHeartbeatLoop

    cfg = config or {}
    executor_config = ExecutorConfig.from_yaml()
    rules = MMRules.from_yaml()
    preauth = PreauthConfig.from_yaml()
    budget = BudgetTracker(
        max_daily_gas_usd=executor_config.max_daily_gas_usd,
        max_daily_volume_usd=executor_config.max_daily_volume_usd,
        max_daily_trades=executor_config.max_daily_trades,
        max_daily_loss_usd=executor_config.max_daily_loss_usd,
    )

    w3 = cfg.get("web3") or _build_web3()
    pk = cfg.get("private_key") or get_s5_env("MM_PRIVATE_KEY")
    adapter = PancakeV2Adapter(web3=w3, private_key=pk or None)
    executor = DexExecutor(adapter=adapter, config=cfg)
    pools = cfg.get("pools") or list(preauth.approved_pools)

    loop = MMHeartbeatLoop(
        executor=executor,
        rules=rules,
        tvl_breaker=TVLBreaker(),
        slippage_guard=SlippageGuard(max_slippage_pct=executor_config.max_slippage_pct),
        mev_guard=MEVGuard(),
        budget=budget,
        preauth=preauth,
        notify=_build_notify_router(),
        pools=pools,
    )
    logger.info("MM-Campaign started (heartbeat mode, %d pools)", len(pools))
    await loop.run_forever()


async def run_arb_campaign(*, config: dict | None = None, workspace: Path | None = None):
    """启动 Arb-Campaign（因子驱动套利）— §3"""
    from toolloop_arb import ArbCampaignLoop
    from toolloop_common import (
        DexExecutor, PancakeV2Adapter, NotifyRouter,
        SlippageGuard, TVLBreaker, MEVGuard, ApproveManager,
    )

    cfg = config or {}
    executor_config = ExecutorConfig.from_yaml()
    preauth = PreauthConfig.from_yaml()
    budget = BudgetTracker(
        max_daily_gas_usd=executor_config.max_daily_gas_usd,
        max_daily_volume_usd=executor_config.max_daily_volume_usd,
        max_daily_trades=executor_config.max_daily_trades,
        max_daily_loss_usd=executor_config.max_daily_loss_usd,
    )

    w3 = cfg.get("web3") or _build_web3()
    pk = cfg.get("private_key") or get_s5_env("MM_PRIVATE_KEY")
    adapter = PancakeV2Adapter(web3=w3, private_key=pk or None)
    executor = DexExecutor(adapter=adapter, config=cfg)

    loop = ArbCampaignLoop(
        config=cfg,
        executor=executor,
        budget=budget,
        preauth=preauth,
        notify=_build_notify_router(),
        slippage_guard=SlippageGuard(max_slippage_pct=executor_config.max_slippage_pct),
        tvl_breaker=TVLBreaker(),
        mev_guard=MEVGuard(),
        approve_manager=ApproveManager(web3=w3, private_key=pk or None),
    )
    logger.info("Arb-Campaign started (factor-driven)")
    await loop.run_campaign(max_cycles=cfg.get("max_cycles", 100))


def main():
    """CLI 入口"""
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="S5 MarketMaker-Agent")
    parser.add_argument(
        "--campaign", choices=["mm", "arb", "both"], default="mm",
        help="启动哪个 Campaign (default: mm)",
    )
    parser.add_argument("--config", type=str, help="配置文件路径 (YAML)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
    config = load_config(args.config)

    if args.campaign in ("mm", "both"):
        logger.info("Starting MM-Campaign...")
        asyncio.run(run_mm_campaign(config=config))

    if args.campaign in ("arb", "both"):
        logger.info("Starting Arb-Campaign...")
        asyncio.run(run_arb_campaign(config=config))


if __name__ == "__main__":
    main()
