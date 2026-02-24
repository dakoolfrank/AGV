// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/tokens/PreGVT.sol";
import "../contracts/tokens/ShadowGVT.sol";
import "../contracts/presale/Presale.sol";

/**
 * @title DeployPresale
 * @notice Deploys PreGVT + Presale + ShadowGVT in one transaction sequence
 * @dev Required .env variables:
 *   PRIVATE_KEY, TREASURY_ADDRESS, USDT_ADDRESS
 *   Optional: ADMIN_ADDRESS (defaults to deployer)
 */
contract DeployPresale is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envOr("ADMIN_ADDRESS", vm.addr(deployerKey));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");

        console.log("===========================================");
        console.log("PreGVT / sGVT / Presale Deployment");
        console.log("===========================================");
        console.log("Admin:", admin);
        console.log("Treasury:", treasury);
        console.log("USDT:", usdt);
        console.log("Chain ID:", block.chainid);
        console.log("===========================================\n");

        vm.startBroadcast(deployerKey);

        // 1. Deploy PreGVT (initial globalCap = 5M for Stage 1)
        PreGVT preGVT = new PreGVT(admin, 5_000_000 * 10 ** 18);
        console.log("PreGVT deployed at:", address(preGVT));

        // 2. Deploy Presale
        Presale presale = new Presale(
            address(preGVT),
            usdt,
            treasury,
            admin
        );
        console.log("Presale deployed at:", address(presale));

        // 3. Grant MINTER_ROLE on PreGVT to the Presale contract
        preGVT.grantRole(preGVT.MINTER_ROLE(), address(presale));
        console.log("Granted MINTER_ROLE to Presale");

        // 4. Create Stage 1 on PreGVT (5M cap)
        uint256 stageId = preGVT.createStage(5_000_000 * 10 ** 18);
        console.log("Stage created, ID:", stageId);

        // 5. Configure Presale Stage 1
        //    price = 5_000 = 0.005 USDT (6 decimals) per 1 preGVT (18 decimals)
        //    cap = 5M preGVT
        //    maxPerAddress = 500K preGVT
        //    90-day sale window
        presale.configureStage(
            1,                          // stageId
            5_000,                      // price: 0.005 USDT per preGVT
            5_000_000 * 10 ** 18,       // cap: 5M
            block.timestamp,            // startTime
            block.timestamp + 90 days,  // endTime
            500_000 * 10 ** 18,         // maxPerAddress: 500K
            false,                      // whitelistOnly
            bytes32(0)                  // no whitelist root
        );
        presale.setCurrentStage(1);
        console.log("Presale Stage 1 configured: 0.005 USDT/preGVT, 5M cap");

        // 6. Deploy ShadowGVT (22M, matching existing deployment)
        ShadowGVT sGVT = new ShadowGVT(admin, 22_000_000 * 10 ** 18, treasury);
        console.log("ShadowGVT deployed at:", address(sGVT));

        vm.stopBroadcast();

        console.log("\n===========================================");
        console.log("Deployment complete!");
        console.log("===========================================");
    }
}
