// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/nft/SeedPass.sol";
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
 * @title SeedPassTest
 * @dev Comprehensive test suite for SeedPass contract
 */
contract SeedPassTest is Test {
    // --- Test Contracts ---
    SeedPass public seedPassImpl;
    SeedPass public seedPass;
    MockUSDT public usdt;
    ERC1967Proxy public proxy;

    // --- Test Addresses ---
    address public owner = makeAddr("owner");
    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public nonWhitelisted = makeAddr("nonWhitelisted");
    address public attacker = makeAddr("attacker");

    // --- Test Constants ---
    uint256 public constant PRICE_USDT = 29 * 10 ** 6; // 29 USDT
    uint256 public constant MAX_SUPPLY = 600;
    uint256 public constant MAX_PER_WALLET = 3;
    uint256 public constant WHITELIST_ALLOCATION = 200;
    uint256 public constant PUBLIC_ALLOCATION = 400;

    // --- Role Constants ---
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // bytes32 public constant AGENT_MINTER_ROLE = keccak256("AGENT_MINTER_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    // --- Test Variables ---
    bytes32 public merkleRoot;
    bytes32[] public user1Proof;
    bytes32[] public user2Proof;
    uint256 public wlStartTime;
    uint256 public wlEndTime;

    // --- Events for Testing ---
    event PublicMint(address indexed minter, uint256 quantity, uint256 payment);
    event WhitelistMint(address indexed minter, uint256 quantity, uint256 payment);
    event AgentMint(address indexed agent, address indexed recipient, uint256 quantity);
    event BaseURIUpdated(string newBaseURI);
    event TreasuryWithdraw(address indexed token, uint256 amount);
    event AgentUpdated(address indexed agent, bool authorized);

    function setUp() public {
        // Set up time
        wlStartTime = block.timestamp + 1 hours;
        wlEndTime = wlStartTime + 24 hours;

        // Deploy mock USDT
        usdt = new MockUSDT();

        // Create simple merkle tree for testing
        // user1 and user2 are whitelisted, user3 and nonWhitelisted are not
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

        // Create the Merkle root from the sorted leaves
        merkleRoot = keccak256(abi.encodePacked(a, b));

        // The proof for a leaf is the hash of the other leaf
        user1Proof.push(leaf2);
        user2Proof.push(leaf1);

        seedPassImpl = new SeedPass();

        bytes memory initData = abi.encodeCall(
            SeedPass.initialize,
            ("SeedPass", "SEED", owner, address(usdt), treasury, merkleRoot, wlStartTime, wlEndTime)
        );

        // Deploy proxy
        proxy = new ERC1967Proxy(address(seedPassImpl), initData);
        seedPass = SeedPass(address(proxy));

        // Setup additional roles
        vm.startPrank(owner);
        seedPass.grantRole(ADMIN_ROLE, admin);
        vm.stopPrank();

        // Setup test users with USDT
        usdt.mint(user1, 1000 * 10 ** 6); // 1000 USDT
        usdt.mint(user2, 1000 * 10 ** 6);
        usdt.mint(user3, 1000 * 10 ** 6);
        usdt.mint(nonWhitelisted, 1000 * 10 ** 6);

        // Approve spending
        vm.prank(user1);
        usdt.approve(address(seedPass), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(seedPass), type(uint256).max);
        vm.prank(user3);
        usdt.approve(address(seedPass), type(uint256).max);
        vm.prank(nonWhitelisted);
        usdt.approve(address(seedPass), type(uint256).max);
    }

    // --- Initialization Tests ---

    function test_Initialize() public view {
        assertEq(seedPass.name(), "SeedPass");
        assertEq(seedPass.symbol(), "SEED");
        assertEq(seedPass.owner(), owner);
        assertEq(address(seedPass.usdtToken()), address(usdt));
        assertEq(seedPass.treasuryReceiver(), treasury);
        assertEq(seedPass.whitelistMerkleRoot(), merkleRoot);

        // Updated to use the new config struct
        (uint64 wlStart, uint64 wlEnd, bool active, bool metadataFrozen, uint16 publicMinted, uint16 whitelistMinted) =
            seedPass.config();
        assertEq(wlStart, wlStartTime);
        assertEq(wlEnd, wlEndTime);
        assertTrue(active);
        assertFalse(metadataFrozen);
        assertEq(publicMinted, 0);
        assertEq(whitelistMinted, 0);

        // Check roles
        assertTrue(seedPass.hasRole(seedPass.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(seedPass.hasRole(ADMIN_ROLE, owner));
        assertTrue(seedPass.hasRole(ADMIN_ROLE, admin));
        assertTrue(seedPass.hasRole(TREASURER_ROLE, treasury));

        // Check initial state
        assertFalse(seedPass.paused());
    }

    function test_Initialize_ZeroAddressReverts() public {
        SeedPass temporaryImpl = new SeedPass();

        bytes memory initDataWithZeroOwner = abi.encodeCall(
            SeedPass.initialize,
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

    function test_CannotInitializeTwice() public {
        vm.expectRevert("ERC721A__Initializable: contract is already initialized");
        seedPass.initialize("Test", "TEST", owner, address(usdt), treasury, bytes32(0), wlStartTime, wlEndTime);
    }

    // --- Whitelist Mint Tests ---

    function test_WhitelistMint_Success() public {
        vm.warp(wlStartTime);

        uint256 quantity = 2;
        uint256 expectedPayment = quantity * PRICE_USDT;
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit WhitelistMint(user1, quantity, expectedPayment);

        vm.prank(user1);
        seedPass.mint(quantity, user1Proof);

        // Check balances
        assertEq(seedPass.balanceOf(user1), quantity);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + expectedPayment);

        //  Check whitelistMinted instead of publicMinted during whitelist phase
        (,,,, uint16 publicMinted, uint16 whitelistMinted) = seedPass.config();
        assertEq(whitelistMinted, quantity); // Changed from publicMinted to whitelistMinted
        assertEq(seedPass.numberMinted(user1), quantity);
    }

    function test_WhitelistMint_InvalidProof() public {
        vm.warp(wlStartTime);

        vm.expectRevert("NotWhitelisted");
        vm.prank(nonWhitelisted);
        seedPass.mint(1, user1Proof); // Wrong proof
    }

    function test_WhitelistMint_ExceedsWalletLimit() public {
        vm.warp(wlStartTime);

        // First mint 3 (max)
        vm.prank(user1);
        seedPass.mint(3, user1Proof);

        // Try to mint 1 more
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        seedPass.mint(1, user1Proof);
    }

    function test_WhitelistMint_BeforeStart() public {
        vm.warp(wlStartTime - 1);

        vm.expectRevert("PublicSaleNotStarted");
        vm.prank(user1);
        seedPass.mint(1, user1Proof);
    }

    // --- Public Mint Tests ---

    function test_PublicMint_Success() public {
        // Fast forward to public period
        vm.warp(wlEndTime + 1);

        uint256 quantity = 2;
        uint256 expectedPayment = quantity * PRICE_USDT;

        vm.expectEmit(true, true, true, true);
        emit PublicMint(user3, quantity, expectedPayment);

        vm.prank(user3);
        seedPass.mint(quantity, new bytes32[](0)); // No proof needed for public

        assertEq(seedPass.balanceOf(user3), quantity);

        (,,,, uint16 publicMinted, uint16 whitelistMinted) = seedPass.config();
        assertEq(publicMinted, quantity); // This should be 2
        assertEq(whitelistMinted, 0); // This should still be 0
    }

    function test_PublicMint_NoProofRequired() public {
        vm.warp(wlEndTime + 1);

        vm.prank(nonWhitelisted);
        seedPass.mint(1, new bytes32[](0));

        assertEq(seedPass.balanceOf(nonWhitelisted), 1);
    }

    // --- Supply Limit Tests ---

    function test_ExceedsMaxSupply() public {
        vm.warp(wlEndTime + 1);

        // Try to mint more than total supply
        vm.expectRevert("ExceedsMaxSupply");
        vm.prank(user3);
        seedPass.mint(601, new bytes32[](0)); // Would exceed 600
    }

    // --- Admin Function Tests ---

    function test_SetSaleConfig() public {
        uint256 newWlStart = block.timestamp + 2 hours;
        uint256 newWlEnd = newWlStart + 12 hours;

        vm.prank(owner);
        seedPass.setSaleConfig(newWlStart, newWlEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = seedPass.config();
        assertEq(wlStart, newWlStart);
        assertEq(wlEnd, newWlEnd);
        assertFalse(active);
    }

    function test_SetWhitelistRoot() public {
        bytes32 newRoot = keccak256("new root");

        vm.prank(owner);
        seedPass.setWhitelistRoot(newRoot);

        assertEq(seedPass.whitelistMerkleRoot(), newRoot);
    }

    function test_SetTreasuryReceiver() public {
        address newTreasury = makeAddr("newTreasury");

        vm.prank(owner);
        seedPass.setTreasuryReceiver(newTreasury);

        assertEq(seedPass.treasuryReceiver(), newTreasury);
    }

    function test_SetRoyaltyInfo() public {
        address royaltyReceiver = makeAddr("royaltyReceiver");
        uint96 royaltyFee = 750; // 7.5%

        vm.prank(owner);
        seedPass.setRoyaltyInfo(royaltyReceiver, royaltyFee);

        (address receiver, uint256 amount) = seedPass.royaltyInfo(1, 10000);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 750); // 7.5% of 10000
    }

    function test_SetTreasuryReceiver_UpdatesRole() public {
        address newTreasury = makeAddr("newTreasury");
        address oldTreasury = seedPass.treasuryReceiver();

        vm.prank(owner);
        seedPass.setTreasuryReceiver(newTreasury);

        assertEq(seedPass.treasuryReceiver(), newTreasury);
        assertFalse(seedPass.hasRole(TREASURER_ROLE, oldTreasury));
        assertTrue(seedPass.hasRole(TREASURER_ROLE, newTreasury));
    }

    // --- View Function Tests ---

    function test_GetCurrentPhase() public {
        assertEq(seedPass.getCurrentPhase(), "UPCOMING");

        vm.warp(wlStartTime);
        assertEq(seedPass.getCurrentPhase(), "WHITELIST");

        // During public
        vm.warp(wlEndTime + 1);
        assertEq(seedPass.getCurrentPhase(), "PUBLIC");

        // Inactive
        vm.prank(owner);
        seedPass.setSaleConfig(wlStartTime, wlEndTime, false);
        assertEq(seedPass.getCurrentPhase(), "INACTIVE");
    }

    function test_GetRemainingSupply() public {
        assertEq(seedPass.getRemainingPublicSupply(), 400);
        assertEq(seedPass.getRemainingWhitelistSupply(), 200);

        // After whitelist mint
        vm.warp(wlStartTime);
        vm.prank(user1);
        seedPass.mint(2, user1Proof);

        assertEq(seedPass.getRemainingWhitelistSupply(), 198);

        // After public mint
        vm.warp(wlEndTime + 1);
        vm.prank(user3);
        seedPass.mint(3, new bytes32[](0));

        assertEq(seedPass.getRemainingPublicSupply(), 397);
    }

    // --- Edge Case Tests ---

    function test_MintZeroAmount() public {
        vm.warp(wlStartTime);

        vm.expectRevert("InvalidAmount");
        vm.prank(user1);
        seedPass.mint(0, user1Proof);
    }

    function test_SaleInactive() public {
        vm.prank(owner);
        seedPass.setSaleConfig(wlStartTime, wlEndTime, false);

        vm.warp(wlStartTime);

        vm.expectRevert("SaleNotActive");
        vm.prank(user1);
        seedPass.mint(1, user1Proof);
    }

    function test_InsufficientUSDTBalance() public {
        vm.warp(wlStartTime);

        // User1 has 1000 USDT, but we will reduce it to 10
        vm.prank(user1);
        usdt.transfer(user2, 990 * 10 ** 6); // Leave only 10 USDT

        vm.expectRevert();
        vm.prank(user1);
        seedPass.mint(1, user1Proof);
    }

    // --- Upgrade Tests ---

    function test_UpgradeAuthorization() public {
        address newImpl = address(new SeedPass());

        // Only owner can upgrade
        vm.expectRevert();
        vm.prank(user1);
        seedPass.upgradeToAndCall(newImpl, "");

        // Owner can upgrade
        vm.prank(admin);
        seedPass.upgradeToAndCall(newImpl, "");
    }

    // --- Integration Tests ---

    function test_CompleteWorkflow() public {
        // 1. Pause contract
        vm.prank(admin);
        seedPass.pause();

        // 2. Set metadata
        vm.prank(admin);
        seedPass.setBaseURI("https://api.example.com/");

        // 3. Unpause and start sale
        vm.prank(admin);
        seedPass.unpause();

        // 4. Whitelist mint
        vm.warp(wlStartTime);
        vm.prank(user1);
        seedPass.mint(3, user1Proof);

        vm.prank(user2);
        seedPass.mint(2, user2Proof);

        // 5. Public mint
        vm.warp(wlEndTime + 1);
        vm.prank(user3);
        seedPass.mint(2, new bytes32[](0));

        // 6. Freeze metadata
        vm.prank(admin);
        seedPass.freezeMetadata();

        // 7. Verify final state
        assertEq(seedPass.totalSupply(), 7); // 3 + 2 + 2

        (,,, bool metadataFrozen, uint16 publicMinted, uint16 whitelistMinted) = seedPass.config();
        assertEq(publicMinted, 2);
        assertEq(whitelistMinted, 5); // 3 + 2
        assertTrue(metadataFrozen);
    }

    // --- Wallet Limit Tests ---

    function test_WalletLimit_ExactMax() public {
        vm.warp(wlStartTime);

        // Mint exactly MAX_PER_WALLET (3)
        vm.prank(user1);
        seedPass.mint(3, user1Proof);

        assertEq(seedPass.balanceOf(user1), 3);
        assertEq(seedPass.numberMinted(user1), 3);

        // Try to mint 1 more - should fail
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        seedPass.mint(1, user1Proof);
    }

    function test_WalletLimit_MultipleTransactions() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        seedPass.mint(2, user1Proof);

        assertEq(seedPass.numberMinted(user1), 2);

        vm.prank(user1);
        seedPass.mint(1, user1Proof);

        assertEq(seedPass.numberMinted(user1), 3);

        // Try to mint 1 more (total = 4, should fail)
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        seedPass.mint(1, user1Proof);
    }

    function test_WalletLimit_CrossPhase() public {
        // Mint 2 during whitelist
        vm.warp(wlStartTime);
        vm.prank(user1);
        seedPass.mint(2, user1Proof);

        assertEq(seedPass.numberMinted(user1), 2);

        // Try to mint 2 more during public (total would be 4)
        vm.warp(wlEndTime + 1);
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        seedPass.mint(2, new bytes32[](0));

        // But can mint 1 more (total = 3)
        vm.prank(user1);
        seedPass.mint(1, new bytes32[](0));

        assertEq(seedPass.numberMinted(user1), 3);
    }

    // --- Duplicate Tests ---

    function test_MultipleMints_SameUser_SameBlock() public {
        vm.warp(wlStartTime);

        // Multiple mints in same block should work
        vm.startPrank(user1);
        seedPass.mint(1, user1Proof);
        seedPass.mint(1, user1Proof);
        seedPass.mint(1, user1Proof);
        vm.stopPrank();

        assertEq(seedPass.numberMinted(user1), 3);
        assertEq(seedPass.balanceOf(user1), 3);
    }

    function test_DuplicateProof_DifferentUsers() public {
        vm.warp(wlStartTime);

        // user1 mints with their proof
        vm.prank(user1);
        seedPass.mint(1, user1Proof);

        // user2 tries to use user1's proof - should fail
        vm.expectRevert("NotWhitelisted");
        vm.prank(user2);
        seedPass.mint(1, user1Proof);

        // user2 uses correct proof - should work
        vm.prank(user2);
        seedPass.mint(1, user2Proof);

        assertEq(seedPass.numberMinted(user1), 1);
        assertEq(seedPass.numberMinted(user2), 1);
    }

    // --- Role-Based Access Control Tests ---

    function test_OnlyAdmin_CanSetSaleConfig() public {
        uint256 newStart = block.timestamp + 100;
        uint256 newEnd = newStart + 200;

        vm.expectRevert(); // Regular user cannot set config
        vm.prank(user1);
        seedPass.setSaleConfig(newStart, newEnd, false);

        vm.expectRevert(); // Treasury cannot set config
        vm.prank(treasury);
        seedPass.setSaleConfig(newStart, newEnd, false);

        // Admin can set config
        vm.prank(admin);
        seedPass.setSaleConfig(newStart, newEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = seedPass.config();
        assertEq(wlStart, newStart);
        assertEq(wlEnd, newEnd);
        assertFalse(active);
    }

    function test_OnlyOwner_CanSetTreasury() public {
        address newTreasury = makeAddr("newTreasury");

        vm.expectRevert();
        vm.prank(user1);
        seedPass.setTreasuryReceiver(newTreasury);

        vm.expectRevert();
        vm.prank(treasury);
        seedPass.setTreasuryReceiver(newTreasury);

        // Owner can set treasury
        vm.prank(owner);
        seedPass.setTreasuryReceiver(newTreasury);

        assertEq(seedPass.treasuryReceiver(), newTreasury);
    }

    function test_OnlyTreasurer_CanWithdraw() public {
        // Send some USDT to contract
        usdt.transfer(address(seedPass), 100 * 10 ** 6);

        vm.expectRevert();
        vm.prank(user1);
        seedPass.withdrawTreasury(address(usdt));

        // Admin cannot withdraw (only treasurer)
        vm.expectRevert();
        vm.prank(admin);
        seedPass.withdrawTreasury(address(usdt));

        // Treasurer can withdraw
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(treasury);
        seedPass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + 100 * 10 ** 6);
        assertEq(usdt.balanceOf(address(seedPass)), 0);
    }

    function test_OnlyAdmin_CanPauseUnpause() public {
        vm.expectRevert();
        vm.prank(user1);
        seedPass.pause();

        vm.expectRevert();
        vm.prank(treasury);
        seedPass.pause();

        // Admin can pause
        vm.prank(admin);
        seedPass.pause();

        assertTrue(seedPass.paused());

        // When paused, minting should fail
        vm.warp(wlStartTime);
        vm.expectRevert();
        vm.prank(user1);
        seedPass.mint(1, user1Proof);

        // Admin can unpause
        vm.prank(admin);
        seedPass.unpause();

        assertFalse(seedPass.paused());

        // After unpause, minting should work
        vm.prank(user1);
        seedPass.mint(1, user1Proof);

        assertEq(seedPass.balanceOf(user1), 1);
    }

    // --- Royalty Tests ---

    function test_DefaultRoyalty_SetOnInitialization() public view {
        (address receiver, uint256 royaltyAmount) = seedPass.royaltyInfo(1, 10000);

        assertEq(receiver, treasury);
        assertEq(royaltyAmount, 500); // 5% of 10000 = 500
    }

    function test_RoyaltyInfo_DifferentSalePrices() public view {
        uint256 salePrice1 = 1000 * 10 ** 6; // 1000 USDT
        uint256 salePrice2 = 50 * 10 ** 6; // 50 USDT

        (address receiver1, uint256 royalty1) = seedPass.royaltyInfo(1, salePrice1);
        (address receiver2, uint256 royalty2) = seedPass.royaltyInfo(2, salePrice2);

        assertEq(receiver1, treasury);
        assertEq(receiver2, treasury);
        assertEq(royalty1, salePrice1 * 500 / 10000); // 5%
        assertEq(royalty2, salePrice2 * 500 / 10000); // 5%
    }

    function test_SetRoyaltyInfo_OnlyAdmin() public {
        address newRoyaltyReceiver = makeAddr("royaltyReceiver");
        uint96 newRoyaltyFee = 750; // 7.5%

        // Non-admin cannot set royalty
        vm.expectRevert();
        vm.prank(user1);
        seedPass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        // Treasury cannot set royalty
        vm.expectRevert();
        vm.prank(treasury);
        seedPass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        // Admin can set royalty
        vm.prank(admin);
        seedPass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        (address receiver, uint256 royaltyAmount) = seedPass.royaltyInfo(1, 10000);

        assertEq(receiver, newRoyaltyReceiver);
        assertEq(royaltyAmount, 750); // 7.5% of 10000
    }

    function test_RoyaltyInfo_SupportsInterface() public view {
        // ERC2981 interface ID
        bytes4 ERC2981_INTERFACE_ID = 0x2a55205a;
        assertTrue(seedPass.supportsInterface(ERC2981_INTERFACE_ID));

        // AccessControl interface ID
        bytes4 ACCESS_CONTROL_INTERFACE_ID = 0x7965db0b;
        assertTrue(seedPass.supportsInterface(ACCESS_CONTROL_INTERFACE_ID));
    }

    function test_SupportsInterface_ERC721() public view {
        // ERC165
        assertTrue(seedPass.supportsInterface(0x01ffc9a7), "should support ERC165");
        // ERC721
        assertTrue(seedPass.supportsInterface(0x80ac58cd), "should support ERC721");
        // ERC721Metadata
        assertTrue(seedPass.supportsInterface(0x5b5e139f), "should support ERC721Metadata");
    }

    // --- Treasury Withdrawal Tests ---

    function test_WithdrawTreasury_USDT() public {
        // Send USDT to contract
        uint256 amount = 500 * 10 ** 6; // 500 USDT
        usdt.transfer(address(seedPass), amount);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(usdt), amount);

        vm.prank(treasury);
        seedPass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + amount);
        assertEq(usdt.balanceOf(address(seedPass)), 0);
    }

    function test_WithdrawTreasury_ETH() public {
        uint256 amount = 1 ether;
        vm.deal(address(seedPass), amount);

        uint256 treasuryBalanceBefore = treasury.balance;

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(0), amount);

        vm.prank(treasury);
        seedPass.withdrawTreasury(address(0));

        assertEq(treasury.balance, treasuryBalanceBefore + amount);
        assertEq(address(seedPass).balance, 0);
    }

    function test_WithdrawTreasury_EmptyBalance() public {
        assertEq(usdt.balanceOf(address(seedPass)), 0);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        // Should not revert, but also not emit event
        vm.prank(treasury);
        seedPass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore);
    }

    // --- Metadata Tests ---

    function test_SetBaseURI_OnlyAdmin() public {
        string memory newBaseURI = "https://newapi.example.com/";

        vm.expectRevert();
        vm.prank(user1);
        seedPass.setBaseURI(newBaseURI);

        // Admin can set base URI
        vm.expectEmit(true, true, true, true);
        emit BaseURIUpdated(newBaseURI);

        vm.prank(admin);
        seedPass.setBaseURI(newBaseURI);
    }

    function test_FreezeMetadata_Permanent() public {
        string memory initialURI = "https://api.example.com/";
        string memory newURI = "https://newapi.example.com/";

        vm.prank(admin);
        seedPass.setBaseURI(initialURI);

        // Freeze metadata
        vm.prank(admin);
        seedPass.freezeMetadata();

        // Check frozen status
        (,,, bool metadataFrozen,,) = seedPass.config();
        assertTrue(metadataFrozen);

        vm.expectRevert("MetadataFrozen");
        vm.prank(admin);
        seedPass.setBaseURI(newURI);

        // Even owner cannot change after freeze
        vm.expectRevert("MetadataFrozen");
        vm.prank(owner);
        seedPass.setBaseURI(newURI);
    }

    // Test BaseURI retrieval

    function test_BaseURI_TokenURI() public {
        string memory baseURI = "https://api.seedpass.com/metadata/";

        vm.prank(admin);
        seedPass.setBaseURI(baseURI);

        vm.warp(wlStartTime);
        vm.prank(user1);
        seedPass.mint(1, user1Proof);

        // Token ID starts from 1 (due to _startTokenId override)
        uint256 tokenId = 1;

        string memory tokenURI = seedPass.tokenURI(tokenId);

        string memory expectedURI = string(abi.encodePacked(baseURI, "1"));

        assertEq(tokenURI, expectedURI);
    }

    function test_BaseURI_MultipleTokens() public {
        string memory baseURI = "https://metadata.example.com/json/";

        // Set base URI
        vm.prank(admin);
        seedPass.setBaseURI(baseURI);

        // Mint multiple tokens
        vm.warp(wlStartTime);
        vm.prank(user1);
        seedPass.mint(3, user1Proof);

        // Check each token's URI
        for (uint256 i = 1; i <= 3; i++) {
            string memory tokenURI = seedPass.tokenURI(i);
            string memory expectedURI = string(abi.encodePacked(baseURI, vm.toString(i)));
            assertEq(tokenURI, expectedURI);
        }
    }
}
