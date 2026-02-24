// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/GVT.sol";
import "../contracts/tokens/rGGP.sol";
import "../contracts/core/BondingCurve.sol";

contract BondingCurveTest is Test {
    GVT public gvt;
    rGGP public rggp;
    BondingCurve public bondingCurve;

    address public admin = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    address public minter = address(4);

    event ConversionInitiated(
        address indexed user, uint256 rggpAmount, uint256 gvtAmount, uint256 vestingDuration, uint256 positionId
    );

    event TokensClaimed(address indexed user, uint256 positionId, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy tokens
        gvt = new GVT(admin);
        rggp = new rGGP(admin);

        // Deploy bonding curve
        bondingCurve = new BondingCurve(address(rggp), address(gvt), admin);

        // Setup roles
        bytes32 minterRole = gvt.MINTER_ROLE();
        gvt.grantRole(minterRole, address(bondingCurve));

        bytes32 rggpMinterRole = rggp.MINTER_ROLE();
        rggp.grantRole(rggpMinterRole, minter);

        vm.stopPrank();

        // Mint rGGP to users for testing
        _mintRGGPToUser(user1, 10000 * 10 ** 18);
        _mintRGGPToUser(user2, 5000 * 10 ** 18);
    }

    function _mintRGGPToUser(address user, uint256 amount) internal {
        bytes32 sourceId = keccak256(abi.encodePacked(user, amount));

        vm.prank(minter);
        rggp.mintFromOutput(
            user,
            amount / 10, // Divide by rate
            rGGP.AssetType.SOLAR,
            sourceId,
            block.timestamp,
            hex"00"
        );
    }

    function testInitialState() public {
        assertEq(address(bondingCurve.rGGP()), address(rggp));
        assertEq(address(bondingCurve.GVT()), address(gvt));

        (uint256 baseRatio, uint256 slope, uint256 discount, uint256 minVesting, uint256 maxVesting) =
            bondingCurve.curveParams();

        assertEq(baseRatio, 10 * 10 ** 18); // 10:1 ratio
        assertEq(slope, 0);
        assertEq(discount, 500); // 5%
        assertEq(minVesting, 7);
        assertEq(maxVesting, 30);
    }

    function testConvert() public {
        uint256 rggpAmount = 1000 * 10 ** 18;
        uint256 vestingDays = 7;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        // Check position created
        assertEq(bondingCurve.getPositionCount(user1), 1);

        // Check rGGP transferred
        uint256 bondingCurveBalance = rggp.balanceOf(address(bondingCurve));
        assertEq(bondingCurveBalance, rggpAmount);
    }

    function testConvertCalculatesGVTCorrectly() public {
        uint256 rggpAmount = 1000 * 10 ** 18;
        uint256 vestingDays = 7;

        uint256 preview = bondingCurve.previewConversion(rggpAmount, vestingDays);

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        (uint256 totalGVT,,,) = bondingCurve.vestingPositions(user1, 0);
        assertEq(totalGVT, preview);
    }

    function testCannotConvertWithInvalidVesting() public {
        uint256 rggpAmount = 1000 * 10 ** 18;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);

        // Too short
        vm.expectRevert("Invalid vesting period");
        bondingCurve.convert(rggpAmount, 6);

        // Too long
        vm.expectRevert("Invalid vesting period");
        bondingCurve.convert(rggpAmount, 31);

        vm.stopPrank();
    }

    function testCannotConvertZeroAmount() public {
        vm.startPrank(user1);
        vm.expectRevert("Amount must be > 0");
        bondingCurve.convert(0, 7);
        vm.stopPrank();
    }

    function testClaimAfterVesting() public {
        uint256 rggpAmount = 1000 * 10 ** 18;
        uint256 vestingDays = 10;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        // Fast forward 5 days (50% vested)
        vm.warp(block.timestamp + 5 days);

        vm.prank(user1);
        bondingCurve.claim(0);

        uint256 gvtBalance = gvt.balanceOf(user1);
        assertGt(gvtBalance, 0);

        (uint256 totalGVT, uint256 claimedGVT,,) = bondingCurve.vestingPositions(user1, 0);
        assertApproxEqRel(claimedGVT, totalGVT / 2, 0.02e18); // 2% tolerance
    }

    function testClaimFullyVested() public {
        uint256 rggpAmount = 1000 * 10 ** 18;
        uint256 vestingDays = 10;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        // Fast forward past vesting period
        vm.warp(block.timestamp + 11 days);

        vm.prank(user1);
        bondingCurve.claim(0);

        (uint256 totalGVT, uint256 claimedGVT,,) = bondingCurve.vestingPositions(user1, 0);
        assertEq(claimedGVT, totalGVT);
    }

    function testCannotClaimBeforeVesting() public {
        uint256 rggpAmount = 1000 * 10 ** 18;
        uint256 vestingDays = 10;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, vestingDays);

        // Try to claim immediately
        vm.expectRevert("Nothing to claim");
        bondingCurve.claim(0);
        vm.stopPrank();
    }

    function testClaimAll() public {
        uint256 rggpAmount = 500 * 10 ** 18;
        uint256 vestingDays = 10;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount * 3);

        // Create 3 positions
        bondingCurve.convert(rggpAmount, vestingDays);
        bondingCurve.convert(rggpAmount, vestingDays);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        // Fast forward 5 days
        vm.warp(block.timestamp + 5 days);

        vm.prank(user1);
        bondingCurve.claimAll();

        uint256 gvtBalance = gvt.balanceOf(user1);
        assertGt(gvtBalance, 0);
    }

    function testGetClaimable() public {
        uint256 rggpAmount = 1000 * 10 ** 18;
        uint256 vestingDays = 10;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        // Initially 0
        uint256 claimable1 = bondingCurve.getClaimable(user1, 0);
        assertEq(claimable1, 0);

        // After 5 days
        vm.warp(block.timestamp + 5 days);
        uint256 claimable2 = bondingCurve.getClaimable(user1, 0);
        assertGt(claimable2, 0);

        // After 10 days (fully vested)
        vm.warp(block.timestamp + 10 days);
        uint256 claimable3 = bondingCurve.getClaimable(user1, 0);
        assertGt(claimable3, claimable2);
    }

    function testGetTotalClaimable() public {
        uint256 rggpAmount = 500 * 10 ** 18;
        uint256 vestingDays = 10;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount * 2);
        bondingCurve.convert(rggpAmount, vestingDays);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        vm.warp(block.timestamp + 5 days);

        uint256 totalClaimable = bondingCurve.getTotalClaimable(user1);
        assertGt(totalClaimable, 0);
    }

    function testPreviewConversion() public {
        uint256 rggpAmount = 1000 * 10 ** 18;
        uint256 vestingDays = 7;

        uint256 preview = bondingCurve.previewConversion(rggpAmount, vestingDays);

        // With 10:1 ratio, 1000 rGGP should give 100 GVT + discount
        uint256 baseGVT = 100 * 10 ** 18;
        assertGe(preview, baseGVT); // Should be at least base amount
        assertLe(preview, baseGVT * 12 / 10); // Should not exceed base + max discount
    }

    function testLongerVestingGivesBetterDiscount() public {
        uint256 rggpAmount = 1000 * 10 ** 18;

        uint256 preview7Days = bondingCurve.previewConversion(rggpAmount, 7);
        uint256 preview30Days = bondingCurve.previewConversion(rggpAmount, 30);

        assertGt(preview30Days, preview7Days);
    }

    function testUpdateCurveParams() public {
        uint256 newRatio = 20 * 10 ** 18; // 20:1
        uint256 newSlope = 1 * 10 ** 15;
        uint256 newDiscount = 1000; // 10%
        uint256 newMinVesting = 14;
        uint256 newMaxVesting = 60;

        vm.prank(admin);
        bondingCurve.updateCurveParams(newRatio, newSlope, newDiscount, newMinVesting, newMaxVesting);

        (uint256 baseRatio, uint256 slope, uint256 discount, uint256 minVesting, uint256 maxVesting) =
            bondingCurve.curveParams();

        assertEq(baseRatio, newRatio);
        assertEq(slope, newSlope);
        assertEq(discount, newDiscount);
        assertEq(minVesting, newMinVesting);
        assertEq(maxVesting, newMaxVesting);
    }

    function testCannotUpdateWithInvalidParams() public {
        vm.startPrank(admin);

        // Invalid ratio
        vm.expectRevert("Invalid base ratio");
        bondingCurve.updateCurveParams(0, 0, 500, 7, 30);

        // Invalid vesting range
        vm.expectRevert("Invalid vesting range");
        bondingCurve.updateCurveParams(10 * 10 ** 18, 0, 500, 30, 7);

        // Discount too high
        vm.expectRevert("Discount too high");
        bondingCurve.updateCurveParams(10 * 10 ** 18, 0, 2500, 7, 30);

        vm.stopPrank();
    }

    function testUpdateEpochConfig() public {
        uint256 newDuration = 180 days;
        uint256 newMaxGVT = 20_000_000 * 10 ** 18;

        vm.prank(admin);
        bondingCurve.updateEpochConfig(newDuration, newMaxGVT);

        (uint256 duration,,, uint256 maxGVT) = bondingCurve.epochConfig();
        assertEq(duration, newDuration);
        assertEq(maxGVT, newMaxGVT);
    }

    function testGetCurrentRatio() public {
        uint256 ratio = bondingCurve.getCurrentRatio();
        assertEq(ratio, 10 * 10 ** 18);
    }

    function testGetRemainingEpochCapacity() public {
        uint256 initialCapacity = bondingCurve.getRemainingEpochCapacity();

        // Make a conversion
        uint256 rggpAmount = 1000 * 10 ** 18;
        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, 7);
        vm.stopPrank();

        uint256 newCapacity = bondingCurve.getRemainingEpochCapacity();
        assertLt(newCapacity, initialCapacity);
    }

    function testCannotExceedEpochCap() public {
        // Set very low epoch cap
        vm.prank(admin);
        bondingCurve.updateEpochConfig(90 days, 10 * 10 ** 18);

        uint256 rggpAmount = 10000 * 10 ** 18; // Large amount

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        vm.expectRevert("Epoch cap exceeded");
        bondingCurve.convert(rggpAmount, 7);
        vm.stopPrank();
    }

    function testUpdateTreasuryCapacity() public {
        uint256 newCapacity = 100_000_000 * 10 ** 18;

        vm.prank(admin);
        bondingCurve.updateTreasuryCapacity(newCapacity);

        assertEq(bondingCurve.treasuryCapacity(), newCapacity);
    }

    function testCannotExceedTreasuryCapacity() public {
        // Set very low treasury capacity
        vm.prank(admin);
        bondingCurve.updateTreasuryCapacity(10 * 10 ** 18);

        uint256 rggpAmount = 10000 * 10 ** 18;

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        vm.expectRevert("Treasury capacity exceeded");
        bondingCurve.convert(rggpAmount, 7);
        vm.stopPrank();
    }

    function testWithdrawRGGP() public {
        // User converts rGGP
        uint256 rggpAmount = 1000 * 10 ** 18;
        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, 7);
        vm.stopPrank();

        // Admin withdraws
        uint256 withdrawAmount = 500 * 10 ** 18;
        vm.prank(admin);
        bondingCurve.withdrawRGGP(admin, withdrawAmount);

        assertEq(rggp.balanceOf(admin), withdrawAmount);
    }

    function testPauseUnpause() public {
        vm.prank(admin);
        bondingCurve.pause();

        uint256 rggpAmount = 1000 * 10 ** 18;
        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        vm.expectRevert();
        bondingCurve.convert(rggpAmount, 7);
        vm.stopPrank();

        // Unpause
        vm.prank(admin);
        bondingCurve.unpause();

        // Should work now
        vm.startPrank(user1);
        bondingCurve.convert(rggpAmount, 7);
        vm.stopPrank();
    }

    function testFuzzConvert(uint96 rggpAmount, uint8 vestingDays) public {
        vm.assume(rggpAmount > 0 && rggpAmount < 5000 * 10 ** 18);
        vm.assume(vestingDays >= 7 && vestingDays <= 30);

        // Ensure user has enough rGGP
        if (rggp.balanceOf(user1) < rggpAmount) {
            _mintRGGPToUser(user1, rggpAmount);
        }

        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, vestingDays);
        vm.stopPrank();

        assertEq(bondingCurve.getPositionCount(user1), 1);
    }

    function testMultipleUsersConvert() public {
        uint256 rggpAmount = 1000 * 10 ** 18;

        // User 1 converts
        vm.startPrank(user1);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, 7);
        vm.stopPrank();

        // User 2 converts
        vm.startPrank(user2);
        rggp.approve(address(bondingCurve), rggpAmount);
        bondingCurve.convert(rggpAmount, 15);
        vm.stopPrank();

        assertEq(bondingCurve.getPositionCount(user1), 1);
        assertEq(bondingCurve.getPositionCount(user2), 1);
    }
}
