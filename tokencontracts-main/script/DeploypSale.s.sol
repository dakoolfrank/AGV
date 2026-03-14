// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../contracts/tokens/pGVT.sol";
import "../contracts/tokens/sGVT.sol";
import "../contracts/presale/pSale.sol";

/**
 * @title DeploypSale
 * @notice Deploys pGVT + pSale + sGVT in one transaction sequence
 * @dev Required .env variables:
 *   PRIVATE_KEY, TREASURY_ADDRESS, USDT_ADDRESS
 *   Optional: ADMIN_ADDRESS (defaults to deployer)
 *
 * NOTE: V3 pGVT also has a built-in buy() flow. pSale is the separate staged-presale
 * contract (with Merkle whitelist, per-address limits, agent sales) that calls pGVT.mint().
 * Both can coexist — pSale is more feature-rich for structured presale rounds.
 */
contract DeploypSale is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envOr("ADMIN_ADDRESS", vm.addr(deployerKey));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");

        console.log("===========================================");
        console.log("pGVT / sGVT / pSale Deployment");
        console.log("===========================================");
        console.log("Admin:", admin);
        console.log("Treasury:", treasury);
        console.log("USDT:", usdt);
        console.log("Chain ID:", block.chainid);
        console.log("===========================================\n");

        vm.startBroadcast(deployerKey);

        // 1. Deploy pGVT (V3: MAX_SUPPLY=100M, all roles to admin)
        pGVT pgvt = new pGVT(admin);
        console.log("pGVT deployed at:", address(pgvt));

        // 2. Deploy pSale
        pSale presale = new pSale(
            address(pgvt),
            usdt,
            treasury,
            admin
        );
        console.log("pSale deployed at:", address(presale));

        // 3. Grant MINTER_ROLE on pGVT to the pSale contract
        pgvt.grantRole(pgvt.MINTER_ROLE(), address(presale));
        console.log("Granted MINTER_ROLE to pSale");

        // 4. Configure pSale Stage 1
        //    price = 5_000 = 0.005 USDT (6 decimals) per 1 pGVT (18 decimals)
        //    cap = 5M pGVT
        //    maxPerAddress = 500K pGVT
        //    90-day sale window
        presale.configureStage(
            1,                          // stageId
            5_000,                      // price: 0.005 USDT per pGVT
            5_000_000 * 10 ** 18,       // cap: 5M
            block.timestamp,            // startTime
            block.timestamp + 90 days,  // endTime
            500_000 * 10 ** 18,         // maxPerAddress: 500K
            false,                      // whitelistOnly
            bytes32(0)                  // no whitelist root
        );
        presale.setCurrentStage(1);
        console.log("pSale Stage 1 configured: 0.005 USDT/pGVT, 5M cap");

        // 5. Deploy sGVT (institutional accounting certificate)
        //    Uses deployer as placeholder registry, USDT as quote asset, PancakeSwap V2
        sGVT sgvt = new sGVT(admin, admin, usdt, 2, 50_000_000 * 10 ** 18);
        console.log("sGVT deployed at:", address(sgvt));

        // 6. Grant MINTER_ROLE on sGVT and mint initial supply to treasury
        sgvt.grantRole(sgvt.MINTER_ROLE(), admin);
        sgvt.mint(treasury, 22_000_000 * 10 ** 18, "initial-treasury");
        console.log("sGVT: 22M minted to treasury");

        vm.stopBroadcast();

        console.log("\n===========================================");
        console.log("Deployment complete!");
        console.log("===========================================");
    }
}
