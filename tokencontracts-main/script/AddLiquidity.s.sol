// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AddLiquidity
 * @notice Add pGVT-USDT and sGVT-USDT liquidity on PancakeSwap V2 (BNB Chain)
 *
 * @dev Prerequisites:
 *   - Your wallet holds pGVT, sGVT, and enough USDT (BSC)
 *   - Tokens already deployed (run AirdropMint first)
 *
 * Usage:
 *   forge script script/AddLiquidity.s.sol:AddLiquidity \
 *     --rpc-url https://bsc-dataseed.binance.org \
 *     --broadcast --private-key <PRIVATE_KEY>
 *
 * Required .env:
 *   PRIVATE_KEY=0x...
 *   PGVT_ADDRESS=0x...      (deployed pGVT contract)
 *   SGVT_ADDRESS=0x...      (deployed sGVT contract)
 *
 * Optional .env (LP amounts — defaults to standard plan if not set):
 *   PGVT_LP_AMOUNT=100000   (pGVT tokens to add, whole units)
 *   PGVT_USDT_AMOUNT=500    (USDT to pair with pGVT)
 *   SGVT_LP_AMOUNT=10000    (sGVT tokens to add, whole units)
 *   SGVT_USDT_AMOUNT=5000   (USDT to pair with sGVT)
 *
 * Presets:
 *   Standard ($200):   20,000 pGVT + 100 USDT  |  200 sGVT + 100 USDT
 *
 * Pricing (ratio determines price, not absolute amount):
 *   pGVT = PGVT_USDT / PGVT_LP  (default 0.005 USDT)
 *   sGVT = SGVT_USDT / SGVT_LP  (default 0.5   USDT)
 */

interface IPancakeRouter02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function factory() external view returns (address);
}

interface IPancakeFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

contract AddLiquidity is Script {
    // ============ BNB Chain Addresses ============
    address constant PANCAKE_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address constant BSC_USDT       = 0x55d398326f99059fF775485246999027B3197955;

    // ============ Default LP Amounts (overridable via .env) ============
    uint256 constant DEFAULT_PGVT_LP     = 20_000;   // pGVT tokens (whole units)
    uint256 constant DEFAULT_PGVT_USDT   = 100;      // USDT (whole units)
    uint256 constant DEFAULT_SGVT_LP     = 200;      // sGVT tokens (whole units)
    uint256 constant DEFAULT_SGVT_USDT   = 100;      // USDT (whole units)

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address wallet = vm.addr(deployerKey);
        address pgvt = vm.envAddress("PGVT_ADDRESS");
        address sgvt = vm.envAddress("SGVT_ADDRESS");

        // Read LP amounts from .env (fallback to defaults)
        uint256 pgvtLpAmount   = vm.envOr("PGVT_LP_AMOUNT",   DEFAULT_PGVT_LP)   * 10 ** 18;
        uint256 pgvtUsdtAmount = vm.envOr("PGVT_USDT_AMOUNT", DEFAULT_PGVT_USDT) * 10 ** 18;
        uint256 sgvtLpAmount   = vm.envOr("SGVT_LP_AMOUNT",   DEFAULT_SGVT_LP)   * 10 ** 18;
        uint256 sgvtUsdtAmount = vm.envOr("SGVT_USDT_AMOUNT", DEFAULT_SGVT_USDT) * 10 ** 18;
        uint256 totalUsdtNeeded = pgvtUsdtAmount + sgvtUsdtAmount;

        console.log("========== AddLiquidity (PancakeSwap V2) ==========");
        console.log("Wallet :", wallet);
        console.log("pGVT   :", pgvt);
        console.log("sGVT   :", sgvt);
        console.log("USDT   :", BSC_USDT);
        console.log("Router :", PANCAKE_ROUTER);
        console.log("---------------------------------------------------");
        console.log("pGVT LP: %s pGVT + %s USDT", pgvtLpAmount / 1e18, pgvtUsdtAmount / 1e18);
        console.log("sGVT LP: %s sGVT + %s USDT", sgvtLpAmount / 1e18, sgvtUsdtAmount / 1e18);
        console.log("Total USDT needed:", totalUsdtNeeded / 1e18);
        console.log("===================================================\n");

        // Check balances
        uint256 usdtBal = IERC20(BSC_USDT).balanceOf(wallet);
        uint256 pgvtBal = IERC20(pgvt).balanceOf(wallet);
        uint256 sgvtBal = IERC20(sgvt).balanceOf(wallet);

        console.log("Wallet USDT  balance:", usdtBal / 1e18);
        console.log("Wallet pGVT  balance:", pgvtBal / 1e18);
        console.log("Wallet sGVT  balance:", sgvtBal / 1e18);

        require(usdtBal >= totalUsdtNeeded, "Insufficient USDT");
        require(pgvtBal >= pgvtLpAmount,    "Insufficient pGVT");
        require(sgvtBal >= sgvtLpAmount,    "Insufficient sGVT");

        vm.startBroadcast(deployerKey);

        uint256 deadline = block.timestamp + 300; // 5 min

        // ---- 1. Approve Router ----
        IERC20(pgvt).approve(PANCAKE_ROUTER, pgvtLpAmount);
        IERC20(sgvt).approve(PANCAKE_ROUTER, sgvtLpAmount);
        IERC20(BSC_USDT).approve(PANCAKE_ROUTER, totalUsdtNeeded);
        console.log("\nApprovals done");

        // ---- 2. Add pGVT-USDT Liquidity ----
        //    price = pgvtUsdtAmount / pgvtLpAmount (default 0.005 USDT/pGVT)
        (uint256 amtA1, uint256 amtB1, uint256 lp1) = IPancakeRouter02(PANCAKE_ROUTER).addLiquidity(
            pgvt,
            BSC_USDT,
            pgvtLpAmount,
            pgvtUsdtAmount,
            pgvtLpAmount * 95 / 100,    // 5% slippage
            pgvtUsdtAmount * 95 / 100,
            wallet,
            deadline
        );
        console.log("\npGVT-USDT LP added:");
        console.log("  pGVT used:", amtA1 / 1e18);
        console.log("  USDT used:", amtB1 / 1e18);
        console.log("  LP tokens:", lp1);

        // ---- 3. Add sGVT-USDT Liquidity ----
        //    price = sgvtUsdtAmount / sgvtLpAmount (default 0.5 USDT/sGVT)
        (uint256 amtA2, uint256 amtB2, uint256 lp2) = IPancakeRouter02(PANCAKE_ROUTER).addLiquidity(
            sgvt,
            BSC_USDT,
            sgvtLpAmount,
            sgvtUsdtAmount,
            sgvtLpAmount * 95 / 100,
            sgvtUsdtAmount * 95 / 100,
            wallet,
            deadline
        );
        console.log("\nsGVT-USDT LP added:");
        console.log("  sGVT used:", amtA2 / 1e18);
        console.log("  USDT used:", amtB2 / 1e18);
        console.log("  LP tokens:", lp2);

        vm.stopBroadcast();

        // ---- Summary ----
        console.log("\n========== Summary ==========");
        console.log("pGVT price: 0.005 USDT");
        console.log("sGVT price: 0.5   USDT");
        console.log("Remaining pGVT:", (pgvtBal - amtA1) / 1e18);
        console.log("Remaining sGVT:", (sgvtBal - amtA2) / 1e18);
        console.log("Remaining USDT:", (usdtBal - amtB1 - amtB2) / 1e18);
        console.log("=============================");
    }
}
