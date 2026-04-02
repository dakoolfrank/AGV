"""PancakeV2Adapter + DexExecutor + ApproveManager 单元测试

测试策略：
  - web3 mock 模式（不需要真实 BSC 节点）
  - 验证交易构建、ABI 编码、错误处理
  - 验证 DexExecutor → Adapter 委派链路
  - 验证 ApproveManager 安全策略
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.toolloop_common import (
    PancakeV2Adapter,
    DexExecutor,
    LiveDexExecutor,
    DryRunDexExecutor,
    ApproveManager,
    SlippageGuard,
    MEVGuard,
    TVLBreaker,
    TVLState,
    ROUTER,
    FACTORY,
    USDT,
    KNOWN_PAIRS,
    PANCAKE_V2_ROUTER_ABI,
    PANCAKE_V2_PAIR_ABI,
    ERC20_APPROVE_ABI,
)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ── Fixtures ─────────────────────────────────────────

FAKE_PRIVATE_KEY = "0x" + "ab" * 32  # 32 bytes hex
FAKE_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678"

def _make_mock_web3(*, reserves=(10**18, 5 * 10**18), gas_price=5_000_000_000):
    """构建 mock web3 实例"""
    w3 = MagicMock()
    w3.to_checksum_address = lambda addr: addr  # passthrough for tests

    # eth.gas_price
    type(w3.eth).gas_price = property(lambda self: gas_price)

    # eth.get_transaction_count
    w3.eth.get_transaction_count = MagicMock(return_value=42)

    # eth.contract → returns mock contract
    mock_contract = MagicMock()

    # Router functions (swap/addLiquidity/removeLiquidity)
    mock_tx_builder = MagicMock()
    mock_tx_builder.build_transaction = MagicMock(return_value={
        "from": FAKE_ADDRESS,
        "to": ROUTER,
        "data": "0xdeadbeef",
        "gas": 250_000,
        "gasPrice": gas_price,
        "nonce": 42,
        "chainId": 56,
    })
    mock_contract.functions.swapExactTokensForTokens = MagicMock(return_value=mock_tx_builder)
    mock_contract.functions.addLiquidity = MagicMock(return_value=mock_tx_builder)
    mock_contract.functions.removeLiquidity = MagicMock(return_value=mock_tx_builder)

    # Pair functions (getReserves)
    mock_reserves_call = MagicMock()
    mock_reserves_call.call = MagicMock(return_value=reserves + (int(time.time()),))
    mock_contract.functions.getReserves = MagicMock(return_value=mock_reserves_call)

    # ERC20 functions (allowance/approve)
    mock_allowance_call = MagicMock()
    mock_allowance_call.call = MagicMock(return_value=0)
    mock_contract.functions.allowance = MagicMock(return_value=mock_allowance_call)
    mock_contract.functions.approve = MagicMock(return_value=mock_tx_builder)

    w3.eth.contract = MagicMock(return_value=mock_contract)

    # Account
    mock_account = MagicMock()
    mock_account.address = FAKE_ADDRESS
    w3.eth.account.from_key = MagicMock(return_value=mock_account)

    # send_raw_transaction + wait_for_transaction_receipt
    w3.eth.account.sign_transaction = MagicMock(return_value=MagicMock(
        raw_transaction=b"\x00" * 32,
    ))
    w3.eth.send_raw_transaction = MagicMock(return_value=b"\x01" * 32)
    w3.eth.wait_for_transaction_receipt = MagicMock(return_value={
        "transactionHash": b"\x01" * 32,
        "status": 1,
        "gasUsed": 150_000,
        "blockNumber": 12345678,
    })

    return w3


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ABI 常量测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestABIConstants:
    """验证 ABI 片段结构完整"""

    def test_router_abi_has_three_functions(self):
        names = {f["name"] for f in PANCAKE_V2_ROUTER_ABI}
        assert names == {"swapExactTokensForTokens", "addLiquidity", "removeLiquidity"}

    def test_pair_abi_has_reserves_and_tokens(self):
        names = {f["name"] for f in PANCAKE_V2_PAIR_ABI}
        assert "getReserves" in names
        assert "token0" in names
        assert "token1" in names

    def test_erc20_abi_has_approve_and_allowance(self):
        names = {f["name"] for f in ERC20_APPROVE_ABI}
        assert names == {"approve", "allowance"}

    def test_known_pairs_contains_both_pools(self):
        assert "pGVT_USDT" in KNOWN_PAIRS
        assert "sGVT_USDT" in KNOWN_PAIRS

    def test_router_address_is_checksummed(self):
        assert ROUTER.startswith("0x")
        assert len(ROUTER) == 42


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PancakeV2Adapter 测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestPancakeV2Adapter:

    def test_init_without_web3(self):
        adapter = PancakeV2Adapter()
        assert adapter.web3 is None
        assert adapter._router is None

    def test_init_with_web3_creates_router(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        assert adapter._router is not None
        assert adapter._account == FAKE_ADDRESS

    def test_get_account_raises_without_key(self):
        adapter = PancakeV2Adapter()
        with pytest.raises(RuntimeError, match="no private_key"):
            adapter.get_account()

    def test_get_account_returns_address(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        assert adapter.get_account() == FAKE_ADDRESS

    def test_build_swap_tx_raises_without_web3(self):
        adapter = PancakeV2Adapter()
        with pytest.raises(RuntimeError, match="web3 not initialized"):
            _run(adapter.build_swap_tx(
                token_in=USDT, token_out=KNOWN_PAIRS["pGVT_USDT"],
                amount_in=10**18, min_amount_out=10**17,
                recipient=FAKE_ADDRESS, deadline=int(time.time()) + 300,
            ))

    def test_build_swap_tx_returns_dict(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        tx = _run(adapter.build_swap_tx(
            token_in=USDT, token_out="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_in=10**18, min_amount_out=10**17,
            recipient=FAKE_ADDRESS, deadline=int(time.time()) + 300,
        ))
        assert isinstance(tx, dict)
        assert "from" in tx
        assert "gas" in tx

    def test_build_add_liquidity_tx_returns_dict(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        tx = _run(adapter.build_add_liquidity_tx(
            token_a=USDT,
            token_b="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_a_desired=10**18, amount_b_desired=5 * 10**18,
            amount_a_min=10**17, amount_b_min=5 * 10**17,
            to=FAKE_ADDRESS, deadline=int(time.time()) + 300,
        ))
        assert isinstance(tx, dict)

    def test_build_remove_liquidity_tx_returns_dict(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        tx = _run(adapter.build_remove_liquidity_tx(
            token_a=USDT,
            token_b="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            liquidity=10**18, amount_a_min=10**17, amount_b_min=5 * 10**17,
            to=FAKE_ADDRESS, deadline=int(time.time()) + 300,
        ))
        assert isinstance(tx, dict)

    def test_get_reserves_returns_tuple(self):
        expected = (10**18, 5 * 10**18)
        w3 = _make_mock_web3(reserves=expected)
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        r0, r1 = _run(adapter.get_reserves(KNOWN_PAIRS["pGVT_USDT"]))
        assert r0 == expected[0]
        assert r1 == expected[1]

    def test_get_reserves_raises_pool_incompatible_on_revert(self):
        w3 = _make_mock_web3()
        w3.eth.contract.return_value.functions.getReserves.return_value.call.side_effect = (
            Exception("execution reverted: 0x")
        )
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        # Use Exception base to avoid dual-import identity mismatch
        # (toolloop_mm vs scripts.toolloop_mm)
        with pytest.raises(Exception, match="not PancakeSwap V2 compatible"):
            _run(adapter.get_reserves("0x" + "ab" * 20))

    def test_get_reserves_raises_without_web3(self):
        adapter = PancakeV2Adapter()
        with pytest.raises(RuntimeError, match="web3 not initialized"):
            _run(adapter.get_reserves(KNOWN_PAIRS["pGVT_USDT"]))

    def test_send_tx_success(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        result = _run(adapter.send_tx({"fake": "tx_data"}))
        assert result["status"] == "success"
        assert "tx_hash" in result
        assert "gas_used" in result

    def test_send_tx_reverted(self):
        w3 = _make_mock_web3()
        w3.eth.wait_for_transaction_receipt = MagicMock(return_value={
            "transactionHash": b"\x01" * 32,
            "status": 0,  # reverted
            "gasUsed": 250_000,
            "blockNumber": 12345679,
        })
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        result = _run(adapter.send_tx({"fake": "tx_data"}))
        assert result["status"] == "reverted"

    def test_send_tx_raises_without_private_key(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3)
        with pytest.raises(RuntimeError, match="private_key not configured"):
            _run(adapter.send_tx({"fake": "tx_data"}))

    def test_custom_router_address(self):
        custom = "0x" + "ff" * 20
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, router_address=custom, private_key=FAKE_PRIVATE_KEY)
        assert adapter.router_address == custom


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DexExecutor 测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestDexExecutor:

    def test_get_amount_out_basic(self):
        """AMM 恒积公式验证"""
        executor = DexExecutor()
        # 1 ETH in, 1000:2000 reserves → expect ~1993 (with 0.3% fee)
        out = _run(executor.get_amount_out(1000, 100_000, 200_000))
        assert out > 0
        assert out < 200_000  # 不能超过 reserve_out

    def test_get_amount_out_zero_input(self):
        executor = DexExecutor()
        out = _run(executor.get_amount_out(0, 100_000, 200_000))
        assert out == 0

    def test_get_amount_out_zero_denominator(self):
        executor = DexExecutor()
        out = _run(executor.get_amount_out(1000, 0, 0))
        assert out == 0

    def test_estimate_slippage(self):
        executor = DexExecutor()
        slippage = _run(executor.estimate_slippage(
            amount_in=1000, reserve_in=100_000, reserve_out=200_000, price=2.0,
        ))
        assert 0.0 <= slippage <= 1.0

    def test_swap_raises_without_adapter(self):
        executor = DexExecutor()
        with pytest.raises(RuntimeError, match="no adapter"):
            _run(executor.swap(
                token_in=USDT, token_out="0x" + "ab" * 20,
                amount_in=10**18, min_amount_out=10**17,
            ))

    def test_swap_delegates_to_adapter(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        executor = DexExecutor(adapter=adapter)
        result = _run(executor.swap(
            token_in=USDT,
            token_out="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_in=10**18, min_amount_out=10**17,
        ))
        assert result["status"] == "success"

    def test_add_liquidity_delegates_to_adapter(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        executor = DexExecutor(adapter=adapter)
        result = _run(executor.add_liquidity(
            token_a=USDT,
            token_b="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_a=10**18, amount_b=5 * 10**18,
            min_a=10**17, min_b=5 * 10**17,
        ))
        assert result["status"] == "success"

    def test_remove_liquidity_delegates_to_adapter(self):
        w3 = _make_mock_web3()
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        executor = DexExecutor(adapter=adapter)
        result = _run(executor.remove_liquidity(
            token_a=USDT,
            token_b="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            liquidity=10**18, min_a=10**17, min_b=5 * 10**17,
        ))
        assert result["status"] == "success"

    def test_get_reserves_delegates_to_adapter(self):
        expected = (10**18, 5 * 10**18)
        w3 = _make_mock_web3(reserves=expected)
        adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)
        executor = DexExecutor(adapter=adapter)
        r0, r1 = _run(executor.get_reserves(KNOWN_PAIRS["pGVT_USDT"]))
        assert r0 == expected[0]
        assert r1 == expected[1]

    def test_get_reserves_raises_without_adapter(self):
        executor = DexExecutor()
        with pytest.raises(RuntimeError, match="no adapter"):
            _run(executor.get_reserves(KNOWN_PAIRS["pGVT_USDT"]))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ApproveManager 测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestApproveManager:

    def test_in_memory_approve(self):
        """无 web3 时走内存缓存"""
        mgr = ApproveManager()
        result = _run(mgr.approve(USDT, ROUTER, 1000))
        assert result["status"] == "approved"
        assert result["amount"] == 1000

    def test_get_allowance_returns_zero_initially(self):
        mgr = ApproveManager()
        val = _run(mgr.get_allowance(USDT, ROUTER))
        assert val == 0

    def test_ensure_allowance_triggers_approve(self):
        mgr = ApproveManager()
        result = _run(mgr.ensure_allowance(USDT, ROUTER, 500))
        assert result is not None
        assert result["amount"] == 1000  # 500 * 2

    def test_ensure_allowance_skips_if_sufficient(self):
        mgr = ApproveManager()
        _run(mgr.approve(USDT, ROUTER, 2000))
        result = _run(mgr.ensure_allowance(USDT, ROUTER, 500))
        assert result is None  # no approve needed

    def test_ensure_allowance_demand_x2_strategy(self):
        """确认：approve 额度 = 需求量 × 2（安全策略 §5.5）"""
        mgr = ApproveManager()
        result = _run(mgr.ensure_allowance(USDT, ROUTER, 12345))
        assert result["amount"] == 12345 * 2

    def test_case_insensitive_cache(self):
        """地址大小写不影响缓存"""
        mgr = ApproveManager()
        _run(mgr.approve("0xABCD", "0xEFGH", 999))
        val = _run(mgr.get_allowance("0xabcd", "0xefgh"))
        assert val == 999


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DexExecutor + SlippageGuard 集成测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestExecutorSlippageIntegration:

    def test_slippage_check_before_swap(self):
        """完整流程：估算滑点 → guard 检查 → 通过/拒绝"""
        executor = DexExecutor()
        guard = SlippageGuard(max_slippage_pct=0.02)

        # 小额交易 → 滑点低 → 通过
        amount_in = 100
        reserve_in = 100_000
        reserve_out = 200_000
        amount_out = _run(executor.get_amount_out(amount_in, reserve_in, reserve_out))
        ideal_out = int(amount_in * (reserve_out / reserve_in))

        result = _run(guard.check(
            amount_in=amount_in, expected_out=amount_out, ideal_out=ideal_out,
        ))
        assert result["passed"] is True

    def test_large_trade_high_slippage(self):
        """大额交易 → 高滑点 → guard 拒绝"""
        executor = DexExecutor()
        guard = SlippageGuard(max_slippage_pct=0.02)

        # 大额（占池 10%）
        amount_in = 10_000
        reserve_in = 100_000
        reserve_out = 200_000
        amount_out = _run(executor.get_amount_out(amount_in, reserve_in, reserve_out))
        ideal_out = int(amount_in * (reserve_out / reserve_in))

        result = _run(guard.check(
            amount_in=amount_in, expected_out=amount_out, ideal_out=ideal_out,
        ))
        assert result["passed"] is False
        assert result["actual_slippage"] > 0.02


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  env 加载测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestEnvLoading:

    def test_get_s5_env_falls_back_to_default(self):
        from scripts.skill_mm_arb import get_s5_env
        val = get_s5_env("NONEXISTENT_KEY_12345", "fallback_val")
        assert val == "fallback_val"

    def test_get_s5_env_reads_os_environ(self):
        import os
        from scripts.skill_mm_arb import get_s5_env, _S5_ENV
        os.environ["_TEST_S5_KEY"] = "from_env"
        try:
            val = get_s5_env("_TEST_S5_KEY", "default")
            assert val == "from_env"
        finally:
            del os.environ["_TEST_S5_KEY"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  _calc_trade_pnl 测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestCalcTradePnl:
    """测试 P&L 计算函数"""

    def test_import(self):
        """函数可导入"""
        from scripts.toolloop_arb import _calc_trade_pnl
        assert callable(_calc_trade_pnl)

    def test_basic_calculation(self):
        """基本往返计算"""
        from scripts.toolloop_arb import _calc_trade_pnl

        # 10 USDT → swap → 0.01 BNB
        # 池子储备: 100,000 USDT + 100 BNB
        r_in = 100_000 * 10**18   # 100K USDT
        r_out = 100 * 10**18      # 100 BNB
        amount_in = 10 * 10**18   # 10 USDT
        amount_out = int(0.00997 * 10**18)  # ~0.00997 BNB (扣 0.3% fee)

        result = _calc_trade_pnl(
            amount_in_wei=amount_in,
            amount_out=amount_out,
            r_in=r_in,
            r_out=r_out,
            gas_used=150_000,
            amount_in_usd=10.0,
        )

        assert "gross_pnl_bps" in result
        assert "gas_cost_usd" in result
        assert "net_pnl_usd" in result
        assert "profitable" in result
        assert "round_trip_out" in result

    def test_round_trip_is_lossy(self):
        """往返一定亏损（AMM 双向手续费 + 滑点）"""
        from scripts.toolloop_arb import _calc_trade_pnl

        r_in = 1_000_000 * 10**18
        r_out = 1_000 * 10**18
        amount_in = 100 * 10**18
        # AMM 公式: amount_out = (100 * 997 * 1000) / (1_000_000 * 1000 + 100 * 997)
        amount_out = (100 * 997 * 1_000 * 10**18) // (1_000_000 * 1000 + 100 * 997)

        result = _calc_trade_pnl(
            amount_in_wei=amount_in,
            amount_out=amount_out,
            r_in=r_in,
            r_out=r_out,
            gas_used=150_000,
            amount_in_usd=100.0,
        )

        # 往返损失 > 0 bps (至少 2 × 0.3% = 60bps)
        assert result["gross_pnl_bps"] > 50
        # round_trip_out < amount_in
        assert result["round_trip_out"] < amount_in
        # 净亏损
        assert result["net_pnl_usd"] < 0
        assert result["profitable"] is False

    def test_zero_reserves_returns_default(self):
        """零储备返回默认值"""
        from scripts.toolloop_arb import _calc_trade_pnl

        result = _calc_trade_pnl(
            amount_in_wei=10 * 10**18,
            amount_out=10**16,
            r_in=0,
            r_out=0,
            gas_used=150_000,
            amount_in_usd=10.0,
        )

        assert result["gross_pnl_bps"] == 0.0
        assert result["profitable"] is False

    def test_gas_cost_calculated(self):
        """gas 成本正确计算"""
        from scripts.toolloop_arb import _calc_trade_pnl

        result = _calc_trade_pnl(
            amount_in_wei=10 * 10**18,
            amount_out=10**16,
            r_in=10**20,
            r_out=10**18,
            gas_used=200_000,  # 200k gas
            amount_in_usd=10.0,
            gas_price_gwei=3.0,
            bnb_price_usd=300.0,
        )

        # gas_cost = 200_000 * 3e9 * 300 / 10^18 = 0.18 USD
        expected_gas_cost = 200_000 * 3.0 * 1e-9 * 300
        assert abs(result["gas_cost_usd"] - expected_gas_cost) < 0.001


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DryRunDexExecutor 增强功能测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TestDryRunDexExecutorEnhanced:
    """测试 DryRunDexExecutor 的 amount_out/price_impact 计算"""

    def test_import_dryrun_executor(self):
        """DryRunDexExecutor 可导入"""
        from scripts.toolloop_common import DryRunDexExecutor
        assert DryRunDexExecutor is not None

    def test_swap_with_pair_address_returns_amount_out(self):
        """传入 pair_address 时返回 amount_out"""
        from scripts.toolloop_common import DryRunDexExecutor, PancakeV2Adapter

        # Mock adapter
        adapter = MagicMock(spec=PancakeV2Adapter)
        adapter.get_account.return_value = "0x1234"

        # Mock get_reserves 返回
        async def mock_reserves(addr):
            return (100_000 * 10**18, 100 * 10**18)  # 100K USDT, 100 BNB
        adapter.get_reserves = mock_reserves

        # Mock build_swap_tx
        async def mock_build(*args, **kwargs):
            return {"from": "0x1234", "to": "0x5678", "data": "0x", "value": 0}
        adapter.build_swap_tx = mock_build

        # Mock web3 eth_call
        mock_w3 = MagicMock()
        mock_w3.eth.call = MagicMock(return_value=b"")
        mock_w3.eth.estimate_gas = MagicMock(return_value=150000)
        mock_w3.eth.block_number = 12345
        adapter.web3 = mock_w3

        executor = DryRunDexExecutor(adapter=adapter)

        result = _run(executor.swap(
            token_in="0xUSDT",
            token_out="0xWBNB",
            amount_in=10 * 10**18,
            min_amount_out=0,
            pair_address="0xPAIR",
        ))

        # 应有 amount_out 计算
        assert "amount_out" in result
        assert result["amount_out"] > 0
        # 应有 price_impact
        assert "price_impact" in result
        # 应有储备信息
        assert result["reserve_in"] > 0
        assert result["reserve_out"] > 0

    def test_swap_without_pair_address_no_amount_out(self):
        """不传 pair_address 时 amount_out 为 0"""
        from scripts.toolloop_common import DryRunDexExecutor, PancakeV2Adapter

        adapter = MagicMock(spec=PancakeV2Adapter)
        adapter.get_account.return_value = "0x1234"

        async def mock_build(*args, **kwargs):
            return {"from": "0x1234", "to": "0x5678", "data": "0x", "value": 0}
        adapter.build_swap_tx = mock_build

        mock_w3 = MagicMock()
        mock_w3.eth.call = MagicMock(return_value=b"")
        mock_w3.eth.estimate_gas = MagicMock(return_value=150000)
        mock_w3.eth.block_number = 12345
        adapter.web3 = mock_w3

        executor = DryRunDexExecutor(adapter=adapter)

        result = _run(executor.swap(
            token_in="0xUSDT",
            token_out="0xWBNB",
            amount_in=10 * 10**18,
            min_amount_out=0,
            # 不传 pair_address
        ))

        # 无 pair_address → amount_out = 0
        assert result["amount_out"] == 0
        assert result["reserve_in"] == 0

    def test_dryrun_preserves_simulated_flag(self):
        """DryRun 保留 simulated 和 dry_run 标记"""
        from scripts.toolloop_common import DryRunDexExecutor, PancakeV2Adapter

        adapter = MagicMock(spec=PancakeV2Adapter)
        adapter.get_account.return_value = "0x1234"

        async def mock_build(*args, **kwargs):
            return {"from": "0x1234", "to": "0x5678", "data": "0x", "value": 0}
        adapter.build_swap_tx = mock_build

        mock_w3 = MagicMock()
        mock_w3.eth.call = MagicMock(return_value=b"")
        mock_w3.eth.estimate_gas = MagicMock(return_value=150000)
        mock_w3.eth.block_number = 12345
        adapter.web3 = mock_w3

        executor = DryRunDexExecutor(adapter=adapter)

        result = _run(executor.swap(
            token_in="0xUSDT",
            token_out="0xWBNB",
            amount_in=10**18,
            min_amount_out=0,
        ))

        assert result["simulated"] is True
        assert result["dry_run"] is True
        assert result["tx_hash"].startswith("dryrun-")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  LiveDexExecutor 测试
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _make_live_executor(
    *,
    reserves=(100_000 * 10**18, 500 * 10**18),
    balance=10**20,
    allowance=0,
    tvl_state=TVLState.NORMAL,
    slippage_max=0.02,
    swap_receipt_status=1,
    with_guards=True,
):
    """构建 LiveDexExecutor，全 mock web3"""
    w3 = _make_mock_web3(reserves=reserves)

    # balanceOf mock
    balance_mock = MagicMock()
    balance_mock.call = MagicMock(return_value=balance)
    # allowance mock — 需要覆盖默认的 0
    allowance_mock = MagicMock()
    allowance_mock.call = MagicMock(return_value=allowance)

    # 区分 balanceOf 和 allowance 调用
    original_contract = w3.eth.contract.return_value
    original_contract.functions.balanceOf = MagicMock(return_value=balance_mock)
    original_contract.functions.allowance = MagicMock(return_value=allowance_mock)

    # 覆盖 receipt status
    w3.eth.wait_for_transaction_receipt = MagicMock(return_value={
        "transactionHash": b"\x01" * 32,
        "status": swap_receipt_status,
        "gasUsed": 150_000,
        "blockNumber": 12345678,
    })

    adapter = PancakeV2Adapter(web3=w3, private_key=FAKE_PRIVATE_KEY)

    kwargs = dict(adapter=adapter, config={"recipient": FAKE_ADDRESS})
    if with_guards:
        kwargs["slippage_guard"] = SlippageGuard(max_slippage_pct=slippage_max)
        kwargs["approve_manager"] = ApproveManager(web3=w3, private_key=FAKE_PRIVATE_KEY)
        kwargs["tvl_breaker"] = TVLBreaker(
            min_tvl_usd=0.0, warn_tvl_usd=0.0, critical_reserve_ratio=0.0
        )

    executor = LiveDexExecutor(**kwargs)
    return executor


class TestLiveDexExecutor:
    """LiveDexExecutor — 实盘执行器完整测试"""

    # ── 基础属性 ──

    def test_is_live_flag(self):
        executor = LiveDexExecutor()
        assert executor.is_live is True

    def test_inherits_dex_executor(self):
        assert issubclass(LiveDexExecutor, DexExecutor)

    def test_init_accepts_guards(self):
        executor = LiveDexExecutor(
            slippage_guard=SlippageGuard(),
            mev_guard=MEVGuard(),
            tvl_breaker=TVLBreaker(),
            approve_manager=ApproveManager(),
        )
        assert executor.slippage_guard is not None
        assert executor.mev_guard is not None
        assert executor.tvl_breaker is not None
        assert executor.approve_manager is not None

    def test_tx_count_starts_at_zero(self):
        executor = LiveDexExecutor()
        assert executor._tx_count == 0

    # ── Pre-flight: 余额检查 ──

    def test_preflight_balance_pass(self):
        executor = _make_live_executor(balance=10**20)
        result = _run(executor._preflight_balance_check(USDT, 10**18))
        assert result["passed"] is True
        assert result["balance"] == 10**20

    def test_preflight_balance_fail_insufficient(self):
        executor = _make_live_executor(balance=100)
        result = _run(executor._preflight_balance_check(USDT, 10**18))
        assert result["passed"] is False
        assert "insufficient_balance" in result["reason"]

    def test_preflight_balance_skip_no_adapter(self):
        executor = LiveDexExecutor()
        result = _run(executor._preflight_balance_check(USDT, 10**18))
        assert result["passed"] is True
        assert result["reason"] == "no_adapter_skip"

    # ── Pre-flight: Allowance 检查 ──

    def test_preflight_allowance_skip_no_manager(self):
        executor = LiveDexExecutor()
        result = _run(executor._preflight_allowance_check(USDT, 10**18))
        assert result["passed"] is True
        assert result["reason"] == "no_approve_manager_skip"

    def test_preflight_allowance_sufficient(self):
        executor = _make_live_executor(allowance=10**20)
        result = _run(executor._preflight_allowance_check(
            USDT, 10**18, spender=ROUTER
        ))
        assert result["passed"] is True
        assert result["allowance"] == 10**20

    def test_preflight_allowance_auto_approve(self):
        executor = _make_live_executor(allowance=0)
        result = _run(executor._preflight_allowance_check(
            USDT, 10**18, spender=ROUTER
        ))
        assert result["passed"] is True
        assert result.get("auto_approved") is True

    # ── Pre-flight: 滑点检查 ──

    def test_preflight_slippage_skip_no_guard(self):
        executor = _make_live_executor(with_guards=False)
        result = _run(executor._preflight_slippage_check(
            amount_in=10**18, pair_address="0xPAIR"
        ))
        assert result["passed"] is True

    def test_preflight_slippage_skip_no_pair(self):
        executor = _make_live_executor()
        result = _run(executor._preflight_slippage_check(
            amount_in=10**18, pair_address=None
        ))
        assert result["passed"] is True

    def test_preflight_slippage_pass_small_trade(self):
        # 大储备 + 小交易 → 低滑点 → 通过
        executor = _make_live_executor(
            reserves=(10**24, 10**24), slippage_max=0.05
        )
        result = _run(executor._preflight_slippage_check(
            amount_in=10**18, pair_address=KNOWN_PAIRS["pGVT_USDT"]
        ))
        assert result["passed"] is True

    # ── Pre-flight: TVL 检查 ──

    def test_preflight_tvl_skip_no_breaker(self):
        executor = _make_live_executor(with_guards=False)
        result = _run(executor._preflight_tvl_check("0xPAIR"))
        assert result["passed"] is True

    def test_preflight_tvl_skip_no_pair(self):
        executor = _make_live_executor()
        result = _run(executor._preflight_tvl_check(None))
        assert result["passed"] is True

    # ── swap 完整流程 ──

    def test_swap_success_with_preflight(self):
        executor = _make_live_executor(
            balance=10**20, allowance=10**20,
            reserves=(10**22, 10**22),  # 均衡储备，避免 TVL ratio 触发
        )
        result = _run(executor.swap(
            token_in=USDT,
            token_out="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_in=10**18,
            min_amount_out=10**16,
            pair_address=KNOWN_PAIRS["pGVT_USDT"],
        ))
        assert result["status"] == "success"
        assert result["live"] is True
        assert result["tx_index"] == 1
        assert "preflight" in result
        assert "tx_hash" in result

    def test_swap_skip_preflight(self):
        executor = _make_live_executor(balance=0)  # 余额不足
        result = _run(executor.swap(
            token_in=USDT,
            token_out="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_in=10**18,
            min_amount_out=10**16,
            skip_preflight=True,  # 跳过检查 → 仍然会发交易
        ))
        # 跳过 preflight → 调用 super().swap() → 返回 adapter 结果
        assert result["status"] == "success"
        assert result["live"] is True

    def test_swap_preflight_balance_fail_aborts(self):
        executor = _make_live_executor(balance=0)
        result = _run(executor.swap(
            token_in=USDT,
            token_out="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_in=10**18,
            min_amount_out=10**16,
        ))
        assert result["status"] == "preflight_failed"
        assert result["tx_hash"] is None
        assert result["preflight"]["balance"]["passed"] is False

    def test_swap_preflight_allowance_fail_aborts(self):
        # 余额足够，但 approve_manager.get_allowance 抛异常
        executor = _make_live_executor(balance=10**20)
        # 让 get_allowance 抛异常
        async def _broken_get(token, spender):
            raise RuntimeError("allowance RPC failed")
        executor.approve_manager.get_allowance = _broken_get
        result = _run(executor.swap(
            token_in=USDT,
            token_out="0x8F9EC8107C126e94F5C4df26350Fb7354E0C8af9",
            amount_in=10**18,
            min_amount_out=10**16,
        ))
        assert result["status"] == "preflight_failed"
        assert "allowance_check_error" in result["preflight"]["allowance"]["reason"]

    def test_swap_increments_tx_count(self):
        executor = _make_live_executor(balance=10**20, allowance=10**20)
        _run(executor.swap(
            token_in=USDT, token_out="0x" + "ab" * 20,
            amount_in=10**18, min_amount_out=0,
            pair_address=KNOWN_PAIRS["pGVT_USDT"],
        ))
        _run(executor.swap(
            token_in=USDT, token_out="0x" + "ab" * 20,
            amount_in=10**18, min_amount_out=0,
            pair_address=KNOWN_PAIRS["pGVT_USDT"],
        ))
        assert executor._tx_count == 2

    def test_swap_reverted_receipt(self):
        executor = _make_live_executor(
            balance=10**20, allowance=10**20, swap_receipt_status=0,
            reserves=(10**22, 10**22),  # 均衡储备
        )
        result = _run(executor.swap(
            token_in=USDT,
            token_out="0x" + "ab" * 20,
            amount_in=10**18,
            min_amount_out=0,
            pair_address=KNOWN_PAIRS["pGVT_USDT"],
        ))
        assert result["status"] == "reverted"
        assert result["live"] is True

    # ── swap 无 guards ──

    def test_swap_no_guards_succeeds(self):
        executor = _make_live_executor(with_guards=False, balance=10**20)
        result = _run(executor.swap(
            token_in=USDT,
            token_out="0x" + "ab" * 20,
            amount_in=10**18,
            min_amount_out=0,
        ))
        assert result["status"] == "success"
        assert result["live"] is True

    # ── DryRun vs Live 对比 ──

    def test_live_vs_dryrun_is_live_flag(self):
        live = LiveDexExecutor()
        dry = DryRunDexExecutor(adapter=MagicMock(spec=PancakeV2Adapter))
        assert live.is_live is True
        assert dry.is_live is False
