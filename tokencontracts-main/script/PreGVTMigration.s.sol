// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/tokens/PreGVT.sol";

/**
 * @title PreGVTMigration
 * @notice TGE batch conversion script: preGVT holders → GVT 1:1
 * @dev Execution steps:
 *   1. Off-chain: snapshot all preGVT holders + balances (via events or indexer)
 *   2. Prepare holders.json with { "holders": [...], "balances": [...] }
 *   3. On-chain: preGVT.pause() — freeze all transfers
 *   4. On-chain: GVT.grantRole(MINTER_ROLE, migrationEOA) — temporary
 *   5. On-chain: for each holder: GVT.mint(holder, balance)
 *   6. On-chain: GVT.revokeRole(MINTER_ROLE, migrationEOA)
 *   7. Verify: sum(minted) == preGVT.totalSupply()
 *
 * Required .env: PRIVATE_KEY, GVT_ADDRESS, PREGVT_ADDRESS
 * Required file: ./snapshot/holders.json
 *
 * @dev SAFETY: GVT.mint() enforces totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY
 *   Even if this script is buggy, GVT itself will revert on over-mint.
 */
contract PreGVTMigration is Script {
    struct Snapshot {
        address[] holders;
        uint256[] balances;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address gvtAddress = vm.envAddress("GVT_ADDRESS");
        address preGVTAddress = vm.envAddress("PREGVT_ADDRESS");

        GVT gvt = GVT(gvtAddress);
        PreGVT preGVT = PreGVT(preGVTAddress);

        console.log("===========================================");
        console.log("PreGVT -> GVT TGE Migration");
        console.log("===========================================");
        console.log("GVT:", gvtAddress);
        console.log("PreGVT:", preGVTAddress);
        console.log("PreGVT totalSupply:", preGVT.totalSupply());
        console.log("GVT totalSupply (before):", gvt.totalSupply());

        // Load snapshot from JSON
        string memory json = vm.readFile("./snapshot/holders.json");
        address[] memory holders = abi.decode(vm.parseJson(json, ".holders"), (address[]));
        uint256[] memory balances = abi.decode(vm.parseJson(json, ".balances"), (uint256[]));
        require(holders.length == balances.length, "Array length mismatch");
        require(holders.length > 0, "Empty snapshot");

        // Sanity: sum of balances should match preGVT.totalSupply()
        uint256 totalToMigrate;
        for (uint256 i = 0; i < balances.length; i++) {
            totalToMigrate += balances[i];
        }
        console.log("Holders count:", holders.length);
        console.log("Total to migrate:", totalToMigrate);
        require(totalToMigrate == preGVT.totalSupply(), "Snapshot sum != preGVT totalSupply");

        vm.startBroadcast(deployerKey);

        // Step 1: Pause preGVT (freeze transfers) — skip if already paused
        if (!preGVT.paused()) {
            preGVT.pause();
            console.log("preGVT paused");
        } else {
            console.log("preGVT already paused");
        }

        // Step 2: Batch mint GVT to each preGVT holder
        // NOTE: The broadcaster must already have GVT MINTER_ROLE
        for (uint256 i = 0; i < holders.length; i++) {
            if (balances[i] > 0) {
                gvt.mint(holders[i], balances[i]);
            }
        }
        console.log("Batch mint complete");

        // Step 3: Revoke MINTER_ROLE from migrator
        address migrator = vm.addr(deployerKey);
        gvt.revokeRole(gvt.MINTER_ROLE(), migrator);
        console.log("MINTER_ROLE revoked from migrator");

        vm.stopBroadcast();

        console.log("\n===========================================");
        console.log("GVT totalSupply (after):", gvt.totalSupply());
        console.log("TGE Migration complete!");
        console.log("===========================================");
    }
}
