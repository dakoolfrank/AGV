"""
MM-Campaign Tool Loop — 心跳模式 + 共享执行层

=== 共享执行层（DexExecutor L2）===
MM-Campaign 和 Arb-Campaign 共用的链上执行设施：
  - DexExecutor:        统一 DEX 接口（swap/addLiquidity/removeLiquidity）
  - PancakeV2Adapter:   PancakeSwap V2 适配器（BSC Mainnet）
  - SlippageGuard:      Layer 1 — 滑点硬顶 2%
  - MEVGuard:           Layer 2 — mempool 扫描 + 冷却延迟
  - TVLBreaker:         Layer 3 — TVL 熔断三态机
  - ApproveManager:     Token approve 安全（禁止 MAX_UINT256）
  - NotifyRouter:       通知路由（CRITICAL→双通道）

=== MM-Campaign 心跳模式 (§2.3) ===
确定性管线，零 LLM 依赖：
  HEARTBEAT → READ → DETECT → DECIDE → EXECUTE/NOOP → LOG

状态机（§2.5）:
  IDLE → HEARTBEAT → [DETECT] → NOOP / REBALANCE / EMERGENCY
                                │         │           │
                                │         │           └→ WITHDRAW_LP → COOLDOWN → IDLE
                                │         └→ EXECUTE_SWAP → LOG → IDLE
                                └→ LOG → IDLE
"""
from __future__ import annotations

import asyncio
import json as _json
import logging
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
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

    def __init__(self, *, adapter: "PancakeV2Adapter | None" = None,
                 signer=None, config: dict | None = None):
        self.adapter = adapter
        self.signer = signer
        self.config = config or {}

    async def swap(self, *, token_in: str, token_out: str, amount_in: int,
                   min_amount_out: int, deadline_seconds: int = 300,
                   use_private_rpc: bool = False):
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
        """读取 LP 对的 reserve0, reserve1"""
        if not self.web3:
            raise RuntimeError("PancakeV2Adapter: web3 not initialized")
        w3 = self.web3
        pair = w3.eth.contract(
            address=w3.to_checksum_address(pair_address),
            abi=PANCAKE_V2_PAIR_ABI,
        )
        reserves = await asyncio.to_thread(pair.functions.getReserves().call)
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

    async def scan_mempool(self, *, pending_txs: list[dict], our_pool: str) -> dict:
        raise NotImplementedError("Phase 1: mempool scanning")

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


# ── SimDexExecutor（模拟模式）────────────────────────
class SimDexExecutor(DexExecutor):
    """模拟执行器 — 纯 AMM 数学，零链上交互

    用于 --simulate 模式：
      - swap() 用恒积公式计算预期输出（不发交易）
      - get_reserves() 返回可配置的虚拟池深度
      - 产出与真实执行器格式一致（tx_hash=sim-*）
    """

    def __init__(self, *, config: dict | None = None,
                 reserves: dict[str, tuple[int, int]] | None = None):
        super().__init__(config=config)
        # pool_address → (reserve_in, reserve_out)
        self._sim_reserves = reserves or {}
        self._default_reserves = (100_000 * 10**18, 500 * 10**18)
        self._tx_counter = 0

    async def swap(self, *, token_in: str, token_out: str, amount_in: int,
                   min_amount_out: int, deadline_seconds: int = 300,
                   use_private_rpc: bool = False):
        """模拟 swap — 恒积公式计算，不发链上交易"""
        # 找到对应池子的 reserves
        r_in, r_out = self._default_reserves
        for _addr, (ri, ro) in self._sim_reserves.items():
            r_in, r_out = ri, ro
            break  # 单池简化

        amount_out = await self.get_amount_out(amount_in, r_in, r_out)
        self._tx_counter += 1

        if amount_out < min_amount_out:
            return {
                "tx_hash": f"sim-reverted-{self._tx_counter:04d}",
                "status": "reverted",
                "gas_used": 0,
                "block_number": 0,
                "simulated": True,
                "amount_out": amount_out,
                "min_amount_out": min_amount_out,
            }

        return {
            "tx_hash": f"sim-{self._tx_counter:04d}",
            "status": "success",
            "gas_used": 150_000,
            "block_number": 99_999_999,
            "simulated": True,
            "amount_in": amount_in,
            "amount_out": amount_out,
            "price_impact": 1 - (amount_out * r_in / (amount_in * r_out)) if r_out > 0 and amount_in > 0 else 0,
        }

    async def get_reserves(self, pair_address: str) -> tuple[int, int]:
        """返回虚拟池深度（可配置）"""
        return self._sim_reserves.get(pair_address, self._default_reserves)


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


# ── 状态机（§2.5）──────────────────────────────────
class MMState(str, Enum):
    IDLE = "IDLE"
    HEARTBEAT = "HEARTBEAT"
    NOOP = "NOOP"
    REBALANCE = "REBALANCE"
    EMERGENCY = "EMERGENCY"
    COOLDOWN = "COOLDOWN"


@dataclass
class PoolSnapshot:
    """链上池状态快照 — READ 阶段产出"""
    pair_address: str
    reserve_a: int = 0
    reserve_b: int = 0
    price: float = 0.0
    tvl_usd: float = 0.0
    target_price: float | None = None
    timestamp: float = field(default_factory=time.time)

    @property
    def reserve_ratio(self) -> float:
        """两侧偏离比率 (0=完美平衡, 正=A侧偏多)"""
        total = self.reserve_a + self.reserve_b
        if total == 0:
            return 0.0
        return (self.reserve_a - self.reserve_b) / total

    @property
    def price_deviation(self) -> float:
        """价格偏移率（相对目标价格）"""
        if not self.target_price or self.target_price == 0:
            return 0.0
        return (self.price - self.target_price) / self.target_price


@dataclass
class HeartbeatDecision:
    """DECIDE 阶段产出 — 确定性决策"""
    action: str = "noop"           # noop / rebalance / emergency_withdraw
    reason_code: str = "heartbeat_noop"
    params: dict = field(default_factory=dict)


# ── MempoolMonitor（§2.4 MEV 检测）─────────────────
class MempoolMonitor:
    """Mempool 监控 — 识别三明治 / JIT / 鲸鱼砸盘"""

    def __init__(self, *, alert_threshold: float = 0.05):
        self.alert_threshold = alert_threshold
        self._patterns: list[dict] = []

    async def scan_pending(self, *, pool_address: str, web3=None) -> list[dict]:
        """扫描 pending 交易（链上读取 — stub）"""
        return []  # Phase 1: 需要 BSC 节点 WebSocket

    def detect_sandwich(self, pending_txs: list[dict], our_pool: str) -> dict | None:
        """识别三明治攻击模式 — front-run + back-run 组合"""
        # Phase 1 stub: 真实实现需要解码 pending tx calldata
        return None


# ── MMHeartbeatLoop（§2.2 + §2.3）───────────────────
class MMHeartbeatLoop:
    """MM-Campaign 心跳主循环 — 确定性管线，零 LLM"""

    def __init__(
        self,
        *,
        executor: DexExecutor | None = None,
        rules: Any = None,
        tvl_breaker: TVLBreaker | None = None,
        slippage_guard: SlippageGuard | None = None,
        mev_guard: MEVGuard | None = None,
        budget: Any = None,
        preauth: Any = None,
        notify: NotifyRouter | None = None,
        pools: list[str] | None = None,
        config: dict | None = None,
    ):
        self._executor = executor
        self._rules = rules
        self._tvl_breaker = tvl_breaker
        self._slippage_guard = slippage_guard
        self._mev_guard = mev_guard
        self._budget = budget
        self._preauth = preauth
        self._notify = notify
        self._pools = pools or []
        self.config = config or {}
        # 频率参数（从 rules 读取或使用默认值）
        self._normal_interval = getattr(rules, "heartbeat_normal_interval", 30)
        self._degraded_interval = getattr(rules, "heartbeat_degraded_interval", 300)
        self._emergency_interval = getattr(rules, "heartbeat_emergency_interval", 5)
        self._max_noop = getattr(rules, "heartbeat_max_noop", 120)
        # 运行状态
        self._running = False
        self._state = MMState.IDLE
        self._cycle_count = 0
        self._noop_count = 0
        self._cooldown_until: float = 0.0

    @property
    def state(self) -> MMState:
        return self._state

    @property
    def current_interval(self) -> float:
        """当前心跳间隔（三档：normal / degraded / emergency）"""
        if self._state == MMState.EMERGENCY:
            return self._emergency_interval
        if self._noop_count >= self._max_noop:
            return self._degraded_interval
        return self._normal_interval

    # ── READ ─────────────────────────────────────────
    async def read_pool_state(self, pair_address: str) -> PoolSnapshot:
        """READ — 读取链上池状态（可 mock 用于测试）"""
        if self._executor:
            try:
                r_a, r_b = await self._executor.get_reserves(pair_address)
                price = r_b / r_a if r_a > 0 else 0.0
                tvl = 0.0  # Phase 1: 需要 token 价格来计算 USD TVL
                return PoolSnapshot(
                    pair_address=pair_address,
                    reserve_a=r_a, reserve_b=r_b,
                    price=price, tvl_usd=tvl,
                )
            except NotImplementedError:
                pass
        return PoolSnapshot(pair_address=pair_address)

    # ── DETECT ───────────────────────────────────────
    def detect_anomaly(self, snapshot: PoolSnapshot) -> dict:
        """DETECT — 纯确定性异常检测（零 LLM）"""
        result = {"price_class": "normal", "whale_class": "normal", "tvl_state": "NORMAL"}

        # 价格偏移分级
        if self._rules:
            result["price_class"] = self._rules.classify_price_deviation(snapshot.price_deviation)

        # TVL 熔断检查
        if self._tvl_breaker:
            tvl_state = self._tvl_breaker.evaluate(
                tvl_usd=snapshot.tvl_usd,
                reserve_a=snapshot.reserve_a,
                reserve_b=snapshot.reserve_b,
            )
            result["tvl_state"] = tvl_state.value

        return result

    # ── DECIDE ───────────────────────────────────────
    def decide(self, snapshot: PoolSnapshot, anomaly: dict) -> HeartbeatDecision:
        """DECIDE — 纯确定性规则（零 LLM，§2.3）"""
        tvl_state = anomaly.get("tvl_state", "NORMAL")
        price_class = anomaly.get("price_class", "normal")
        whale_class = anomaly.get("whale_class", "normal")

        # TVL 熔断 → 紧急撤流动性
        if tvl_state == "HALT_ALL":
            return HeartbeatDecision(
                action="emergency_withdraw",
                reason_code="tvl_circuit_break",
                params={"pair": snapshot.pair_address},
            )

        # 紧急（价格或鲸鱼）
        if price_class == "emergency" or whale_class == "emergency":
            return HeartbeatDecision(
                action="emergency_withdraw",
                reason_code="emergency_withdraw",
                params={"trigger": price_class if price_class == "emergency" else whale_class},
            )

        # 再平衡
        if price_class == "rebalance":
            return HeartbeatDecision(
                action="rebalance",
                reason_code="rebalance_executed",
                params={"deviation": snapshot.price_deviation},
            )

        # 预算检查
        if self._budget:
            ok, reason = self._budget.can_trade()
            if not ok:
                return HeartbeatDecision(action="noop", reason_code=reason or "budget_blocked")

        return HeartbeatDecision(action="noop", reason_code="heartbeat_noop")

    # ── EXECUTE ──────────────────────────────────────
    async def execute_action(
        self, decision: HeartbeatDecision, snapshot: PoolSnapshot,
    ) -> dict:
        """EXECUTE — 执行决策或 NOOP"""
        if decision.action == "noop":
            return {"executed": False, "reason_code": decision.reason_code}

        if decision.action == "emergency_withdraw":
            self._state = MMState.EMERGENCY
            # Phase 1 stub: await self._executor.remove_liquidity(...)
            if self._notify:
                await self._notify.send(
                    level="CRITICAL",
                    title="紧急撤流动性",
                    body=f"Pool {snapshot.pair_address[:10]}... reason={decision.reason_code}",
                )
            self._cooldown_until = time.monotonic() + 1800  # 30min 冷静期
            return {"executed": True, "action": "emergency_withdraw", "reason_code": decision.reason_code}

        if decision.action == "rebalance":
            self._state = MMState.REBALANCE
            # Phase 1 stub: await self._executor.swap(...)
            if self._budget:
                self._budget.record_trade(gas_usd=0.01, volume_usd=0.0)
            return {"executed": True, "action": "rebalance", "reason_code": decision.reason_code}

        return {"executed": False, "reason_code": "unknown_action"}

    # ── run_once ─────────────────────────────────────
    async def run_once(self) -> list[dict]:
        """单次心跳：遍历所有池 — READ → DETECT → DECIDE → EXECUTE → LOG"""
        self._cycle_count += 1
        self._state = MMState.HEARTBEAT
        results = []

        # 冷静期检查
        if time.monotonic() < self._cooldown_until:
            self._state = MMState.COOLDOWN
            results.append({"action": "noop", "reason_code": "cooldown_active"})
            return results

        for pool in self._pools:
            # READ
            snapshot = await self.read_pool_state(pool)
            # DETECT
            anomaly = self.detect_anomaly(snapshot)
            # DECIDE
            decision = self.decide(snapshot, anomaly)
            # EXECUTE
            exec_result = await self.execute_action(decision, snapshot)
            # LOG
            exec_result["pool"] = pool
            exec_result["cycle"] = self._cycle_count
            results.append(exec_result)

        # 更新 noop 计数
        has_action = any(r.get("executed") for r in results)
        if has_action:
            self._noop_count = 0
        else:
            self._noop_count += 1

        if self._state not in (MMState.EMERGENCY, MMState.COOLDOWN):
            self._state = MMState.IDLE

        return results

    # ── run_forever ──────────────────────────────────
    async def run_forever(self):
        """持续心跳 — 三档频率（normal / degraded / emergency）"""
        self._running = True
        try:
            while self._running:
                await self.run_once()
                await asyncio.sleep(self.current_interval)
        finally:
            self._running = False
            self._state = MMState.IDLE

    def stop(self):
        """优雅停止"""
        self._running = False
