// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/GVT.sol";

contract GVTTest is Test {
    GVT public gvt;

    address public admin = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    address public minter = address(4);

    uint256 constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    event AllocationSet(address indexed beneficiary, uint256 amount, uint256 vestingDuration);
    event TokensReleased(address indexed beneficiary, uint256 amount);

    function setUp() public {
        vm.prank(admin);
        gvt = new GVT(admin);
    }

    function testInitialState() public {
        assertEq(gvt.name(), "Green Value Token");
        assertEq(gvt.symbol(), "GVT");
        assertEq(gvt.decimals(), 18);
        assertEq(gvt.MAX_SUPPLY(), MAX_SUPPLY);
        assertEq(gvt.totalSupply(), 0);
    }

    function testSetAllocation() public {
        uint256 amount = 150_000_000 * 10 ** 18; // 15% of supply
        uint256 vestingDuration = 36 * 30 days; // 36 months

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        (uint256 allocAmount, uint256 released, uint256 vestingStart, uint256 vestingDur) = gvt.allocations(user1);

        assertEq(allocAmount, amount);
        assertEq(released, 0);
        assertEq(vestingDur, vestingDuration);
    }

    function testCannotSetDuplicateAllocation() public {
        uint256 amount = 100 * 10 ** 18;
        uint256 vestingDuration = 12 * 30 days;

        vm.startPrank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        vm.expectRevert("Allocation already set");
        gvt.setAllocation(user1, amount, vestingDuration);
        vm.stopPrank();
    }

    function testCannotExceedMaxSupply() public {
        uint256 exceedAmount = MAX_SUPPLY + 1;
        uint256 vestingDuration = 12 * 30 days;

        vm.prank(admin);
        vm.expectRevert("Exceeds cap");
        gvt.setAllocation(user1, exceedAmount, vestingDuration);
    }

    function testReleaseVested() public {
        uint256 amount = 100 * 10 ** 18;
        uint256 vestingDuration = 100 days;

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        // Fast forward 50 days (50% vested)
        vm.warp(block.timestamp + 50 days);

        vm.prank(user1);
        gvt.releaseVested();

        uint256 balance = gvt.balanceOf(user1);
        assertApproxEqRel(balance, amount / 2, 0.01e18); // 1% tolerance
    }

    function testFullyVestedRelease() public {
        uint256 amount = 100 * 10 ** 18;
        uint256 vestingDuration = 100 days;

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        // Fast forward past vesting period
        vm.warp(block.timestamp + 101 days);

        vm.prank(user1);
        gvt.releaseVested();

        assertEq(gvt.balanceOf(user1), amount);
    }

    function testCannotReleaseWithoutAllocation() public {
        vm.prank(user1);
        vm.expectRevert("No allocation");
        gvt.releaseVested();
    }

    function testCannotReleaseBeforeVesting() public {
        uint256 amount = 100 * 10 ** 18;
        uint256 vestingDuration = 100 days;

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        // Try to release immediately
        vm.prank(user1);
        vm.expectRevert("Nothing to release");
        gvt.releaseVested();
    }

    function testMinterRoleMinting() public {
        bytes32 minterRole = gvt.MINTER_ROLE();

        vm.prank(admin);
        gvt.grantRole(minterRole, minter);

        uint256 mintAmount = 1000 * 10 ** 18;

        vm.prank(minter);
        gvt.mint(user1, mintAmount);

        assertEq(gvt.balanceOf(user1), mintAmount);
    }

    function testCannotMintWithoutRole() public {
        uint256 mintAmount = 1000 * 10 ** 18;

        vm.prank(user1);
        vm.expectRevert();
        gvt.mint(user1, mintAmount);
    }

    function testCannotMintExceedingMaxSupply() public {
        bytes32 minterRole = gvt.MINTER_ROLE();

        vm.prank(admin);
        gvt.grantRole(minterRole, minter);

        vm.prank(minter);
        vm.expectRevert("Exceeds cap");
        gvt.mint(user1, MAX_SUPPLY + 1);
    }

    function testBurnTokens() public {
        bytes32 minterRole = gvt.MINTER_ROLE();

        vm.prank(admin);
        gvt.grantRole(minterRole, minter);

        uint256 mintAmount = 1000 * 10 ** 18;
        vm.prank(minter);
        gvt.mint(user1, mintAmount);

        vm.prank(user1);
        gvt.burn(500 * 10 ** 18);

        assertEq(gvt.balanceOf(user1), 500 * 10 ** 18);
    }

    function testPauseUnpause() public {
        bytes32 pauserRole = gvt.PAUSER_ROLE();
        bytes32 minterRole = gvt.MINTER_ROLE();

        vm.startPrank(admin);
        gvt.grantRole(minterRole, minter);
        gvt.pause();
        vm.stopPrank();

        // Cannot transfer when paused
        vm.prank(minter);
        vm.expectRevert();
        gvt.mint(user1, 100 * 10 ** 18);

        // Unpause
        vm.prank(admin);
        gvt.unpause();

        // Should work now
        vm.prank(minter);
        gvt.mint(user1, 100 * 10 ** 18);
        assertEq(gvt.balanceOf(user1), 100 * 10 ** 18);
    }

    function testReleasableAmount() public {
        uint256 amount = 100 * 10 ** 18;
        uint256 vestingDuration = 100 days;

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        // At 25% through vesting
        vm.warp(block.timestamp + 25 days);
        uint256 releasable = gvt.releasableAmount(user1);
        assertApproxEqRel(releasable, amount / 4, 0.01e18);

        // At 75% through vesting
        vm.warp(block.timestamp + 50 days);
        releasable = gvt.releasableAmount(user1);
        assertApproxEqRel(releasable, (amount * 3) / 4, 0.01e18);
    }

    function testMultipleVestingReleases() public {
        uint256 amount = 100 * 10 ** 18;
        uint256 vestingDuration = 100 days;

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        // Release at 25%
        vm.warp(block.timestamp + 25 days);
        vm.prank(user1);
        gvt.releaseVested();
        uint256 balance1 = gvt.balanceOf(user1);

        // Release at 75%
        vm.warp(block.timestamp + 50 days);
        vm.prank(user1);
        gvt.releaseVested();
        uint256 balance2 = gvt.balanceOf(user1);

        assertGt(balance2, balance1);
        assertApproxEqRel(balance2, (amount * 3) / 4, 0.01e18);
    }

    function testFuzzSetAllocation(uint256 amount, uint256 vestingDuration) public {
        vm.assume(amount > 0 && amount <= MAX_SUPPLY);
        vm.assume(vestingDuration > 0 && vestingDuration <= 10 * 365 days);

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        (uint256 allocAmount,,, uint256 vestingDur) = gvt.allocations(user1);
        assertEq(allocAmount, amount);
        assertEq(vestingDur, vestingDuration);
    }

    function testFuzzReleaseVested(uint96 amount, uint32 vestingDuration, uint32 timeElapsed) public {
        vm.assume(amount > 0 && amount <= MAX_SUPPLY / 100);
        vm.assume(vestingDuration > 1 days && vestingDuration <= 365 days);
        vm.assume(timeElapsed > 0 && timeElapsed <= vestingDuration);

        // Ensure that at least 1 token will be vested to avoid "Nothing to release" error
        // This happens when (amount * timeElapsed) / vestingDuration >= 1
        vm.assume((uint256(amount) * timeElapsed) / vestingDuration > 0);

        vm.prank(admin);
        gvt.setAllocation(user1, amount, vestingDuration);

        vm.warp(block.timestamp + timeElapsed);

        vm.prank(user1);
        gvt.releaseVested();

        uint256 balance = gvt.balanceOf(user1);
        uint256 expectedVested = (uint256(amount) * timeElapsed) / vestingDuration;

        assertApproxEqRel(balance, expectedVested, 0.02e18); // 2% tolerance
    }
}
