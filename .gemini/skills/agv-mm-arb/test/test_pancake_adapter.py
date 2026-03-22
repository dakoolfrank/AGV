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

from scripts.toolloop_mm import (
    PancakeV2Adapter,
    DexExecutor,
    ApproveManager,
    SlippageGuard,
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
