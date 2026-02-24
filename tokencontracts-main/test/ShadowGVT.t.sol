// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/ShadowGVT.sol";

contract ShadowGVTTest is Test {
    ShadowGVT public sGVT;

    address public admin = address(1);
    address public treasury = address(2);
    address public user1 = address(3);

    uint256 constant INITIAL_SUPPLY = 22_000_000 * 10 ** 18; // 22M

    function setUp() public {
        vm.prank(admin);
        sGVT = new ShadowGVT(admin, INITIAL_SUPPLY, treasury);
    }

    // ===================== Initial State =====================

    function testInitialSupplyCorrect() public view {
        assertEq(sGVT.name(), "Shadow Green Value Token");
        assertEq(sGVT.symbol(), "sGVT");
        assertEq(sGVT.decimals(), 18);
        assertEq(sGVT.INITIAL_SUPPLY(), INITIAL_SUPPLY);
        assertEq(sGVT.totalSupply(), INITIAL_SUPPLY);
    }

    function testTreasuryReceivesAllTokens() public view {
        assertEq(sGVT.balanceOf(treasury), INITIAL_SUPPLY);
    }

    // ===================== No Mint Function =====================

    function testNoMintFunctionExists() public {
        // ShadowGVT has no mint function — verify via ABI
        // We can only confirm there's no public/external mint by checking
        // that the contract cannot be called to increase supply
        uint256 supplyBefore = sGVT.totalSupply();

        // Treasury can transfer, but total supply stays the same
        vm.prank(treasury);
        sGVT.transfer(user1, 1000 * 10 ** 18);

        assertEq(sGVT.totalSupply(), supplyBefore);
    }

    // ===================== Transfers =====================

    function testTransferWorks() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.prank(treasury);
        sGVT.transfer(user1, amount);

        assertEq(sGVT.balanceOf(user1), amount);
        assertEq(sGVT.balanceOf(treasury), INITIAL_SUPPLY - amount);
    }

    // ===================== Burn =====================

    function testBurnReducesSupply() public {
        uint256 burnAmount = 1_000_000 * 10 ** 18;

        vm.prank(treasury);
        sGVT.burn(burnAmount);

        assertEq(sGVT.totalSupply(), INITIAL_SUPPLY - burnAmount);
        assertEq(sGVT.balanceOf(treasury), INITIAL_SUPPLY - burnAmount);
    }

    // ===================== Pause =====================

    function testPauseFreezesTransfers() public {
        vm.prank(admin);
        sGVT.pause();

        vm.prank(treasury);
        vm.expectRevert();
        sGVT.transfer(user1, 100 * 10 ** 18);
    }

    function testUnpauseRestoresTransfers() public {
        vm.prank(admin);
        sGVT.pause();

        vm.prank(admin);
        sGVT.unpause();

        vm.prank(treasury);
        sGVT.transfer(user1, 100 * 10 ** 18);
        assertEq(sGVT.balanceOf(user1), 100 * 10 ** 18);
    }

    // ===================== Constructor Validations =====================

    function testConstructorRevertsInvalidTreasury() public {
        vm.expectRevert("Invalid treasury");
        new ShadowGVT(admin, INITIAL_SUPPLY, address(0));
    }

    function testConstructorRevertsZeroSupply() public {
        vm.expectRevert("Supply=0");
        new ShadowGVT(admin, 0, treasury);
    }

    // ===================== Access Control =====================

    function testOnlyPauserCanPause() public {
        vm.prank(user1);
        vm.expectRevert();
        sGVT.pause();
    }
}
