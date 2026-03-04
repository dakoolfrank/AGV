// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/registry/AgentRegistry.sol";

/**
 * @title DeployAgentRegistry
 * @notice Deployment script for AgentRegistry
 * @dev Steps:
 *   1. Deploy AgentRegistry
 *   2. Register NFT contracts (ComputePass, SolarPass)
 *   3. (Post-deploy) Call setAgentRegistry() on each NFT contract
 *   4. (Post-deploy) Set agent quotas via setQuota() or batchSetQuota()
 *
 * Usage:
 *   forge script script/AgentRegistry.s.sol:DeployAgentRegistry \
 *     --rpc-url $RPC_URL --broadcast --verify
 *
 * Required ENV vars:
 *   PRIVATE_KEY, ADMIN_ADDRESS, COMPUTE_PASS_ADDRESS, SOLAR_PASS_ADDRESS
 */
contract DeployAgentRegistry is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address computePass = vm.envAddress("COMPUTE_PASS_ADDRESS");
        address solarPass = vm.envAddress("SOLAR_PASS_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Deploy AgentRegistry
        AgentRegistry registry = new AgentRegistry(admin);
        console.log("AgentRegistry deployed at:", address(registry));

        // 2. Register NFT contracts (grant NFT_CONTRACT_ROLE)
        registry.registerNFTContract(computePass);
        console.log("Registered ComputePass:", computePass);

        registry.registerNFTContract(solarPass);
        console.log("Registered SolarPass:", solarPass);

        vm.stopBroadcast();

        console.log("");
        console.log("=== NEXT STEPS (execute as admin) ===");
        console.log("1. Upgrade ComputePass implementation (add agentRegistry slot)");
        console.log("2. Upgrade SolarPass implementation (add agentRegistry slot)");
        console.log("3. ComputePass.setAgentRegistry(", address(registry), ")");
        console.log("4. SolarPass.setAgentRegistry(", address(registry), ")");
        console.log("5. Set agent quotas: registry.setQuota(agent, nftContract, quota)");
    }
}
