// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/PreGVT.sol";

contract PreGVTTest is Test {
    PreGVT public preGVT;

    address public admin = address(1);
    address public minter = address(2);
    address public user1 = address(3);
    address public user2 = address(4);
    address public capAdmin = address(5);

    uint256 constant ABSOLUTE_CEILING = 250_000_000 * 10 ** 18;
    uint256 constant INITIAL_GLOBAL_CAP = 5_000_000 * 10 ** 18;

    function setUp() public {
        vm.startPrank(admin);
        preGVT = new PreGVT(admin, INITIAL_GLOBAL_CAP);
        preGVT.grantRole(preGVT.MINTER_ROLE(), minter);
        preGVT.grantRole(preGVT.CAP_ADMIN_ROLE(), capAdmin);
        // Create stage 1 with 5M cap
        preGVT.createStage(INITIAL_GLOBAL_CAP);
        vm.stopPrank();
    }

    // ===================== Initial State =====================

    function testInitialState() public view {
        assertEq(preGVT.name(), "Pre Green Value Token");
        assertEq(preGVT.symbol(), "preGVT");
        assertEq(preGVT.decimals(), 18);
        assertEq(preGVT.ABSOLUTE_CEILING(), ABSOLUTE_CEILING);
        assertEq(preGVT.globalCap(), INITIAL_GLOBAL_CAP);
        assertEq(preGVT.totalSupply(), 0);
        assertEq(preGVT.currentStage(), 1);
    }

    // ===================== Minting — Three-Layer Cap =====================

    function testMintRespectsThreeLayerCap() public {
        uint256 amount = 1_000_000 * 10 ** 18; // 1M

        vm.prank(minter);
        preGVT.mint(user1, amount);

        assertEq(preGVT.balanceOf(user1), amount);
        assertEq(preGVT.totalSupply(), amount);

        // Check stage tracking
        (, uint256 minted,) = preGVT.stages(1);
        assertEq(minted, amount);
    }

    function testMintRevertsWhenStageCapExceeded() public {
        uint256 stageCapAmount = INITIAL_GLOBAL_CAP;

        vm.startPrank(minter);
        // Mint up to stage cap
        preGVT.mint(user1, stageCapAmount);

        // One more should fail
        vm.expectRevert(PreGVT.StageCapExceeded.selector);
        preGVT.mint(user2, 1);
        vm.stopPrank();
    }

    function testMintRevertsWhenGlobalCapExceeded() public {
        // Create a stage with cap larger than globalCap
        vm.prank(capAdmin);
        preGVT.createStage(INITIAL_GLOBAL_CAP + 1_000_000 * 10 ** 18);

        // Mint up to globalCap on stage 2
        vm.startPrank(minter);
        preGVT.mint(user1, INITIAL_GLOBAL_CAP);

        // Exceeds global cap
        vm.expectRevert(PreGVT.GlobalCapExceeded.selector);
        preGVT.mint(user2, 1);
        vm.stopPrank();
    }

    function testMintRevertsWhenAbsoluteCeilingExceeded() public {
        // Set globalCap to ABSOLUTE_CEILING
        vm.prank(capAdmin);
        preGVT.setGlobalCap(ABSOLUTE_CEILING);

        // Create a stage with ABSOLUTE_CEILING cap (so stage cap is NOT the binding constraint)
        vm.prank(capAdmin);
        preGVT.createStage(ABSOLUTE_CEILING);

        // Mint ABSOLUTE_CEILING
        vm.prank(minter);
        preGVT.mint(user1, ABSOLUTE_CEILING);

        // Create another stage so stage cap is fresh (not exhausted)
        vm.prank(capAdmin);
        preGVT.createStage(ABSOLUTE_CEILING);

        // Any more should fail at globalCap (== ABSOLUTE_CEILING), which triggers GlobalCapExceeded
        // since globalCap == ABSOLUTE_CEILING, that check fires first
        vm.prank(minter);
        vm.expectRevert(PreGVT.GlobalCapExceeded.selector);
        preGVT.mint(user2, 1);
    }

    function testMintRevertsAmountZero() public {
        vm.prank(minter);
        vm.expectRevert(PreGVT.AmountIsZero.selector);
        preGVT.mint(user1, 0);
    }

    // ===================== Cap Management =====================

    function testSetGlobalCapCannotExceedCeiling() public {
        vm.prank(capAdmin);
        vm.expectRevert(PreGVT.ExceedsAbsoluteCeiling.selector);
        preGVT.setGlobalCap(ABSOLUTE_CEILING + 1);
    }

    function testSetGlobalCapCannotGoBelowSupply() public {
        // Mint some tokens
        vm.prank(minter);
        preGVT.mint(user1, 1_000_000 * 10 ** 18);

        // Try to set cap below current supply
        vm.prank(capAdmin);
        vm.expectRevert(PreGVT.BelowCurrentSupply.selector);
        preGVT.setGlobalCap(500_000 * 10 ** 18);
    }

    function testSetGlobalCapSuccess() public {
        uint256 newCap = 10_000_000 * 10 ** 18;

        vm.prank(capAdmin);
        preGVT.setGlobalCap(newCap);

        assertEq(preGVT.globalCap(), newCap);
    }

    // ===================== Stage Management =====================

    function testStageCreationAndClosure() public {
        vm.startPrank(capAdmin);

        // Create stage 2
        uint256 stageId = preGVT.createStage(2_000_000 * 10 ** 18);
        assertEq(stageId, 2);
        assertEq(preGVT.currentStage(), 2);

        (uint256 cap,, bool active) = preGVT.stages(2);
        assertEq(cap, 2_000_000 * 10 ** 18);
        assertTrue(active);

        // Close stage 2
        preGVT.closeStage(2);
        (,, active) = preGVT.stages(2);
        assertFalse(active);

        vm.stopPrank();
    }

    function testCloseStageRevertsIfNotActive() public {
        // Close stage 1 first
        vm.prank(capAdmin);
        preGVT.closeStage(1);

        // Try to close again
        vm.prank(capAdmin);
        vm.expectRevert(PreGVT.StageNotActive.selector);
        preGVT.closeStage(1);
    }

    function testMintRevertsWhenNoActiveStage() public {
        vm.prank(capAdmin);
        preGVT.closeStage(1);

        vm.prank(minter);
        vm.expectRevert(PreGVT.StageNotActive.selector);
        preGVT.mint(user1, 1000);
    }

    // ===================== Pause =====================

    function testPauseFreezesAllTransfers() public {
        // Mint some tokens
        vm.prank(minter);
        preGVT.mint(user1, 1000 * 10 ** 18);

        // Pause
        vm.prank(admin);
        preGVT.pause();
        assertTrue(preGVT.paused());

        // Minting should fail
        vm.prank(minter);
        vm.expectRevert();
        preGVT.mint(user2, 100 * 10 ** 18);

        // Transfer should fail
        vm.prank(user1);
        vm.expectRevert();
        preGVT.transfer(user2, 50 * 10 ** 18);
    }

    function testUnpauseRestoresTransfers() public {
        vm.prank(minter);
        preGVT.mint(user1, 1000 * 10 ** 18);

        vm.prank(admin);
        preGVT.pause();

        vm.prank(admin);
        preGVT.unpause();

        // Transfer should work again
        vm.prank(user1);
        preGVT.transfer(user2, 100 * 10 ** 18);
        assertEq(preGVT.balanceOf(user2), 100 * 10 ** 18);
    }

    // ===================== Access Control =====================

    function testOnlyMinterCanMint() public {
        vm.prank(user1);
        vm.expectRevert();
        preGVT.mint(user1, 1000);
    }

    function testOnlyCapAdminCanSetGlobalCap() public {
        vm.prank(user1);
        vm.expectRevert();
        preGVT.setGlobalCap(10_000_000 * 10 ** 18);
    }

    function testOnlyCapAdminCanCreateStage() public {
        vm.prank(user1);
        vm.expectRevert();
        preGVT.createStage(1_000_000 * 10 ** 18);
    }

    // ===================== View Helpers =====================

    function testStageRemaining() public {
        vm.prank(minter);
        preGVT.mint(user1, 1_000_000 * 10 ** 18);

        assertEq(preGVT.stageRemaining(), 4_000_000 * 10 ** 18);
    }

    function testGlobalRemaining() public {
        vm.prank(minter);
        preGVT.mint(user1, 2_000_000 * 10 ** 18);

        assertEq(preGVT.globalRemaining(), 3_000_000 * 10 ** 18);
    }

    // ===================== Constructor Edge Cases =====================

    function testConstructorRevertsIfCapExceedsCeiling() public {
        vm.expectRevert(PreGVT.ExceedsAbsoluteCeiling.selector);
        new PreGVT(admin, ABSOLUTE_CEILING + 1);
    }

    // ===================== Fuzz Tests =====================

    function testFuzz_MintNeverExceedsCeiling(uint256 amount) public {
        // Bound: 1 wei to globalCap
        amount = bound(amount, 1, INITIAL_GLOBAL_CAP);

        vm.prank(minter);
        preGVT.mint(user1, amount);

        assertLe(preGVT.totalSupply(), preGVT.globalCap());
        assertLe(preGVT.totalSupply(), ABSOLUTE_CEILING);
    }

    function testFuzz_SetGlobalCapBounded(uint256 newCap) public {
        // Mint 1M first
        vm.prank(minter);
        preGVT.mint(user1, 1_000_000 * 10 ** 18);

        newCap = bound(newCap, preGVT.totalSupply(), ABSOLUTE_CEILING);

        vm.prank(capAdmin);
        preGVT.setGlobalCap(newCap);

        assertEq(preGVT.globalCap(), newCap);
        assertLe(preGVT.totalSupply(), preGVT.globalCap());
    }
}
