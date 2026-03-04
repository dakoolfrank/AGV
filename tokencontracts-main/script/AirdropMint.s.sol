// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/tokens/pGVT.sol";
import "../contracts/tokens/ShadowGVT.sol";

/**
 * @title AirdropMint
 * @notice One-step: deploy pGVT + sGVT on BNB Chain, airdrop 1M each to target wallet
 *
 * @dev Usage (BNB Chain):
 *   forge script script/AirdropMint.s.sol:AirdropMint \
 *     --rpc-url https://bsc-dataseed.binance.org \
 *     --broadcast --private-key <PRIVATE_KEY> \
 *     -s "run(address)" <YOUR_WALLET>
 *
 *   Or set .env:
 *     PRIVATE_KEY=0x...
 *     AIRDROP_TO=0x...    (target wallet)
 *
 * What this script does (all in one tx sequence):
 *   1. Deploy pGVT   (symbol: pGVT, distinct from existing preGVT)
 *   2. Mint 1M pGVT  → target wallet
 *   3. Deploy sGVT   (symbol: sGVT, supply = 1M, treasury = target wallet)
 *   4. Done — wallet holds 1M pGVT + 1M sGVT, ready to transfer
 */
contract AirdropMint is Script {
    uint256 constant PGVT_AMOUNT = 1_000_000 * 10 ** 18;  // 1M pGVT
    uint256 constant SGVT_SUPPLY = 1_000_000 * 10 ** 18;  // 1M sGVT (entire supply)

    /// @notice Call with target wallet as argument
    function run(address wallet) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("========== AirdropMint (BNB Chain) ==========");
        console.log("Deployer  :", deployer);
        console.log("Airdrop to:", wallet);
        console.log("Chain ID  :", block.chainid);
        console.log("=============================================\n");

        vm.startBroadcast(deployerKey);

        // ---- pGVT: deploy → mint 1M to wallet ----
        pGVT pgvt = new pGVT(deployer);
        pgvt.mint(wallet, PGVT_AMOUNT);
        console.log("pGVT  deployed:", address(pgvt));
        console.log("  -> Minted 1,000,000 pGVT to wallet");

        // ---- sGVT: deploy with treasury = wallet (all 1M go directly to wallet) ----
        ShadowGVT sgvt = new ShadowGVT(deployer, SGVT_SUPPLY, wallet);
        console.log("sGVT  deployed:", address(sgvt));
        console.log("  -> 1,000,000 sGVT minted to wallet in constructor");

        vm.stopBroadcast();

        console.log("\n========== Done ==========");
        console.log("wallet pGVT balance:", pgvt.balanceOf(wallet) / 1e18);
        console.log("wallet sGVT balance:", sgvt.balanceOf(wallet) / 1e18);
    }

    /// @notice Convenience: read AIRDROP_TO from .env
    function run() external {
        address wallet = vm.envAddress("AIRDROP_TO");
        this.run(wallet);
    }
}
