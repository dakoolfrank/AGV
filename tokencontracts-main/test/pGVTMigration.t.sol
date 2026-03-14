// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/tokens/pGVT.sol";

/**
 * @title MockMigrator
 * @notice Simulates the real migrator: burns pGVT on caller side, mints GVT to user
 */
contract MigrationMigrator is IMigrator {
    GVT public gvt;
    address public lastUser;
    uint256 public lastAmount;

    constructor(GVT _gvt) {
        gvt = _gvt;
    }

    function migrateToGVT(address user, uint256 amount) external override {
        lastUser = user;
        lastAmount = amount;
        gvt.mint(user, amount);
    }
}

/**
 * @title pGVTMigrationTest
 * @notice Tests the V3 migration flow: convertToGVT() burns pGVT and calls migrator
 *
 * V3 flow (per user):
 *   1. Admin sets gvtToken + migrator on pGVT
 *   2. Grant MINTER_ROLE on GVT to the migrator contract
 *   3. Each user calls pGVT.convertToGVT(amount) → burns pGVT, migrator mints GVT
 *
 * Differences from V2:
 *   - V2: admin pauses pGVT → off-chain snapshot → admin batch-mints GVT
 *   - V3: each user self-serves via convertToGVT() (vesting-aware)
 */
contract pGVTMigrationTest is Test {
    GVT public gvt;
    pGVT public pgvt;
    MigrationMigrator public migr;

    address public admin = address(1);
    address public holder1 = address(3);
    address public holder2 = address(4);
    address public holder3 = address(5);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy GVT + pGVT
        gvt = new GVT(admin);
        pgvt = new pGVT(admin);

        // Deploy migrator and wire it up
        migr = new MigrationMigrator(gvt);
        gvt.grantRole(gvt.MINTER_ROLE(), address(migr));
        pgvt.setGvtToken(address(gvt));
        pgvt.setMigrator(address(migr));

        // Mint pGVT to holders
        pgvt.mint(holder1, 1_000_000 * 10 ** 18);
        pgvt.mint(holder2, 2_000_000 * 10 ** 18);
        pgvt.mint(holder3, 500_000 * 10 ** 18);

        vm.stopPrank();
    }

    // ===================== Core Conversion =====================

    function testConvertToGVTMintsCorrectAmounts() public {
        uint256 bal1 = pgvt.balanceOf(holder1);

        vm.prank(holder1);
        pgvt.convertToGVT(bal1);

        // pGVT burned
        assertEq(pgvt.balanceOf(holder1), 0);
        // GVT minted 1:1
        assertEq(gvt.balanceOf(holder1), bal1);
        assertEq(gvt.balanceOf(holder1), 1_000_000 * 10 ** 18);
    }

    function testPartialConversion() public {
        uint256 convertAmount = 500_000 * 10 ** 18;

        vm.prank(holder1);
        pgvt.convertToGVT(convertAmount);

        assertEq(pgvt.balanceOf(holder1), 500_000 * 10 ** 18);
        assertEq(gvt.balanceOf(holder1), convertAmount);
    }

    function testAllHoldersConvertFully() public {
        uint256 totalPgvt = pgvt.totalSupply();
        uint256 bal1 = pgvt.balanceOf(holder1);
        uint256 bal2 = pgvt.balanceOf(holder2);
        uint256 bal3 = pgvt.balanceOf(holder3);

        vm.prank(holder1);
        pgvt.convertToGVT(bal1);

        vm.prank(holder2);
        pgvt.convertToGVT(bal2);

        vm.prank(holder3);
        pgvt.convertToGVT(bal3);

        // All pGVT burned
        assertEq(pgvt.totalSupply(), 0);
        // GVT total matches original pGVT supply
        assertEq(gvt.totalSupply(), totalPgvt);
    }

    // ===================== Vesting-Aware Conversion =====================

    function testConvertRespectsVesting() public {
        // Set vesting: 1 year, 3 month cliff
        vm.prank(admin);
        pgvt.setVestingSchedule(
            holder1,
            uint64(block.timestamp),
            uint64(90 days),
            uint64(365 days),
            1_000_000 * 10 ** 18
        );

        // Before cliff: 0 transferable → cannot convert
        vm.prank(holder1);
        vm.expectRevert(pGVT.TransferExceedsUnlocked.selector);
        pgvt.convertToGVT(1);
    }

    function testConvertAfterPartialVesting() public {
        uint256 total = 1_000_000 * 10 ** 18;
        uint256 start = block.timestamp;

        vm.prank(admin);
        pgvt.setVestingSchedule(
            holder1,
            uint64(start),
            uint64(0),        // no cliff
            uint64(100 days), // 100 day linear
            total
        );

        // At 50 days → 50% vested → 500K convertible
        vm.warp(start + 50 days);

        uint256 convertible = pgvt.transferableBalance(holder1);
        assertEq(convertible, 500_000 * 10 ** 18);

        // Convert within limit
        vm.prank(holder1);
        pgvt.convertToGVT(convertible);

        assertEq(gvt.balanceOf(holder1), convertible);
        assertEq(pgvt.balanceOf(holder1), 500_000 * 10 ** 18);
    }

    // ===================== GVT Cap Safety =====================

    function testConvertRevertsIfGVTCapExceeded() public {
        vm.startPrank(admin);
        gvt.grantRole(gvt.MINTER_ROLE(), admin);
        // Fill GVT to near cap: 1B - 500K room
        gvt.mint(address(99), gvt.MAX_SUPPLY() - 500_000 * 10 ** 18);
        vm.stopPrank();

        // holder3 has 500K → exactly fits
        uint256 bal3 = pgvt.balanceOf(holder3);
        vm.prank(holder3);
        pgvt.convertToGVT(bal3);
        assertEq(gvt.balanceOf(holder3), 500_000 * 10 ** 18);

        // holder1 has 1M → won't fit (only 0 room left)
        uint256 bal1 = pgvt.balanceOf(holder1);
        vm.prank(holder1);
        vm.expectRevert("Exceeds cap");
        pgvt.convertToGVT(bal1);
    }

    // ===================== Fuzz =====================

    function testFuzz_ConversionAmounts(uint256 a1, uint256 a2) public {
        a1 = bound(a1, 1, 2_000_000 * 10 ** 18);
        a2 = bound(a2, 1, 2_000_000 * 10 ** 18);

        // Deploy fresh set
        vm.startPrank(admin);
        GVT freshGVT = new GVT(admin);
        pGVT freshPgvt = new pGVT(admin);
        MigrationMigrator freshMigr = new MigrationMigrator(freshGVT);
        freshGVT.grantRole(freshGVT.MINTER_ROLE(), address(freshMigr));
        freshPgvt.setGvtToken(address(freshGVT));
        freshPgvt.setMigrator(address(freshMigr));
        freshPgvt.mint(holder1, a1);
        freshPgvt.mint(holder2, a2);
        vm.stopPrank();

        uint256 totalPgvt = freshPgvt.totalSupply();

        vm.prank(holder1);
        freshPgvt.convertToGVT(a1);

        vm.prank(holder2);
        freshPgvt.convertToGVT(a2);

        assertEq(freshGVT.totalSupply(), totalPgvt);
        assertEq(freshGVT.balanceOf(holder1), a1);
        assertEq(freshGVT.balanceOf(holder2), a2);
    }
}
