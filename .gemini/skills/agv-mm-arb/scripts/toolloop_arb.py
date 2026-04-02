"""
Arb-Campaign Tool Loop — 5 步管线 (DESIGN.md §3)

collect → curate → dataset → execute → fix

设计理念（路径 B — 因子驱动定向交易）:
  ≠ 搬砖套利（比速度）
  = AI 因子策略 → 信号评估 → 定向买入 → 持仓管理 → 止盈/止损（比脑子）

  核心区分:
    搬砖: 双池价差 → 原子交易 → 秒级 → 零壁垒
    路径B: AI因子 → 信号判断 → 持仓周期 → 知识壁垒

Execute 工作模式:
  1. 取当前市场快照（价格/储备/链上活跃度）
  2. 若无持仓 → SignalEvaluator 评估入场信号 → 满足则 BUY
  3. 若有持仓 → 评估出场信号（止盈/止损/超时）→ 满足则 SELL
  4. 记录持仓状态 + P&L

调用方式对齐 WQ-YI:
  AGV 的 curate/dataset 步骤直接调用 WQ-YI 的 Skill 类，不经过 AgentOps。

管线步骤:
  - collect:  modules/collect/ 子模块（自建 — GeckoTerminal + Moralis）
  - curate:  直接调 WQ-YI KnowledgeBaseSkill
  - dataset: 委托 DatasetOps (agent_ops_arb.py) — 唯一 L1+L2 真相源
  - execute: SignalEvaluator + PositionManager + DexExecutor（因子驱动）
  - fix:     三级回退诊断

三级回退（§3.6）:
  A: 参数调整 → execute（同策略重试，零 LLM）
  B: 因子切换 → curate（重新提取骨架，LLM 辅助）
  C: 策略重构 → collect（从头收集，LLM 主导）
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── 共享执行层导入 ──────────────────────────────────
try:
    from toolloop_common import (
        ROUTER, USDT, KNOWN_PAIRS, PANCAKE_V2_PAIR_ABI,
        SlippageGuard, MEVGuard, TVLBreaker,
        ApproveManager,
    )
except ImportError:
    ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"
    USDT = "0x55d398326f99059fF775485246999027B3197955"
    KNOWN_PAIRS = {}  # type: ignore[assignment]
    PANCAKE_V2_PAIR_ABI = []  # type: ignore[assignment]
    SlippageGuard = None  # type: ignore[assignment,misc]
    MEVGuard = None  # type: ignore[assignment,misc]
    TVLBreaker = None  # type: ignore[assignment,misc]
    ApproveManager = None  # type: ignore[assignment,misc]

# ── 外部 DEX 池 → Token 映射（种子数据，collect 动态补充）──
POOL_TOKEN_MAP: dict[str, dict[str, str]] = {
    "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE": {
        "base": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",   # WBNB
        "quote": "0x55d398326f99059fF775485246999027B3197955",  # USDT
        "name": "WBNB_USDT",
    },
}

# 默认交易金额 10 USDT (18 decimals on BSC)
DEFAULT_TRADE_SIZE_WEI = 10 * 10**18


# ── 三级回退（§3.6）──────────────────────────────────
RETREAT_LEVELS = {
    "A": {"target_step": "execute", "llm": False, "trigger": "param_drift"},
    "B": {"target_step": "curate",  "llm": True,  "trigger": "factor_exhausted"},
    "C": {"target_step": "collect",  "llm": True,  "trigger": "structural_change"},
}


# ── P&L 计算工具 ─────────────────────────────────────


# ── 市场快照（链上实时数据）─────────────────────────
@dataclass
class MarketSnapshot:
    """单次链上采样 — 供 SignalEvaluator 判断入场/出场"""
    pool_address: str
    reserve_in: int = 0
    reserve_out: int = 0
    spot_price: float = 0.0      # reserve_out / reserve_in
    timestamp: float = field(default_factory=time.time)
    block_number: int = 0
    # 可选扩展字段（由 _enrich_snapshot 填充）
    price_change_pct: float = 0.0  # 相对于持仓入场价的变化
    metadata: dict = field(default_factory=dict)

    @property
    def is_valid(self) -> bool:
        return self.reserve_in > 0 and self.reserve_out > 0


# ── 持仓记录 ─────────────────────────────────────────
@dataclass
class Position:
    """单个持仓 — 记录买入时的状态"""
    pool_address: str
    strategy_id: str
    token_held: str             # 持有的 token 地址（买入的 token_out）
    token_quote: str            # 计价 token 地址（卖出时要换回的）
    amount_held: int            # 持有数量（wei）
    entry_price: float          # 入场价（spot_price at buy）
    entry_amount_usd: float     # 入场金额（USD）
    entry_time: float = field(default_factory=time.time)
    entry_block: int = 0
    entry_tx_hash: str = ""
    # 策略参数（从 StrategyRef.exit_rules 复制）
    take_profit_bps: float = 50.0   # 止盈 bps
    stop_loss_bps: float = 20.0     # 止损 bps
    max_hold_seconds: int = 300     # 最大持仓时间
    metadata: dict = field(default_factory=dict)

    @property
    def age_seconds(self) -> float:
        return time.time() - self.entry_time

    def to_dict(self) -> dict:
        return {
            "pool_address": self.pool_address,
            "strategy_id": self.strategy_id,
            "token_held": self.token_held,
            "token_quote": self.token_quote,
            "amount_held": self.amount_held,
            "entry_price": self.entry_price,
            "entry_amount_usd": self.entry_amount_usd,
            "entry_time": self.entry_time,
            "entry_block": self.entry_block,
            "entry_tx_hash": self.entry_tx_hash,
            "take_profit_bps": self.take_profit_bps,
            "stop_loss_bps": self.stop_loss_bps,
            "max_hold_seconds": self.max_hold_seconds,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Position":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class PositionManager:
    """持仓管理器 — YAML 持久化，支持跨 Session 恢复

    存储路径: .docs/ai-skills/execute/positions.yml
    """

    def __init__(self, workspace: Path | None = None):
        self._workspace = workspace or Path.cwd()
        self._positions: dict[str, Position] = {}  # pool_address → Position
        self._closed: list[dict] = []               # 已平仓记录
        self._load()

    @property
    def _positions_file(self) -> Path:
        return self._workspace / ".docs" / "ai-skills" / "execute" / "positions.yml"

    def _load(self) -> None:
        f = self._positions_file
        if not f.exists():
            return
        try:
            import yaml
            data = yaml.safe_load(f.read_text()) or {}
            for k, v in (data.get("open", {}) or {}).items():
                self._positions[k] = Position.from_dict(v)
            self._closed = data.get("closed", []) or []
        except Exception as exc:
            logger.warning("PositionManager: load failed: %s", exc)

    def save(self) -> None:
        f = self._positions_file
        f.parent.mkdir(parents=True, exist_ok=True)
        import yaml
        data = {
            "open": {k: v.to_dict() for k, v in self._positions.items()},
            "closed": self._closed[-50:],  # 保留最近 50 条
        }
        f.write_text(yaml.dump(data, default_flow_style=False, allow_unicode=True))

    def has_position(self, pool_address: str) -> bool:
        return pool_address in self._positions

    def get_position(self, pool_address: str) -> Position | None:
        return self._positions.get(pool_address)

    def open_position(self, position: Position) -> None:
        self._positions[position.pool_address] = position
        self.save()
        logger.info("position opened: %s @ %.6f (%s)",
                     position.strategy_id, position.entry_price, position.pool_address[:10])

    def close_position(self, pool_address: str, *, exit_price: float,
                       exit_reason: str, pnl: dict | None = None) -> Position | None:
        pos = self._positions.pop(pool_address, None)
        if pos:
            self._closed.append({
                **pos.to_dict(),
                "exit_price": exit_price,
                "exit_reason": exit_reason,
                "exit_time": time.time(),
                "hold_seconds": pos.age_seconds,
                "pnl": pnl,
            })
            self.save()
            logger.info("position closed: %s reason=%s hold=%.0fs",
                         pos.strategy_id, exit_reason, pos.age_seconds)
        return pos

    def list_open(self) -> list[Position]:
        return list(self._positions.values())

    @property
    def open_count(self) -> int:
        return len(self._positions)


# ── 出场信号 ─────────────────────────────────────────
@dataclass
class ExitSignal:
    """出场信号"""
    should_exit: bool
    reason: str                # take_profit / stop_loss / timeout / signal_reversal
    current_price: float = 0.0
    pnl_bps: float = 0.0      # 当前浮动收益 bps


class SignalEvaluator:
    """因子信号评估器 — 用 dataset 绑定的指标决定入场/出场

    当前支持的因子:
      - volume_momentum: 价格动量 + 链上活跃度（简化: 价格变化率）
      - whale_follow: 巨鲸跟随（简化: 大额储备变化检测）

    不支持 cross_pool_arbitrage（搬砖，不是我们的方向）。

    入场逻辑:
      - 取当前市场快照
      - 与历史快照对比，计算价格变化率
      - 变化率 > 阈值 → 入场信号

    出场逻辑:
      - 止盈: 价格相对入场价上涨 > take_profit_bps
      - 止损: 价格相对入场价下跌 > stop_loss_bps
      - 超时: 持仓时间 > max_hold_seconds
    """

    # 入场默認阈值
    DEFAULT_MOMENTUM_ENTRY_BPS = 30    # 价格正向变化 > 0.3% → 入场
    DEFAULT_VOLUME_SPIKE_RATIO = 1.5   # 储备变化 > 1.5x → 活跃度信号

    def __init__(self, *, config: dict | None = None):
        self.config = config or {}
        self._price_history: dict[str, list[tuple[float, float]]] = {}  # pool → [(ts, price)]
        self._reserve_history: dict[str, list[tuple[float, int, int]]] = {}  # pool → [(ts, r_in, r_out)]

    def record_snapshot(self, snapshot: MarketSnapshot) -> None:
        """记录市场快照 — 供后续信号计算使用"""
        pool = snapshot.pool_address
        if pool not in self._price_history:
            self._price_history[pool] = []
            self._reserve_history[pool] = []

        self._price_history[pool].append((snapshot.timestamp, snapshot.spot_price))
        self._reserve_history[pool].append(
            (snapshot.timestamp, snapshot.reserve_in, snapshot.reserve_out)
        )
        # 保留最近 100 条
        self._price_history[pool] = self._price_history[pool][-100:]
        self._reserve_history[pool] = self._reserve_history[pool][-100:]

    def evaluate_entry(self, strategy: "StrategyRef", snapshot: MarketSnapshot) -> dict:
        """评估入场信号 — 返回 {should_enter, reason, confidence}

        策略类型分发:
          - volume_momentum → 短期价格动量 + 储备活跃度
          - whale_follow → 储备突变检测
          - cross_pool_arbitrage → 拒绝（不支持搬砖）
        """
        stype = strategy.strategy_type

        if stype == "cross_pool_arbitrage":
            return {"should_enter": False, "reason": "unsupported_strategy_type",
                    "confidence": 0.0}

        if not snapshot.is_valid:
            return {"should_enter": False, "reason": "invalid_snapshot", "confidence": 0.0}

        self.record_snapshot(snapshot)

        if stype == "volume_momentum":
            return self._eval_momentum_entry(strategy, snapshot)
        elif stype == "whale_follow":
            return self._eval_whale_entry(strategy, snapshot)
        else:
            return self._eval_momentum_entry(strategy, snapshot)  # fallback

    def _eval_momentum_entry(self, strategy: "StrategyRef", snapshot: MarketSnapshot) -> dict:
        """动量入场: 短期价格上涨 > 阈值"""
        pool = snapshot.pool_address
        history = self._price_history.get(pool, [])
        if len(history) < 2:
            return {"should_enter": False, "reason": "insufficient_history",
                    "confidence": 0.0, "history_count": len(history)}

        # 对比最近 vs 之前的均价
        recent_price = snapshot.spot_price
        lookback = min(10, len(history) - 1)
        older_prices = [p for _, p in history[-lookback - 1:-1] if p > 0]
        if not older_prices:
            return {"should_enter": False, "reason": "no_valid_older_prices",
                    "confidence": 0.0}
        avg_older = sum(older_prices) / len(older_prices)

        if avg_older <= 0:
            return {"should_enter": False, "reason": "zero_avg_price", "confidence": 0.0}

        change_bps = ((recent_price - avg_older) / avg_older) * 10000
        threshold = self.config.get("momentum_entry_bps", self.DEFAULT_MOMENTUM_ENTRY_BPS)

        trigger_params = getattr(strategy, "entry", {}) or {}
        # 骨架可能在 trigger.params 中指定阈值
        if isinstance(trigger_params, dict):
            threshold = trigger_params.get("momentum_entry_bps", threshold)

        should_enter = change_bps > threshold
        confidence = min(1.0, abs(change_bps) / (threshold * 3)) if threshold > 0 else 0.0

        return {
            "should_enter": should_enter,
            "reason": f"momentum {'triggered' if should_enter else 'below_threshold'}",
            "change_bps": round(change_bps, 2),
            "threshold_bps": threshold,
            "confidence": round(confidence, 3),
            "recent_price": recent_price,
            "avg_older_price": avg_older,
            "lookback": lookback,
        }

    def _eval_whale_entry(self, strategy: "StrategyRef", snapshot: MarketSnapshot) -> dict:
        """巨鲸入场: 储备突变 → 大额资金进入"""
        pool = snapshot.pool_address
        reserve_hist = self._reserve_history.get(pool, [])
        if len(reserve_hist) < 2:
            return {"should_enter": False, "reason": "insufficient_reserve_history",
                    "confidence": 0.0}

        # 计算储备变化率
        _, prev_r_in, prev_r_out = reserve_hist[-2]
        curr_total = snapshot.reserve_in + snapshot.reserve_out
        prev_total = prev_r_in + prev_r_out

        if prev_total <= 0:
            return {"should_enter": False, "reason": "zero_prev_reserves", "confidence": 0.0}

        change_ratio = curr_total / prev_total
        spike_threshold = self.config.get("volume_spike_ratio", self.DEFAULT_VOLUME_SPIKE_RATIO)

        should_enter = change_ratio > spike_threshold
        confidence = min(1.0, (change_ratio - 1.0) / (spike_threshold - 1.0)) if spike_threshold > 1 else 0.0

        return {
            "should_enter": should_enter,
            "reason": f"whale {'detected' if should_enter else 'no_spike'}",
            "reserve_change_ratio": round(change_ratio, 4),
            "spike_threshold": spike_threshold,
            "confidence": round(max(0.0, confidence), 3),
        }

    def evaluate_exit(self, position: Position, snapshot: MarketSnapshot) -> ExitSignal:
        """评估出场信号 — 止盈/止损/超时"""
        if not snapshot.is_valid:
            return ExitSignal(should_exit=False, reason="invalid_snapshot")

        current_price = snapshot.spot_price
        entry_price = position.entry_price

        if entry_price <= 0:
            return ExitSignal(should_exit=False, reason="zero_entry_price")

        # 浮动 P&L（bps）
        pnl_bps = ((current_price - entry_price) / entry_price) * 10000

        # 1. 止盈
        if pnl_bps >= position.take_profit_bps:
            return ExitSignal(
                should_exit=True, reason="take_profit",
                current_price=current_price, pnl_bps=pnl_bps,
            )

        # 2. 止损
        if pnl_bps <= -position.stop_loss_bps:
            return ExitSignal(
                should_exit=True, reason="stop_loss",
                current_price=current_price, pnl_bps=pnl_bps,
            )

        # 3. 超时
        if position.max_hold_seconds > 0 and position.age_seconds > position.max_hold_seconds:
            return ExitSignal(
                should_exit=True, reason="timeout",
                current_price=current_price, pnl_bps=pnl_bps,
            )

        return ExitSignal(
            should_exit=False, reason="hold",
            current_price=current_price, pnl_bps=pnl_bps,
        )


# ── P&L 计算工具 ─────────────────────────────────────

def _calc_trade_pnl(
    *,
    amount_in_wei: int,
    amount_out: int,
    r_in: int,
    r_out: int,
    gas_used: int,
    amount_in_usd: float,
    gas_price_gwei: float = 3.0,  # BSC 默认 gas price
    bnb_price_usd: float = 300.0,  # BNB/USD 价格
) -> dict:
    """计算 swap 交易的 P&L（往返成本 + gas）

    AMM 往返逻辑:
      1. 买入: amount_in → amount_out（已执行）
      2. 卖出: amount_out → expected_back（理论计算）
      3. 往返损失 = amount_in - expected_back

    返回:
      - gross_pnl_bps: 往返毛损失（basis points，万分比）
      - gas_cost_usd: gas 成本（美元）
      - net_pnl_usd: 净 P&L（美元，负数表示亏损）
      - profitable: 是否有利可图（bool）
      - break_even_bps: 盈亏平衡点（需要的最小价差 bps）
    """
    result = {
        "gross_pnl_bps": 0.0,
        "gas_cost_usd": 0.0,
        "net_pnl_usd": 0.0,
        "profitable": False,
        "break_even_bps": 0.0,
        "round_trip_out": 0,
        "slippage_loss_bps": 0.0,
    }

    # ── 1. 计算往返输出（假设立即反向卖出）──
    # 卖出后的新储备: r_in' = r_in - amount_in, r_out' = r_out + amount_out
    # PancakeSwap 0.25% fee → 997/1000
    if r_in <= 0 or r_out <= 0 or amount_out <= 0:
        return result

    # 买入后池子状态（简化：忽略手续费对储备的影响）
    new_r_in = r_in + amount_in_wei
    new_r_out = r_out - amount_out

    if new_r_out <= 0:
        # 抽干了池子（不可能发生，但防御）
        return result

    # 卖出 amount_out → 预期回收多少 quote
    # getAmountOut: (amount_out * 997 * new_r_in) / (new_r_out * 1000 + amount_out * 997)
    amount_out_with_fee = amount_out * 997
    numerator = amount_out_with_fee * new_r_in
    denominator = new_r_out * 1000 + amount_out_with_fee
    round_trip_out = numerator // denominator if denominator > 0 else 0

    result["round_trip_out"] = round_trip_out

    # ── 2. 往返毛损失（basis points）──
    if amount_in_wei > 0:
        loss = amount_in_wei - round_trip_out
        loss_ratio = loss / amount_in_wei
        result["gross_pnl_bps"] = loss_ratio * 10000  # 转为 bps
        result["slippage_loss_bps"] = result["gross_pnl_bps"]

    # ── 3. Gas 成本（USD）──
    gas_cost_wei = gas_used * int(gas_price_gwei * 1e9)
    gas_cost_bnb = gas_cost_wei / 10**18
    gas_cost_usd = gas_cost_bnb * bnb_price_usd
    result["gas_cost_usd"] = gas_cost_usd

    # ── 4. 净 P&L（USD）──
    # 往返损失（USD）= 损失比例 × 输入金额
    slippage_loss_usd = (result["gross_pnl_bps"] / 10000) * amount_in_usd
    # 总损失 = 滑点 + gas
    total_loss_usd = slippage_loss_usd + gas_cost_usd
    result["net_pnl_usd"] = -total_loss_usd  # 负数表示亏损

    # ── 5. 盈亏平衡点 ──
    # 盈利需要的最小价差（bps）= (往返滑点 + gas) / 本金
    if amount_in_usd > 0:
        result["break_even_bps"] = (total_loss_usd / amount_in_usd) * 10000

    # ── 6. 是否有利可图（纯往返永远亏，除非有套利机会）──
    result["profitable"] = result["net_pnl_usd"] > 0

    # ── 7. pnl_summary 所需的扩展字段 ──
    result["amount_in_usd"] = amount_in_usd
    result["execution_cost_usd"] = slippage_loss_usd + gas_cost_usd
    result["round_trip_pnl_usd"] = result["net_pnl_usd"]
    result["breakeven_edge_pct"] = result["break_even_bps"] / 100.0 if result["break_even_bps"] else 0.0
    if result["profitable"]:
        result["verdict"] = "profitable"
    elif result["break_even_bps"] < 50:
        result["verdict"] = "marginal"
    else:
        result["verdict"] = "unprofitable"

    return result


# ── 策略转换层（dataset 产出 → StrategyRef）──────────

def _resolve_pool_info(pair_id: str, workspace: Path | None = None) -> dict:
    """pair_id → pool_address / token_in / token_out

    查找链路:
      1. POOL_TOKEN_MAP 地址匹配（末 6 位 hex 子串）
      2. collect 目录元数据文件（pool_address 字段）
      3. 返回空（execute pre_flight 会阻断）
    """
    # 1. POOL_TOKEN_MAP 匹配
    pid_low = pair_id.lower()
    for addr, info in POOL_TOKEN_MAP.items():
        addr_low = addr.lower()
        name_low = info.get("name", "").lower()
        # 双向匹配: 地址末 6 位在 pair_id 中 / name 是 pair_id 的子串 / pair_id 是 name 的子串
        if (addr_low[-6:] in pid_low
                or name_low in pid_low
                or pid_low in name_low):
            return {
                "pool_address": addr,
                "token_in": info["quote"],
                "token_out": info["base"],
                "name": info["name"],
            }

    # 2. collect 目录元数据
    if workspace:
        import yaml as _yaml
        for base in [
            Path(workspace) / ".docs" / "ai-skills" / "collect" / "pending" / "staged",
            Path(workspace) / ".docs" / "ai-skills" / "collect" / "pending",
        ]:
            pair_dir = base / pair_id
            if not pair_dir.is_dir():
                continue
            for yml_file in sorted(pair_dir.glob("*.yml"))[:5]:
                try:
                    data = _yaml.safe_load(yml_file.read_text()) or {}
                    if not data.get("pool_address"):
                        continue
                    t_in = data.get("token0", data.get("quote", data.get("quote_token", "")))
                    t_out = data.get("token1", data.get("base", data.get("base_token", "")))
                    if t_in and t_out:
                        return {
                            "pool_address": data["pool_address"],
                            "token_in": t_in,
                            "token_out": t_out,
                            "name": pair_id,
                        }
                except Exception:
                    continue

    # 3. 无法解析
    logger.warning("_resolve_pool_info: unresolved pair_id=%s", pair_id)
    return {"pool_address": "", "token_in": "", "token_out": "", "name": pair_id}


def build_strategies_from_binding(
    indicator_binding_file: Path,
    slot_categories_file: Path | None = None,
    pool_info: dict | None = None,
    *,
    default_amount_wei: int = DEFAULT_TRADE_SIZE_WEI,
) -> list:  # list[StrategyRef] — forward ref
    """dataset 产出 → 可执行 StrategyRef 列表

    将 indicator_binding.yml 按 skeleton_id 分组，每个骨架生成一个 StrategyRef。
    pool_info 提供链上执行参数（pool_address / token_in / token_out）。
    """
    import yaml as _yaml

    data = _yaml.safe_load(Path(indicator_binding_file).read_text())
    bindings = data.get("indicator_bindings") or data.get("bindings", [])
    if not bindings:
        return []

    # 读 slot_categories 获取 strategy_type 映射
    skel_type_map: dict[str, str] = {}
    if slot_categories_file and Path(slot_categories_file).exists():
        try:
            cat_data = _yaml.safe_load(Path(slot_categories_file).read_text())
            for sb in (cat_data or {}).get("strategy_bindings", []):
                skel_type_map[sb["skeleton_id"]] = sb.get("strategy_type", "unknown")
        except Exception:
            pass

    # 按 skeleton_id 分组（条目级优先，回退到顶层）
    top_skel_id = data.get("skeleton_id", "")
    skel_groups: dict[str, list[dict]] = {}
    for b in bindings:
        sid = b.get("skeleton_id") or top_skel_id or "default"
        skel_groups.setdefault(sid, []).append(b)

    pool = pool_info or {}
    amount_wei = int(pool.get("amount_in_wei", default_amount_wei))
    top_strategy_type = data.get("strategy_type", "unknown")

    strategies: list[StrategyRef] = []
    for skel_id, group in skel_groups.items():
        # 聚合所有 category 的指标
        all_indicators: dict[str, dict] = {}
        for binding in group:
            cat = binding.get("category", "unknown")
            all_indicators[cat] = {
                "indicators": binding.get("selected_indicators", []),
                "param_hints": binding.get("param_hints", {}),
                "confidence": binding.get("confidence", 0.0),
            }

        confs = [d["confidence"] for d in all_indicators.values() if d["confidence"] > 0]
        avg_conf = sum(confs) / len(confs) if confs else 0.0

        strategies.append(StrategyRef(
            strategy_id=skel_id,
            strategy_type=skel_type_map.get(skel_id, top_strategy_type),
            confidence=avg_conf,
            entry={
                "pool_address": pool.get("pool_address", ""),
                "token_in": pool.get("token_in", ""),
                "token_out": pool.get("token_out", ""),
                "amount_in_wei": amount_wei,
                "amount_usd": amount_wei / 10**18,
                "direction": "buy",
            },
            sizing={"amount_in_usd": amount_wei / 10**18},
            exit_rules={"condition": "immediate_fill", "ttl": 120},
            metadata={
                "indicators": all_indicators,
                "categories": list(all_indicators.keys()),
                "binding_count": len(group),
            },
        ))

    return strategies


# ── 轻量 AssetRef（§3.7 kind 枚举）─────────────────
@dataclass
class SignalRef:
    """collect 产出 — 市场信号"""
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

    STEPS = ["collect", "curate", "dataset", "execute", "fix"]

    def __init__(
        self,
        *,
        config: dict | None = None,
        executor: Any = None,
        budget: Any = None,
        preauth: Any = None,
        notify: Any = None,
        diagnosis: DiagnosisProfile | None = None,
        slippage_guard: Any = None,
        tvl_breaker: Any = None,
        mev_guard: Any = None,
        approve_manager: Any = None,
        workspace: Path | None = None,
        position_manager: PositionManager | None = None,
        signal_evaluator: SignalEvaluator | None = None,
    ):
        self.config = config or {}
        self._executor = executor
        self._budget = budget
        self._preauth = preauth
        self._notify = notify
        self._diagnosis = diagnosis or DiagnosisProfile()
        self._slippage_guard = slippage_guard
        self._tvl_breaker = tvl_breaker
        self._mev_guard = mev_guard
        self._approve_manager = approve_manager
        self._workspace = workspace or Path.cwd()
        self._simulate = bool(config.get("simulate") if config else False)
        # Path B: 信号评估 + 持仓管理
        self._positions = position_manager or PositionManager(self._workspace)
        self._signals = signal_evaluator or SignalEvaluator(config=self.config)
        # 运行状态
        self._running = False
        self._cycle_count = 0
        self._consecutive_failures = 0
        self._current_retreat_level: str | None = None
        self._cooldown_until: float = 0.0

    # ── Helpers ──────────────────────────────────────
    async def _get_ordered_reserves(
        self, pool_address: str, token_in: str,
    ) -> tuple[int, int]:
        """获取按 (reserve_in, reserve_out) 排序的 reserves"""
        r0, r1 = await self._executor.get_reserves(pool_address)
        pool_info = POOL_TOKEN_MAP.get(pool_address)
        if not pool_info:
            return (r0, r1)
        base = pool_info["base"].lower()
        quote = pool_info["quote"].lower()
        # PancakeV2: token0 = smaller address
        token0 = min(base, quote)
        if token_in.lower() == token0:
            return (r0, r1)
        return (r1, r0)

    # NOTE: _local_strategy_builder 已移除 — dataset 由 nexrur DatasetOps 调用
    # WQ-YI DeFiL1Recommender + DeFiL2Binder (LLM-driven) 处理

    # ── Step 1: collect ─────────────────────────────────
    async def _step_collect(self) -> list[SignalRef]:
        """市场信号收集 — modules/collect/ (Arb 版)

        使用 ArbCollectSkill 三阶段管线:
          discover → enrich → persist → 读 registry → 转 SignalRef
        """
        import sys
        from pathlib import Path
        collect_dir = Path(__file__).resolve().parent.parent / "modules" / "collect" / "scripts"
        if str(collect_dir) not in sys.path:
            sys.path.insert(0, str(collect_dir))
        from toolloop_arb_collect import ArbCollectSkill

        skill = ArbCollectSkill(config=self.config.get("collect", {}))
        outcome = await skill.run()

        # 从 registry 读取已持久化的 pending 池对 → 转 SignalRef
        signals = []
        for pair_id in skill.registry.list_pending():
            entry = skill.registry.get(pair_id) or {}
            signals.append(SignalRef(
                sig_id=pair_id,
                signal_type="pool_discovery",
                strength=0.0,
                source="arb_collect",
                pool_address=entry.get("pool_address", ""),
                metadata={"discovery_method": entry.get("discovery_method", ""), **entry},
            ))

        logger.info("collect: %d persisted (discovered=%d, enriched=%d, skipped=%d)",
                     len(signals), outcome.pools_discovered,
                     outcome.pools_enriched, outcome.pools_skipped)
        return signals

    # ── Step 2: curate ───────────────────────────────
    async def _step_curate(self, signals: list[SignalRef]) -> list[dict]:
        """策略骨架提取 — WQ-YI KnowledgeBaseSkill(domain=defi)"""
        import sys as _sys
        _wqyi = Path(__file__).resolve().parents[5] / "WQ-YI"
        _curate_dir = _wqyi / ".gemini" / "skills" / "brain-curate-knowledge" / "scripts"
        if str(_curate_dir) not in _sys.path:
            _sys.path.insert(0, str(_curate_dir))
        from skill_curate_knowledge import KnowledgeBaseSkill  # type: ignore[import-untyped]

        skeletons: list[dict] = []
        for sig in signals:
            pair_id = sig.sig_id
            collect_dir = None
            for candidate in [
                self._workspace / ".docs" / "ai-skills" / "collect" / "pending" / pair_id,
                self._workspace / ".docs" / "ai-skills" / "collect" / "pending" / "staged" / pair_id,
            ]:
                if candidate.is_dir():
                    collect_dir = candidate
                    break
            if collect_dir is None:
                logger.warning("curate: collect dir missing for %s", pair_id)
                continue

            paper = {"abbr": pair_id, "name": pair_id, "path": str(collect_dir), "domain": "defi"}
            try:
                skill = KnowledgeBaseSkill(paper)
                curate_dir = self._workspace / ".docs" / "ai-skills" / "curate" / "staged" / pair_id
                curate_dir.mkdir(parents=True, exist_ok=True)
                skill.work_dir = curate_dir
                success = skill.run()
                if success:
                    skeletons.append({"id": pair_id, "path": str(curate_dir), "type": "curated"})
                else:
                    logger.warning("curate: skill returned failure for %s", pair_id)
            except Exception as exc:
                logger.error("curate failed for %s: %s", pair_id, exc)

        logger.info("curate: %d skeletons from %d signals", len(skeletons), len(signals))
        return skeletons

    # ── 产物写入 ────────────────────────────────────
    def _write_execute_artifacts(
        self, results: list[dict], strategies: list[StrategyRef],
    ) -> Path | None:
        """写执行产物到 .docs/ai-skills/execute/{simulator|output}/

        路径由执行器类型决定（非 simulate 配置）：
          - DryRunDexExecutor (is_live=False) → execute/simulator/
          - LiveDexExecutor   (is_live=True)  → execute/output/
        """
        import yaml as _yaml
        from datetime import datetime, timezone

        # 根据执行器类型选路径：DryRun→simulator, Live→output
        is_live = getattr(self._executor, "is_live", True) if self._executor else False
        subdir = "output" if is_live else "simulator"
        output_root = self._workspace / ".docs" / "ai-skills" / "execute" / subdir
        output_root.mkdir(parents=True, exist_ok=True)

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        run_dir = output_root / ts
        run_dir.mkdir(parents=True, exist_ok=True)

        # 策略 → 结果 映射
        strat_map = {s.strategy_id: s for s in strategies}

        records = []
        for r in results:
            sid = r.get("strategy_id", "unknown")
            s = strat_map.get(sid)
            record = {
                "strategy_id": sid,
                "strategy_type": s.strategy_type if s else "unknown",
                "status": r.get("status", "unknown"),
                "reason": r.get("reason"),
                "tx_hash": r.get("tx_hash"),
                "gas_used": r.get("gas_used"),
                "block_number": r.get("block_number"),
                "simulated": r.get("simulated", False),
                "amount_in": r.get("amount_in"),
                "amount_out": r.get("amount_out"),
                "price_impact": r.get("price_impact"),
            }
            if r.get("pnl"):
                record["pnl"] = r["pnl"]
            if s:
                record["entry"] = s.entry
                record["confidence"] = s.confidence
            records.append(record)

        # P&L 汇总（仅统计有 pnl 的交易）
        pnl_trades = [r["pnl"] for r in records if r.get("pnl")]
        pnl_summary = None
        if pnl_trades:
            pnl_summary = {
                "traded_count": len(pnl_trades),
                "total_volume_usd": round(sum(p["amount_in_usd"] for p in pnl_trades), 4),
                "total_execution_cost_usd": round(sum(p["execution_cost_usd"] for p in pnl_trades), 4),
                "total_gas_cost_usd": round(sum(p["gas_cost_usd"] for p in pnl_trades), 4),
                "total_round_trip_pnl_usd": round(sum(p["round_trip_pnl_usd"] for p in pnl_trades), 4),
                "avg_breakeven_edge_pct": round(
                    sum(p["breakeven_edge_pct"] for p in pnl_trades) / len(pnl_trades), 4
                ),
                "verdicts": [p["verdict"] for p in pnl_trades],
            }

        summary = {
            "run_timestamp": ts,
            "cycle": self._cycle_count,
            "total": len(records),
            "success": sum(1 for r in records if r["status"] == "success"),
            "blocked": sum(1 for r in records if r["status"] == "blocked"),
            "errors": sum(1 for r in records if r["status"] == "error"),
            "simulated": any(r.get("simulated") for r in records),
            "results": records,
        }
        if pnl_summary:
            summary["pnl_summary"] = pnl_summary

        artifact_path = run_dir / "execution_results.yml"
        artifact_path.write_text(
            _yaml.dump(summary, default_flow_style=False, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        logger.info("execute: artifacts written to %s", artifact_path)
        return run_dir

    # ── Step 3: dataset ──────────────────────────────
    async def _step_dataset(self, skeletons: list[dict]) -> list[StrategyRef]:
        """指标绑定 + 策略构建 — 委托 DatasetOps (L1+L2) → StrategyRef

        DatasetOps 是 L1→L2 管线的唯一真相源；本方法只做:
          1. skeletons dict → AssetRef 转换
          2. 调 DatasetOps
          3. 产出目录 → StrategyRef 转换
        """
        from nexrur.engines.orchestrator import AssetRef as _AssetRef
        from _shared.engines.agent_ops_arb import DatasetOps

        # skeleton dict → AssetRef（DatasetOps 需要 kind="arb_strategy"）
        assets = []
        for skel in skeletons:
            assets.append(_AssetRef(
                kind="arb_strategy",
                id=skel["id"],
                path=skel.get("path", ""),
                metadata={"type": skel.get("type", "curated")},
            ))

        ops = DatasetOps()
        _tid = f"arb-cycle-{self._cycle_count}"
        result = ops(
            pipeline_run_id=_tid,
            step_run_id=f"{_tid}-dataset",
            trace_id=_tid,
            assets_input=assets,
            config={},
            workspace=self._workspace,
        )

        # DatasetOps 产出 → StrategyRef 转换
        all_strategies: list[StrategyRef] = []
        for asset in result.assets_produced:
            output_dir = self._workspace / asset.path
            ind_file = output_dir / "indicator_binding.yml"
            l1_file = output_dir / "slot_categories.yml"
            if ind_file.exists():
                pool_info = _resolve_pool_info(asset.id, self._workspace)
                strategies = build_strategies_from_binding(ind_file, l1_file, pool_info)
                all_strategies.extend(strategies)

        logger.info("dataset: %d strategies from %d skeletons", len(all_strategies), len(skeletons))
        return all_strategies

    # ── Step 4: execute ──────────────────────────────
    async def _step_execute(self, strategies: list[StrategyRef]) -> list[dict]:
        """执行（因子驱动）— 信号评估 → 入场/出场/持仓 → DexExecutor + 三层安全护甲

        Path B 流程:
          1. 先检查已有持仓 — 是否需要出场（止盈/止损/超时）
          2. 再评估新策略 — 信号是否触发入场
        """
        results: list[dict] = []

        # Phase 1: 检查已有持仓的出场信号
        for pos in self._positions.list_open():
            exit_result = await self._evaluate_and_exit(pos)
            if exit_result:
                results.append(exit_result)

        # Phase 2: 评估新策略的入场信号
        for strategy in strategies:
            result = await self._execute_single(strategy)
            results.append(result)

        ok = sum(1 for r in results if r.get("status") == "success")
        skipped = sum(1 for r in results if r.get("status") == "skipped")
        logger.info("execute: %d results (%d success, %d skipped)", len(results), ok, skipped)

        # 写产物到 .docs/ai-skills/execute/{simulator|output}/
        try:
            self._write_execute_artifacts(results, strategies)
        except Exception as exc:
            logger.warning("execute: artifact write failed: %s", exc)

        return results

    async def _evaluate_and_exit(self, position: Position) -> dict | None:
        """已有持仓 — 获取市场快照 → 评估出场信号 → SELL if triggered"""
        pool_address = position.pool_address

        # 获取市场快照
        snapshot = await self._fetch_market_snapshot(pool_address, position.token_held)
        if not snapshot.is_valid:
            logger.warning("exit check: invalid snapshot for %s", pool_address[:10])
            return None

        exit_signal = self._signals.evaluate_exit(position, snapshot)
        if not exit_signal.should_exit:
            logger.debug("hold: %s pnl=%.1f bps", position.strategy_id, exit_signal.pnl_bps)
            return None

        logger.info("exit signal: %s reason=%s pnl=%.1f bps",
                     position.strategy_id, exit_signal.reason, exit_signal.pnl_bps)

        # 执行卖出 — token_held → token_quote
        sell_result = await self._do_swap(
            strategy_id=f"{position.strategy_id}_exit",
            pool_address=pool_address,
            token_in=position.token_held,
            token_out=position.token_quote,
            amount_in_wei=position.amount_held,
        )

        if sell_result.get("status") == "success":
            pnl_data = sell_result.get("pnl")
            self._positions.close_position(
                pool_address,
                exit_price=snapshot.spot_price,
                exit_reason=exit_signal.reason,
                pnl=pnl_data,
            )
            sell_result["exit_reason"] = exit_signal.reason
            sell_result["hold_seconds"] = position.age_seconds
            sell_result["floating_pnl_bps"] = exit_signal.pnl_bps

        return sell_result

    async def _execute_single(self, strategy: StrategyRef) -> dict:
        """单策略执行（Path B）— 信号评估 → 入场/跳过

        流程:
          1. Pre-flight 安全检查
          2. 获取市场快照
          3. 已有持仓 → skip（一池一仓）
          4. 信号评估 → should_enter?
          5. 入场: approve → swap → 建仓
        """
        sid = strategy.strategy_id
        entry = strategy.entry

        # 1. Pre-flight
        pre = await self.pre_flight(strategy)
        if not pre["passed"]:
            return {"strategy_id": sid, "status": "blocked", "reason": pre["reason"]}

        # 2. Extract execution params
        pool_address = entry.get("pool_address", "")
        token_in = entry.get("token_in", "")
        token_out = entry.get("token_out", "")
        amount_in_wei = int(entry.get("amount_in_wei", 0))

        if not all([pool_address, token_in, token_out, amount_in_wei > 0]):
            return {"strategy_id": sid, "status": "blocked",
                    "reason": "incomplete_entry_params"}

        if not self._executor:
            return {"strategy_id": sid, "status": "blocked", "reason": "no_executor"}

        # 3. 已有持仓 → skip（一池一仓原则）
        if self._positions.has_position(pool_address):
            return {"strategy_id": sid, "status": "skipped",
                    "reason": "position_already_open"}

        # 4. 获取市场快照 + 信号评估
        snapshot = await self._fetch_market_snapshot(pool_address, token_in)

        # force_entry: 跳过信号评估（DryRun 验证 swap 链路用）
        force_entry = self.config.get("force_entry", False)
        if force_entry:
            signal_result = {"should_enter": True, "reason": "force_entry",
                            "confidence": 1.0}
        else:
            signal_result = self._signals.evaluate_entry(strategy, snapshot)

        if not signal_result.get("should_enter"):
            return {
                "strategy_id": sid,
                "status": "skipped",
                "reason": f"no_entry_signal:{signal_result.get('reason', 'unknown')}",
                "signal": signal_result,
            }

        logger.info("entry signal: %s type=%s confidence=%.2f",
                     sid, strategy.strategy_type, signal_result.get("confidence", 0))

        # 5. 执行入场 swap
        swap_result = await self._do_swap(
            strategy_id=sid,
            pool_address=pool_address,
            token_in=token_in,
            token_out=token_out,
            amount_in_wei=amount_in_wei,
            volume_usd=entry.get("amount_usd", amount_in_wei / 10**18),
        )

        # 6. 建仓记录
        if swap_result.get("status") == "success":
            exit_rules = strategy.exit_rules or {}
            pos = Position(
                pool_address=pool_address,
                strategy_id=sid,
                token_held=token_out,
                token_quote=token_in,
                amount_held=swap_result.get("amount_out", 0),
                entry_price=snapshot.spot_price,
                entry_amount_usd=entry.get("amount_usd", amount_in_wei / 10**18),
                entry_block=swap_result.get("block_number", 0),
                entry_tx_hash=swap_result.get("tx_hash", ""),
                take_profit_bps=exit_rules.get("take_profit_bps", 50),
                stop_loss_bps=exit_rules.get("stop_loss_bps", 20),
                max_hold_seconds=exit_rules.get("max_hold_seconds", 300),
            )
            self._positions.open_position(pos)
            swap_result["position_opened"] = True
            swap_result["signal"] = signal_result

        return swap_result

    async def _fetch_market_snapshot(self, pool_address: str, token_in: str) -> MarketSnapshot:
        """从链上获取市场快照 — reserves → spot_price"""
        try:
            r_in, r_out = await self._get_ordered_reserves(pool_address, token_in)
            spot_price = r_out / r_in if r_in > 0 else 0.0
            return MarketSnapshot(
                pool_address=pool_address,
                reserve_in=r_in,
                reserve_out=r_out,
                spot_price=spot_price,
            )
        except Exception as exc:
            logger.warning("snapshot fetch failed: %s", exc)
            return MarketSnapshot(pool_address=pool_address)

    async def _do_swap(
        self, *, strategy_id: str, pool_address: str,
        token_in: str, token_out: str, amount_in_wei: int,
        volume_usd: float = 0.0,
    ) -> dict:
        """底层 swap 执行 — 安全护甲 + approve + DexExecutor.swap()

        从旧 _execute_single 提取的纯执行逻辑（无信号判断）。
        """
        # TVL breaker
        if self._tvl_breaker and not self._tvl_breaker.allows_arb():
            return {"strategy_id": strategy_id, "status": "blocked",
                    "reason": f"tvl_breaker:{self._tvl_breaker.halt_reason}"}

        # Get reserves + expected output
        try:
            r_in, r_out = await self._get_ordered_reserves(pool_address, token_in)
        except Exception as exc:
            exc_name = type(exc).__name__
            if exc_name == "PoolIncompatibleError":
                return {"strategy_id": strategy_id, "status": "error",
                        "reason": f"pool_incompatible:{exc}"}
            return {"strategy_id": strategy_id, "status": "error",
                    "reason": f"get_reserves:{exc}"}

        expected_out = await self._executor.get_amount_out(amount_in_wei, r_in, r_out)
        if expected_out <= 0:
            return {"strategy_id": strategy_id, "status": "blocked",
                    "reason": "zero_expected_output"}

        # Slippage guard
        ideal_out = amount_in_wei * r_out // r_in if r_in > 0 else 0
        min_amount_out = expected_out * 98 // 100
        if self._slippage_guard:
            check = await self._slippage_guard.check(
                amount_in=amount_in_wei, expected_out=expected_out,
                ideal_out=ideal_out,
            )
            if not check["passed"]:
                return {"strategy_id": strategy_id, "status": "blocked",
                        "reason": f"slippage:{check['reason']}"}
            min_amount_out = check.get("min_amount_out", min_amount_out)

        # MEV guard
        if self._mev_guard and await self._mev_guard.should_delay():
            return {"strategy_id": strategy_id, "status": "delayed",
                    "reason": "mev_cooldown"}

        # Ensure allowance
        if self._approve_manager:
            try:
                router = ROUTER
                if self._executor.adapter:
                    router = self._executor.adapter.router_address
                await self._approve_manager.ensure_allowance(
                    token_in, router, amount_in_wei,
                )
            except Exception as exc:
                return {"strategy_id": strategy_id, "status": "error",
                        "reason": f"approve:{exc}"}

        # Execute swap
        try:
            tx_result = await self._executor.swap(
                token_in=token_in, token_out=token_out,
                amount_in=amount_in_wei, min_amount_out=min_amount_out,
                pair_address=pool_address,
            )
        except Exception as exc:
            return {"strategy_id": strategy_id, "status": "error",
                    "reason": f"swap:{exc}"}

        # Record budget
        status = tx_result.get("status", "unknown")
        if self._budget and status == "success":
            gas_usd = tx_result.get("gas_used", 0) * 3e-9 * 300
            self._budget.record_trade(gas_usd=gas_usd, volume_usd=volume_usd)

        # P&L estimation
        pnl = None
        actual_out = tx_result.get("amount_out", 0) or 0
        if status == "success" and actual_out > 0 and r_in > 0 and r_out > 0:
            pnl = _calc_trade_pnl(
                amount_in_wei=amount_in_wei,
                amount_out=actual_out,
                r_in=r_in,
                r_out=r_out,
                gas_used=tx_result.get("gas_used", 0),
                amount_in_usd=amount_in_wei / 10**18,
            )

        return {
            "strategy_id": strategy_id,
            "status": status,
            "tx_hash": tx_result.get("tx_hash"),
            "gas_used": tx_result.get("gas_used"),
            "block_number": tx_result.get("block_number"),
            "simulated": tx_result.get("simulated", False),
            "amount_in": tx_result.get("amount_in"),
            "amount_out": tx_result.get("amount_out"),
            "price_impact": tx_result.get("price_impact"),
            "pnl": pnl,
        }

    # ── Step 5: fix ──────────────────────────────────
    async def _step_fix(self, results: list[dict]) -> str | None:
        """策略修复 — 三级回退诊断（§3.6）

        失败分类:
          - 结构性 (tvl_breaker/no_executor) → C (re-collect)
          - 因子性 (zero_expected_output/slippage) → B (re-curate)
          - 参数性 (tx_revert/approve_fail) → A (param adjust)

        Returns:
            回退目标步骤名（collect/curate/execute），或 None（无需修复）
        """
        failures = [r for r in results if r.get("status") not in ("success", "delayed")]
        if not failures:
            self._consecutive_failures = 0
            self._current_retreat_level = None
            return None

        self._consecutive_failures += 1
        reasons = [r.get("reason", "") for r in failures]

        # 分类失败原因 → 确定回退级别
        structural = any(
            k in r for r in reasons for k in ("tvl_breaker", "no_executor", "tvl_halt")
        )
        factor_issue = any(
            k in r for r in reasons
            for k in ("zero_expected_output", "slippage", "get_reserves")
        )

        if structural:
            level = "C"
        elif factor_issue and self._consecutive_failures > self._diagnosis.max_level_a_retries:
            level = "B"
        elif self._consecutive_failures <= self._diagnosis.max_level_a_retries:
            level = "A"
        elif self._consecutive_failures <= self._diagnosis.max_consecutive_failures:
            level = "B"
        else:
            level = "C"

        self._current_retreat_level = level
        retreat = RETREAT_LEVELS[level]
        target = retreat["target_step"]

        logger.warning(
            "fix: level %s retreat → %s (consecutive=%d, reasons=%s)",
            level, target, self._consecutive_failures,
            "; ".join(reasons[:3]),
        )

        # C 级回退 → 冷静期
        if level == "C":
            self._cooldown_until = time.monotonic() + self._diagnosis.cooldown_minutes * 60
            logger.warning("fix: C-level cooldown for %d minutes",
                           self._diagnosis.cooldown_minutes)

        return target

    # ── 前置检查（§3.5 pre_flight）───────────────────
    async def pre_flight(self, strategy: Any) -> dict:
        """确定性前置检查 — 零 LLM，7 项门控"""
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

        # 4. 池深度检查（需 preauth）
        if self._preauth and hasattr(strategy, "signal"):
            pool = getattr(strategy.signal, "pool_address", "")
            if pool and not self._preauth.is_pool_approved(pool):
                reasons.append(f"pool_not_approved ({pool[:10]}...)")

        # 5. 冷静期检查
        if time.monotonic() < self._cooldown_until:
            remaining = self._cooldown_until - time.monotonic()
            reasons.append(f"cooldown_active ({remaining:.0f}s remaining)")

        # 6. TVL 熔断检查
        if self._tvl_breaker and not self._tvl_breaker.allows_arb():
            reasons.append(f"tvl_halt:{self._tvl_breaker.halt_reason}")

        # 7. 执行参数完整性
        entry = getattr(strategy, "entry", {})
        if entry and not entry.get("pool_address"):
            reasons.append("missing_pool_address")

        if reasons:
            return {"passed": False, "reason": "; ".join(reasons)}
        return {"passed": True, "reason": None}

    # ── 单次循环 ─────────────────────────────────────
    async def run_cycle(self, *, start_step: str | None = None) -> dict:
        """单次 5 步循环（支持回退重入）

        Args:
            start_step: 回退时从此步开始（默认 collect）
        """
        self._cycle_count += 1
        start = start_step or "collect"
        start_idx = self.STEPS.index(start) if start in self.STEPS else 0

        signals: list[SignalRef] = []
        skeletons: list[dict] = []
        strategies: list[StrategyRef] = []
        results: list[dict] = []
        retreat_target: str | None = None

        for step_name in self.STEPS[start_idx:]:
            try:
                if step_name == "collect":
                    signals = await self._step_collect()
                    if not signals:
                        return {"cycle": self._cycle_count, "outcome": "no_signals"}
                elif step_name == "curate":
                    skeletons = await self._step_curate(signals)
                    if not skeletons:
                        return {"cycle": self._cycle_count, "outcome": "curate_failed"}
                elif step_name == "dataset":
                    strategies = await self._step_dataset(skeletons)
                    if not strategies:
                        return {"cycle": self._cycle_count, "outcome": "no_strategies"}
                elif step_name == "execute":
                    results = await self._step_execute(strategies)
                    ok = sum(1 for r in results if r.get("status") == "success")
                    if ok and self._notify:
                        await self._notify.send(
                            level="INFO", title="Arb trades executed",
                            body=f"cycle={self._cycle_count}",
                            data={"success": ok, "total": len(results)},
                        )
                elif step_name == "fix":
                    retreat_target = await self._step_fix(results)
            except Exception as exc:
                logger.error("step %s failed: %s", step_name, exc)
                if self._notify:
                    await self._notify.send(
                        level="WARNING", title="Arb step failed",
                        body=f"cycle={self._cycle_count} step={step_name}",
                        data={"error": str(exc)[:200]},
                    )
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
                        if self._notify:
                            await self._notify.send(
                                level="WARNING", title="Arb budget exhausted",
                                body=f"cycle={self._cycle_count}",
                                data={"reason": reason},
                            )
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
                    if self._notify:
                        await self._notify.send(
                            level="CRITICAL", title="Arb campaign HALTED",
                            body=f"Max failures ({self._diagnosis.max_consecutive_failures}) reached",
                            data={"cycles": self._cycle_count},
                        )
                    break

                await asyncio.sleep(interval)
        finally:
            self._running = False
            logger.info("campaign: stopped after %d cycles", self._cycle_count)

    def stop(self):
        """优雅停止"""
        self._running = False
