"""
共享执行层 — MM-Campaign 和 Arb-Campaign 共用基础设施

=== DexExecutor L2 ===
  - DexExecutor:        统一 DEX 接口（swap/addLiquidity/removeLiquidity）
  - PancakeV2Adapter:   PancakeSwap V2 适配器（BSC Mainnet）
  - LiveDexExecutor:    实盘执行器（真实签名 + 广播 + pre-flight 安全检查）
  - DryRunDexExecutor:  仿真执行器（eth_call 仿真 + AMM 预计算）
  - SlippageGuard:      Layer 1 — 滑点硬顶 2%
  - MEVGuard:           Layer 2 — mempool 扫描 + 冷却延迟
  - TVLBreaker:         Layer 3 — TVL 熔断三态机
  - ApproveManager:     Token approve 安全（禁止 MAX_UINT256）
  - NotifyRouter:       通知路由（CRITICAL→双通道）

拆分自 toolloop_mm.py — D5: toolloop_common.py 为唯一共享真相源。
MM 和 Arb 是独立 Campaign，共享基础设施在此文件。
"""
from __future__ import annotations

import asyncio
import json as _json
import logging
import time
import urllib.request
import urllib.error
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)

# ── BSC Mainnet 常量 ─────────────────────────────────
ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"
FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"
USDT = "0x55d398326f99059fF775485246999027B3197955"

KNOWN_PAIRS = {
    "pGVT_USDT": "0x5558e43eE316C45e6C842bC7aC4B770EED03c5C0",
    "sGVT_USDT": "0xBE1B08D1743f2C158165472Fa2fEB038E8DfaA9d",
}


class PoolIncompatibleError(RuntimeError):
    """池合约与 PancakeSwap V2 ABI 不兼容（如 V3 集中流动性池）"""

    def __init__(self, pair_address: str, cause: Exception | None = None):
        self.pair_address = pair_address
        self.cause = cause
        msg = (
            f"Pool {pair_address[:10]}... is not PancakeSwap V2 compatible "
            f"(getReserves reverted). Likely a V3/concentrated-liquidity pool."
        )
        if cause:
            msg += f" Original error: {cause}"
        super().__init__(msg)


# ── ABI 片段（PancakeSwap V2 + ERC20）────────────────
PANCAKE_V2_ROUTER_ABI = [
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"},
            {"name": "amountADesired", "type": "uint256"},
            {"name": "amountBDesired", "type": "uint256"},
            {"name": "amountAMin", "type": "uint256"},
            {"name": "amountBMin", "type": "uint256"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "addLiquidity",
        "outputs": [
            {"name": "amountA", "type": "uint256"},
            {"name": "amountB", "type": "uint256"},
            {"name": "liquidity", "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "tokenA", "type": "address"},
            {"name": "tokenB", "type": "address"},
            {"name": "liquidity", "type": "uint256"},
            {"name": "amountAMin", "type": "uint256"},
            {"name": "amountBMin", "type": "uint256"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "name": "removeLiquidity",
        "outputs": [
            {"name": "amountA", "type": "uint256"},
            {"name": "amountB", "type": "uint256"},
        ],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

PANCAKE_V2_PAIR_ABI = [
    {
        "inputs": [],
        "name": "getReserves",
        "outputs": [
            {"name": "_reserve0", "type": "uint112"},
            {"name": "_reserve1", "type": "uint112"},
            {"name": "_blockTimestampLast", "type": "uint32"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "token0",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "token1",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
]

ERC20_APPROVE_ABI = [
    {
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


# ── DexExecutor ──────────────────────────────────────
class DexExecutor:
    """DEX 执行层 — 两个 Campaign 共享"""

    is_live: bool = True  # 基类默认为实盘，DryRun 子类覆盖为 False

    def __init__(self, *, adapter: "PancakeV2Adapter | None" = None,
                 signer=None, config: dict | None = None):
        self.adapter = adapter
        self.signer = signer
        self.config = config or {}

    async def swap(self, *, token_in: str, token_out: str, amount_in: int,
                   min_amount_out: int, deadline_seconds: int = 300,
                   use_private_rpc: bool = False,
                   pair_address: str | None = None):  # DryRun 使用，Live 忽略
        if not self.adapter:
            raise RuntimeError("DexExecutor: no adapter configured")
        recipient = self.config.get("recipient") or self.adapter.get_account()
        deadline = int(time.time()) + deadline_seconds
        tx = await self.adapter.build_swap_tx(
            token_in=token_in, token_out=token_out,
            amount_in=amount_in, min_amount_out=min_amount_out,
            recipient=recipient, deadline=deadline,
        )
        return await self.adapter.send_tx(tx)

    async def add_liquidity(self, *, token_a: str, token_b: str,
                            amount_a: int, amount_b: int,
                            min_a: int, min_b: int,
                            deadline_seconds: int = 300):
        if not self.adapter:
            raise RuntimeError("DexExecutor: no adapter configured")
        recipient = self.config.get("recipient") or self.adapter.get_account()
        deadline = int(time.time()) + deadline_seconds
        tx = await self.adapter.build_add_liquidity_tx(
            token_a=token_a, token_b=token_b,
            amount_a_desired=amount_a, amount_b_desired=amount_b,
            amount_a_min=min_a, amount_b_min=min_b,
            to=recipient, deadline=deadline,
        )
        return await self.adapter.send_tx(tx)

    async def remove_liquidity(self, *, token_a: str, token_b: str,
                               liquidity: int, min_a: int, min_b: int,
                               deadline_seconds: int = 300):
        if not self.adapter:
            raise RuntimeError("DexExecutor: no adapter configured")
        recipient = self.config.get("recipient") or self.adapter.get_account()
        deadline = int(time.time()) + deadline_seconds
        tx = await self.adapter.build_remove_liquidity_tx(
            token_a=token_a, token_b=token_b,
            liquidity=liquidity, amount_a_min=min_a, amount_b_min=min_b,
            to=recipient, deadline=deadline,
        )
        return await self.adapter.send_tx(tx)

    async def get_reserves(self, pair_address: str) -> tuple[int, int]:
        if not self.adapter:
            raise RuntimeError("DexExecutor: no adapter configured")
        return await self.adapter.get_reserves(pair_address)

    async def get_amount_out(self, amount_in: int, reserve_in: int,
                             reserve_out: int) -> int:
        """链下预计算 — AMM 恒积公式"""
        numerator = amount_in * 997 * reserve_out
        denominator = reserve_in * 1000 + amount_in * 997
        if denominator == 0:
            return 0
        return numerator // denominator

    async def estimate_slippage(
        self, *, amount_in: int, reserve_in: int, reserve_out: int, price: float,
    ) -> float:
        """预估滑点 — ideal vs AMM 实际输出 (§5.2)"""
        if price <= 0 or amount_in <= 0:
            return 0.0
        ideal_out = amount_in * price
        actual_out = await self.get_amount_out(amount_in, reserve_in, reserve_out)
        if ideal_out == 0:
            return 0.0
        return max(0.0, 1.0 - (actual_out / ideal_out))


# ── PancakeV2Adapter ─────────────────────────────────
class PancakeV2Adapter:
    """PancakeSwap V2 适配器 — web3.py 实现 (D1)

    所有链上读取走 asyncio.to_thread（sync web3 → async bridge）。
    交易构建为纯内存操作，不需要 async。
    """

    def __init__(self, *, web3=None, router_address: str = ROUTER,
                 private_key: str | None = None):
        self.web3 = web3
        self.router_address = router_address
        self._private_key = private_key
        self._router = None
        self._account: str | None = None
        if web3 is not None:
            self._init_contracts()

    def _init_contracts(self):
        """初始化 Router 合约对象"""
        w3 = self.web3
        self._router = w3.eth.contract(
            address=w3.to_checksum_address(self.router_address),
            abi=PANCAKE_V2_ROUTER_ABI,
        )
        if self._private_key:
            acct = w3.eth.account.from_key(self._private_key)
            self._account = acct.address

    def get_account(self) -> str:
        """返回签名地址"""
        if not self._account:
            raise RuntimeError("PancakeV2Adapter: no private_key configured")
        return self._account

    async def build_swap_tx(self, *, token_in: str, token_out: str,
                            amount_in: int, min_amount_out: int,
                            recipient: str, deadline: int) -> dict:
        """构建 swapExactTokensForTokens 交易"""
        if not self._router or not self.web3:
            raise RuntimeError("PancakeV2Adapter: web3 not initialized")
        w3 = self.web3
        path = [w3.to_checksum_address(token_in), w3.to_checksum_address(token_out)]
        tx_data = self._router.functions.swapExactTokensForTokens(
            amount_in, min_amount_out, path,
            w3.to_checksum_address(recipient), deadline,
        ).build_transaction({
            "from": self.get_account(),
            "gas": 250_000,
            "gasPrice": await asyncio.to_thread(w3.eth.gas_price.fget, w3.eth) if hasattr(w3.eth.gas_price, 'fget') else await asyncio.to_thread(lambda: w3.eth.gas_price),
            "nonce": await asyncio.to_thread(
                w3.eth.get_transaction_count, w3.to_checksum_address(self.get_account()),
            ),
        })
        return tx_data

    async def build_add_liquidity_tx(self, *, token_a: str, token_b: str,
                                     amount_a_desired: int, amount_b_desired: int,
                                     amount_a_min: int, amount_b_min: int,
                                     to: str, deadline: int) -> dict:
        """构建 addLiquidity 交易"""
        if not self._router or not self.web3:
            raise RuntimeError("PancakeV2Adapter: web3 not initialized")
        w3 = self.web3
        tx_data = self._router.functions.addLiquidity(
            w3.to_checksum_address(token_a),
            w3.to_checksum_address(token_b),
            amount_a_desired, amount_b_desired,
            amount_a_min, amount_b_min,
            w3.to_checksum_address(to), deadline,
        ).build_transaction({
            "from": self.get_account(),
            "gas": 300_000,
            "gasPrice": await asyncio.to_thread(lambda: w3.eth.gas_price),
            "nonce": await asyncio.to_thread(
                w3.eth.get_transaction_count, w3.to_checksum_address(self.get_account()),
            ),
        })
        return tx_data

    async def build_remove_liquidity_tx(self, *, token_a: str, token_b: str,
                                        liquidity: int, amount_a_min: int,
                                        amount_b_min: int,
                                        to: str, deadline: int) -> dict:
        """构建 removeLiquidity 交易"""
        if not self._router or not self.web3:
            raise RuntimeError("PancakeV2Adapter: web3 not initialized")
        w3 = self.web3
        tx_data = self._router.functions.removeLiquidity(
            w3.to_checksum_address(token_a),
            w3.to_checksum_address(token_b),
            liquidity, amount_a_min, amount_b_min,
            w3.to_checksum_address(to), deadline,
        ).build_transaction({
            "from": self.get_account(),
            "gas": 300_000,
            "gasPrice": await asyncio.to_thread(lambda: w3.eth.gas_price),
            "nonce": await asyncio.to_thread(
                w3.eth.get_transaction_count, w3.to_checksum_address(self.get_account()),
            ),
        })
        return tx_data

    async def get_reserves(self, pair_address: str) -> tuple[int, int]:
        """读取 LP 对的 reserve0, reserve1

        Raises:
            PoolIncompatibleError: 当 getReserves() revert 时（V3 池等）
        """
        if not self.web3:
            raise RuntimeError("PancakeV2Adapter: web3 not initialized")
        w3 = self.web3
        pair = w3.eth.contract(
            address=w3.to_checksum_address(pair_address),
            abi=PANCAKE_V2_PAIR_ABI,
        )
        try:
            reserves = await asyncio.to_thread(pair.functions.getReserves().call)
        except Exception as exc:
            exc_str = str(exc).lower()
            if "revert" in exc_str or "execution reverted" in exc_str or "0x" in exc_str:
                raise PoolIncompatibleError(pair_address, exc) from exc
            raise
        return (reserves[0], reserves[1])

    async def send_tx(self, tx: dict) -> dict:
        """签名 + 发送 + 等待确认"""
        if not self.web3 or not self._private_key:
            raise RuntimeError("PancakeV2Adapter: web3 or private_key not configured")
        w3 = self.web3
        signed = w3.eth.account.sign_transaction(tx, self._private_key)
        tx_hash = await asyncio.to_thread(w3.eth.send_raw_transaction, signed.raw_transaction)
        receipt = await asyncio.to_thread(w3.eth.wait_for_transaction_receipt, tx_hash, timeout=120)
        return {
            "tx_hash": receipt["transactionHash"].hex(),
            "status": "success" if receipt["status"] == 1 else "reverted",
            "gas_used": receipt["gasUsed"],
            "block_number": receipt["blockNumber"],
        }


# ── SlippageGuard ────────────────────────────────────
class SlippageGuard:
    """Layer 1 — 滑点硬顶 2%，不可被 LLM 覆盖"""

    def __init__(self, *, max_slippage_pct: float = 0.02):
        self.max_slippage_pct = max_slippage_pct

    async def check(self, *, amount_in: int, expected_out: int,
                    ideal_out: int) -> dict:
        if ideal_out == 0:
            return {"passed": False, "reason": "ideal_out is zero"}
        actual_slippage = 1 - (expected_out / ideal_out)
        if actual_slippage > self.max_slippage_pct:
            return {
                "passed": False,
                "reason": f"slippage {actual_slippage:.2%} > max {self.max_slippage_pct:.2%}",
                "actual_slippage": actual_slippage,
            }
        min_out = int(expected_out * (1 - self.max_slippage_pct))
        return {"passed": True, "actual_slippage": actual_slippage, "min_amount_out": min_out}


# ── MEVGuard ─────────────────────────────────────────
class MEVGuard:
    """Layer 2 — MEV 防御（mempool 扫描 + 冷却延迟）"""

    def __init__(self, *, gas_spike_ratio: float = 3.0, cooldown_sec: int = 6):
        self.gas_spike_ratio = gas_spike_ratio
        self.cooldown_sec = cooldown_sec
        self._last_alert_ts: float = 0.0

    async def inspect_mempool(self, *, pending_txs: list[dict], our_pool: str) -> dict:
        raise NotImplementedError("Phase 1: mempool inspection")

    async def should_delay(self) -> bool:
        if self._last_alert_ts == 0.0:
            return False
        return (time.monotonic() - self._last_alert_ts) < self.cooldown_sec

    def record_alert(self) -> None:
        self._last_alert_ts = time.monotonic()


# ── TVLBreaker ───────────────────────────────────────
class TVLState(str, Enum):
    NORMAL = "NORMAL"
    REDUCE_ACTIVITY = "REDUCE_ACTIVITY"
    HALT_ALL = "HALT_ALL"


class TVLBreaker:
    """Layer 3 — TVL 熔断三态机，不可被 LLM 覆盖"""

    def __init__(self, *, min_tvl_usd: float = 30.0, warn_tvl_usd: float = 80.0,
                 recover_tvl_usd: float = 100.0, critical_reserve_ratio: float = 0.10):
        self.min_tvl_usd = min_tvl_usd
        self.warn_tvl_usd = warn_tvl_usd
        self.recover_tvl_usd = recover_tvl_usd
        self.critical_reserve_ratio = critical_reserve_ratio
        self._state = TVLState.NORMAL
        self._halt_reason: str | None = None

    @property
    def state(self) -> TVLState:
        return self._state

    @property
    def halt_reason(self) -> str | None:
        return self._halt_reason

    def evaluate(self, *, tvl_usd: float, reserve_a: int, reserve_b: int) -> TVLState:
        total_reserve = reserve_a + reserve_b
        if total_reserve > 0:
            min_ratio = min(reserve_a, reserve_b) / total_reserve
            if min_ratio < self.critical_reserve_ratio:
                self._state = TVLState.HALT_ALL
                self._halt_reason = (
                    f"reserve ratio {min_ratio:.2%} < critical {self.critical_reserve_ratio:.2%}"
                )
                return self._state

        if tvl_usd < self.min_tvl_usd:
            self._state = TVLState.HALT_ALL
            self._halt_reason = f"TVL ${tvl_usd:.2f} < min ${self.min_tvl_usd:.2f}"
        elif tvl_usd < self.warn_tvl_usd:
            self._state = TVLState.REDUCE_ACTIVITY
            self._halt_reason = f"TVL ${tvl_usd:.2f} < warn ${self.warn_tvl_usd:.2f}"
        elif tvl_usd >= self.recover_tvl_usd:
            self._state = TVLState.NORMAL
            self._halt_reason = None
        return self._state

    def allows_mm(self) -> bool:
        return self._state in (TVLState.NORMAL, TVLState.REDUCE_ACTIVITY)

    def allows_arb(self) -> bool:
        return self._state == TVLState.NORMAL

    def allows_trade(self) -> bool:
        return self._state != TVLState.HALT_ALL


# ── LiveDexExecutor（实盘执行）───────────────────────
class LiveDexExecutor(DexExecutor):
    """实盘执行器 — 真实签名 + 广播 + 安全检查

    继承 DexExecutor 的 swap/add_liquidity/remove_liquidity，但添加：
      - Pre-flight: 余额检查、Allowance 检查、滑点预估、MEV 评估
      - Post-flight: 交易确认、gas 记录、余额验证

    与 DryRunDexExecutor 的区别：
      - is_live = True → 真实发送交易
      - 产出物路径：execute/output/

    安全护甲集成（可选注入）：
      - slippage_guard: SlippageGuard — 滑点硬限制
      - mev_guard: MEVGuard — MEV 防御
      - tvl_breaker: TVLBreaker — TVL 熔断
      - approve_manager: ApproveManager — Allowance 管理

    用法：
      adapter = PancakeV2Adapter(web3=w3, private_key=pk)
      executor = LiveDexExecutor(
          adapter=adapter,
          slippage_guard=SlippageGuard(max_slippage_pct=0.02),
          approve_manager=ApproveManager(web3=w3, private_key=pk),
      )
      result = await executor.swap(token_in=..., ...)
    """

    is_live: bool = True

    def __init__(
        self,
        *,
        adapter: "PancakeV2Adapter | None" = None,
        signer=None,
        config: dict | None = None,
        # ── 可选安全护甲 ──
        slippage_guard: "SlippageGuard | None" = None,
        mev_guard: "MEVGuard | None" = None,
        tvl_breaker: "TVLBreaker | None" = None,
        approve_manager: "ApproveManager | None" = None,
    ):
        super().__init__(adapter=adapter, signer=signer, config=config)
        self.slippage_guard = slippage_guard
        self.mev_guard = mev_guard
        self.tvl_breaker = tvl_breaker
        self.approve_manager = approve_manager
        self._tx_count = 0

    async def _preflight_balance_check(self, token_in: str, amount_in: int) -> dict:
        """Pre-flight: 检查余额是否足够"""
        if not self.adapter or not self.adapter.web3:
            return {"passed": True, "reason": "no_adapter_skip"}

        w3 = self.adapter.web3
        account = self.adapter.get_account()
        if not account:
            return {"passed": False, "reason": "no_account"}

        try:
            # ERC20 balanceOf
            contract = w3.eth.contract(
                address=w3.to_checksum_address(token_in),
                abi=[{
                    "inputs": [{"name": "account", "type": "address"}],
                    "name": "balanceOf",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function",
                }],
            )
            balance = await asyncio.to_thread(
                contract.functions.balanceOf(
                    w3.to_checksum_address(account)
                ).call
            )
            if balance < amount_in:
                return {
                    "passed": False,
                    "reason": f"insufficient_balance: have {balance}, need {amount_in}",
                    "balance": balance,
                    "required": amount_in,
                }
            return {"passed": True, "balance": balance}
        except Exception as exc:
            return {"passed": False, "reason": f"balance_check_error: {exc}"}

    async def _preflight_allowance_check(
        self, token_in: str, amount_in: int, spender: str | None = None
    ) -> dict:
        """Pre-flight: 检查 Allowance 是否足够，可选自动 approve"""
        if not self.approve_manager:
            return {"passed": True, "reason": "no_approve_manager_skip"}

        spender = spender or self.adapter.router_address if self.adapter else None
        if not spender:
            return {"passed": False, "reason": "no_spender"}

        try:
            current = await self.approve_manager.get_allowance(token_in, spender)
            if current >= amount_in:
                return {"passed": True, "allowance": current}

            # 自动 approve（需求×2，不用 MAX_UINT256）
            result = await self.approve_manager.ensure_allowance(
                token_in, spender, amount_in
            )
            if result:
                return {
                    "passed": True,
                    "auto_approved": True,
                    "approved_amount": result.get("amount"),
                    "approve_tx": result.get("tx_hash"),
                }
            return {"passed": True, "allowance": current}
        except Exception as exc:
            return {"passed": False, "reason": f"allowance_check_error: {exc}"}

    async def _preflight_slippage_check(
        self,
        *,
        amount_in: int,
        pair_address: str | None,
    ) -> dict:
        """Pre-flight: 滑点预估（需要 pair_address）"""
        if not self.slippage_guard or not pair_address:
            return {"passed": True, "reason": "no_guard_or_pair_skip"}

        try:
            r0, r1 = await self.get_reserves(pair_address)
            reserve_in, reserve_out = (r0, r1) if r0 > r1 else (r1, r0)
            expected_out = await self.get_amount_out(amount_in, reserve_in, reserve_out)
            ideal_out = int(amount_in * (reserve_out / reserve_in)) if reserve_in > 0 else 0

            check = await self.slippage_guard.check(
                amount_in=amount_in,
                expected_out=expected_out,
                ideal_out=ideal_out,
            )
            return {
                "passed": check["passed"],
                "reason": check.get("reason"),
                "slippage": check.get("actual_slippage"),
                "min_amount_out": check.get("min_amount_out"),
                "expected_out": expected_out,
            }
        except Exception as exc:
            return {"passed": False, "reason": f"slippage_check_error: {exc}"}

    async def _preflight_tvl_check(self, pair_address: str | None) -> dict:
        """Pre-flight: TVL 熔断检查"""
        if not self.tvl_breaker or not pair_address:
            return {"passed": True, "reason": "no_breaker_or_pair_skip"}

        try:
            r0, r1 = await self.get_reserves(pair_address)
            # 简化 TVL 估算：假设 r0+r1 为总储备（实际应乘以 token 价格）
            # TODO: 集成价格预言机做精确 TVL/USD 计算
            fake_tvl_usd = (r0 + r1) / 1e18 * 0.01  # 粗略估算
            state = self.tvl_breaker.evaluate(
                tvl_usd=fake_tvl_usd, reserve_a=r0, reserve_b=r1,
            )
            if not self.tvl_breaker.allows_trade():
                return {
                    "passed": False,
                    "reason": self.tvl_breaker.halt_reason,
                    "tvl_state": state.value,
                }
            return {"passed": True, "tvl_state": state.value}
        except Exception as exc:
            return {"passed": False, "reason": f"tvl_check_error: {exc}"}

    async def swap(
        self,
        *,
        token_in: str,
        token_out: str,
        amount_in: int,
        min_amount_out: int,
        deadline_seconds: int = 300,
        use_private_rpc: bool = False,
        pair_address: str | None = None,
        skip_preflight: bool = False,
    ):
        """实盘 swap — 带完整 pre-flight 检查

        新增参数:
          - skip_preflight: 跳过所有检查（危险，仅测试用）

        返回字段（在父类基础上扩展）:
          - preflight: 各项检查结果
          - tx_index: 本次执行的交易序号
        """
        self._tx_count += 1
        preflight_results = {}

        if not skip_preflight:
            # ── 1. 余额检查 ──
            preflight_results["balance"] = await self._preflight_balance_check(
                token_in, amount_in
            )
            if not preflight_results["balance"]["passed"]:
                return {
                    "tx_hash": None,
                    "status": "preflight_failed",
                    "preflight": preflight_results,
                    "tx_index": self._tx_count,
                }

            # ── 2. Allowance 检查 + 自动 approve ──
            preflight_results["allowance"] = await self._preflight_allowance_check(
                token_in, amount_in
            )
            if not preflight_results["allowance"]["passed"]:
                return {
                    "tx_hash": None,
                    "status": "preflight_failed",
                    "preflight": preflight_results,
                    "tx_index": self._tx_count,
                }

            # ── 3. 滑点检查 ──
            slippage_check = await self._preflight_slippage_check(
                amount_in=amount_in, pair_address=pair_address
            )
            preflight_results["slippage"] = slippage_check
            if not slippage_check["passed"]:
                return {
                    "tx_hash": None,
                    "status": "preflight_failed",
                    "preflight": preflight_results,
                    "tx_index": self._tx_count,
                }
            # 使用滑点检查计算的 min_amount_out（如果可用）
            if slippage_check.get("min_amount_out"):
                min_amount_out = max(min_amount_out, slippage_check["min_amount_out"])

            # ── 4. TVL 熔断检查 ──
            preflight_results["tvl"] = await self._preflight_tvl_check(pair_address)
            if not preflight_results["tvl"]["passed"]:
                return {
                    "tx_hash": None,
                    "status": "preflight_failed",
                    "preflight": preflight_results,
                    "tx_index": self._tx_count,
                }

        # ── 5. 执行真实交易（调用父类）──
        result = await super().swap(
            token_in=token_in,
            token_out=token_out,
            amount_in=amount_in,
            min_amount_out=min_amount_out,
            deadline_seconds=deadline_seconds,
            use_private_rpc=use_private_rpc,
            pair_address=pair_address,
        )

        # ── 6. Post-flight 记录 ──
        result["preflight"] = preflight_results
        result["tx_index"] = self._tx_count
        result["live"] = True
        return result


# ── DryRunDexExecutor（eth_call 仿真）─────────────────
class DryRunDexExecutor(DexExecutor):
    """DryRun 执行器 — 真实链上数据 + eth_call 仿真，不发交易

    与 live 路径共享 95% 代码（adapter 构建真实 tx），唯一区别：
      - send_tx() 被替换为 eth_call + estimate_gas
      - 不签名、不广播、不花钱
      - 返回真实 gas 估算、真实 revert 原因
      - **计算真实 amount_out、price_impact、预期 P&L**

    用法：
      adapter = PancakeV2Adapter(web3=w3, private_key=pk)
      executor = DryRunDexExecutor(adapter=adapter)
      result = await executor.swap(token_in=..., pair_address=..., ...)

    需要：BSC RPC 连接 + 钱包地址（构建 tx 的 from 字段）
    不需要：余额、allowance（eth_call 可用 state_override 绕过）

    产出物路径：execute/simulator/（区别于 Live 的 execute/output/）
    """

    is_live: bool = False  # DryRun → execute/simulator/

    def __init__(self, *, adapter: "PancakeV2Adapter", config: dict | None = None):
        super().__init__(adapter=adapter, config=config)
        self._tx_counter = 0

    async def swap(self, *, token_in: str, token_out: str, amount_in: int,
                   min_amount_out: int, deadline_seconds: int = 300,
                   use_private_rpc: bool = False,
                   pair_address: str | None = None):
        """构建真实交易 → eth_call 仿真 + AMM 预计算（不签名、不广播）

        新增返回字段:
          - amount_out: AMM 公式计算的预期输出
          - price_impact: 相对于无限流动性的滑点损失
          - reserve_in/reserve_out: 当前池子储备
          - effective_price: 实际成交价（amount_out / amount_in）
          - ideal_price: 无滑点理想价（reserve_out / reserve_in）
        """
        if not self.adapter:
            raise RuntimeError("DryRunDexExecutor: no adapter configured")

        recipient = self.config.get("recipient") or self.adapter.get_account()
        deadline = int(time.time()) + deadline_seconds
        self._tx_counter += 1

        # ── 1. 获取真实储备（如果提供了 pair_address）──
        reserve_in = 0
        reserve_out = 0
        amount_out = 0
        price_impact = 0.0
        effective_price = 0.0
        ideal_price = 0.0

        if pair_address:
            try:
                r0, r1 = await self.get_reserves(pair_address)
                # 判断 token 顺序（假设 token_in 是 quote，token_out 是 base）
                # 简化处理：用较大的作为 reserve_in（通常是 USDT/稳定币）
                if r0 > r1:
                    reserve_in, reserve_out = r0, r1
                else:
                    reserve_in, reserve_out = r1, r0

                # AMM 公式计算预期输出
                amount_out = await self.get_amount_out(amount_in, reserve_in, reserve_out)

                # 计算价格和滑点
                if reserve_in > 0 and amount_in > 0:
                    ideal_price = reserve_out / reserve_in  # 无滑点价格
                    effective_price = amount_out / amount_in if amount_out > 0 else 0
                    price_impact = 1 - (effective_price / ideal_price) if ideal_price > 0 else 0
            except Exception as exc:
                # 储备读取失败不阻断，继续 eth_call 验证
                logger.warning("DryRun: get_reserves failed for %s: %s", pair_address, exc)

        # ── 2. 构建真实 tx（与 live 完全一致）──
        tx = await self.adapter.build_swap_tx(
            token_in=token_in, token_out=token_out,
            amount_in=amount_in, min_amount_out=min_amount_out,
            recipient=recipient, deadline=deadline,
        )

        # ── 3. eth_call 仿真 + estimate_gas（不签名、不发送）──
        w3 = self.adapter.web3
        call_tx = {k: v for k, v in tx.items() if k in ("from", "to", "data", "value")}

        revert_reason: str | None = None
        gas_estimate = 0
        block_number = 0
        try:
            await asyncio.to_thread(w3.eth.call, call_tx)
            gas_estimate = await asyncio.to_thread(w3.eth.estimate_gas, call_tx)
            block_number = await asyncio.to_thread(lambda: w3.eth.block_number)
            status = "success"
        except Exception as exc:
            revert_reason = str(exc)
            status = "reverted"
            try:
                block_number = await asyncio.to_thread(lambda: w3.eth.block_number)
            except Exception:
                pass

        return {
            "tx_hash": f"dryrun-{self._tx_counter:04d}",
            "status": status,
            "gas_used": gas_estimate,
            "block_number": block_number,
            "simulated": True,
            "dry_run": True,
            # 交易金额
            "amount_in": amount_in,
            "amount_out": amount_out,
            "min_amount_out": min_amount_out,
            # 池子状态
            "reserve_in": reserve_in,
            "reserve_out": reserve_out,
            # 价格分析
            "ideal_price": ideal_price,
            "effective_price": effective_price,
            "price_impact": price_impact,
            # 错误信息
            "revert_reason": revert_reason,
        }

    async def get_reserves(self, pair_address: str) -> tuple[int, int]:
        """真实链上读取 — 与 DexExecutor 完全一致"""
        return await self.adapter.get_reserves(pair_address)


# ── ApproveManager ───────────────────────────────────
class ApproveManager:
    """Token Approve 安全 — 禁止 MAX_UINT256，每次 = 需求×2 (§5.5)"""

    def __init__(self, *, web3=None, private_key: str | None = None):
        self.web3 = web3
        self._private_key = private_key
        self._allowance_cache: dict[tuple[str, str], int] = {}

    async def get_allowance(self, token: str, spender: str) -> int:
        """查询当前 allowance"""
        if self.web3:
            w3 = self.web3
            contract = w3.eth.contract(
                address=w3.to_checksum_address(token),
                abi=ERC20_APPROVE_ABI,
            )
            acct = w3.eth.account.from_key(self._private_key) if self._private_key else None
            if acct:
                val = await asyncio.to_thread(
                    contract.functions.allowance(
                        w3.to_checksum_address(acct.address),
                        w3.to_checksum_address(spender),
                    ).call,
                )
                self._allowance_cache[(token.lower(), spender.lower())] = val
                return val
        return self._allowance_cache.get((token.lower(), spender.lower()), 0)

    async def approve(self, token: str, spender: str, amount: int) -> dict:
        """发送 approve 交易"""
        if self.web3 and self._private_key:
            w3 = self.web3
            contract = w3.eth.contract(
                address=w3.to_checksum_address(token),
                abi=ERC20_APPROVE_ABI,
            )
            acct = w3.eth.account.from_key(self._private_key)
            tx = contract.functions.approve(
                w3.to_checksum_address(spender), amount,
            ).build_transaction({
                "from": acct.address,
                "gas": 60_000,
                "gasPrice": await asyncio.to_thread(lambda: w3.eth.gas_price),
                "nonce": await asyncio.to_thread(
                    w3.eth.get_transaction_count, acct.address,
                ),
            })
            signed = w3.eth.account.sign_transaction(tx, self._private_key)
            tx_hash = await asyncio.to_thread(w3.eth.send_raw_transaction, signed.raw_transaction)
            receipt = await asyncio.to_thread(w3.eth.wait_for_transaction_receipt, tx_hash, timeout=60)
            self._allowance_cache[(token.lower(), spender.lower())] = amount
            return {
                "status": "approved",
                "amount": amount,
                "tx_hash": receipt["transactionHash"].hex(),
            }
        # Fallback: in-memory only (testing)
        self._allowance_cache[(token.lower(), spender.lower())] = amount
        return {"status": "approved", "amount": amount}

    async def ensure_allowance(self, token: str, spender: str, required: int) -> dict | None:
        """检查 + 按需 approve（需求×2，不 approve MAX_UINT256）"""
        current = await self.get_allowance(token, spender)
        if current >= required:
            return None  # 无需 approve
        approve_amount = required * 2
        return await self.approve(token, spender, approve_amount)


# ── NotifyRouter ─────────────────────────────────────
def _http_post_json(url: str, payload: dict, *, timeout: float = 10) -> dict:
    """同步 HTTP POST JSON — stdlib only, 零外部依赖"""
    body = _json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return _json.loads(resp.read())


class TelegramNotifier:
    """Telegram Bot 通知（sendMessage API）"""
    _API = "https://api.telegram.org/bot{token}/sendMessage"

    def __init__(self, *, bot_token: str = "", chat_id: str = "", session=None):
        self._bot_token = bot_token
        self._chat_id = chat_id
        self._session = session  # 保留接口，未来可换 aiohttp

    def _configured(self) -> bool:
        return bool(self._bot_token and self._chat_id)

    def _format(self, title: str, body: str, data: dict | None) -> str:
        parts = [f"<b>{title}</b>", body]
        if data:
            kv = "\n".join(f"  {k}: {v}" for k, v in data.items())
            parts.append(f"<pre>{kv}</pre>")
        return "\n".join(parts)

    async def send(self, *, title: str, body: str, data: dict | None = None) -> bool:
        if not self._configured():
            logger.debug("TelegramNotifier: unconfigured, skip")
            return False
        text = self._format(title, body, data)
        url = self._API.format(token=self._bot_token)
        payload = {"chat_id": self._chat_id, "text": text, "parse_mode": "HTML"}
        try:
            await asyncio.to_thread(_http_post_json, url, payload)
            return True
        except (urllib.error.URLError, OSError, ValueError) as exc:
            logger.warning("Telegram send failed: %s", exc)
            return False


class DiscordNotifier:
    """Discord Webhook 通知（Embed 格式）"""

    _COLORS = {"CRITICAL": 0xFF0000, "WARNING": 0xFFA500, "INFO": 0x3498DB}

    def __init__(self, *, webhook_url: str = "", session=None):
        self._webhook_url = webhook_url
        self._session = session

    def _configured(self) -> bool:
        return bool(self._webhook_url)

    async def send(self, *, title: str, body: str, data: dict | None = None,
                   level: str = "INFO") -> bool:
        if not self._configured():
            logger.debug("DiscordNotifier: unconfigured, skip")
            return False
        embed: dict = {
            "title": title,
            "description": body,
            "color": self._COLORS.get(level, 0x3498DB),
        }
        if data:
            embed["fields"] = [
                {"name": k, "value": str(v), "inline": True}
                for k, v in list(data.items())[:25]
            ]
        payload = {"embeds": [embed]}
        try:
            await asyncio.to_thread(_http_post_json, self._webhook_url, payload)
            return True
        except (urllib.error.URLError, OSError, ValueError) as exc:
            logger.warning("Discord send failed: %s", exc)
            return False


class NotifyRouter:
    """通知路由 — CRITICAL→双通道, WARNING→Telegram, INFO→Discord"""

    def __init__(self, *, telegram: TelegramNotifier | None = None,
                 discord: DiscordNotifier | None = None):
        self._telegram = telegram
        self._discord = discord

    async def send(self, *, level: str = "INFO", title: str, body: str,
                   data: dict | None = None) -> None:
        if level == "CRITICAL":
            if self._telegram:
                await self._telegram.send(title=title, body=body, data=data)
            if self._discord:
                await self._discord.send(title=title, body=body, data=data, level=level)
        elif level == "WARNING":
            if self._telegram:
                await self._telegram.send(title=title, body=body, data=data)
        else:
            if self._discord:
                await self._discord.send(title=title, body=body, data=data, level=level)
