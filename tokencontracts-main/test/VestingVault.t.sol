// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/utils/VestingVault.sol";

contract VestingVaultTest is Test {
    GVT public gvt;
    VestingVault public vault;

    address public admin = address(1);
    address public operator = address(2);
    address public user1 = address(3);
    address public user2 = address(4);

    uint256 constant DEPOSIT_AMOUNT = 500_000_000 * 10 ** 18;

    function setUp() public {
        vm.startPrank(admin);

        gvt = new GVT(admin);
        vault = new VestingVault(address(gvt), admin);

        bytes32 operatorRole = vault.OPERATOR_ROLE();
        vault.grantRole(operatorRole, operator);

        bytes32 minterRole = gvt.MINTER_ROLE();
        gvt.grantRole(minterRole, admin);

        // Mint and deposit tokens to vault
        gvt.mint(admin, DEPOSIT_AMOUNT);
        gvt.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);

        vm.stopPrank();
    }

    function testInitialState() public {
        assertEq(address(vault.token()), address(gvt));
        assertEq(gvt.balanceOf(address(vault)), DEPOSIT_AMOUNT);
        assertEq(vault.totalAllocated(), 0);
        assertEq(vault.totalClaimed(), 0);
    }

    function testCreateVestingSchedule() public {
        uint256 amount = 1000 * 10 ** 18;
        uint256 cliffMonths = 6;
        uint256 vestingMonths = 36;

        vm.prank(operator);
        uint256 scheduleId = vault.createVestingSchedule(user1, amount, cliffMonths, vestingMonths, true, "Team");

        assertEq(scheduleId, 0);
        assertEq(vault.scheduleCount(user1), 1);
        assertEq(vault.totalAllocated(), amount);
    }

    function testCreateTeamVesting() public {
        uint256 amount = 150_000_000 * 10 ** 18; // 15% team allocation

        vm.prank(operator);
        uint256 scheduleId = vault.createTeamVesting(user1, amount);

        (uint256 totalAmount,,, uint256 cliffEnd, uint256 vestingEnd, bool revocable,, string memory category,) =
            vault.getSchedule(user1, scheduleId);

        assertEq(totalAmount, amount);
        assertEq(category, "Team");
        assertTrue(revocable);
        assertEq(cliffEnd - block.timestamp, 6 * 30 days);
        assertEq(vestingEnd - block.timestamp, 36 * 30 days);
    }

    function testCreateStrategicVesting() public {
        uint256 amount = 150_000_000 * 10 ** 18;

        vm.prank(operator);
        uint256 scheduleId = vault.createStrategicVesting(user1, amount);

        (uint256 totalAmount,,, uint256 cliffEnd, uint256 vestingEnd, bool revocable,, string memory category,) =
            vault.getSchedule(user1, scheduleId);

        assertEq(totalAmount, amount);
        assertEq(category, "Strategic");
        assertFalse(revocable);
        assertEq(cliffEnd - block.timestamp, 6 * 30 days);
        assertEq(vestingEnd - block.timestamp, 24 * 30 days);
    }

    function testCreatePublicVesting() public {
        uint256 amount = 100_000_000 * 10 ** 18;

        vm.prank(operator);
        uint256 scheduleId = vault.createPublicVesting(user1, amount);

        (uint256 totalAmount,,, uint256 cliffEnd, uint256 vestingEnd, bool revocable,, string memory category,) =
            vault.getSchedule(user1, scheduleId);

        assertEq(totalAmount, amount);
        assertEq(category, "Public");
        assertFalse(revocable);
        assertEq(cliffEnd, block.timestamp); // No cliff
        assertEq(vestingEnd - block.timestamp, 6 * 30 days);
    }

    function testCannotClaimDuringCliff() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createVestingSchedule(user1, amount, 6, 36, true, "Team");

        // Try to claim during cliff
        vm.prank(user1);
        vm.expectRevert("Nothing to claim");
        vault.claim(0);
    }

    function testClaimAfterCliff() public {
        uint256 amount = 1000 * 10 ** 18;
        uint256 cliffMonths = 6;
        uint256 vestingMonths = 36;

        vm.prank(operator);
        vault.createVestingSchedule(user1, amount, cliffMonths, vestingMonths, true, "Team");

        // Fast forward past cliff (7 months)
        vm.warp(block.timestamp + 7 * 30 days);

        vm.prank(user1);
        vault.claim(0);

        uint256 balance = gvt.balanceOf(user1);
        assertGt(balance, 0);
    }

    function testLinearVesting() public {
        uint256 amount = 3600 * 10 ** 18; // Easy to calculate
        uint256 vestingMonths = 36;

        vm.prank(operator);
        vault.createPublicVesting(user1, amount); // No cliff, 6 months

        // After 3 months (50% vested)
        vm.warp(block.timestamp + 3 * 30 days);

        vm.prank(user1);
        vault.claim(0);

        uint256 balance = gvt.balanceOf(user1);
        assertApproxEqRel(balance, amount / 2, 0.02e18); // 2% tolerance
    }

    function testClaimFullyVested() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createPublicVesting(user1, amount);

        // Fast forward past vesting period
        vm.warp(block.timestamp + 7 * 30 days);

        vm.prank(user1);
        vault.claim(0);

        assertEq(gvt.balanceOf(user1), amount);
    }

    function testClaimAll() public {
        uint256 amount = 500 * 10 ** 18;

        vm.startPrank(operator);
        vault.createPublicVesting(user1, amount);
        vault.createPublicVesting(user1, amount);
        vault.createPublicVesting(user1, amount);
        vm.stopPrank();

        // Fast forward 3 months (50% vested)
        vm.warp(block.timestamp + 3 * 30 days);

        vm.prank(user1);
        vault.claimAll();

        uint256 balance = gvt.balanceOf(user1);
        uint256 expectedTotal = amount * 3;
        assertApproxEqRel(balance, expectedTotal / 2, 0.02e18);
    }

    function testRevokeVesting() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createTeamVesting(user1, amount);

        // Fast forward 12 months (1/3 vested after cliff)
        vm.warp(block.timestamp + 12 * 30 days);

        // Claim what's vested BEFORE revoking
        vm.prank(user1);
        vault.claim(0);

        uint256 balanceBeforeRevoke = gvt.balanceOf(user1);
        assertApproxEqRel(balanceBeforeRevoke, amount / 3, 0.02e18);

        // Now revoke
        vm.prank(admin);
        vault.revokeVesting(user1, 0);

        // Check that schedule is revoked and total amount reduced
        (uint256 totalAmount,,,,,, bool revoked,,) = vault.getSchedule(user1, 0);
        assertTrue(revoked);
        assertLt(totalAmount, amount);
    }

    function testCannotRevokeNonRevocable() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createStrategicVesting(user1, amount);

        vm.prank(admin);
        vm.expectRevert("Schedule not revocable");
        vault.revokeVesting(user1, 0);
    }

    function testCannotRevokeAlreadyRevoked() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createTeamVesting(user1, amount);

        vm.warp(block.timestamp + 12 * 30 days);

        vm.startPrank(admin);
        vault.revokeVesting(user1, 0);

        vm.expectRevert("Already revoked");
        vault.revokeVesting(user1, 0);
        vm.stopPrank();
    }

    function testGetClaimable() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createPublicVesting(user1, amount);

        // Initially 0 (actually small amount due to block time)
        uint256 claimable1 = vault.getClaimable(user1, 0);
        assertLe(claimable1, amount / 100); // Less than 1%

        // After 3 months (50%)
        vm.warp(block.timestamp + 3 * 30 days);
        uint256 claimable2 = vault.getClaimable(user1, 0);
        assertApproxEqRel(claimable2, amount / 2, 0.02e18);

        // After 6 months (100%)
        vm.warp(block.timestamp + 4 * 30 days);
        uint256 claimable3 = vault.getClaimable(user1, 0);
        assertEq(claimable3, amount);
    }

    function testGetTotalClaimable() public {
        uint256 amount = 500 * 10 ** 18;

        vm.startPrank(operator);
        vault.createPublicVesting(user1, amount);
        vault.createPublicVesting(user1, amount);
        vm.stopPrank();

        vm.warp(block.timestamp + 3 * 30 days);

        uint256 totalClaimable = vault.getTotalClaimable(user1);
        assertApproxEqRel(totalClaimable, amount, 0.02e18); // 2 schedules at 50% = amount
    }

    function testBatchCreateVestingSchedules() public {
        address[] memory beneficiaries = new address[](3);
        beneficiaries[0] = user1;
        beneficiaries[1] = user2;
        beneficiaries[2] = address(5);

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1000 * 10 ** 18;
        amounts[1] = 2000 * 10 ** 18;
        amounts[2] = 1500 * 10 ** 18;

        uint256[] memory cliffMonths = new uint256[](3);
        cliffMonths[0] = 6;
        cliffMonths[1] = 6;
        cliffMonths[2] = 3;

        uint256[] memory vestingMonths = new uint256[](3);
        vestingMonths[0] = 36;
        vestingMonths[1] = 24;
        vestingMonths[2] = 18;

        bool[] memory revocable = new bool[](3);
        revocable[0] = true;
        revocable[1] = false;
        revocable[2] = false;

        string[] memory categories = new string[](3);
        categories[0] = "Team";
        categories[1] = "Strategic";
        categories[2] = "Ecosystem";

        vm.prank(operator);
        vault.batchCreateVestingSchedules(beneficiaries, amounts, cliffMonths, vestingMonths, revocable, categories);

        assertEq(vault.scheduleCount(user1), 1);
        assertEq(vault.scheduleCount(user2), 1);
        assertEq(vault.scheduleCount(address(5)), 1);
    }

    function testGetCategoryStats() public {
        uint256 teamAmount = 1000 * 10 ** 18;
        uint256 strategicAmount = 2000 * 10 ** 18;

        vm.startPrank(operator);
        vault.createTeamVesting(user1, teamAmount);
        vault.createStrategicVesting(user2, strategicAmount);
        vm.stopPrank();

        (uint256 teamAllocated, uint256 teamClaimed, uint256 teamRemaining) = vault.getCategoryStats("Team");
        (uint256 strategicAllocated,,) = vault.getCategoryStats("Strategic");

        assertEq(teamAllocated, teamAmount);
        assertEq(teamClaimed, 0);
        assertEq(teamRemaining, teamAmount);
        assertEq(strategicAllocated, strategicAmount);
    }

    function testCategoryStatsAfterClaim() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createPublicVesting(user1, amount);

        // Vest 50%
        vm.warp(block.timestamp + 3 * 30 days);

        vm.prank(user1);
        vault.claim(0);

        (uint256 allocated, uint256 claimed, uint256 remaining) = vault.getCategoryStats("Public");

        assertEq(allocated, amount);
        assertGt(claimed, 0);
        assertLt(remaining, amount);
    }

    function testGetGlobalStats() public {
        uint256 amount1 = 1000 * 10 ** 18;
        uint256 amount2 = 2000 * 10 ** 18;

        vm.startPrank(operator);
        vault.createTeamVesting(user1, amount1);
        vault.createStrategicVesting(user2, amount2);
        vm.stopPrank();

        (uint256 allocated, uint256 claimed, uint256 revoked, uint256 remaining, uint256 vaultBalance) =
            vault.getGlobalStats();

        assertEq(allocated, amount1 + amount2);
        assertEq(claimed, 0);
        assertEq(revoked, 0);
        assertEq(remaining, amount1 + amount2);
        assertEq(vaultBalance, DEPOSIT_AMOUNT);
    }

    function testGlobalStatsAfterRevoke() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createTeamVesting(user1, amount);

        vm.warp(block.timestamp + 12 * 30 days);

        vm.prank(admin);
        vault.revokeVesting(user1, 0);

        (uint256 allocated,, uint256 revoked,,) = vault.getGlobalStats();

        assertEq(allocated, amount);
        assertGt(revoked, 0);
    }

    function testDeposit() public {
        uint256 additionalAmount = 100_000_000 * 10 ** 18;

        vm.startPrank(admin);
        gvt.mint(admin, additionalAmount);
        gvt.approve(address(vault), additionalAmount);
        vault.deposit(additionalAmount);
        vm.stopPrank();

        assertEq(gvt.balanceOf(address(vault)), DEPOSIT_AMOUNT + additionalAmount);
    }

    function testEmergencyWithdraw() public {
        uint256 withdrawAmount = 1000 * 10 ** 18;

        vm.prank(admin);
        vault.emergencyWithdraw(admin, withdrawAmount);

        assertEq(gvt.balanceOf(admin), withdrawAmount);
        assertEq(gvt.balanceOf(address(vault)), DEPOSIT_AMOUNT - withdrawAmount);
    }

    function testMultipleClaimsOverTime() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(operator);
        vault.createPublicVesting(user1, amount);

        uint256 startTime = block.timestamp;

        // Claim at 25% (45 days from start)
        vm.warp(startTime + 45 days);
        vm.prank(user1);
        vault.claim(0);
        uint256 balance1 = gvt.balanceOf(user1);

        // Claim at 50% (90 days from start)
        vm.warp(startTime + 90 days);
        vm.prank(user1);
        vault.claim(0);
        uint256 balance2 = gvt.balanceOf(user1);

        // Claim at 100% (180+ days from start)
        vm.warp(startTime + 180 days);
        vm.prank(user1);
        vault.claim(0);
        uint256 balance3 = gvt.balanceOf(user1);

        assertGt(balance2, balance1);
        assertGt(balance3, balance2);
        assertEq(balance3, amount);
    }

    function testCannotCreateScheduleWithZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert("Amount must be > 0");
        vault.createVestingSchedule(user1, 0, 6, 36, true, "Team");
    }

    function testCannotCreateScheduleWithZeroVesting() public {
        vm.prank(operator);
        vm.expectRevert("Vesting duration must be > 0");
        vault.createVestingSchedule(user1, 1000 * 10 ** 18, 6, 0, true, "Team");
    }

    function testCannotCreateScheduleWithInvalidBeneficiary() public {
        vm.prank(operator);
        vm.expectRevert("Invalid beneficiary");
        vault.createVestingSchedule(address(0), 1000 * 10 ** 18, 6, 36, true, "Team");
    }

    function testFuzzVestingSchedule(uint96 amount, uint16 cliffMonths, uint16 vestingMonths) public {
        vm.assume(amount > 0 && amount < 1_000_000 * 10 ** 18);
        vm.assume(cliffMonths < 60);
        vm.assume(vestingMonths > 0 && vestingMonths < 120);

        vm.prank(operator);
        vault.createVestingSchedule(user1, amount, cliffMonths, vestingMonths, true, "Test");

        assertEq(vault.scheduleCount(user1), 1);
    }
}
