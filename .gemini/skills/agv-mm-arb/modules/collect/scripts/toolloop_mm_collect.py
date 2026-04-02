"""
toolloop_mm_collect — collect 工具循环库（纯数学计算层）

合并自: modules/curate/scripts/toolloop_curate_arb.py
原文件三大功能块完整保留:
  1. 技术指标计算（EMA/RSI/Bollinger/VWAP/MACD/ATR/compute_all）
  2. AMM 恒积数学（滑点/最优套利量/无常损失/三明治估算）
  3. 跨池分析引擎（价差检测/Z-score 均值回归/三角套利）

纯数学函数 + 轻量 dataclass，零网络依赖。
collect skill 消费此模块做指标计算 + 跨池分析。

对齐关系:
  WQ-YI curate 步骤 → 从论文提取骨架 → standard_operators.yml 定义算子
  AGV   collect  步骤 → 从链上提取指标 → 本文件实现算子
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field


# ═══════════════════════════════════════════════════════
# Part 1: 技术指标计算
# ═══════════════════════════════════════════════════════

def ema(closes: list[float], period: int) -> list[float]:
    """指数移动平均 — 递推 O(n)

    Returns:
        与 closes 等长的 list，前 period-1 个元素为 NaN
    """
    if not closes or period < 1:
        return []
    result: list[float] = [float("nan")] * len(closes)
    k = 2.0 / (period + 1)

    if len(closes) < period:
        return result
    sma = sum(closes[:period]) / period
    result[period - 1] = sma

    prev = sma
    for i in range(period, len(closes)):
        val = closes[i] * k + prev * (1 - k)
        result[i] = val
        prev = val
    return result


def rsi(closes: list[float], period: int = 14) -> list[float]:
    """相对强弱指数 — Wilder 平滑法

    Returns:
        与 closes 等长的 list，前 period 个元素为 NaN
    """
    if len(closes) < period + 1:
        return [float("nan")] * len(closes)

    result: list[float] = [float("nan")] * len(closes)
    gains: list[float] = []
    losses: list[float] = []

    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    if avg_loss == 0:
        result[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        result[period] = 100.0 - 100.0 / (1.0 + rs)

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            result[i + 1] = 100.0
        else:
            rs = avg_gain / avg_loss
            result[i + 1] = 100.0 - 100.0 / (1.0 + rs)

    return result


@dataclass
class BollingerBand:
    upper: float
    middle: float
    lower: float
    bandwidth: float    # (upper - lower) / middle


def bollinger_bands(
    closes: list[float], period: int = 20, num_std: float = 2.0,
) -> list[BollingerBand | None]:
    """布林带 — SMA ± k·σ"""
    result: list[BollingerBand | None] = [None] * len(closes)
    if len(closes) < period:
        return result

    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        middle = sum(window) / period
        variance = sum((x - middle) ** 2 for x in window) / period
        std = math.sqrt(variance)

        upper = middle + num_std * std
        lower = middle - num_std * std
        bw = (upper - lower) / middle if middle != 0 else 0.0

        result[i] = BollingerBand(
            upper=upper, middle=middle, lower=lower, bandwidth=bw,
        )
    return result


def vwap(bars: list[dict]) -> list[float]:
    """成交量加权平均价 — 累积法"""
    result: list[float] = []
    cum_vol = 0.0
    cum_pv = 0.0

    for bar in bars:
        typical_price = (bar.get("high", 0) + bar.get("low", 0) + bar.get("close", 0)) / 3
        vol = bar.get("volume_usd", 0)
        cum_vol += vol
        cum_pv += typical_price * vol
        if cum_vol > 0:
            result.append(cum_pv / cum_vol)
        else:
            result.append(typical_price)
    return result


@dataclass
class MACDResult:
    macd_line: list[float]
    signal_line: list[float]
    histogram: list[float]


def macd(
    closes: list[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> MACDResult:
    """MACD — 双 EMA 差值 + 信号线"""
    fast = ema(closes, fast_period)
    slow = ema(closes, slow_period)

    macd_line = []
    for f, s in zip(fast, slow):
        if math.isnan(f) or math.isnan(s):
            macd_line.append(float("nan"))
        else:
            macd_line.append(f - s)

    valid_macd = [v for v in macd_line if not math.isnan(v)]
    signal = ema(valid_macd, signal_period) if valid_macd else []

    signal_full: list[float] = [float("nan")] * len(macd_line)
    valid_start = next((i for i, v in enumerate(macd_line) if not math.isnan(v)), len(macd_line))
    for j, val in enumerate(signal):
        idx = valid_start + j
        if idx < len(signal_full):
            signal_full[idx] = val

    histogram = []
    for m, s in zip(macd_line, signal_full):
        if math.isnan(m) or math.isnan(s):
            histogram.append(float("nan"))
        else:
            histogram.append(m - s)

    return MACDResult(macd_line=macd_line, signal_line=signal_full, histogram=histogram)


def atr(bars: list[dict], period: int = 14) -> list[float]:
    """平均真实波幅 — 测量波动率"""
    if len(bars) < 2:
        return [float("nan")] * len(bars)

    true_ranges: list[float] = [float("nan")]
    for i in range(1, len(bars)):
        h = bars[i].get("high", 0)
        l = bars[i].get("low", 0)
        prev_c = bars[i - 1].get("close", 0)
        tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
        true_ranges.append(tr)

    result: list[float] = [float("nan")] * len(bars)
    if len(true_ranges) < period + 1:
        return result

    valid_trs = [v for v in true_ranges[1:period + 1] if not math.isnan(v)]
    if not valid_trs:
        return result
    current_atr = sum(valid_trs) / len(valid_trs)
    result[period] = current_atr

    for i in range(period + 1, len(true_ranges)):
        if not math.isnan(true_ranges[i]):
            current_atr = (current_atr * (period - 1) + true_ranges[i]) / period
            result[i] = current_atr

    return result


# ── 批量计算快照 ─────────────────────────────────────
@dataclass
class IndicatorSnapshot:
    """某一时刻的全部指标快照"""
    timestamp: float = 0.0
    price: float = 0.0
    rsi_14: float = float("nan")
    ema_12: float = float("nan")
    ema_26: float = float("nan")
    vwap_val: float = float("nan")
    bb_upper: float = float("nan")
    bb_lower: float = float("nan")
    bb_middle: float = float("nan")
    bb_bandwidth: float = float("nan")
    macd_val: float = float("nan")
    macd_signal: float = float("nan")
    macd_hist: float = float("nan")
    atr_14: float = float("nan")


def compute_all(bars: list[dict]) -> list[IndicatorSnapshot]:
    """从 OHLCV 一次性计算全部指标"""
    if not bars:
        return []

    closes = [b.get("close", 0.0) for b in bars]
    timestamps = [b.get("timestamp", 0.0) for b in bars]

    rsi_vals = rsi(closes, 14)
    ema12 = ema(closes, 12)
    ema26 = ema(closes, 26)
    vwap_vals = vwap(bars)
    bb_vals = bollinger_bands(closes, 20, 2.0)
    macd_result = macd(closes, 12, 26, 9)
    atr_vals = atr(bars, 14)

    snapshots: list[IndicatorSnapshot] = []
    for i in range(len(bars)):
        bb = bb_vals[i]
        snap = IndicatorSnapshot(
            timestamp=timestamps[i],
            price=closes[i],
            rsi_14=rsi_vals[i],
            ema_12=ema12[i],
            ema_26=ema26[i],
            vwap_val=vwap_vals[i],
            bb_upper=bb.upper if bb else float("nan"),
            bb_lower=bb.lower if bb else float("nan"),
            bb_middle=bb.middle if bb else float("nan"),
            bb_bandwidth=bb.bandwidth if bb else float("nan"),
            macd_val=macd_result.macd_line[i],
            macd_signal=macd_result.signal_line[i],
            macd_hist=macd_result.histogram[i],
            atr_14=atr_vals[i],
        )
        snapshots.append(snap)

    return snapshots


# ═══════════════════════════════════════════════════════
# Part 2: AMM 恒积数学
# ═══════════════════════════════════════════════════════

def get_amount_out(amount_in: int, reserve_in: int, reserve_out: int,
                   fee_bps: int = 30) -> int:
    """AMM 输出量（含手续费）

    fee_bps: 手续费（basis points）— PancakeSwap V2 = 25, Uniswap V2 = 30
    """
    if amount_in <= 0 or reserve_in <= 0 or reserve_out <= 0:
        return 0
    fee_factor = 10000 - fee_bps
    numerator = amount_in * fee_factor * reserve_out
    denominator = reserve_in * 10000 + amount_in * fee_factor
    return numerator // denominator


def get_amount_in(amount_out: int, reserve_in: int, reserve_out: int,
                  fee_bps: int = 30) -> int:
    """达到目标输出量需要多少输入"""
    if amount_out <= 0 or reserve_in <= 0 or amount_out >= reserve_out:
        return 0
    fee_factor = 10000 - fee_bps
    numerator = reserve_in * amount_out * 10000
    denominator = (reserve_out - amount_out) * fee_factor
    return numerator // denominator + 1


def effective_price(amount_in: int, reserve_in: int, reserve_out: int,
                    fee_bps: int = 30) -> float:
    """实际成交均价 = amount_out / amount_in"""
    out = get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)
    if out == 0 or amount_in == 0:
        return 0.0
    return out / amount_in


def spot_price(reserve_in: int, reserve_out: int) -> float:
    """即时报价（不含手续费、不含滑点）"""
    if reserve_in <= 0:
        return 0.0
    return reserve_out / reserve_in


def price_impact(amount_in: int, reserve_in: int, reserve_out: int,
                 fee_bps: int = 30) -> float:
    """价格冲击 — 实际成交价 vs 即时报价的偏离 (0~1)"""
    sp = spot_price(reserve_in, reserve_out)
    if sp <= 0:
        return 1.0
    ep = effective_price(amount_in, reserve_in, reserve_out, fee_bps)
    if ep <= 0:
        return 1.0
    return max(0.0, 1.0 - ep / sp)


def optimal_arb_size(reserve_in: int, reserve_out: int,
                     target_price: float, fee_bps: int = 30) -> int:
    """当池子价格偏离目标价时，计算最优交易量

    公式: Δx* = (√(fee_factor · r_x · r_y · p*) - 10000 · r_x) / fee_factor
    """
    if reserve_in <= 0 or reserve_out <= 0 or target_price <= 0:
        return 0

    fee_factor = 10000 - fee_bps
    current_price = spot_price(reserve_in, reserve_out)

    if current_price <= 0:
        return 0
    if current_price >= target_price:
        return 0

    inner = fee_factor * reserve_in * reserve_out * target_price
    if inner <= 0:
        return 0

    sqrt_val = math.sqrt(inner)
    numerator = sqrt_val - 10000 * reserve_in
    if numerator <= 0:
        return 0

    result = int(numerator / fee_factor)
    return max(result, 0)


def impermanent_loss(price_ratio: float) -> float:
    """LP 无常损失百分比

    公式: IL = 2·√r / (1+r) - 1  （r = price_ratio）
    """
    if price_ratio <= 0:
        return 1.0
    r = price_ratio
    return 2.0 * math.sqrt(r) / (1.0 + r) - 1.0


def sandwich_profit_estimate(victim_amount_in: int,
                             reserve_in: int, reserve_out: int,
                             front_amount: int,
                             fee_bps: int = 30) -> float:
    """估算三明治攻击利润 — 反向用途：判断自己被夹的成本"""
    if front_amount <= 0:
        return 0.0

    out_front = get_amount_out(front_amount, reserve_in, reserve_out, fee_bps)
    r_in_1 = reserve_in + front_amount
    r_out_1 = reserve_out - out_front

    out_victim = get_amount_out(victim_amount_in, r_in_1, r_out_1, fee_bps)
    r_in_2 = r_in_1 + victim_amount_in
    r_out_2 = r_out_1 - out_victim

    out_back = get_amount_out(out_front, r_out_2, r_in_2, fee_bps)

    profit = out_back - front_amount
    return float(profit)


def net_arb_profit(amount_in: int, reserve_in: int, reserve_out: int,
                   target_price: float, gas_cost_token_in: float,
                   fee_bps: int = 30) -> float:
    """扣除手续费和 gas 后的净套利利润"""
    amount_out = get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)
    revenue = amount_out * target_price
    profit = revenue - amount_in - gas_cost_token_in
    return profit


def price_after_trade(amount_in: int, reserve_in: int, reserve_out: int,
                      fee_bps: int = 30) -> float:
    """交易后的新即时报价"""
    out = get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)
    new_rin = reserve_in + amount_in
    new_rout = reserve_out - out
    return spot_price(new_rin, new_rout)


# ═══════════════════════════════════════════════════════
# Part 3: 跨池分析引擎
# ═══════════════════════════════════════════════════════

@dataclass
class PoolState:
    """池子实时状态"""
    address: str
    name: str = ""
    reserve_in: int = 0
    reserve_out: int = 0
    price: float = 0.0
    tvl_usd: float = 0.0
    volume_24h_usd: float = 0.0
    fee_bps: int = 25
    timestamp: float = field(default_factory=time.time)

    @property
    def is_valid(self) -> bool:
        return self.reserve_in > 0 and self.reserve_out > 0 and self.price > 0


@dataclass
class DivergenceResult:
    """两池价差分析结果"""
    pool_cheap: str
    pool_expensive: str
    price_cheap: float
    price_expensive: float
    spread_pct: float
    net_spread_pct: float
    optimal_size: int
    estimated_profit: float
    gas_breakeven: float
    timestamp: float = field(default_factory=time.time)

    @property
    def is_profitable(self) -> bool:
        return self.net_spread_pct > 0 and self.optimal_size > 0


def price_divergence(pool_a: PoolState, pool_b: PoolState) -> DivergenceResult | None:
    """检测两池价差 — 含手续费后的净利润估算"""
    if not pool_a.is_valid or not pool_b.is_valid:
        return None

    if pool_a.price <= pool_b.price:
        cheap, expensive = pool_a, pool_b
    else:
        cheap, expensive = pool_b, pool_a

    if cheap.price <= 0:
        return None

    spread = (expensive.price - cheap.price) / cheap.price
    total_fee_pct = (cheap.fee_bps + expensive.fee_bps) / 10000
    net_spread = spread - total_fee_pct

    opt_size = optimal_arb_size(
        cheap.reserve_in, cheap.reserve_out,
        expensive.price, cheap.fee_bps,
    )

    est_profit = 0.0
    if opt_size > 0:
        est_profit = net_arb_profit(
            opt_size, cheap.reserve_in, cheap.reserve_out,
            expensive.price, gas_cost_token_in=0, fee_bps=cheap.fee_bps,
        )

    gas_be = est_profit if est_profit > 0 else 0.0

    return DivergenceResult(
        pool_cheap=cheap.address,
        pool_expensive=expensive.address,
        price_cheap=cheap.price,
        price_expensive=expensive.price,
        spread_pct=spread,
        net_spread_pct=net_spread,
        optimal_size=opt_size,
        estimated_profit=est_profit,
        gas_breakeven=gas_be,
    )


def zscore_series(prices: list[float], window: int = 20) -> list[float]:
    """价格 Z-score 序列 — 均值回归信号

    |Z| > 2 → 强均值回归信号
    |Z| > 3 → 极端偏离
    """
    result: list[float] = [float("nan")] * len(prices)
    if len(prices) < window:
        return result

    for i in range(window - 1, len(prices)):
        w = prices[i - window + 1 : i + 1]
        mean = sum(w) / window
        variance = sum((x - mean) ** 2 for x in w) / window
        std = math.sqrt(variance)
        if std > 0:
            result[i] = (prices[i] - mean) / std
        else:
            result[i] = 0.0

    return result


def zscore_latest(prices: list[float], window: int = 20) -> float:
    """只取最新一个 Z-score"""
    series = zscore_series(prices, window)
    if not series:
        return float("nan")
    return series[-1]


def spread_zscore(prices_a: list[float], prices_b: list[float],
                  window: int = 20) -> list[float]:
    """两池价差序列的 Z-score — 配对交易（stat arb）核心信号

    Z > +2: A 相对 B 偏贵 → 卖 A 买 B
    Z < -2: A 相对 B 偏便宜 → 买 A 卖 B
    """
    if len(prices_a) != len(prices_b):
        min_len = min(len(prices_a), len(prices_b))
        prices_a = prices_a[-min_len:]
        prices_b = prices_b[-min_len:]

    spreads = [a - b for a, b in zip(prices_a, prices_b)]
    return zscore_series(spreads, window)


@dataclass
class TriangularResult:
    """三角套利检测结果"""
    path: list[str]
    cycle_rate: float
    profit_pct: float
    is_profitable: bool


def triangular_arb_check(
    *,
    rate_a_to_b: float,
    rate_b_to_c: float,
    rate_c_to_a: float,
    pool_ab: str = "",
    pool_bc: str = "",
    pool_ca: str = "",
    min_profit_pct: float = 0.001,
) -> TriangularResult:
    """三角套利检测 — A→B→C→A 闭环

    cycle_rate = rate_a_to_b × rate_b_to_c × rate_c_to_a
    cycle_rate > 1.0 → 有利润
    """
    cycle_rate = rate_a_to_b * rate_b_to_c * rate_c_to_a
    profit_pct = cycle_rate - 1.0

    return TriangularResult(
        path=[pool_ab, pool_bc, pool_ca],
        cycle_rate=cycle_rate,
        profit_pct=profit_pct,
        is_profitable=profit_pct > min_profit_pct,
    )


def compare_all_pairs(pools: list[PoolState],
                   min_net_spread: float = 0.001) -> list[DivergenceResult]:
    """比较所有池子两两组合，找出净价差 > 阈值的配对"""
    results = []
    for i in range(len(pools)):
        for j in range(i + 1, len(pools)):
            div = price_divergence(pools[i], pools[j])
            if div and div.net_spread_pct >= min_net_spread:
                results.append(div)

    results.sort(key=lambda d: d.net_spread_pct, reverse=True)
    return results


# ── Part 4: 事件总线 + 定时循环 ─────────────────────

class SignalBus:
    """轻量级 pub-sub 信号总线

    collect 产出的信号通过 publish() 分发给订阅者，
    同时缓存在 _buffer 中供 drain() 批量取走。
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list] = {}
        self._buffer: list[dict] = []

    def subscribe(self, signal_type: str, handler) -> None:
        self._subscribers.setdefault(signal_type, []).append(handler)

    async def publish(self, signal: dict) -> None:
        sig_type = signal.get("type", "")
        self._buffer.append(signal)
        for handler in self._subscribers.get(sig_type, []):
            await handler(signal)

    async def drain(self) -> list[dict]:
        """取走并清空缓存的全部信号"""
        out = list(self._buffer)
        self._buffer.clear()
        return out


class CollectLoop:
    """定时 collect 循环 — 自动降级空闲间隔"""

    def __init__(
        self,
        *,
        interval_seconds: float = 60.0,
        degraded_interval: float = 300.0,
        max_noop_before_degrade: int = 5,
        collect_skill=None,
        signal_bus: SignalBus | None = None,
    ) -> None:
        self._interval = interval_seconds
        self._degraded_interval = degraded_interval
        self._max_noop = max_noop_before_degrade
        self._collect_skill = collect_skill
        self._signal_bus = signal_bus or SignalBus()
        self._cycle_count: int = 0
        self._noop_count: int = 0
        self._running: bool = False

    @property
    def current_interval(self) -> float:
        if self._noop_count >= self._max_noop:
            return self._degraded_interval
        return self._interval

    async def run_once(self, pools: list[str]) -> list[dict]:
        if self._collect_skill is None:
            raise RuntimeError("collect_skill not configured")
        signals = await self._collect_skill.collect_all_pools(pools)
        self._cycle_count += 1
        if signals:
            self._noop_count = 0
            for sig in signals:
                await self._signal_bus.publish(sig)
        else:
            self._noop_count += 1
        return signals

    def stop(self) -> None:
        self._running = False
