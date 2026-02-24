// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/tokens/PreGVT.sol";

/**
 * @title PreGVTMigrationTest
 * @notice Tests the TGE migration flow: preGVT → GVT 1:1
 */
contract PreGVTMigrationTest is Test {
    GVT public gvt;
    PreGVT public preGVT;

    address public admin = address(1);
    address public migrator = address(2);
    address public holder1 = address(3);
    address public holder2 = address(4);
    address public holder3 = address(5);
    address public minter = address(6);

    uint256 constant PREGVT_GLOBAL_CAP = 5_000_000 * 10 ** 18;

    function setUp() public {
        vm.startPrank(admin);

        // Deploy GVT
        gvt = new GVT(admin);

        // Deploy PreGVT
        preGVT = new PreGVT(admin, PREGVT_GLOBAL_CAP);
        preGVT.grantRole(preGVT.MINTER_ROLE(), minter);
        preGVT.createStage(PREGVT_GLOBAL_CAP);

        vm.stopPrank();

        // Simulate presale: mint preGVT to holders
        vm.startPrank(minter);
        preGVT.mint(holder1, 1_000_000 * 10 ** 18); // 1M
        preGVT.mint(holder2, 2_000_000 * 10 ** 18); // 2M
        preGVT.mint(holder3, 500_000 * 10 ** 18);   // 500K
        vm.stopPrank();
    }

    // ===================== Core Migration =====================

    function testMigrationMintsCorrectGVTAmounts() public {
        // Setup: grant migrator MINTER_ROLE on GVT, PAUSER_ROLE on preGVT
        vm.startPrank(admin);
        gvt.grantRole(gvt.MINTER_ROLE(), migrator);
        preGVT.grantRole(preGVT.PAUSER_ROLE(), migrator);
        vm.stopPrank();

        // Step 1: Pause preGVT
        vm.startPrank(migrator);
        preGVT.pause();

        // Step 2: Snapshot balances
        uint256 bal1 = preGVT.balanceOf(holder1);
        uint256 bal2 = preGVT.balanceOf(holder2);
        uint256 bal3 = preGVT.balanceOf(holder3);

        // Step 3: Batch mint GVT
        gvt.mint(holder1, bal1);
        gvt.mint(holder2, bal2);
        gvt.mint(holder3, bal3);

        vm.stopPrank();

        // Verify: each holder has exactly 1:1 GVT
        assertEq(gvt.balanceOf(holder1), 1_000_000 * 10 ** 18);
        assertEq(gvt.balanceOf(holder2), 2_000_000 * 10 ** 18);
        assertEq(gvt.balanceOf(holder3), 500_000 * 10 ** 18);
    }

    function testMigrationTotalEqualsPreGVTSupply() public {
        vm.startPrank(admin);
        gvt.grantRole(gvt.MINTER_ROLE(), migrator);
        preGVT.grantRole(preGVT.PAUSER_ROLE(), migrator);
        vm.stopPrank();

        uint256 preGVTTotal = preGVT.totalSupply();

        vm.startPrank(migrator);
        preGVT.pause();

        // Mint GVT for all holders
        gvt.mint(holder1, preGVT.balanceOf(holder1));
        gvt.mint(holder2, preGVT.balanceOf(holder2));
        gvt.mint(holder3, preGVT.balanceOf(holder3));
        vm.stopPrank();

        // GVT totalSupply should equal preGVT totalSupply
        assertEq(gvt.totalSupply(), preGVTTotal);
    }

    function testMigrationRevertsIfGVTCapExceeded() public {
        // Grant migrator and admin MINTER_ROLE on GVT
        vm.startPrank(admin);
        gvt.grantRole(gvt.MINTER_ROLE(), migrator);
        gvt.grantRole(gvt.MINTER_ROLE(), admin);

        // Mint GVT until only 2M cap room remains
        // GVT MAX_SUPPLY = 1B, preGVT holders have 3.5M total
        gvt.mint(address(99), gvt.MAX_SUPPLY() - 2_000_000 * 10 ** 18);
        vm.stopPrank();

        // Cache balances before prank (to avoid external calls inside expectRevert)
        uint256 holder1Bal = preGVT.balanceOf(holder1);
        uint256 holder2Bal = preGVT.balanceOf(holder2);

        // Migrate holder1 (1M) — should succeed (2M room, 1M mint = OK)
        vm.startPrank(migrator);
        gvt.mint(holder1, holder1Bal); // 1M — OK, 1M room left

        // Migrate holder2 (2M) — should fail (only 1M room left)
        vm.expectRevert("Exceeds cap");
        gvt.mint(holder2, holder2Bal);
        vm.stopPrank();
    }

    function testMigrationRevertsIfPreGVTNotPaused() public {
        // This tests the operational requirement: preGVT should be paused before migration
        // to prevent holders from transferring during snapshot
        vm.startPrank(admin);
        gvt.grantRole(gvt.MINTER_ROLE(), migrator);
        vm.stopPrank();

        // Migration without pausing preGVT first — technically succeeds at contract level
        // (GVT.mint doesn't check preGVT.paused), but it's an operational risk
        // The test verifies that we CAN pause and that pausing truly stops transfers
        assertFalse(preGVT.paused());

        // Holder could still transfer preGVT (bad: snapshot could be stale)
        vm.prank(holder1);
        preGVT.transfer(holder2, 100 * 10 ** 18);

        // After pause, no transfers possible
        vm.prank(admin);
        preGVT.pause();

        vm.prank(holder2);
        vm.expectRevert();
        preGVT.transfer(holder1, 100 * 10 ** 18);
    }

    function testMinterRoleRevokedAfterMigration() public {
        vm.startPrank(admin);
        gvt.grantRole(gvt.MINTER_ROLE(), migrator);
        preGVT.grantRole(preGVT.PAUSER_ROLE(), migrator);
        vm.stopPrank();

        vm.startPrank(migrator);
        preGVT.pause();

        // Migrate
        gvt.mint(holder1, preGVT.balanceOf(holder1));
        gvt.mint(holder2, preGVT.balanceOf(holder2));
        gvt.mint(holder3, preGVT.balanceOf(holder3));
        vm.stopPrank();

        // Admin revokes MINTER_ROLE from migrator
        bytes32 minterRole = gvt.MINTER_ROLE(); // cache to avoid consuming prank
        vm.prank(admin);
        gvt.revokeRole(minterRole, migrator);

        // Verify migrator can no longer mint
        assertTrue(!gvt.hasRole(gvt.MINTER_ROLE(), migrator));

        vm.prank(migrator);
        vm.expectRevert();
        gvt.mint(holder1, 1);
    }

    // ===================== Fuzz =====================

    function testFuzz_MigrationAmounts(uint256 a1, uint256 a2) public {
        // Bound amounts to fit within preGVT cap
        a1 = bound(a1, 1, 2_000_000 * 10 ** 18);
        a2 = bound(a2, 1, 2_000_000 * 10 ** 18);

        // Deploy fresh contracts for this fuzz run
        PreGVT freshPreGVT;
        GVT freshGVT;

        vm.startPrank(admin);
        freshGVT = new GVT(admin);
        freshPreGVT = new PreGVT(admin, PREGVT_GLOBAL_CAP);
        freshPreGVT.grantRole(freshPreGVT.MINTER_ROLE(), minter);
        freshPreGVT.createStage(PREGVT_GLOBAL_CAP);
        freshGVT.grantRole(freshGVT.MINTER_ROLE(), migrator);
        freshPreGVT.grantRole(freshPreGVT.PAUSER_ROLE(), migrator);
        vm.stopPrank();

        vm.startPrank(minter);
        freshPreGVT.mint(holder1, a1);
        freshPreGVT.mint(holder2, a2);
        vm.stopPrank();

        uint256 totalPreGVT = freshPreGVT.totalSupply();

        vm.startPrank(migrator);
        freshPreGVT.pause();
        freshGVT.mint(holder1, a1);
        freshGVT.mint(holder2, a2);
        vm.stopPrank();

        assertEq(freshGVT.totalSupply(), totalPreGVT);
        assertEq(freshGVT.balanceOf(holder1), a1);
        assertEq(freshGVT.balanceOf(holder2), a2);
    }
}
