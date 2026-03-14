// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../contracts/tokens/pGVT.sol";
import "../contracts/tokens/sGVT.sol";

/**
 * @title AirdropMint
 * @notice One-step: deploy pGVT + sGVT on BNB Chain, mint initial supply to target wallet
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
 *   1. Deploy pGVT (V3: MAX_SUPPLY=100M, all roles to deployer)
 *   2. Mint 3M pGVT → target wallet
 *   3. Deploy sGVT (maxSupply=100M) → mint 30M sGVT to target wallet
 *   4. Done — wallet holds 3M pGVT + 30M sGVT, ready to BatchAirdrop
 */
contract AirdropMint is Script {
    uint256 constant SGVT_MAX_SUPPLY = 100_000_000 * 10 ** 18;  // sGVT 上限 1 亿
    uint256 constant SGVT_MINT       =  30_000_000 * 10 ** 18;  // 首铸 3000 万
    uint256 constant PGVT_MINT       =   3_000_000 * 10 ** 18;  // 首铸 300 万

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

        // ---- pGVT: deploy → mint 3M to wallet ----
        pGVT pgvt = new pGVT(deployer);
        pgvt.mint(wallet, PGVT_MINT);
        console.log("pGVT  deployed:", address(pgvt));
        console.log("  -> Minted 3,000,000 pGVT to wallet");

        // ---- sGVT: deploy (maxSupply=100M) → mint 30M to wallet ----
        sGVT sgvt = new sGVT(deployer, deployer, deployer, 2, SGVT_MAX_SUPPLY);
        sgvt.grantRole(sgvt.MINTER_ROLE(), deployer);
        sgvt.mint(wallet, SGVT_MINT, "initial_mint");
        console.log("sGVT  deployed:", address(sgvt));
        console.log("  -> Minted 30,000,000 sGVT to wallet (maxSupply: 100M)");

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
