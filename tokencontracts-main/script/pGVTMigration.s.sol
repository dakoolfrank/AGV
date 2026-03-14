// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/tokens/pGVT.sol";

/**
 * @title pGVTMigration
 * @notice V3 TGE conversion: pGVT → GVT via convertToGVT()
 *
 * @dev V3 migration architecture:
 *   1. Deploy a Migrator contract that implements IMigrator.migrateToGVT()
 *   2. Grant GVT MINTER_ROLE to the Migrator contract
 *   3. Set gvtToken + migrator on pGVT
 *   4. Each holder calls pGVT.convertToGVT(amount) → burns pGVT, migrator mints GVT
 *
 *   This is a SELF-SERVICE model — each user initiates their own conversion.
 *   The script below is an admin setup script (steps 1-3).
 *   Step 4 happens via user interaction (dApp / direct contract call).
 *
 * Required .env: PRIVATE_KEY, GVT_ADDRESS, PGVT_ADDRESS, MIGRATOR_ADDRESS
 *
 * @dev SAFETY: GVT.mint() enforces totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY
 */
contract pGVTMigration is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address gvtAddress = vm.envAddress("GVT_ADDRESS");
        address pGVTAddress = vm.envAddress("PGVT_ADDRESS");
        address migratorAddress = vm.envAddress("MIGRATOR_ADDRESS");

        GVT gvt = GVT(gvtAddress);
        pGVT pgvt = pGVT(pGVTAddress);

        console.log("===========================================");
        console.log("pGVT -> GVT TGE Setup (V3 convertToGVT)");
        console.log("===========================================");
        console.log("GVT:", gvtAddress);
        console.log("pGVT:", pGVTAddress);
        console.log("Migrator:", migratorAddress);
        console.log("pGVT totalSupply:", pgvt.totalSupply());
        console.log("GVT totalSupply:", gvt.totalSupply());

        vm.startBroadcast(deployerKey);

        // Step 1: Grant MINTER_ROLE on GVT to the Migrator contract
        gvt.grantRole(gvt.MINTER_ROLE(), migratorAddress);
        console.log("Granted GVT MINTER_ROLE to Migrator");

        // Step 2: Set gvtToken and migrator on pGVT
        pgvt.setGvtToken(gvtAddress);
        pgvt.setMigrator(migratorAddress);
        console.log("Set gvtToken and migrator on pGVT");

        vm.stopBroadcast();

        console.log("\n===========================================");
        console.log("TGE setup complete!");
        console.log("Users can now call pGVT.convertToGVT(amount)");
        console.log("===========================================");
    }
}
