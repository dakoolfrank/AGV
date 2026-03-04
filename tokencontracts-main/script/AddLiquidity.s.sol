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
 * Pricing:
 *   pGVT = 0.005 USDT  →  100,000 pGVT : 500 USDT
 *   sGVT = 0.5   USDT  →  10,000  sGVT : 5,000 USDT
 *   Total USDT needed: 5,500 USDT
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

    // ============ LP Amounts (adjust as needed) ============
    // pGVT @ $0.005:  100,000 pGVT + 500 USDT
    uint256 constant PGVT_LP_AMOUNT = 100_000 * 10 ** 18;
    uint256 constant PGVT_USDT_AMOUNT = 500 * 10 ** 18;     // BSC USDT = 18 decimals

    // sGVT @ $0.5:  10,000 sGVT + 5,000 USDT
    uint256 constant SGVT_LP_AMOUNT = 10_000 * 10 ** 18;
    uint256 constant SGVT_USDT_AMOUNT = 5_000 * 10 ** 18;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address wallet = vm.addr(deployerKey);
        address pgvt = vm.envAddress("PGVT_ADDRESS");
        address sgvt = vm.envAddress("SGVT_ADDRESS");

        console.log("========== AddLiquidity (PancakeSwap V2) ==========");
        console.log("Wallet :", wallet);
        console.log("pGVT   :", pgvt);
        console.log("sGVT   :", sgvt);
        console.log("USDT   :", BSC_USDT);
        console.log("Router :", PANCAKE_ROUTER);
        console.log("===================================================\n");

        // Check balances
        uint256 usdtBal = IERC20(BSC_USDT).balanceOf(wallet);
        uint256 pgvtBal = IERC20(pgvt).balanceOf(wallet);
        uint256 sgvtBal = IERC20(sgvt).balanceOf(wallet);
        uint256 totalUsdtNeeded = PGVT_USDT_AMOUNT + SGVT_USDT_AMOUNT;

        console.log("Wallet USDT  balance:", usdtBal / 1e18);
        console.log("Wallet pGVT  balance:", pgvtBal / 1e18);
        console.log("Wallet sGVT  balance:", sgvtBal / 1e18);
        console.log("Total  USDT  needed :", totalUsdtNeeded / 1e18);

        require(usdtBal >= totalUsdtNeeded, "Insufficient USDT");
        require(pgvtBal >= PGVT_LP_AMOUNT,  "Insufficient pGVT");
        require(sgvtBal >= SGVT_LP_AMOUNT,  "Insufficient sGVT");

        vm.startBroadcast(deployerKey);

        uint256 deadline = block.timestamp + 300; // 5 min

        // ---- 1. Approve Router ----
        IERC20(pgvt).approve(PANCAKE_ROUTER, PGVT_LP_AMOUNT);
        IERC20(sgvt).approve(PANCAKE_ROUTER, SGVT_LP_AMOUNT);
        IERC20(BSC_USDT).approve(PANCAKE_ROUTER, totalUsdtNeeded);
        console.log("\nApprovals done");

        // ---- 2. Add pGVT-USDT Liquidity ----
        //    100,000 pGVT + 500 USDT → price = 500/100000 = 0.005 USDT/pGVT
        (uint256 amtA1, uint256 amtB1, uint256 lp1) = IPancakeRouter02(PANCAKE_ROUTER).addLiquidity(
            pgvt,
            BSC_USDT,
            PGVT_LP_AMOUNT,
            PGVT_USDT_AMOUNT,
            PGVT_LP_AMOUNT * 95 / 100,    // 5% slippage
            PGVT_USDT_AMOUNT * 95 / 100,
            wallet,                         // LP tokens go to wallet
            deadline
        );
        console.log("\npGVT-USDT LP added:");
        console.log("  pGVT used:", amtA1 / 1e18);
        console.log("  USDT used:", amtB1 / 1e18);
        console.log("  LP tokens:", lp1);

        // ---- 3. Add sGVT-USDT Liquidity ----
        //    10,000 sGVT + 5,000 USDT → price = 5000/10000 = 0.5 USDT/sGVT
        (uint256 amtA2, uint256 amtB2, uint256 lp2) = IPancakeRouter02(PANCAKE_ROUTER).addLiquidity(
            sgvt,
            BSC_USDT,
            SGVT_LP_AMOUNT,
            SGVT_USDT_AMOUNT,
            SGVT_LP_AMOUNT * 95 / 100,
            SGVT_USDT_AMOUNT * 95 / 100,
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
