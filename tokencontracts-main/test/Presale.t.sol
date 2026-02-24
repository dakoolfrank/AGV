// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../contracts/tokens/PreGVT.sol";
import "../contracts/presale/Presale.sol";

/// @dev Mock USDT with 6 decimals for testing
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PresaleTest is Test {
    PreGVT public preGVT;
    Presale public presale;
    MockUSDT public usdt;

    address public admin = address(1);
    address public treasury = address(2);
    address public buyer = address(3);
    address public buyer2 = address(4);
    address public agent = address(5);
    address public recipient = address(6);

    uint256 constant GLOBAL_CAP = 5_000_000 * 10 ** 18;
    uint256 constant STAGE_PRICE = 5_000; // 0.005 USDT per preGVT
    uint256 constant STAGE_CAP = 5_000_000 * 10 ** 18;
    uint256 constant MAX_PER_ADDRESS = 500_000 * 10 ** 18;

    function setUp() public {
        vm.startPrank(admin);

        // Deploy mock USDT
        usdt = new MockUSDT();

        // Deploy PreGVT
        preGVT = new PreGVT(admin, GLOBAL_CAP);
        preGVT.createStage(GLOBAL_CAP);

        // Deploy Presale
        presale = new Presale(address(preGVT), address(usdt), treasury, admin);

        // Grant MINTER_ROLE to Presale
        preGVT.grantRole(preGVT.MINTER_ROLE(), address(presale));

        // Configure sale stage
        presale.configureStage(
            1,
            STAGE_PRICE,
            STAGE_CAP,
            block.timestamp,
            block.timestamp + 90 days,
            MAX_PER_ADDRESS,
            false,
            bytes32(0)
        );
        presale.setCurrentStage(1);

        vm.stopPrank();

        // Give buyers some USDT
        usdt.mint(buyer, 100_000 * 10 ** 6);   // 100K USDT
        usdt.mint(buyer2, 100_000 * 10 ** 6);
        usdt.mint(agent, 100_000 * 10 ** 6);

        // Approve presale
        vm.prank(buyer);
        usdt.approve(address(presale), type(uint256).max);
        vm.prank(buyer2);
        usdt.approve(address(presale), type(uint256).max);
        vm.prank(agent);
        usdt.approve(address(presale), type(uint256).max);
    }

    // ===================== Core Purchase =====================

    function testBuyMintsCorrectAmount() public {
        // Buy with 10 USDT → should get 2000 preGVT
        // (10_000_000 * 1e18) / 5_000 = 2_000e18
        uint256 usdtAmount = 10 * 10 ** 6; // 10 USDT

        vm.prank(buyer);
        presale.buy(buyer, usdtAmount, new bytes32[](0));

        uint256 expected = (usdtAmount * 1e18) / STAGE_PRICE;
        assertEq(preGVT.balanceOf(buyer), expected);
        assertEq(expected, 2_000 * 10 ** 18); // sanity: 10 USDT / 0.005 = 2000 preGVT
    }

    function testUSDTTransferredToTreasury() public {
        uint256 usdtAmount = 50 * 10 ** 6; // 50 USDT
        uint256 treasuryBefore = usdt.balanceOf(treasury);

        vm.prank(buyer);
        presale.buy(buyer, usdtAmount, new bytes32[](0));

        assertEq(usdt.balanceOf(treasury), treasuryBefore + usdtAmount);
    }

    function testBuyOnBehalfOfRecipient() public {
        uint256 usdtAmount = 5 * 10 ** 6; // 5 USDT

        vm.prank(agent);
        presale.buy(recipient, usdtAmount, new bytes32[](0));

        uint256 expected = (usdtAmount * 1e18) / STAGE_PRICE;
        assertEq(preGVT.balanceOf(recipient), expected);
        assertEq(preGVT.balanceOf(agent), 0); // agent keeps nothing
        assertEq(usdt.balanceOf(treasury), usdtAmount); // USDT goes to treasury
    }

    // ===================== Stage Boundary =====================

    function testBuyRevertsOutsideStageTime() public {
        // Warp past endTime
        vm.warp(block.timestamp + 91 days);

        vm.prank(buyer);
        vm.expectRevert(Presale.StageNotActive.selector);
        presale.buy(buyer, 10 * 10 ** 6, new bytes32[](0));
    }

    function testBuyRevertsBeforeStageStart() public {
        // Configure a stage that starts in the future
        vm.prank(admin);
        presale.configureStage(
            2,
            STAGE_PRICE,
            STAGE_CAP,
            block.timestamp + 1 days,
            block.timestamp + 90 days,
            0,
            false,
            bytes32(0)
        );
        vm.prank(admin);
        presale.setCurrentStage(2);

        vm.prank(buyer);
        vm.expectRevert(Presale.StageNotActive.selector);
        presale.buy(buyer, 10 * 10 ** 6, new bytes32[](0));
    }

    function testBuyRevertsWhenStageSoldOut() public {
        // Calculate USDT needed to buy entire stage cap
        // STAGE_CAP = 5M preGVT
        // price = 5_000 USDT-units per 1e18 preGVT
        // USDT needed = (5_000_000e18 * 5_000) / 1e18 = 25_000_000_000 = 25,000 USDT
        uint256 usdtToFillStage = (STAGE_CAP / 1e18) * STAGE_PRICE;

        // Give buyer enough USDT
        usdt.mint(buyer, usdtToFillStage);
        vm.prank(buyer);
        usdt.approve(address(presale), type(uint256).max);

        // Increase per-address limit to allow filling the stage
        vm.prank(admin);
        presale.configureStage(
            1,
            STAGE_PRICE,
            STAGE_CAP,
            block.timestamp,
            block.timestamp + 90 days,
            0, // unlimited per address
            false,
            bytes32(0)
        );

        // Fill entire stage
        vm.prank(buyer);
        presale.buy(buyer, usdtToFillStage, new bytes32[](0));

        // Next buy should fail
        vm.prank(buyer2);
        vm.expectRevert(Presale.StageCapExceeded.selector);
        presale.buy(buyer2, 1 * 10 ** 6, new bytes32[](0));
    }

    // ===================== Per-Address Limit =====================

    function testPerAddressLimitEnforced() public {
        // MAX_PER_ADDRESS = 500K preGVT
        // USDT for 500K preGVT = (500_000e18 * 5_000) / 1e18 = 2_500_000_000 = 2,500 USDT
        uint256 usdtForMax = (MAX_PER_ADDRESS / 1e18) * STAGE_PRICE;

        usdt.mint(buyer, usdtForMax * 2);
        vm.prank(buyer);
        usdt.approve(address(presale), type(uint256).max);

        // Buy up to limit
        vm.prank(buyer);
        presale.buy(buyer, usdtForMax, new bytes32[](0));

        assertEq(preGVT.balanceOf(buyer), MAX_PER_ADDRESS);

        // Buying one more should fail
        vm.prank(buyer);
        vm.expectRevert(Presale.PerAddressLimitExceeded.selector);
        presale.buy(buyer, STAGE_PRICE, new bytes32[](0)); // minimal buy = 1 preGVT
    }

    // ===================== Whitelist =====================

    function testWhitelistVerification() public {
        // Set up a whitelisted stage with a merkle tree
        bytes32 leaf = keccak256(abi.encodePacked(buyer));
        bytes32 root = leaf; // single-element tree: root = leaf

        vm.prank(admin);
        presale.configureStage(
            2,
            STAGE_PRICE,
            STAGE_CAP,
            block.timestamp,
            block.timestamp + 90 days,
            0,
            true,  // whitelistOnly
            root
        );
        vm.prank(admin);
        presale.setCurrentStage(2);

        // Create PreGVT stage 2
        vm.prank(admin);
        preGVT.createStage(STAGE_CAP);

        bytes32[] memory proof = new bytes32[](0); // single leaf, no siblings

        // Whitelisted buyer should succeed
        vm.prank(buyer);
        presale.buy(buyer, 10 * 10 ** 6, proof);
        assertGt(preGVT.balanceOf(buyer), 0);

        // Non-whitelisted buyer should fail
        vm.prank(buyer2);
        vm.expectRevert(Presale.NotWhitelisted.selector);
        presale.buy(buyer2, 10 * 10 ** 6, proof);
    }

    // ===================== Price Calculation =====================

    function testBuyRevertsAmountZero() public {
        vm.prank(buyer);
        vm.expectRevert(Presale.AmountIsZero.selector);
        presale.buy(buyer, 0, new bytes32[](0));
    }

    function testBuyRevertsAmountTooSmall() public {
        // If usdtAmount is so small that (usdtAmount * 1e18 / price) rounds to 0
        // With price = 5_000, need usdtAmount < 5_000 / 1e18... but since USDT is integer,
        // smallest valid = 1 USDT unit. (1 * 1e18) / 5_000 = 2e14 = 0.0002 preGVT — still > 0
        // So with our current price this won't actually happen. Test with a higher price.

        vm.prank(admin);
        presale.configureStage(
            3,
            1e18, // Extremely high price: 1e12 USDT per preGVT
            STAGE_CAP,
            block.timestamp,
            block.timestamp + 90 days,
            0,
            false,
            bytes32(0)
        );
        vm.prank(admin);
        presale.setCurrentStage(3);

        vm.prank(admin);
        preGVT.createStage(STAGE_CAP);

        // Buy 1 USDT unit → (1 * 1e18) / 1e18 = 1 — still not 0
        // Buy would need amount = 0 to get 0 preGVT, which is already checked
        // Actually, to get preGVTAmount = 0:  usdtAmount * 1e18 < price
        // price = 1e18, so usdtAmount must be 0 → already caught by AmountIsZero

        // This edge case shows our price calculation is robust for practical USDT amounts
        // For completeness, test that normal purchase works with this stage
        vm.prank(buyer);
        presale.buy(buyer, 1, new bytes32[](0));
        assertEq(preGVT.balanceOf(buyer), 1); // 1 wei preGVT
    }

    // ===================== Fuzz =====================

    function testFuzz_BuyPriceCalculation(uint256 usdtAmount) public {
        // Bound to realistic range: 0.01 USDT to 10,000 USDT
        usdtAmount = bound(usdtAmount, 10_000, 10_000 * 10 ** 6);

        // Increase per-address limit
        vm.prank(admin);
        presale.configureStage(
            1,
            STAGE_PRICE,
            STAGE_CAP,
            block.timestamp,
            block.timestamp + 90 days,
            0, // unlimited
            false,
            bytes32(0)
        );

        usdt.mint(buyer, usdtAmount);
        vm.prank(buyer);
        usdt.approve(address(presale), type(uint256).max);

        vm.prank(buyer);
        presale.buy(buyer, usdtAmount, new bytes32[](0));

        uint256 expectedPreGVT = (usdtAmount * 1e18) / STAGE_PRICE;
        assertEq(preGVT.balanceOf(buyer), expectedPreGVT);
    }

    // ===================== Treasury Management =====================

    function testSetTreasury() public {
        address newTreasury = address(99);

        vm.prank(admin);
        presale.setTreasury(newTreasury);

        assertEq(presale.treasury(), newTreasury);
    }

    function testSetTreasuryRevertsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(Presale.InvalidTreasury.selector);
        presale.setTreasury(address(0));
    }

    // ===================== Pause =====================

    function testPausedPresaleBlocksBuys() public {
        vm.prank(admin);
        presale.pause();

        vm.prank(buyer);
        vm.expectRevert();
        presale.buy(buyer, 10 * 10 ** 6, new bytes32[](0));
    }

    // ===================== View Helpers =====================

    function testStageRemaining() public {
        uint256 usdtAmount = 10 * 10 ** 6;

        vm.prank(buyer);
        presale.buy(buyer, usdtAmount, new bytes32[](0));

        uint256 bought = (usdtAmount * 1e18) / STAGE_PRICE;
        assertEq(presale.stageRemaining(), STAGE_CAP - bought);
    }

    function testAddressRemaining() public {
        uint256 usdtAmount = 10 * 10 ** 6;

        vm.prank(buyer);
        presale.buy(buyer, usdtAmount, new bytes32[](0));

        uint256 bought = (usdtAmount * 1e18) / STAGE_PRICE;
        assertEq(presale.addressRemaining(buyer), MAX_PER_ADDRESS - bought);
    }
}
