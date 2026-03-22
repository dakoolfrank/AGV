"""Arb-Campaign 端到端集成测试 (Phase 3)

覆盖:
  - POOL_TOKEN_MAP 正确性
  - _local_strategy_builder 本地策略构建
  - _execute_single 全流程 (9 步安全链)
  - Safety guard 集成 (Slippage/TVL/MEV/Approve)
  - _step_fix 失败分类 + 三级回退
  - pre_flight 增强门控
  - run_cycle 端到端 (全步骤 mock)
"""
from __future__ import annotations

import asyncio
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── 路径设置 ──────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "scripts"))
sys.path.insert(0, str(ROOT_DIR / "modules" / "collect" / "scripts"))

from scripts.toolloop_arb import (
    ArbCampaignLoop,
    RETREAT_LEVELS,
    POOL_TOKEN_MAP,
    DEFAULT_TRADE_SIZE_WEI,
    SignalRef,
    StrategyRef,
    DiagnosisProfile,
    build_strategies_from_binding,
    _resolve_pool_info,
)
from scripts.toolloop_mm import (
    DexExecutor,
    PancakeV2Adapter,
    SlippageGuard,
    MEVGuard,
    TVLBreaker,
    TVLState,
    ApproveManager,
    SimDexExecutor,
    KNOWN_PAIRS,
)
from scripts.skill_mm_arb import BudgetTracker


# ── 辅助 ──────────────────────────────────────────────

def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_strategy(
    *,
    pool_address: str = "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0",
    token_in: str = "0x55d398326f99059fF775485246999027B3197955",
    token_out: str = "0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
    amount_in_wei: int = 10 * 10**18,
    confidence: float = 0.90,
) -> StrategyRef:
    return StrategyRef(
        strategy_id=f"test-{int(time.time())}",
        strategy_type="cross_pool_arbitrage",
        confidence=confidence,
        entry={
            "pool_address": pool_address,
            "token_in": token_in,
            "token_out": token_out,
            "amount_in_wei": amount_in_wei,
            "direction": "buy",
            "amount_usd": amount_in_wei / 10**18,
        },
        sizing={"amount_in_usd": amount_in_wei / 10**18, "gas_usd": 0.01},
        exit_rules={"condition": "immediate_fill", "ttl": 120},
    )


def _make_executor(
    *,
    reserves: tuple[int, int] = (100_000 * 10**18, 500 * 10**18),
    swap_result: dict | None = None,
) -> DexExecutor:
    """创建 mock DexExecutor"""
    mock_adapter = MagicMock(spec=PancakeV2Adapter)
    mock_adapter.router_address = "0x10ED43C718714eb63d5aA57B78B54704E256024E"

    executor = DexExecutor(adapter=mock_adapter)

    async def _get_reserves(pair):
        return reserves

    executor.get_reserves = _get_reserves

    default_swap = {
        "tx_hash": "0x" + "ab" * 32,
        "status": "success",
        "gas_used": 150_000,
        "block_number": 12345678,
    }

    async def _swap(**kwargs):
        return swap_result or default_swap

    executor.swap = _swap
    return executor


def _make_loop(**kwargs) -> ArbCampaignLoop:
    """创建带 mock 的 ArbCampaignLoop"""
    defaults = {
        "executor": _make_executor(),
        "slippage_guard": SlippageGuard(max_slippage_pct=0.02),
        "tvl_breaker": TVLBreaker(),
        "mev_guard": MEVGuard(),
        "approve_manager": ApproveManager(),
        "budget": BudgetTracker(),
    }
    defaults.update(kwargs)
    return ArbCampaignLoop(**defaults)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1. POOL_TOKEN_MAP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestPoolTokenMap:
    def test_pgvt_pool_exists(self):
        assert "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0" in POOL_TOKEN_MAP

    def test_sgvt_pool_exists(self):
        assert "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d" in POOL_TOKEN_MAP

    def test_pgvt_tokens(self):
        info = POOL_TOKEN_MAP["0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0"]
        assert info["name"] == "pGVT_USDT"
        assert "8F9EC8" in info["base"]  # pGVT
        assert "55d398" in info["quote"]  # USDT

    def test_sgvt_tokens(self):
        info = POOL_TOKEN_MAP["0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d"]
        assert info["name"] == "sGVT_USDT"
        assert "53e599" in info["base"]  # sGVT

    def test_consistent_with_known_pairs(self):
        for name, addr in KNOWN_PAIRS.items():
            assert addr in POOL_TOKEN_MAP, f"{name} not in POOL_TOKEN_MAP"

    def test_default_trade_size(self):
        assert DEFAULT_TRADE_SIZE_WEI == 10 * 10**18


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  2. _get_ordered_reserves
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestGetOrderedReserves:
    """PancakeV2 ordering: token0 = min(addr)"""

    def test_usdt_is_token0_for_pgvt(self):
        """pGVT=0x8F9E, USDT=0x55d3 → USDT < pGVT → token0=USDT"""
        loop = _make_loop()
        usdt = "0x55d398326f99059fF775485246999027B3197955"
        pool = "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0"
        # r0=USDT reserve, r1=pGVT reserve
        r_in, r_out = _run(loop._get_ordered_reserves(pool, usdt))
        # USDT is token0 → if token_in=USDT → reserve_in=r0
        assert r_in == 100_000 * 10**18
        assert r_out == 500 * 10**18

    def test_pgvt_is_token1(self):
        """token_in=pGVT (not token0) → reserves flipped"""
        loop = _make_loop()
        pgvt = "0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9"
        pool = "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0"
        r_in, r_out = _run(loop._get_ordered_reserves(pool, pgvt))
        assert r_in == 500 * 10**18
        assert r_out == 100_000 * 10**18

    def test_sgvt_is_token0(self):
        """sGVT=0x53e5, USDT=0x55d3 → sGVT < USDT → token0=sGVT"""
        loop = _make_loop()
        sgvt = "0x53e599211bF49Aa2336C3F839Ad57e20dE3662a3"
        pool = "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d"
        r_in, r_out = _run(loop._get_ordered_reserves(pool, sgvt))
        # sGVT is token0 → token_in=sGVT → reserve_in=r0
        assert r_in == 100_000 * 10**18

    def test_unknown_pool_returns_original_order(self):
        loop = _make_loop()
        r_in, r_out = _run(loop._get_ordered_reserves("0xDEAD", "0xBEEF"))
        assert r_in == 100_000 * 10**18
        assert r_out == 500 * 10**18


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  3. _local_strategy_builder — REMOVED
#     Dataset 已由 nexrur DatasetOps → WQ-YI DeFiL1Recommender + DeFiL2Binder 处理
#     旧确定性构建器已删除，LLM 不可用直接 fail-fast
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  4. _execute_single
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestExecuteSingle:
    def test_successful_swap(self):
        loop = _make_loop()
        strategy = _make_strategy()
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "success"
        assert result["tx_hash"] is not None
        assert result["gas_used"] == 150_000

    def test_no_executor_blocked(self):
        loop = _make_loop(executor=None)
        strategy = _make_strategy()
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "blocked"
        assert "no_executor" in result["reason"]

    def test_incomplete_params_blocked(self):
        loop = _make_loop()
        strategy = StrategyRef(
            strategy_id="test-inc",
            strategy_type="arb",
            confidence=0.90,
            entry={"pool_address": "0x5558", "token_in": "", "token_out": ""},
        )
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "blocked"
        assert "incomplete_entry_params" in result["reason"]

    def test_low_confidence_blocked(self):
        loop = _make_loop()
        strategy = _make_strategy(confidence=0.50)
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "blocked"
        assert "low_confidence" in result["reason"]

    def test_tvl_breaker_blocks(self):
        breaker = TVLBreaker(min_tvl_usd=30.0)
        breaker.evaluate(tvl_usd=10.0, reserve_a=100, reserve_b=100)
        assert breaker.state == TVLState.HALT_ALL

        loop = _make_loop(tvl_breaker=breaker)
        strategy = _make_strategy()
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "blocked"
        assert "tvl_halt" in result["reason"]

    def test_slippage_guard_blocks_large_trade(self):
        """Large trade relative to pool → high slippage → blocked"""
        # Pool: 100 USDT + 500 pGVT, Trade: 50 USDT (50% of pool)
        loop = _make_loop(
            executor=_make_executor(reserves=(100 * 10**18, 500 * 10**18)),
        )
        strategy = _make_strategy(amount_in_wei=50 * 10**18)
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "blocked"
        assert "slippage" in result["reason"]

    def test_mev_guard_delays(self):
        mev = MEVGuard()
        mev.record_alert()  # trigger cooldown
        loop = _make_loop(mev_guard=mev)
        strategy = _make_strategy()
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "delayed"
        assert "mev_cooldown" in result["reason"]

    def test_swap_failure_returns_error(self):
        async def _failing_swap(**kwargs):
            raise RuntimeError("tx reverted: INSUFFICIENT_OUTPUT_AMOUNT")

        executor = _make_executor()
        executor.swap = _failing_swap
        loop = _make_loop(executor=executor)
        strategy = _make_strategy()
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "error"
        assert "swap:" in result["reason"]

    def test_budget_recorded_on_success(self):
        budget = BudgetTracker()
        loop = _make_loop(budget=budget)
        strategy = _make_strategy()
        _run(loop._execute_single(strategy))
        assert budget._trade_count == 1
        assert budget._volume_usd > 0

    def test_budget_not_recorded_on_failure(self):
        budget = BudgetTracker()
        executor = _make_executor(swap_result={"status": "reverted", "gas_used": 100_000})
        loop = _make_loop(executor=executor, budget=budget)
        strategy = _make_strategy()
        _run(loop._execute_single(strategy))
        assert budget._trade_count == 0  # reverted → not recorded

    def test_approve_called_before_swap(self):
        approve_mgr = ApproveManager()
        loop = _make_loop(approve_manager=approve_mgr)
        strategy = _make_strategy()
        _run(loop._execute_single(strategy))
        # Check allowance was set (in-memory mode)
        token_in = strategy.entry["token_in"].lower()
        router = loop._executor.adapter.router_address.lower()
        key = (token_in, router)
        assert approve_mgr._allowance_cache.get(key, 0) > 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  5. _step_execute (batch)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStepExecute:
    def test_batch_all_success(self):
        loop = _make_loop()
        strategies = [_make_strategy() for _ in range(3)]
        results = _run(loop._step_execute(strategies))
        assert len(results) == 3
        assert all(r["status"] == "success" for r in results)

    def test_batch_mixed(self):
        """One good, one low confidence → 1 success + 1 blocked"""
        loop = _make_loop()
        strategies = [
            _make_strategy(confidence=0.90),
            _make_strategy(confidence=0.50),
        ]
        results = _run(loop._step_execute(strategies))
        assert len(results) == 2
        statuses = {r["status"] for r in results}
        assert "success" in statuses
        assert "blocked" in statuses


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  6. _step_fix (failure classification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStepFix:
    def test_all_success_no_retreat(self):
        loop = _make_loop()
        results = [{"status": "success"}]
        target = _run(loop._step_fix(results))
        assert target is None
        assert loop._consecutive_failures == 0

    def test_delayed_not_failure(self):
        loop = _make_loop()
        results = [{"status": "delayed", "reason": "mev_cooldown"}]
        target = _run(loop._step_fix(results))
        assert target is None

    def test_structural_failure_goes_to_C(self):
        loop = _make_loop()
        results = [{"status": "blocked", "reason": "tvl_breaker:TVL too low"}]
        target = _run(loop._step_fix(results))
        assert target == "collect"  # C-level
        assert loop._current_retreat_level == "C"
        assert loop._cooldown_until > time.monotonic()

    def test_factor_failure_first_goes_to_A(self):
        loop = _make_loop()
        results = [{"status": "blocked", "reason": "slippage:too high"}]
        target = _run(loop._step_fix(results))
        assert target == "execute"  # A-level (first failure)
        assert loop._current_retreat_level == "A"

    def test_factor_failure_escalates_to_B(self):
        loop = _make_loop(diagnosis=DiagnosisProfile(max_level_a_retries=2))
        # Exhaust A-level retries
        for _ in range(3):
            _run(loop._step_fix([{"status": "blocked", "reason": "slippage:X"}]))
        # 4th failure should be B
        target = _run(loop._step_fix([{"status": "blocked", "reason": "slippage:X"}]))
        assert target == "curate"  # B-level

    def test_generic_failure_A_then_B_then_C(self):
        diag = DiagnosisProfile(max_level_a_retries=2, max_consecutive_failures=4)
        loop = _make_loop(diagnosis=diag)

        # First 2: A-level
        for _ in range(2):
            t = _run(loop._step_fix([{"status": "error", "reason": "swap:timeout"}]))
            assert t == "execute"

        # Next 2: B-level
        for _ in range(2):
            t = _run(loop._step_fix([{"status": "error", "reason": "swap:timeout"}]))
            assert t == "curate"

        # 5th: C-level
        t = _run(loop._step_fix([{"status": "error", "reason": "swap:timeout"}]))
        assert t == "collect"

    def test_success_resets_counter(self):
        loop = _make_loop()
        _run(loop._step_fix([{"status": "error", "reason": "something"}]))
        assert loop._consecutive_failures == 1
        _run(loop._step_fix([{"status": "success"}]))
        assert loop._consecutive_failures == 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  7. pre_flight (enhanced)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestPreFlight:
    def test_pass_with_good_strategy(self):
        loop = _make_loop()
        strategy = _make_strategy()
        result = _run(loop.pre_flight(strategy))
        assert result["passed"] is True

    def test_budget_blocked(self):
        budget = BudgetTracker(max_daily_trades=0)
        loop = _make_loop(budget=budget)
        strategy = _make_strategy()
        result = _run(loop.pre_flight(strategy))
        assert result["passed"] is False
        assert "daily_trades_exceeded" in result["reason"]

    def test_low_confidence_blocked(self):
        loop = _make_loop()
        strategy = _make_strategy(confidence=0.50)
        result = _run(loop.pre_flight(strategy))
        assert result["passed"] is False
        assert "low_confidence" in result["reason"]

    def test_tvl_halt_blocked(self):
        breaker = TVLBreaker(min_tvl_usd=30.0)
        breaker.evaluate(tvl_usd=10.0, reserve_a=100, reserve_b=100)
        loop = _make_loop(tvl_breaker=breaker)
        strategy = _make_strategy()
        result = _run(loop.pre_flight(strategy))
        assert result["passed"] is False
        assert "tvl_halt" in result["reason"]

    def test_missing_pool_address_blocked(self):
        loop = _make_loop()
        strategy = StrategyRef(
            strategy_id="test",
            strategy_type="arb",
            confidence=0.90,
            entry={"direction": "buy"},  # no pool_address
        )
        result = _run(loop.pre_flight(strategy))
        assert result["passed"] is False
        assert "missing_pool_address" in result["reason"]

    def test_multiple_reasons_joined(self):
        budget = BudgetTracker(max_daily_trades=0)
        breaker = TVLBreaker()
        breaker.evaluate(tvl_usd=10.0, reserve_a=100, reserve_b=100)
        loop = _make_loop(budget=budget, tvl_breaker=breaker)
        strategy = _make_strategy(confidence=0.50)
        result = _run(loop.pre_flight(strategy))
        assert result["passed"] is False
        assert ";" in result["reason"]  # multiple reasons joined


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  8. _step_dataset — REMOVED
#     Dataset 已由 nexrur DatasetOps 桥接层编排，不再有内部 fallback
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  9. Init params
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestInitParams:
    def test_default_init(self):
        loop = ArbCampaignLoop()
        assert loop._slippage_guard is None
        assert loop._tvl_breaker is None
        assert loop._mev_guard is None
        assert loop._approve_manager is None

    def test_safety_components_stored(self):
        sg = SlippageGuard()
        tvl = TVLBreaker()
        mev = MEVGuard()
        am = ApproveManager()
        loop = ArbCampaignLoop(
            slippage_guard=sg, tvl_breaker=tvl,
            mev_guard=mev, approve_manager=am,
        )
        assert loop._slippage_guard is sg
        assert loop._tvl_breaker is tvl
        assert loop._mev_guard is mev
        assert loop._approve_manager is am

    def test_has_execute_single(self):
        loop = ArbCampaignLoop()
        assert hasattr(loop, "_execute_single")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  10. Integration: reserves ordering + execute
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestReservesExecuteIntegration:
    def test_small_trade_passes_slippage(self):
        """Small trade (1% of pool) passes 2% slippage guard"""
        # Pool: 1000 USDT + 5000 pGVT, Trade: 10 USDT
        loop = _make_loop(
            executor=_make_executor(reserves=(1000 * 10**18, 5000 * 10**18)),
        )
        strategy = _make_strategy(amount_in_wei=10 * 10**18)
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "success"

    def test_zero_reserves_blocked(self):
        """Zero reserves → zero expected output → blocked"""
        loop = _make_loop(
            executor=_make_executor(reserves=(0, 0)),
        )
        strategy = _make_strategy()
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "blocked"
        assert "zero_expected_output" in result["reason"]

    def test_get_reserves_error_handled(self):
        """get_reserves failure → error status"""
        async def _failing_reserves(pair):
            raise ConnectionError("RPC timeout")

        executor = _make_executor()
        executor.get_reserves = _failing_reserves
        loop = _make_loop(executor=executor)
        strategy = _make_strategy()
        result = _run(loop._execute_single(strategy))
        assert result["status"] == "error"
        assert "get_reserves" in result["reason"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  11. build_strategies_from_binding 转换层
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestBuildStrategies:
    """indicator_binding.yml → StrategyRef 转换"""

    def _write_binding(self, tmp_path, bindings, categories=None):
        """Helper: 写 indicator_binding.yml + slot_categories.yml"""
        import yaml
        ind_data = {"domain": "defi", "indicator_bindings": bindings}
        ind_file = tmp_path / "indicator_binding.yml"
        ind_file.write_text(yaml.dump(ind_data))

        cat_file = None
        if categories:
            cat_data = {"strategy_bindings": categories}
            cat_file = tmp_path / "slot_categories.yml"
            cat_file.write_text(yaml.dump(cat_data))

        return ind_file, cat_file

    def test_single_skeleton_single_category(self, tmp_path):
        ind_file, _ = self._write_binding(tmp_path, [
            {"skeleton_id": "skel_01", "category": "defi_onchain",
             "selected_indicators": ["vol", "tx_count"],
             "param_hints": {"vol": {"window": "1h"}},
             "confidence": 0.90},
        ])
        pool = {"pool_address": "0xABC", "token_in": "0xUSDT", "token_out": "0xTOK"}
        result = build_strategies_from_binding(ind_file, None, pool)
        assert len(result) == 1
        s = result[0]
        assert s.strategy_id == "skel_01"
        assert s.confidence == 0.90
        assert s.entry["pool_address"] == "0xABC"
        assert s.entry["token_in"] == "0xUSDT"
        assert s.metadata["binding_count"] == 1

    def test_multiple_categories_grouped(self, tmp_path):
        ind_file, _ = self._write_binding(tmp_path, [
            {"skeleton_id": "skel_01", "category": "defi_onchain",
             "selected_indicators": ["vol"], "confidence": 0.90},
            {"skeleton_id": "skel_01", "category": "defi_price",
             "selected_indicators": ["vwap"], "confidence": 1.0},
        ])
        result = build_strategies_from_binding(ind_file, None, {})
        assert len(result) == 1
        s = result[0]
        assert s.confidence == pytest.approx(0.95)  # avg(0.90, 1.0)
        assert s.metadata["binding_count"] == 2
        assert set(s.metadata["categories"]) == {"defi_onchain", "defi_price"}

    def test_multiple_skeletons(self, tmp_path):
        ind_file, _ = self._write_binding(tmp_path, [
            {"skeleton_id": "skel_A", "category": "c1",
             "selected_indicators": ["x"], "confidence": 0.80},
            {"skeleton_id": "skel_B", "category": "c2",
             "selected_indicators": ["y"], "confidence": 0.95},
        ])
        result = build_strategies_from_binding(ind_file, None, {})
        assert len(result) == 2
        ids = {s.strategy_id for s in result}
        assert ids == {"skel_A", "skel_B"}

    def test_strategy_type_from_categories(self, tmp_path):
        ind_file, cat_file = self._write_binding(
            tmp_path,
            [{"skeleton_id": "skel_01", "category": "c1",
              "selected_indicators": ["x"], "confidence": 0.90}],
            [{"skeleton_id": "skel_01", "strategy_type": "whale_follow"}],
        )
        result = build_strategies_from_binding(ind_file, cat_file, {})
        assert result[0].strategy_type == "whale_follow"

    def test_no_categories_file_strategy_type_unknown(self, tmp_path):
        ind_file, _ = self._write_binding(tmp_path, [
            {"skeleton_id": "skel_01", "category": "c1",
             "selected_indicators": ["x"], "confidence": 0.90},
        ])
        result = build_strategies_from_binding(ind_file, None, {})
        assert result[0].strategy_type == "unknown"

    def test_empty_bindings(self, tmp_path):
        ind_file, _ = self._write_binding(tmp_path, [])
        result = build_strategies_from_binding(ind_file, None, {})
        assert result == []

    def test_default_amount_propagated(self, tmp_path):
        ind_file, _ = self._write_binding(tmp_path, [
            {"skeleton_id": "s1", "category": "c1",
             "selected_indicators": ["x"], "confidence": 0.90},
        ])
        result = build_strategies_from_binding(ind_file, None, {})
        assert result[0].entry["amount_in_wei"] == DEFAULT_TRADE_SIZE_WEI

    def test_custom_amount_from_pool_info(self, tmp_path):
        ind_file, _ = self._write_binding(tmp_path, [
            {"skeleton_id": "s1", "category": "c1",
             "selected_indicators": ["x"], "confidence": 0.90},
        ])
        pool = {"pool_address": "0xA", "amount_in_wei": 50 * 10**18}
        result = build_strategies_from_binding(ind_file, None, pool)
        assert result[0].entry["amount_in_wei"] == 50 * 10**18


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  12. _resolve_pool_info
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestResolvePoolInfo:
    def test_pgvt_pool_matched(self):
        result = _resolve_pool_info("pGVT_USDT")
        assert result["pool_address"] == "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0"
        assert "55d398" in result["token_in"]  # USDT
        assert "8F9EC8" in result["token_out"]  # pGVT

    def test_sgvt_pool_matched(self):
        result = _resolve_pool_info("sGVT_USDT")
        assert result["pool_address"] == "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d"

    def test_address_suffix_match(self):
        """pair_id 含池地址末 6 位 → 匹配"""
        result = _resolve_pool_info("something_0x350c73")
        # 0x350c73 is NOT in POOL_TOKEN_MAP, so should return empty
        assert result["pool_address"] == ""

    def test_known_pool_suffix(self):
        """pGVT LP 末 6 位 = 5c0 — 但区分大小写"""
        result = _resolve_pool_info("pool_d03c5c0_test")
        assert result["pool_address"] == "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0"

    def test_unknown_pool_returns_empty(self):
        result = _resolve_pool_info("UNKNOWN_PAIR")
        assert result["pool_address"] == ""
        assert result["name"] == "UNKNOWN_PAIR"

    def test_collect_metadata_fallback(self, tmp_path):
        """collect 目录元数据文件包含 pool_address → 解析成功"""
        import yaml
        collect_dir = tmp_path / ".docs" / "ai-skills" / "collect" / "pending" / "staged" / "TEST_PAIR"
        collect_dir.mkdir(parents=True)
        meta = {"pool_address": "0xDEAD", "token0": "0xA", "token1": "0xB"}
        (collect_dir / "pool_meta.yml").write_text(yaml.dump(meta))

        result = _resolve_pool_info("TEST_PAIR", workspace=tmp_path)
        assert result["pool_address"] == "0xDEAD"
        assert result["token_in"] == "0xA"
        assert result["token_out"] == "0xB"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  13. ArbExecuteOps 桥接层
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


try:
    SKILLS_DIR = ROOT_DIR.parent
    if str(SKILLS_DIR) not in sys.path:
        sys.path.insert(0, str(SKILLS_DIR))
    from nexrur.engines.orchestrator import AssetRef
    from _shared.engines.agent_ops_arb import ArbExecuteOps
    _HAS_NEXRUR = True
except ImportError:
    _HAS_NEXRUR = False


@pytest.mark.skipif(not _HAS_NEXRUR, reason="nexrur not installed")
class TestArbExecuteOpsBridge:
    def test_no_bindings_fails(self, tmp_path):
        ops = ArbExecuteOps()
        result = ops(
            pipeline_run_id="test", step_run_id="test", trace_id="test",
            assets_input=[], config={}, workspace=tmp_path,
        )
        assert not result.success
        assert result.metadata["reason"] == "no_bindings"

    def test_missing_indicator_file_error(self, tmp_path):
        """dataset_binding 存在但 indicator_binding.yml 不存在 → errors 列表"""
        out_dir = tmp_path / ".docs" / "ai-skills" / "dataset" / "output" / "test_pair"
        out_dir.mkdir(parents=True)
        ops = ArbExecuteOps()
        result = ops(
            pipeline_run_id="test", step_run_id="test", trace_id="test",
            assets_input=[
                AssetRef(kind="dataset_binding", id="test_pair",
                         path=str(out_dir.relative_to(tmp_path)), metadata={}),
            ],
            config={}, workspace=tmp_path,
        )
        assert not result.success
        assert "indicator_binding.yml not found" in result.metadata["errors"][0]

    def test_binding_to_execution_with_mock_campaign(self, tmp_path):
        """indicator_binding.yml 存在 + mock campaign → 真实执行"""
        import yaml
        out_dir = tmp_path / ".docs" / "ai-skills" / "dataset" / "output" / "test_pair"
        out_dir.mkdir(parents=True)
        ind_data = {
            "domain": "defi",
            "indicator_bindings": [{
                "skeleton_id": "test_skel", "category": "defi_onchain",
                "selected_indicators": ["vol"],
                "param_hints": {"vol": {"window": "1h"}},
                "confidence": 0.95,
            }],
        }
        cat_data = {
            "strategy_bindings": [{
                "skeleton_id": "test_skel", "strategy_type": "test_arb",
            }],
        }
        (out_dir / "indicator_binding.yml").write_text(yaml.dump(ind_data))
        (out_dir / "slot_categories.yml").write_text(yaml.dump(cat_data))

        # mock campaign — 用 _make_loop 创建带 mock executor 的 campaign
        campaign = _make_loop()
        ops = ArbExecuteOps(campaign=campaign)
        result = ops(
            pipeline_run_id="test", step_run_id="test", trace_id="test",
            assets_input=[
                AssetRef(kind="dataset_binding", id="test_pair",
                         path=str(out_dir.relative_to(tmp_path)), metadata={}),
            ],
            config={}, workspace=tmp_path,
        )
        assert result.success
        assert len(result.assets_produced) == 1
        assert result.assets_produced[0].kind == "execution_result"
        # mock executor returns success for each strategy
        assert result.assets_produced[0].metadata["success"] >= 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  14. SimDexExecutor
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestSimDexExecutor:
    def test_swap_returns_success(self):
        sim = SimDexExecutor()
        result = _run(sim.swap(
            token_in="0xA", token_out="0xB",
            amount_in=10 * 10**18, min_amount_out=1,
        ))
        assert result["status"] == "success"
        assert result["simulated"] is True
        assert result["tx_hash"].startswith("sim-")
        assert result["amount_out"] > 0

    def test_swap_reverted_when_min_not_met(self):
        sim = SimDexExecutor(reserves={"pool": (100, 100)})
        result = _run(sim.swap(
            token_in="0xA", token_out="0xB",
            amount_in=10, min_amount_out=999_999,
        ))
        assert result["status"] == "reverted"
        assert result["simulated"] is True

    def test_get_reserves_returns_configured(self):
        reserves = {"0x5558": (1000, 2000)}
        sim = SimDexExecutor(reserves=reserves)
        r = _run(sim.get_reserves("0x5558"))
        assert r == (1000, 2000)

    def test_get_reserves_returns_default(self):
        sim = SimDexExecutor()
        r = _run(sim.get_reserves("0xunknown"))
        assert r == (100_000 * 10**18, 500 * 10**18)

    def test_amm_formula_correct(self):
        """verify get_amount_out is inherited and works"""
        sim = SimDexExecutor()
        # 10 in, 100k/500 pool → small trade
        out = _run(sim.get_amount_out(10 * 10**18, 100_000 * 10**18, 500 * 10**18))
        assert out > 0
        assert out < 500 * 10**18  # can't drain pool

    def test_gas_used_constant(self):
        sim = SimDexExecutor()
        result = _run(sim.swap(
            token_in="0xA", token_out="0xB",
            amount_in=1, min_amount_out=0,
        ))
        assert result["gas_used"] == 150_000

    def test_tx_counter_increments(self):
        sim = SimDexExecutor()
        r1 = _run(sim.swap(token_in="0xA", token_out="0xB", amount_in=1, min_amount_out=0))
        r2 = _run(sim.swap(token_in="0xA", token_out="0xB", amount_in=1, min_amount_out=0))
        assert r1["tx_hash"] != r2["tx_hash"]

    def test_no_adapter_needed(self):
        """SimDexExecutor doesn't need PancakeV2Adapter"""
        sim = SimDexExecutor()
        assert sim.adapter is None
        # swap still works
        result = _run(sim.swap(
            token_in="0xA", token_out="0xB",
            amount_in=10 * 10**18, min_amount_out=0,
        ))
        assert result["status"] == "success"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  15. Execute artifacts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestExecuteArtifacts:
    def test_step_execute_writes_artifacts(self, tmp_path):
        """_step_execute writes execution_results.yml"""
        loop = _make_loop(workspace=tmp_path)
        strategy = _make_strategy()
        _run(loop._step_execute([strategy]))

        output_root = tmp_path / ".docs" / "ai-skills" / "execute" / "output"
        assert output_root.exists()
        # find the timestamped run dir
        run_dirs = list(output_root.iterdir())
        assert len(run_dirs) == 1
        artifact = run_dirs[0] / "execution_results.yml"
        assert artifact.exists()

        import yaml
        data = yaml.safe_load(artifact.read_text())
        assert data["total"] == 1
        assert data["success"] == 1
        assert len(data["results"]) == 1
        assert data["results"][0]["strategy_id"] is not None

    def test_artifact_contains_strategy_details(self, tmp_path):
        loop = _make_loop(workspace=tmp_path)
        strategy = _make_strategy()
        _run(loop._step_execute([strategy]))

        import yaml
        output_root = tmp_path / ".docs" / "ai-skills" / "execute" / "output"
        run_dir = list(output_root.iterdir())[0]
        data = yaml.safe_load((run_dir / "execution_results.yml").read_text())

        result = data["results"][0]
        assert "entry" in result
        assert "confidence" in result
        assert result["tx_hash"] is not None

    def test_blocked_strategy_recorded(self, tmp_path):
        loop = _make_loop(executor=None, workspace=tmp_path)
        strategy = _make_strategy()
        _run(loop._step_execute([strategy]))

        import yaml
        output_root = tmp_path / ".docs" / "ai-skills" / "execute" / "output"
        run_dir = list(output_root.iterdir())[0]
        data = yaml.safe_load((run_dir / "execution_results.yml").read_text())

        assert data["success"] == 0
        assert data["blocked"] == 1
        assert data["results"][0]["status"] == "blocked"
        assert "no_executor" in data["results"][0]["reason"]

    def test_simulated_flag_in_artifact(self, tmp_path):
        """SimDexExecutor results are marked as simulated"""
        sim = SimDexExecutor()
        loop = ArbCampaignLoop(
            executor=sim,
            slippage_guard=SlippageGuard(),
            tvl_breaker=TVLBreaker(),
            mev_guard=MEVGuard(),
            approve_manager=ApproveManager(),
            budget=BudgetTracker(),
            workspace=tmp_path,
        )
        strategy = _make_strategy()
        _run(loop._step_execute([strategy]))

        import yaml
        output_root = tmp_path / ".docs" / "ai-skills" / "execute" / "output"
        run_dir = list(output_root.iterdir())[0]
        data = yaml.safe_load((run_dir / "execution_results.yml").read_text())

        assert data["simulated"] is True
        assert data["results"][0]["simulated"] is True
        assert data["results"][0]["tx_hash"].startswith("sim-")

    def test_multiple_strategies_in_one_artifact(self, tmp_path):
        loop = _make_loop(workspace=tmp_path)
        strategies = [_make_strategy(), _make_strategy()]
        _run(loop._step_execute(strategies))

        import yaml
        output_root = tmp_path / ".docs" / "ai-skills" / "execute" / "output"
        run_dir = list(output_root.iterdir())[0]
        data = yaml.safe_load((run_dir / "execution_results.yml").read_text())

        assert data["total"] == 2
        assert len(data["results"]) == 2


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  16. Simulate mode config
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestSimulateConfig:
    def test_simulate_flag_stored(self):
        loop = ArbCampaignLoop(config={"simulate": True})
        assert loop._simulate is True

    def test_simulate_default_false(self):
        loop = ArbCampaignLoop()
        assert loop._simulate is False

    def test_simulate_with_sim_executor_e2e(self, tmp_path):
        """Full simulate pipeline: SimDexExecutor + artifacts"""
        sim = SimDexExecutor()
        loop = ArbCampaignLoop(
            config={"simulate": True},
            executor=sim,
            slippage_guard=SlippageGuard(),
            tvl_breaker=TVLBreaker(),
            mev_guard=MEVGuard(),
            approve_manager=ApproveManager(),
            budget=BudgetTracker(),
            workspace=tmp_path,
        )
        assert loop._simulate is True

        strategy = _make_strategy()
        results = _run(loop._step_execute([strategy]))

        # verify simulation results
        assert results[0]["status"] == "success"
        assert results[0]["simulated"] is True

        # verify artifacts written
        output_root = tmp_path / ".docs" / "ai-skills" / "execute" / "output"
        assert output_root.exists()
        run_dirs = list(output_root.iterdir())
        assert len(run_dirs) == 1
