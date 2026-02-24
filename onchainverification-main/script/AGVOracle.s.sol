// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AGVOracle.sol";

/**
 * @title DeployAGVOracle
 * @notice Simple deployment script for AGVOracle contract
 * @dev Usage:
 *   1. Copy .env.example to .env and fill in the values
 *   2. Run: source .env
 *   3. Deploy: forge script script/DeployAGVOracle.s.sol:DeployAGVOracle --rpc-url $RPC_URL --broadcast --verify
 */
contract DeployAGVOracle is Script {
    function run() external returns (AGVOracle) {
        // Load deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load configuration
        address admin = vm.envAddress("ADMIN_ADDRESS");

        // Tech team addresses
        address techTeam1 = vm.envAddress("TECH_TEAM_1");
        address techTeam2 = vm.envAddress("TECH_TEAM_2");

        // Settlement multisig addresses
        address settlementMultisig1 = vm.envAddress("SETTLEMENT_MULTISIG_1");
        address settlementMultisig2 = vm.envAddress("SETTLEMENT_MULTISIG_2");

        // Build arrays
        address[] memory techTeam = new address[](2);
        techTeam[0] = techTeam1;
        techTeam[1] = techTeam2;

        address[] memory settlementMultisig = new address[](2);
        settlementMultisig[0] = settlementMultisig1;
        settlementMultisig[1] = settlementMultisig2;

        // Log deployment info
        console.log("=== AGVOracle Deployment ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Admin:", admin);
        console.log("\nTech Team:");
        console.log("  - Tech Team 1:", techTeam1);
        console.log("  - Tech Team 2:", techTeam2);
        console.log("\nSettlement Multisig:");
        console.log("  - Multisig 1:", settlementMultisig1);
        console.log("  - Multisig 2:", settlementMultisig2);
        console.log("\nChain ID:", block.chainid);

        // Deploy
        vm.startBroadcast(deployerPrivateKey);

        AGVOracle oracle = new AGVOracle(admin, techTeam, settlementMultisig);

        vm.stopBroadcast();

        // Log results
        console.log("\n=== Deployment Successful ===");
        console.log("AGVOracle deployed at:", address(oracle));
        console.log("\n=== Verification Command ===");
        console.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(address(oracle)),
                " src/AGVOracle.sol:AGVOracle",
                " --chain-id ",
                vm.toString(block.chainid),
                " --constructor-args $(cast abi-encode \"constructor(address,address[],address[])\" ",
                vm.toString(admin),
                " \"[",
                vm.toString(techTeam1),
                ",",
                vm.toString(techTeam2),
                "]\" \"[",
                vm.toString(settlementMultisig1),
                ",",
                vm.toString(settlementMultisig2),
                "]\""
            )
        );

        return oracle;
    }
}
