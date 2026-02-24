// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/nft/TreePass.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title MockUSDT
 * @dev Mock USDT token for testing
 */
contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {
        _mint(msg.sender, 1000000 * 10 ** 6); // 1M USDT
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title TreePassTest
 * @dev Comprehensive test suite for TreePass contract
 */
contract TreePassTest is Test {
    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST CONTRACTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    TreePass public treePassImpl;
    TreePass public treePass;
    MockUSDT public usdt;
    ERC1967Proxy public proxy;

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST ADDRESSES
    // ════════════════════════════════════════════════════════════════════════════════════════

    address public owner = makeAddr("owner");
    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public nonWhitelisted = makeAddr("nonWhitelisted");
    address public attacker = makeAddr("attacker");

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST CONSTANTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    uint256 public constant WL_PRICE_USDT = 59 * 10 ** 6; // 59 USDT
    uint256 public constant PUBLIC_PRICE_USDT = 59 * 10 ** 6; // 59 USDT
    uint256 public constant MAX_SUPPLY = 300;
    uint256 public constant MAX_PER_WALLET = 2;
    uint256 public constant PUBLIC_ALLOCATION = 200;
    uint256 internal constant WHITELIST_ALLOCATION = 100;

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   ROLE CONSTANTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST VARIABLES
    // ════════════════════════════════════════════════════════════════════════════════════════

    bytes32 public merkleRoot;
    bytes32[] public user1Proof;
    bytes32[] public user2Proof;
    uint256 public wlStartTime;
    uint256 public wlEndTime;

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST EVENTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    event PublicMint(address indexed minter, uint256 quantity, uint256 payment);
    event WhitelistMint(address indexed minter, uint256 quantity, uint256 payment);
    event SaleConfigUpdated(uint256 wlStartTime, uint256 wlEndTime, bool active);
    event WhitelistUpdated(bytes32 newRoot);
    event MetadataFrozened();
    event BaseURIUpdated(string newBaseURI);
    event TreasuryWithdraw(address indexed token, uint256 amount);

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                      SETUP
    // ════════════════════════════════════════════════════════════════════════════════════════

    function setUp() public {
        // Set up time
        wlStartTime = block.timestamp + 1 hours;
        wlEndTime = wlStartTime + 24 hours;

        usdt = new MockUSDT();

        bytes32 leaf1 = keccak256(abi.encodePacked(user1));
        bytes32 leaf2 = keccak256(abi.encodePacked(user2));

        // Sort the leaves to ensure a canonical order
        bytes32 a = leaf1;
        bytes32 b = leaf2;
        if (a > b) {
            bytes32 temp = a;
            a = b;
            b = temp;
        }

        merkleRoot = keccak256(abi.encodePacked(a, b));

        user1Proof.push(leaf2);
        user2Proof.push(leaf1);

        treePassImpl = new TreePass();

        bytes memory initData = abi.encodeCall(
            TreePass.initialize,
            ("TreePass", "TREE", owner, address(usdt), treasury, merkleRoot, wlStartTime, wlEndTime)
        );

        // Deploy proxy
        proxy = new ERC1967Proxy(address(treePassImpl), initData);
        treePass = TreePass(address(proxy));

        // Setup additional roles
        vm.startPrank(owner);
        treePass.grantRole(ADMIN_ROLE, admin);
        vm.stopPrank();

        // Setup test users with USDT
        usdt.mint(user1, 1000 * 10 ** 6); // 1000 USDT
        usdt.mint(user2, 1000 * 10 ** 6);
        usdt.mint(user3, 1000 * 10 ** 6);
        usdt.mint(nonWhitelisted, 1000 * 10 ** 6);

        // Approve spending
        vm.prank(user1);
        usdt.approve(address(treePass), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(treePass), type(uint256).max);
        vm.prank(user3);
        usdt.approve(address(treePass), type(uint256).max);
        vm.prank(nonWhitelisted);
        usdt.approve(address(treePass), type(uint256).max);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              INITIALIZATION TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_Initialize_Success() public view {
        assertEq(treePass.name(), "TreePass");
        assertEq(treePass.symbol(), "TREE");
        assertEq(treePass.owner(), owner);
        assertEq(address(treePass.usdtToken()), address(usdt));
        assertEq(treePass.treasuryReceiver(), treasury);
        assertEq(treePass.whitelistMerkleRoot(), merkleRoot);

        // Check config struct
        (uint64 wlStart, uint64 wlEnd, bool active, bool metadataFrozen, uint256 publicMinted, uint256 whitelistMinted)
        = treePass.config();
        assertEq(wlStart, wlStartTime);
        assertEq(wlEnd, wlEndTime);
        assertTrue(active);
        assertFalse(metadataFrozen);
        assertEq(publicMinted, 0);
        assertEq(whitelistMinted, 0);

        // Check roles
        assertTrue(treePass.hasRole(treePass.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(treePass.hasRole(ADMIN_ROLE, owner));
        assertTrue(treePass.hasRole(ADMIN_ROLE, admin));
        assertTrue(treePass.hasRole(TREASURER_ROLE, treasury));

        // Check initial state
        assertFalse(treePass.paused());
    }

    function test_Initialize_ZeroAddressReverts() public {
        TreePass temporaryImpl = new TreePass();

        bytes memory initDataWithZeroOwner = abi.encodeCall(
            TreePass.initialize,
            (
                "Test",
                "TEST",
                address(0), // Zero owner address
                address(usdt),
                treasury,
                merkleRoot,
                wlStartTime,
                wlEndTime
            )
        );

        vm.expectRevert(abi.encodeWithSignature("OwnableInvalidOwner(address)", address(0)));
        new ERC1967Proxy(address(temporaryImpl), initDataWithZeroOwner);
    }

    function test_Initialize_CannotInitializeTwice() public {
        vm.expectRevert("ERC721A__Initializable: contract is already initialized");
        treePass.initialize("Test", "TEST", owner, address(usdt), treasury, bytes32(0), wlStartTime, wlEndTime);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              WHITELIST MINT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WhitelistMint_Success() public {
        vm.warp(wlStartTime);

        uint256 quantity = 2;
        uint256 expectedPayment = quantity * WL_PRICE_USDT;
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit WhitelistMint(user1, quantity, expectedPayment);

        vm.prank(user1);
        treePass.mint(quantity, user1Proof);

        // Check balances
        assertEq(treePass.balanceOf(user1), quantity);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + expectedPayment);

        // Check config updates
        (,,,,, uint256 whitelistMinted) = treePass.config();
        assertEq(whitelistMinted, quantity);
        assertEq(treePass.numberMinted(user1), quantity);
    }

    function test_WhitelistMint_InvalidProof() public {
        vm.warp(wlStartTime);

        vm.expectRevert("NotWhitelisted");
        vm.prank(nonWhitelisted);
        treePass.mint(1, user1Proof); // Wrong proof
    }

    function test_WhitelistMint_ExceedsWalletLimit() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        treePass.mint(2, user1Proof);

        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        treePass.mint(1, user1Proof);
    }

    function test_WhitelistMint_BeforeStart() public {
        vm.warp(wlStartTime - 1);

        vm.expectRevert("SaleNotStarted");
        vm.prank(user1);
        treePass.mint(1, user1Proof);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                PUBLIC MINT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_PublicMint_Success() public {
        vm.warp(wlEndTime + 1);

        uint256 quantity = 2;
        uint256 expectedPayment = quantity * PUBLIC_PRICE_USDT;

        vm.expectEmit(true, true, true, true);
        emit PublicMint(user3, quantity, expectedPayment);

        vm.prank(user3);
        treePass.mint(quantity, new bytes32[](0)); // No proof needed for public

        assertEq(treePass.balanceOf(user3), quantity);

        (,,,, uint256 publicMinted,) = treePass.config();
        assertEq(publicMinted, quantity);
    }

    function test_PublicMint_NoProofRequired() public {
        vm.warp(wlEndTime + 1);

        vm.prank(nonWhitelisted);
        treePass.mint(1, new bytes32[](0));

        assertEq(treePass.balanceOf(nonWhitelisted), 1);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              SUPPLY LIMIT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_ExceedsMaxSupply_PublicMint() public {
        vm.warp(wlEndTime + 1);

        vm.expectRevert("ExceedsMaxSupply");
        vm.prank(user3);
        treePass.mint(301, new bytes32[](0)); // Exceeds 600 max supply
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              ADMIN FUNCTIONS TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_SetSaleConfig_Success() public {
        uint256 newWlStart = block.timestamp + 2 hours;
        uint256 newWlEnd = newWlStart + 12 hours;

        vm.expectEmit(true, true, true, true);
        emit SaleConfigUpdated(newWlStart, newWlEnd, false);

        vm.prank(admin);
        treePass.setSaleConfig(newWlStart, newWlEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = treePass.config();
        assertEq(wlStart, newWlStart);
        assertEq(wlEnd, newWlEnd);
        assertFalse(active);
    }

    function test_SetWhitelistRoot_Success() public {
        bytes32 newRoot = keccak256("new root");

        vm.expectEmit(true, true, true, true);
        emit WhitelistUpdated(newRoot);

        vm.prank(admin);
        treePass.setWhitelistRoot(newRoot);

        assertEq(treePass.whitelistMerkleRoot(), newRoot);
    }

    function test_SetTreasuryReceiver_Success() public {
        address newTreasury = makeAddr("newTreasury");
        address oldTreasury = treePass.treasuryReceiver();

        vm.prank(owner);
        treePass.setTreasuryReceiver(newTreasury);

        assertEq(treePass.treasuryReceiver(), newTreasury);
        assertFalse(treePass.hasRole(TREASURER_ROLE, oldTreasury));
        assertTrue(treePass.hasRole(TREASURER_ROLE, newTreasury));
    }

    function test_SetRoyaltyInfo_Success() public {
        address royaltyReceiver = makeAddr("royaltyReceiver");
        uint96 royaltyFee = 750; // 7.5%

        vm.prank(admin);
        treePass.setRoyaltyInfo(royaltyReceiver, royaltyFee);

        (address receiver, uint256 amount) = treePass.royaltyInfo(1, 10000);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 750); // 7.5% of 10000
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_GetCurrentPhase() public {
        assertEq(treePass.getCurrentPhase(), "UPCOMING");

        vm.warp(wlStartTime);
        assertEq(treePass.getCurrentPhase(), "WHITELIST");

        vm.warp(wlEndTime + 1);
        assertEq(treePass.getCurrentPhase(), "PUBLIC");

        vm.prank(admin);
        treePass.setSaleConfig(wlStartTime, wlEndTime, false);
        assertEq(treePass.getCurrentPhase(), "INACTIVE");
    }

    function test_GetRemainingSupply() public {
        assertEq(treePass.getRemainingPublicSupply(), 200);
        assertEq(treePass.getRemainingWhitelistSupply(), 100);

        // After whitelist mint
        vm.warp(wlStartTime);
        vm.prank(user1);
        treePass.mint(2, user1Proof);

        assertEq(treePass.getRemainingWhitelistSupply(), 98);

        // After public mint
        vm.warp(wlEndTime + 1);
        vm.prank(user3);
        treePass.mint(2, new bytes32[](0));

        assertEq(treePass.getRemainingPublicSupply(), 198);
    }

    function test_NumberMinted() public view {
        assertEq(treePass.numberMinted(user1), 0);
        assertEq(treePass.numberMinted(user2), 0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                EDGE CASES TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_MintZeroAmount() public {
        vm.warp(wlStartTime);

        vm.expectRevert("InvalidAmount");
        vm.prank(user1);
        treePass.mint(0, user1Proof);
    }

    function test_SaleInactive() public {
        vm.prank(admin);
        treePass.setSaleConfig(wlStartTime, wlEndTime, false);

        vm.warp(wlStartTime);

        vm.expectRevert("SaleNotActive");
        vm.prank(user1);
        treePass.mint(1, user1Proof);
    }

    function test_InsufficientUSDTBalance() public {
        vm.warp(wlStartTime);

        // User1 has 1000 USDT, but we will reduce it to 10
        vm.prank(user1);
        usdt.transfer(user2, 990 * 10 ** 6); // Leave only 10 USDT

        vm.expectRevert();
        vm.prank(user1);
        treePass.mint(1, user1Proof);
    }

    function test_ContractPaused() public {
        vm.prank(admin);
        treePass.pause();

        vm.warp(wlStartTime);

        vm.expectRevert();
        vm.prank(user1);
        treePass.mint(1, user1Proof);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              UPGRADE TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_UpgradeAuthorization() public {
        address newImpl = address(new TreePass());

        vm.expectRevert();
        vm.prank(user1);
        treePass.upgradeToAndCall(newImpl, "");

        // Admin can upgrade
        vm.prank(admin);
        treePass.upgradeToAndCall(newImpl, "");
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              WALLET LIMIT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WalletLimit_ExactMax() public {
        vm.warp(wlStartTime);

        // Mint exactly MAX_PER_WALLET (2)
        vm.prank(user1);
        treePass.mint(2, user1Proof);

        assertEq(treePass.balanceOf(user1), 2);
        assertEq(treePass.numberMinted(user1), 2);

        // Try to mint 1 more - should fail
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        treePass.mint(1, user1Proof);
    }

    function test_WalletLimit_MultipleTransactions() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        treePass.mint(1, user1Proof);

        assertEq(treePass.numberMinted(user1), 1);

        vm.prank(user1);
        treePass.mint(1, user1Proof);

        assertEq(treePass.numberMinted(user1), 2);

        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        treePass.mint(1, user1Proof);
    }

    function test_WalletLimit_CrossPhase() public {
        vm.warp(wlStartTime);
        vm.prank(user1);
        treePass.mint(1, user1Proof);

        assertEq(treePass.numberMinted(user1), 1);

        vm.warp(wlEndTime + 1);
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        treePass.mint(2, new bytes32[](0));

        // But can mint 1 more (total = 2)
        vm.prank(user1);
        treePass.mint(1, new bytes32[](0));

        assertEq(treePass.numberMinted(user1), 2);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              ROLE-BASED ACCESS CONTROL TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_OnlyAdmin_CanSetSaleConfig() public {
        uint256 newStart = block.timestamp + 100;
        uint256 newEnd = newStart + 200;

        vm.expectRevert(); // Regular user cannot set config
        vm.prank(user1);
        treePass.setSaleConfig(newStart, newEnd, false);

        vm.expectRevert(); // Treasury cannot set config
        vm.prank(treasury);
        treePass.setSaleConfig(newStart, newEnd, false);

        // Admin can set config
        vm.prank(admin);
        treePass.setSaleConfig(newStart, newEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = treePass.config();
        assertEq(wlStart, newStart);
        assertEq(wlEnd, newEnd);
        assertFalse(active);
    }

    function test_OnlyOwner_CanSetTreasury() public {
        address newTreasury = makeAddr("newTreasury");

        vm.expectRevert();
        vm.prank(user1);
        treePass.setTreasuryReceiver(newTreasury);

        vm.expectRevert();
        vm.prank(treasury);
        treePass.setTreasuryReceiver(newTreasury);

        // Admin can set treasury
        vm.prank(owner);
        treePass.setTreasuryReceiver(newTreasury);

        assertEq(treePass.treasuryReceiver(), newTreasury);
    }

    function test_OnlyTreasurer_CanWithdraw() public {
        usdt.transfer(address(treePass), 100 * 10 ** 6);

        vm.expectRevert();
        vm.prank(user1);
        treePass.withdrawTreasury(address(usdt));

        // Admin cannot withdraw (only treasurer)
        vm.expectRevert();
        vm.prank(admin);
        treePass.withdrawTreasury(address(usdt));

        // Treasurer can withdraw
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(treasury);
        treePass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + 100 * 10 ** 6);
        assertEq(usdt.balanceOf(address(treePass)), 0);
    }

    function test_OnlyAdmin_CanPauseUnpause() public {
        vm.expectRevert();
        vm.prank(user1);
        treePass.pause();

        vm.expectRevert();
        vm.prank(treasury);
        treePass.pause();

        // Admin can pause
        vm.prank(admin);
        treePass.pause();

        assertTrue(treePass.paused());

        // When paused, minting should fail
        vm.warp(wlStartTime);
        vm.expectRevert();
        vm.prank(user1);
        treePass.mint(1, user1Proof);

        // Admin can unpause
        vm.prank(admin);
        treePass.unpause();

        assertFalse(treePass.paused());

        vm.prank(user1);
        treePass.mint(1, user1Proof);

        assertEq(treePass.balanceOf(user1), 1);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                ROYALTY TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_DefaultRoyalty_SetOnInitialization() public view {
        (address receiver, uint256 royaltyAmount) = treePass.royaltyInfo(1, 10000);

        assertEq(receiver, treasury);
        assertEq(royaltyAmount, 500); // 5% of 10000 = 500
    }

    function test_RoyaltyInfo_DifferentSalePrices() public view {
        uint256 salePrice1 = 1000 * 10 ** 6; // 1000 USDT
        uint256 salePrice2 = 50 * 10 ** 6; // 50 USDT

        (address receiver1, uint256 royalty1) = treePass.royaltyInfo(1, salePrice1);
        (address receiver2, uint256 royalty2) = treePass.royaltyInfo(2, salePrice2);

        assertEq(receiver1, treasury);
        assertEq(receiver2, treasury);
        assertEq(royalty1, salePrice1 * 500 / 10000); // 5%
        assertEq(royalty2, salePrice2 * 500 / 10000); // 5%
    }

    function test_SetRoyaltyInfo_OnlyAdmin() public {
        address newRoyaltyReceiver = makeAddr("royaltyReceiver");
        uint96 newRoyaltyFee = 750; // 7.5%

        vm.expectRevert();
        vm.prank(user1);
        treePass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        vm.expectRevert();
        vm.prank(treasury);
        treePass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        // Admin can set royalty
        vm.prank(admin);
        treePass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        (address receiver, uint256 royaltyAmount) = treePass.royaltyInfo(1, 10000);

        assertEq(receiver, newRoyaltyReceiver);
        assertEq(royaltyAmount, 750); // 7.5% of 10000
    }

    function test_RoyaltyInfo_SupportsInterface() public view {
        // ERC2981 interface ID
        bytes4 ERC2981_INTERFACE_ID = 0x2a55205a;
        assertTrue(treePass.supportsInterface(ERC2981_INTERFACE_ID));

        // AccessControl interface ID
        bytes4 ACCESS_CONTROL_INTERFACE_ID = 0x7965db0b;
        assertTrue(treePass.supportsInterface(ACCESS_CONTROL_INTERFACE_ID));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              TREASURY WITHDRAWAL TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WithdrawTreasury_USDT() public {
        // Send USDT to contract
        uint256 amount = 500 * 10 ** 6; // 500 USDT
        usdt.transfer(address(treePass), amount);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(usdt), amount);

        vm.prank(treasury);
        treePass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + amount);
        assertEq(usdt.balanceOf(address(treePass)), 0);
    }

    function test_WithdrawTreasury_ETH() public {
        uint256 amount = 1 ether;
        vm.deal(address(treePass), amount);

        uint256 treasuryBalanceBefore = treasury.balance;

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(0), amount);

        vm.prank(treasury);
        treePass.withdrawTreasury(address(0));

        assertEq(treasury.balance, treasuryBalanceBefore + amount);
        assertEq(address(treePass).balance, 0);
    }

    function test_WithdrawTreasury_EmptyBalance() public {
        assertEq(usdt.balanceOf(address(treePass)), 0);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(treasury);
        treePass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                METADATA TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_SetBaseURI_OnlyAdmin() public {
        string memory newBaseURI = "https://newapi.example.com/";

        vm.expectRevert();
        vm.prank(user1);
        treePass.setBaseURI(newBaseURI);

        // Admin can set base URI
        vm.expectEmit(true, true, true, true);
        emit BaseURIUpdated(newBaseURI);

        vm.prank(admin);
        treePass.setBaseURI(newBaseURI);
    }

    function test_FreezeMetadata_Permanent() public {
        string memory initialURI = "https://api.example.com/";
        string memory newURI = "https://newapi.example.com/";

        vm.prank(admin);
        treePass.setBaseURI(initialURI);

        // Freeze metadata
        vm.expectEmit(true, true, true, true);
        emit MetadataFrozened();

        vm.prank(admin);
        treePass.freezeMetadata();

        // Check frozen status
        (,,, bool metadataFrozen,,) = treePass.config();
        assertTrue(metadataFrozen);

        vm.expectRevert("MetadataFrozen");
        vm.prank(admin);
        treePass.setBaseURI(newURI);

        vm.expectRevert("MetadataFrozen");
        vm.prank(owner);
        treePass.setBaseURI(newURI);
    }

    function test_BaseURI_TokenURI() public {
        string memory baseURI = "https://api.treepass.com/metadata/";

        vm.prank(admin);
        treePass.setBaseURI(baseURI);

        vm.warp(wlStartTime);
        vm.prank(user1);
        treePass.mint(1, user1Proof);

        // Token ID starts from 1 (due to _startTokenId override)
        uint256 tokenId = 1;

        string memory tokenURI = treePass.tokenURI(tokenId);

        string memory expectedURI = string(abi.encodePacked(baseURI, "1"));

        assertEq(tokenURI, expectedURI);
    }

    function test_BaseURI_MultipleTokens() public {
        string memory baseURI = "https://metadata.example.com/json/";

        // Set base URI
        vm.prank(admin);
        treePass.setBaseURI(baseURI);

        // Mint multiple tokens
        vm.warp(wlStartTime);
        vm.prank(user1);
        treePass.mint(2, user1Proof);

        // Check each token's URI
        for (uint256 i = 1; i <= 2; i++) {
            string memory tokenURI = treePass.tokenURI(i);
            string memory expectedURI = string(abi.encodePacked(baseURI, vm.toString(i)));
            assertEq(tokenURI, expectedURI);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              INTEGRATION TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_CompleteWorkflow() public {
        // 1. Pause contract
        vm.prank(admin);
        treePass.pause();

        // 2. Set metadata
        vm.prank(admin);
        treePass.setBaseURI("https://api.example.com/");

        // 3. Unpause and start sale
        vm.prank(admin);
        treePass.unpause();

        // 5. Whitelist mint
        vm.warp(wlStartTime);
        vm.prank(user1);
        treePass.mint(2, user1Proof);

        // 6. Public mint
        vm.warp(wlEndTime + 1);
        vm.prank(user3);
        treePass.mint(2, new bytes32[](0));

        // 7. Freeze metadata
        vm.prank(admin);
        treePass.freezeMetadata();

        // 8. Verify final state
        assertEq(treePass.totalSupply(), 4);

        // config destructuring - use whitelistMinted instead of reservedMinted
        (,,, bool metadataFrozen, uint256 publicMinted, uint256 whitelistMinted) = treePass.config();
        assertEq(publicMinted, 2); // Only public mint
        assertEq(whitelistMinted, 2); // Only whitelist mint
        assertTrue(metadataFrozen);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              DUPLICATE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════════════

    function test_MultipleMints_SameUser_SameBlock() public {
        vm.warp(wlStartTime);

        // Multiple mints in same block should work (up to limit)
        vm.startPrank(user1);
        treePass.mint(1, user1Proof);
        treePass.mint(1, user1Proof);
        vm.stopPrank();

        assertEq(treePass.numberMinted(user1), 2);
        assertEq(treePass.balanceOf(user1), 2);
    }

    function test_DuplicateProof_DifferentUsers() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        treePass.mint(1, user1Proof);

        vm.expectRevert("NotWhitelisted");
        vm.prank(user2);
        treePass.mint(1, user1Proof);

        // user2 uses correct proof
        vm.prank(user2);
        treePass.mint(1, user2Proof);

        assertEq(treePass.numberMinted(user1), 1);
        assertEq(treePass.numberMinted(user2), 1);
    }
}
