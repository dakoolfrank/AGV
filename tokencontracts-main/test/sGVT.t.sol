// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/tokens/sGVT.sol";

contract sGVTTest is Test {
    sGVT public token;

    address public admin = address(1);
    address public registryAddr = address(2);
    address public usdt = address(3);
    address public investor1 = address(4);
    address public investor2 = address(5);
    address public operatorAddr = address(6);
    address public lpAddr = address(7);
    address public routerAddr = address(8);
    address public treasuryAddr = address(9);
    address public nobody = address(10);
    uint256 public constant MAX_SUPPLY = 50_000_000 * 10 ** 18;

    function setUp() public {
        vm.prank(admin);
        token = new sGVT(admin, registryAddr, usdt, 2, MAX_SUPPLY);
    }

    // ===================== Constructor =====================

    function testNameAndSymbol() public view {
        assertEq(token.name(), "sGVT");
        assertEq(token.symbol(), "sGVT");
        assertEq(token.decimals(), 18);
    }

    function testImmutables() public view {
        assertEq(token.registry(), registryAddr);
        assertEq(token.quoteAsset(), usdt);
        assertEq(token.pancakeSwapVersion(), 2);
        assertEq(token.PRICE_USD(), 0.5e18);
        assertEq(token.maxSupply(), MAX_SUPPLY);
    }

    function testAdminIsEligible() public view {
        assertTrue(token.eligibleAddress(admin));
    }

    function testConstructorRevertsInvalidAdmin() public {
        vm.expectRevert("Invalid admin");
        new sGVT(address(0), registryAddr, usdt, 2, MAX_SUPPLY);
    }

    function testConstructorRevertsInvalidRegistry() public {
        vm.expectRevert("Invalid registry");
        new sGVT(admin, address(0), usdt, 2, MAX_SUPPLY);
    }

    function testConstructorRevertsInvalidQuoteAsset() public {
        vm.expectRevert("Invalid quote asset");
        new sGVT(admin, registryAddr, address(0), 2, MAX_SUPPLY);
    }

    function testConstructorRevertsInvalidVersion() public {
        vm.expectRevert("Invalid PancakeSwap version");
        new sGVT(admin, registryAddr, usdt, 1, MAX_SUPPLY);
    }

    function testConstructorAcceptsV3() public {
        sGVT v3 = new sGVT(admin, registryAddr, usdt, 3, MAX_SUPPLY);
        assertEq(v3.pancakeSwapVersion(), 3);
    }

    function testConstructorRevertsZeroMaxSupply() public {
        vm.expectRevert("Invalid max supply");
        new sGVT(admin, registryAddr, usdt, 2, 0);
    }

    // ===================== Eligibility =====================

    function testAdminCanUpdateEligibility() public {
        vm.prank(admin);
        token.updateEligibility(investor1, true, "KYC approved");
        assertTrue(token.eligibleAddress(investor1));
    }

    function testRegistryCanUpdateEligibility() public {
        vm.prank(registryAddr);
        token.updateEligibility(investor1, true, "registry onboard");
        assertTrue(token.eligibleAddress(investor1));
    }

    function testNobodyCannotUpdateEligibility() public {
        vm.prank(nobody);
        vm.expectRevert("Unauthorized: only admin or registry");
        token.updateEligibility(investor1, true, "hack");
    }

    function testBatchUpdateEligibility() public {
        address[] memory accounts = new address[](2);
        accounts[0] = investor1;
        accounts[1] = investor2;

        vm.prank(admin);
        token.batchUpdateEligibility(accounts, true, "batch KYC");

        assertTrue(token.eligibleAddress(investor1));
        assertTrue(token.eligibleAddress(investor2));
    }

    function testRevokeEligibility() public {
        vm.startPrank(admin);
        token.updateEligibility(investor1, true, "KYC");
        token.updateEligibility(investor1, false, "KYC revoked");
        vm.stopPrank();
        assertFalse(token.eligibleAddress(investor1));
    }

    // ===================== Infrastructure Setup =====================

    function testSetLpPair() public {
        vm.prank(admin);
        token.setLpPair(lpAddr);
        assertEq(token.lpPair(), lpAddr);
        assertTrue(token.eligibleAddress(lpAddr));
    }

    function testSetLpPairOnlyOnce() public {
        vm.startPrank(admin);
        token.setLpPair(lpAddr);
        vm.expectRevert("LP pair already set");
        token.setLpPair(address(99));
        vm.stopPrank();
    }

    function testSetPriceOperator() public {
        vm.prank(admin);
        token.setPriceOperator(operatorAddr);
        assertEq(token.priceOperator(), operatorAddr);
        assertTrue(token.eligibleAddress(operatorAddr));
        assertTrue(token.hasRole(token.OPERATOR_ROLE(), operatorAddr));
    }

    function testSetRouter() public {
        vm.prank(admin);
        token.setRouter(routerAddr);
        assertEq(token.router(), routerAddr);
        assertTrue(token.eligibleAddress(routerAddr));
    }

    function testSetTreasury() public {
        vm.prank(admin);
        token.setTreasury(treasuryAddr);
        assertEq(token.treasury(), treasuryAddr);
        assertTrue(token.eligibleAddress(treasuryAddr));
    }

    function testSetInfraOnlyAdmin() public {
        vm.startPrank(nobody);
        vm.expectRevert();
        token.setLpPair(lpAddr);
        vm.expectRevert();
        token.setPriceOperator(operatorAddr);
        vm.expectRevert();
        token.setRouter(routerAddr);
        vm.expectRevert();
        token.setTreasury(treasuryAddr);
        vm.stopPrank();
    }

    // ===================== Finalize =====================

    function _setupInfrastructure() internal {
        vm.startPrank(admin);
        token.setLpPair(lpAddr);
        token.setPriceOperator(operatorAddr);
        token.setRouter(routerAddr);
        token.setTreasury(treasuryAddr);
        vm.stopPrank();
    }

    function testFinalize() public {
        _setupInfrastructure();
        vm.prank(admin);
        token.finalize();
        assertTrue(token.finalized());
        assertTrue(token.isFinalized());
    }

    function testFinalizeRequiresLpPair() public {
        vm.prank(admin);
        vm.expectRevert("LP pair not set");
        token.finalize();
    }

    function testFinalizeRequiresAllInfra() public {
        vm.startPrank(admin);
        token.setLpPair(lpAddr);
        vm.expectRevert("Price operator not set");
        token.finalize();
        vm.stopPrank();
    }

    function testFinalizeOnlyOnce() public {
        _setupInfrastructure();
        vm.startPrank(admin);
        token.finalize();
        vm.expectRevert("Already finalized");
        token.finalize();
        vm.stopPrank();
    }

    function testCannotSetInfraAfterFinalize() public {
        _setupInfrastructure();
        vm.startPrank(admin);
        token.finalize();
        vm.expectRevert("Already finalized");
        token.setRouter(address(99));
        vm.stopPrank();
    }

    // ===================== Mint / Burn =====================

    function testMintWithInvestorId() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.mint(investor1, 1000e18, "INV-001");
        vm.stopPrank();

        assertEq(token.balanceOf(investor1), 1000e18);
        assertTrue(token.eligibleAddress(investor1)); // auto-registered
    }

    function testMintAutoRegistersEligibility() public {
        assertFalse(token.eligibleAddress(investor1));

        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.mint(investor1, 100e18, "INV-001");
        vm.stopPrank();

        assertTrue(token.eligibleAddress(investor1));
    }

    function testBurnWithInvestorId() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.grantRole(token.BURNER_ROLE(), admin);
        token.mint(investor1, 1000e18, "INV-001");
        token.burn(investor1, 500e18, "INV-001");
        vm.stopPrank();

        assertEq(token.balanceOf(investor1), 500e18);
    }

    function testOnlyMinterCanMint() public {
        vm.prank(nobody);
        vm.expectRevert();
        token.mint(investor1, 1000e18, "hack");
    }

    function testMintRevertsExceedsMaxSupply() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.mint(investor1, MAX_SUPPLY, "INV-001");

        vm.expectRevert("Exceeds max supply");
        token.mint(investor2, 1, "INV-002");
        vm.stopPrank();
    }

    function testOnlyBurnerCanBurn() public {
        vm.prank(nobody);
        vm.expectRevert();
        token.burn(investor1, 1000e18, "hack");
    }

    // ===================== Transfers (Pre-Finalize) =====================

    function testPreFinalizeEligibleCanTransfer() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.updateEligibility(investor1, true, "KYC");
        token.updateEligibility(investor2, true, "KYC");
        token.mint(investor1, 1000e18, "INV-001");
        vm.stopPrank();

        vm.prank(investor1);
        token.transfer(investor2, 500e18);
        assertEq(token.balanceOf(investor2), 500e18);
    }

    function testPreFinalizeIneligibleCannotReceive() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.mint(investor1, 1000e18, "INV-001");
        vm.stopPrank();

        // investor1 is eligible (auto-registered by mint), nobody is NOT eligible
        vm.prank(investor1);
        vm.expectRevert("Recipient not eligible");
        token.transfer(nobody, 500e18);
    }

    // ===================== Transfers (Post-Finalize) =====================

    function testPostFinalizeInvestorsCannotTransfer() public {
        _setupInfrastructure();

        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.updateEligibility(investor1, true, "KYC");
        token.updateEligibility(investor2, true, "KYC");
        token.mint(investor1, 1000e18, "INV-001");
        token.finalize();
        vm.stopPrank();

        vm.prank(investor1);
        vm.expectRevert("Transfer not allowed after finalization");
        token.transfer(investor2, 500e18);
    }

    function testPostFinalizeOperatorToLp() public {
        _setupInfrastructure();

        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.mint(operatorAddr, 1000e18, "OP-001");
        token.finalize();
        vm.stopPrank();

        vm.prank(operatorAddr);
        token.transfer(lpAddr, 500e18);
        assertEq(token.balanceOf(lpAddr), 500e18);
    }

    function testPostFinalizeLpToOperator() public {
        _setupInfrastructure();

        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.mint(lpAddr, 1000e18, "LP-001");
        token.finalize();
        vm.stopPrank();

        vm.prank(lpAddr);
        token.transfer(operatorAddr, 500e18);
        assertEq(token.balanceOf(operatorAddr), 500e18);
    }

    function testPostFinalizeRouterMediatedPath() public {
        _setupInfrastructure();

        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.mint(operatorAddr, 1000e18, "OP-001");
        token.finalize();
        vm.stopPrank();

        // operator -> router
        vm.prank(operatorAddr);
        token.transfer(routerAddr, 500e18);
        assertEq(token.balanceOf(routerAddr), 500e18);

        // router -> LP
        vm.prank(routerAddr);
        token.transfer(lpAddr, 500e18);
        assertEq(token.balanceOf(lpAddr), 500e18);
    }

    function testPostFinalizeMintStillWorks() public {
        _setupInfrastructure();

        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.finalize();
        // Mint post-finalize (ongoing onboarding)
        token.mint(investor1, 1000e18, "INV-002");
        vm.stopPrank();

        assertEq(token.balanceOf(investor1), 1000e18);
        assertTrue(token.eligibleAddress(investor1));
    }

    // ===================== Pause =====================

    function testPauseBlocksTransfers() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.updateEligibility(investor1, true, "KYC");
        token.updateEligibility(investor2, true, "KYC");
        token.mint(investor1, 1000e18, "INV-001");
        token.pause();
        vm.stopPrank();

        vm.prank(investor1);
        vm.expectRevert();
        token.transfer(investor2, 500e18);
    }

    function testUnpauseRestoresTransfers() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), admin);
        token.updateEligibility(investor1, true, "KYC");
        token.updateEligibility(investor2, true, "KYC");
        token.mint(investor1, 1000e18, "INV-001");
        token.pause();
        token.unpause();
        vm.stopPrank();

        vm.prank(investor1);
        token.transfer(investor2, 500e18);
        assertEq(token.balanceOf(investor2), 500e18);
    }

    // ===================== RecordSwap =====================

    function testRecordSwapBuy() public {
        _setupInfrastructure();

        vm.prank(operatorAddr);
        token.recordSwap("buy", 1000e18, "0xabc123");
    }

    function testRecordSwapSell() public {
        _setupInfrastructure();

        vm.prank(operatorAddr);
        token.recordSwap("sell", 500e18, "0xdef456");
    }

    function testRecordSwapInvalidDirection() public {
        _setupInfrastructure();

        vm.prank(operatorAddr);
        vm.expectRevert("Invalid direction");
        token.recordSwap("hold", 1000e18, "0xabc123");
    }

    function testRecordSwapOnlyOperator() public {
        vm.prank(nobody);
        vm.expectRevert();
        token.recordSwap("buy", 1000e18, "0xabc123");
    }

    // ===================== View Functions =====================

    function testPriceFunctions() public view {
        assertEq(token.referencePrice(), 0.5e18);
        assertEq(token.priceUSD(), 0.5e18);
        assertEq(token.getPrice(), 0.5e18);
        assertEq(token.latestAnswer(), int256(0.5e18));
        assertTrue(token.hasStaticPrice());
    }

    function testTokenClassification() public view {
        assertEq(token.tokenClassification(), "institutional-accounting-certificate");
    }

    function testGetConfiguration() public {
        _setupInfrastructure();

        (address lp, address op, address rt, address tr, address qa, uint8 ver, bool fin) =
            token.getConfiguration();
        assertEq(lp, lpAddr);
        assertEq(op, operatorAddr);
        assertEq(rt, routerAddr);
        assertEq(tr, treasuryAddr);
        assertEq(qa, usdt);
        assertEq(ver, 2);
        assertFalse(fin);
    }

    function testIsWhitelistedLegacy() public {
        vm.prank(admin);
        token.updateEligibility(investor1, true, "KYC");
        assertTrue(token.isWhitelisted(investor1));
        assertTrue(token.isEligible(investor1));
    }

    // ===================== Access Control =====================

    function testOnlyPauserCanPause() public {
        vm.prank(nobody);
        vm.expectRevert();
        token.pause();
    }

    function testOnlyAdminCanFinalize() public {
        _setupInfrastructure();
        vm.prank(nobody);
        vm.expectRevert();
        token.finalize();
    }
}
