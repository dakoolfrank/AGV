// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/nft/SeedPass.sol";
import "../contracts/nft/TreePass.sol";
import "../contracts/nft/SolarPass.sol";
import "../contracts/nft/ComputePass.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployPasses
 * @notice Deploy all 4 V3 Pass contracts behind UUPS proxies.
 *
 * Usage:
 *   forge script script/DeployPasses.s.sol:DeployPasses \
 *     --rpc-url $BSC_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BSCSCAN_API_KEY \
 *     -vvvv
 *
 * Required env vars:
 *   PRIVATE_KEY       — deployer private key
 *   ADMIN_ADDRESS     — AccessControl admin (usually = deployer)
 *   TREASURY_ADDRESS  — USDT payment receiver
 *   BSC_USDT          — BSC USDT address (default: 0x55d398326f99059fF775485246999027B3197955)
 */
contract DeployPasses is Script {
    // BSC Mainnet USDT (Binance-Peg BSC-USD, 18 decimals)
    address constant DEFAULT_BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address usdt = vm.envOr("BSC_USDT", DEFAULT_BSC_USDT);

        console.log("=== Pass V3 Deployment ===");
        console.log("Admin:   ", admin);
        console.log("Treasury:", treasury);
        console.log("USDT:    ", usdt);
        console.log("");

        vm.startBroadcast(deployerKey);

        // ── Seed Pass ──
        SeedPass seedImpl = new SeedPass();
        ERC1967Proxy seedProxy = new ERC1967Proxy(
            address(seedImpl),
            abi.encodeCall(SeedPass.initialize, (admin, usdt, treasury))
        );
        console.log("SeedPass   impl:", address(seedImpl));
        console.log("SeedPass  proxy:", address(seedProxy));

        // ── Tree Pass ──
        TreePass treeImpl = new TreePass();
        ERC1967Proxy treeProxy = new ERC1967Proxy(
            address(treeImpl),
            abi.encodeCall(TreePass.initialize, (admin, usdt, treasury))
        );
        console.log("TreePass   impl:", address(treeImpl));
        console.log("TreePass  proxy:", address(treeProxy));

        // ── Solar Pass ──
        SolarPass solarImpl = new SolarPass();
        ERC1967Proxy solarProxy = new ERC1967Proxy(
            address(solarImpl),
            abi.encodeCall(SolarPass.initialize, (admin, usdt, treasury))
        );
        console.log("SolarPass  impl:", address(solarImpl));
        console.log("SolarPass proxy:", address(solarProxy));

        // ── Compute Pass ──
        ComputePass compImpl = new ComputePass();
        ERC1967Proxy compProxy = new ERC1967Proxy(
            address(compImpl),
            abi.encodeCall(ComputePass.initialize, (admin, usdt, treasury))
        );
        console.log("ComputePass impl:", address(compImpl));
        console.log("ComputePassproxy:", address(compProxy));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Total contracts: 8 (4 impl + 4 proxy)");
    }
}
