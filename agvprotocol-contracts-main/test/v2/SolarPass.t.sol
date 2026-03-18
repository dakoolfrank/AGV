// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/nft/SolarPass.sol";
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
 * @title SolarPassTest
 * @dev Comprehensive test suite for SolarPass contract
 */
contract SolarPassTest is Test {
    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST CONTRACTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    SolarPass public solarPassImpl;
    SolarPass public solarPass;
    MockUSDT public usdt;
    ERC1967Proxy public proxy;

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST ADDRESSES
    // ════════════════════════════════════════════════════════════════════════════════════════

    address public owner = makeAddr("owner");
    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public nonWhitelisted = makeAddr("nonWhitelisted");
    address public attacker = makeAddr("attacker");

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST CONSTANTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    uint256 public constant WL_PRICE_USDT = 299 * 10 ** 6; // 299 USDT
    uint256 public constant PUBLIC_PRICE_USDT = 299 * 10 ** 6; // 299 USDT
    uint256 public constant AGENT_PRICE_USDT = 199 * 10 ** 6; // 199 USDT
    uint256 public constant MAX_SUPPLY = 300;
    uint256 public constant MAX_PER_WALLET = 2;
    uint256 public constant PUBLIC_ALLOCATION = 200;
    uint256 public constant RESERVED_ALLOCATION = 100;

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   ROLE CONSTANTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AGENT_MINTER_ROLE = keccak256("AGENT_MINTER_ROLE");
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
    event AgentMint(address indexed agent, address indexed recipient, uint256 quantity);
    event SaleConfigUpdated(uint256 wlStartTime, uint256 wlEndTime, bool active);
    event WhitelistUpdated(bytes32 newRoot);
    event AgentUpdated(address indexed agent, bool authorized);
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

        solarPassImpl = new SolarPass();

        bytes memory initData = abi.encodeCall(
            SolarPass.initialize,
            ("SolarPass", "SOLAR", owner, address(usdt), treasury, merkleRoot, wlStartTime, wlEndTime)
        );

        // Deploy proxy
        proxy = new ERC1967Proxy(address(solarPassImpl), initData);
        solarPass = SolarPass(address(proxy));

        // Setup additional roles
        vm.startPrank(owner);
        solarPass.grantRole(ADMIN_ROLE, admin);
        solarPass.grantAgentRole(agent1);
        solarPass.grantAgentRole(agent2);
        vm.stopPrank();

        // Setup test users with USDT
        usdt.mint(user1, 5000 * 10 ** 6); // 5000 USDT (increased for higher prices)
        usdt.mint(user2, 5000 * 10 ** 6);
        usdt.mint(user3, 5000 * 10 ** 6);
        usdt.mint(nonWhitelisted, 5000 * 10 ** 6);
        usdt.mint(agent1, 50000 * 10 ** 6); // Agent needs more USDT for agent minting
        usdt.mint(agent2, 50000 * 10 ** 6);

        // Approve spending
        vm.prank(user1);
        usdt.approve(address(solarPass), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(solarPass), type(uint256).max);
        vm.prank(user3);
        usdt.approve(address(solarPass), type(uint256).max);
        vm.prank(nonWhitelisted);
        usdt.approve(address(solarPass), type(uint256).max);
        vm.prank(agent1);
        usdt.approve(address(solarPass), type(uint256).max);
        vm.prank(agent2);
        usdt.approve(address(solarPass), type(uint256).max);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              INITIALIZATION TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_Initialize_Success() public view {
        assertEq(solarPass.name(), "SolarPass");
        assertEq(solarPass.symbol(), "SOLAR");
        assertEq(solarPass.owner(), owner);
        assertEq(address(solarPass.usdtToken()), address(usdt));
        assertEq(solarPass.treasuryReceiver(), treasury);
        assertEq(solarPass.whitelistMerkleRoot(), merkleRoot);

        // Check config struct
        (uint64 wlStart, uint64 wlEnd, bool active, bool metadataFrozen, uint256 publicMinted, uint256 reservedMinted) =
            solarPass.config();
        assertEq(wlStart, wlStartTime);
        assertEq(wlEnd, wlEndTime);
        assertTrue(active);
        assertFalse(metadataFrozen);
        assertEq(publicMinted, 0);
        assertEq(reservedMinted, 0);

        // Check roles
        assertTrue(solarPass.hasRole(solarPass.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(solarPass.hasRole(ADMIN_ROLE, owner));
        assertTrue(solarPass.hasRole(ADMIN_ROLE, admin));
        assertTrue(solarPass.hasRole(TREASURER_ROLE, treasury));
        assertTrue(solarPass.hasRole(AGENT_MINTER_ROLE, agent1));

        // Check initial state
        assertFalse(solarPass.paused());
    }

    function test_Initialize_ZeroAddressReverts() public {
        SolarPass temporaryImpl = new SolarPass();

        bytes memory initDataWithZeroOwner = abi.encodeCall(
            SolarPass.initialize,
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
        solarPass.initialize("Test", "TEST", owner, address(usdt), treasury, bytes32(0), wlStartTime, wlEndTime);
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
        solarPass.mint(quantity, user1Proof);

        // Check balances
        assertEq(solarPass.balanceOf(user1), quantity);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + expectedPayment);

        // Check config updates
        (,,,, uint256 publicMinted,) = solarPass.config();
        assertEq(publicMinted, quantity);
        assertEq(solarPass.numberMinted(user1), quantity);
    }

    function test_WhitelistMint_InvalidProof() public {
        vm.warp(wlStartTime);

        vm.expectRevert("NotWhitelisted");
        vm.prank(nonWhitelisted);
        solarPass.mint(1, user1Proof); // Wrong proof
    }

    function test_WhitelistMint_ExceedsWalletLimit() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        solarPass.mint(2, user1Proof);

        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        solarPass.mint(1, user1Proof);
    }

    function test_WhitelistMint_BeforeStart() public {
        vm.warp(wlStartTime - 1);

        vm.expectRevert("SaleNotStarted");
        vm.prank(user1);
        solarPass.mint(1, user1Proof);
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
        solarPass.mint(quantity, new bytes32[](0)); // No proof needed for public

        assertEq(solarPass.balanceOf(user3), quantity);

        (,,,, uint256 publicMinted,) = solarPass.config();
        assertEq(publicMinted, quantity);
    }

    function test_PublicMint_NoProofRequired() public {
        vm.warp(wlEndTime + 1);

        vm.prank(nonWhitelisted);
        solarPass.mint(1, new bytes32[](0));

        assertEq(solarPass.balanceOf(nonWhitelisted), 1);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                AGENT MINT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_AgentMint_Success() public {
        address[] memory recipients = new address[](2);
        uint256[] memory quantities = new uint256[](2);

        recipients[0] = user1;
        recipients[1] = user2;
        quantities[0] = 5;
        quantities[1] = 3;

        uint256 totalPayment = (5 + 3) * AGENT_PRICE_USDT;
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit AgentMint(agent1, user1, 5);
        vm.expectEmit(true, true, true, true);
        emit AgentMint(agent1, user2, 3);

        vm.prank(agent1);
        solarPass.agentMint(recipients, quantities);

        assertEq(solarPass.balanceOf(user1), 5);
        assertEq(solarPass.balanceOf(user2), 3);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + totalPayment);

        (,,,,, uint256 reservedMinted) = solarPass.config();
        assertEq(reservedMinted, 8);
    }

    function test_AgentMint_OnlyAgent() public {
        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user1;
        quantities[0] = 1;

        vm.expectRevert();
        vm.prank(user1);
        solarPass.agentMint(recipients, quantities);
    }

    function test_AgentMint_ExceedsReservedAllocation() public {
        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user1;
        quantities[0] = 101; // Exceeds 1000 reserved

        vm.expectRevert("ExceedsReservedAllocation");
        vm.prank(agent1);
        solarPass.agentMint(recipients, quantities);
    }

    function test_AgentMint_InvalidConfiguration() public {
        address[] memory recipients = new address[](2);
        uint256[] memory quantities = new uint256[](1); // Mismatched lengths

        vm.expectRevert("InvalidConfiguration");
        vm.prank(agent1);
        solarPass.agentMint(recipients, quantities);
    }

    function test_AgentMint_AgentPaysForMinting() public {
        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user1;
        quantities[0] = 10;

        uint256 expectedPayment = 10 * AGENT_PRICE_USDT;
        uint256 agentBalanceBefore = usdt.balanceOf(agent1);
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(agent1);
        solarPass.agentMint(recipients, quantities);

        assertEq(usdt.balanceOf(agent1), agentBalanceBefore - expectedPayment);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + expectedPayment);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              SUPPLY LIMIT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_ExceedsMaxSupply_PublicMint() public {
        vm.warp(wlEndTime + 1);

        vm.expectRevert("ExceedsMaxSupply");
        vm.prank(user3);
        solarPass.mint(1501, new bytes32[](0)); // Exceeds 1500 max supply
    }

    function test_ExceedsMaxSupply_AgentMint() public {
        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user1;
        quantities[0] = 1501; // Exceeds 1500 max supply

        vm.expectRevert("ExceedsMaxSupply");
        vm.prank(agent1);
        solarPass.agentMint(recipients, quantities);
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
        solarPass.setSaleConfig(newWlStart, newWlEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = solarPass.config();
        assertEq(wlStart, newWlStart);
        assertEq(wlEnd, newWlEnd);
        assertFalse(active);
    }

    function test_SetWhitelistRoot_Success() public {
        bytes32 newRoot = keccak256("new root");

        vm.expectEmit(true, true, true, true);
        emit WhitelistUpdated(newRoot);

        vm.prank(admin);
        solarPass.setWhitelistRoot(newRoot);

        assertEq(solarPass.whitelistMerkleRoot(), newRoot);
    }

    function test_SetTreasuryReceiver_Success() public {
        address newTreasury = makeAddr("newTreasury");
        address oldTreasury = solarPass.treasuryReceiver();

        vm.prank(owner);
        solarPass.setTreasuryReceiver(newTreasury);

        assertEq(solarPass.treasuryReceiver(), newTreasury);
        assertFalse(solarPass.hasRole(TREASURER_ROLE, oldTreasury));
        assertTrue(solarPass.hasRole(TREASURER_ROLE, newTreasury));
    }

    function test_SetRoyaltyInfo_Success() public {
        address royaltyReceiver = makeAddr("royaltyReceiver");
        uint96 royaltyFee = 500; // 5%

        vm.prank(admin);
        solarPass.setRoyaltyInfo(royaltyReceiver, royaltyFee);

        (address receiver, uint256 amount) = solarPass.royaltyInfo(1, 10000);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 500); // 5% of 10000
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                            ROLE MANAGEMENT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_GrantAgentRole_Success() public {
        address newAgent = makeAddr("newAgent");

        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(newAgent, true);

        vm.prank(admin);
        solarPass.grantAgentRole(newAgent);

        assertTrue(solarPass.hasRole(AGENT_MINTER_ROLE, newAgent));
    }

    function test_RevokeAgentRole_Success() public {
        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(agent1, false);

        vm.prank(admin);
        solarPass.revokeAgentRole(agent1);

        assertFalse(solarPass.hasRole(AGENT_MINTER_ROLE, agent1));
    }

    function test_GrantAgentRole_ZeroAddressReverts() public {
        vm.expectRevert("ZeroAddress");
        vm.prank(admin);
        solarPass.grantAgentRole(address(0));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_GetCurrentPhase() public {
        assertEq(solarPass.getCurrentPhase(), "UPCOMING");

        vm.warp(wlStartTime);
        assertEq(solarPass.getCurrentPhase(), "WHITELIST");

        vm.warp(wlEndTime + 1);
        assertEq(solarPass.getCurrentPhase(), "PUBLIC");

        vm.prank(admin);
        solarPass.setSaleConfig(wlStartTime, wlEndTime, false);
        assertEq(solarPass.getCurrentPhase(), "INACTIVE");
    }

    function test_GetRemainingSupply() public {
        assertEq(solarPass.getRemainingPublicSupply(), 200);
        assertEq(solarPass.getRemainingReservedSupply(), 100);

        // After some mints
        vm.warp(wlEndTime + 1);
        vm.prank(user1);
        solarPass.mint(2, new bytes32[](0));

        assertEq(solarPass.getRemainingPublicSupply(), 198);

        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user2;
        quantities[0] = 10;

        vm.prank(agent1);
        solarPass.agentMint(recipients, quantities);

        assertEq(solarPass.getRemainingReservedSupply(), 90);
    }

    function test_NumberMinted() public view {
        assertEq(solarPass.numberMinted(user1), 0);
        assertEq(solarPass.numberMinted(user2), 0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                EDGE CASES TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_MintZeroAmount() public {
        vm.warp(wlStartTime);

        vm.expectRevert("InvalidAmount");
        vm.prank(user1);
        solarPass.mint(0, user1Proof);
    }

    function test_SaleInactive() public {
        vm.prank(admin);
        solarPass.setSaleConfig(wlStartTime, wlEndTime, false);

        vm.warp(wlStartTime);

        vm.expectRevert("SaleNotActive");
        vm.prank(user1);
        solarPass.mint(1, user1Proof);
    }

    function test_InsufficientUSDTBalance() public {
        vm.warp(wlStartTime);

        // User1 has 5000 USDT, but we will reduce it to 100
        vm.prank(user1);
        usdt.transfer(user2, 4900 * 10 ** 6); // Leave only 100 USDT

        vm.expectRevert();
        vm.prank(user1);
        solarPass.mint(1, user1Proof); // Costs 179 USDT but only has 100
    }

    function test_ContractPaused() public {
        vm.prank(admin);
        solarPass.pause();

        vm.warp(wlStartTime);

        vm.expectRevert();
        vm.prank(user1);
        solarPass.mint(1, user1Proof);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              UPGRADE TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_UpgradeAuthorization() public {
        address newImpl = address(new SolarPass());

        vm.expectRevert();
        vm.prank(user1);
        solarPass.upgradeToAndCall(newImpl, "");

        // Admin can upgrade
        vm.prank(admin);
        solarPass.upgradeToAndCall(newImpl, "");
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              WALLET LIMIT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WalletLimit_ExactMax() public {
        vm.warp(wlStartTime);

        // Mint exactly MAX_PER_WALLET (2)
        vm.prank(user1);
        solarPass.mint(2, user1Proof);

        assertEq(solarPass.balanceOf(user1), 2);
        assertEq(solarPass.numberMinted(user1), 2);

        // Try to mint 1 more - should fail
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        solarPass.mint(1, user1Proof);
    }

    function test_WalletLimit_MultipleTransactions() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        solarPass.mint(1, user1Proof);

        assertEq(solarPass.numberMinted(user1), 1);

        vm.prank(user1);
        solarPass.mint(1, user1Proof);

        assertEq(solarPass.numberMinted(user1), 2);

        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        solarPass.mint(1, user1Proof);
    }

    function test_WalletLimit_CrossPhase() public {
        vm.warp(wlStartTime);
        vm.prank(user1);
        solarPass.mint(1, user1Proof);

        assertEq(solarPass.numberMinted(user1), 1);

        vm.warp(wlEndTime + 1);
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        solarPass.mint(2, new bytes32[](0));

        // But can mint 1 more (total = 2)
        vm.prank(user1);
        solarPass.mint(1, new bytes32[](0));

        assertEq(solarPass.numberMinted(user1), 2);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              ROLE-BASED ACCESS CONTROL TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_OnlyAdmin_CanSetSaleConfig() public {
        uint256 newStart = block.timestamp + 100;
        uint256 newEnd = newStart + 200;

        // Regular user cannot set config
        vm.expectRevert();
        vm.prank(user1);
        solarPass.setSaleConfig(newStart, newEnd, false);

        // Agent cannot set config
        vm.expectRevert();
        vm.prank(agent1);
        solarPass.setSaleConfig(newStart, newEnd, false);

        // Treasury cannot set config
        vm.expectRevert();
        vm.prank(treasury);
        solarPass.setSaleConfig(newStart, newEnd, false);

        // Admin can set config
        vm.expectEmit(true, true, true, true);
        emit SaleConfigUpdated(newStart, newEnd, false);

        vm.prank(admin);
        solarPass.setSaleConfig(newStart, newEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = solarPass.config();
        assertEq(wlStart, newStart);
        assertEq(wlEnd, newEnd);
        assertFalse(active);

        // Owner can also set config (has ADMIN_ROLE)
        vm.prank(owner);
        solarPass.setSaleConfig(newStart + 100, newEnd + 100, true);

        (wlStart, wlEnd, active,,,) = solarPass.config();
        assertEq(wlStart, newStart + 100);
        assertEq(wlEnd, newEnd + 100);
        assertTrue(active);
    }

    function test_OnlyAdmin_CanManageAgents() public {
        address newAgent = makeAddr("newAgent");

        // Regular user cannot grant agent role
        vm.expectRevert();
        vm.prank(user1);
        solarPass.grantAgentRole(newAgent);

        // Existing agent cannot grant agent role to others
        vm.expectRevert();
        vm.prank(agent1);
        solarPass.grantAgentRole(newAgent);

        // Treasury cannot grant agent role
        vm.expectRevert();
        vm.prank(treasury);
        solarPass.grantAgentRole(newAgent);

        // Admin can grant agent role
        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(newAgent, true);

        vm.prank(admin);
        solarPass.grantAgentRole(newAgent);

        assertTrue(solarPass.hasRole(AGENT_MINTER_ROLE, newAgent));

        // Regular user cannot revoke agent role
        vm.expectRevert();
        vm.prank(user1);
        solarPass.revokeAgentRole(newAgent);

        // Agent cannot revoke other agent's role
        vm.expectRevert();
        vm.prank(agent1);
        solarPass.revokeAgentRole(newAgent);

        // Admin can revoke agent role
        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(newAgent, false);

        vm.prank(admin);
        solarPass.revokeAgentRole(newAgent);

        assertFalse(solarPass.hasRole(AGENT_MINTER_ROLE, newAgent));

        // Owner can also manage agents
        vm.prank(owner);
        solarPass.grantAgentRole(newAgent);
        assertTrue(solarPass.hasRole(AGENT_MINTER_ROLE, newAgent));
    }

    function test_OnlyOwner_CanSetTreasuryReceiver() public {
        address newTreasury = makeAddr("newTreasury");

        // Regular user cannot set treasury
        vm.expectRevert();
        vm.prank(user1);
        solarPass.setTreasuryReceiver(newTreasury);

        // Current treasury cannot set new treasury
        vm.expectRevert();
        vm.prank(treasury);
        solarPass.setTreasuryReceiver(newTreasury);

        // Agent cannot set treasury
        vm.expectRevert();
        vm.prank(agent1);
        solarPass.setTreasuryReceiver(newTreasury);

        // Owner can set treasury
        vm.prank(owner);
        solarPass.setTreasuryReceiver(newTreasury);

        assertEq(solarPass.treasuryReceiver(), newTreasury);
        assertFalse(solarPass.hasRole(TREASURER_ROLE, treasury));
        assertTrue(solarPass.hasRole(TREASURER_ROLE, newTreasury));

        // Owner can also set treasury
        address anotherTreasury = makeAddr("anotherTreasury");
        vm.prank(owner);
        solarPass.setTreasuryReceiver(anotherTreasury);

        assertEq(solarPass.treasuryReceiver(), anotherTreasury);
        assertTrue(solarPass.hasRole(TREASURER_ROLE, anotherTreasury));
    }

    function test_OnlyTreasurer_CanWithdraw() public {
        // Send USDT to contract
        usdt.transfer(address(solarPass), 100 * 10 ** 6);

        // Regular user cannot withdraw
        vm.expectRevert();
        vm.prank(user1);
        solarPass.withdrawTreasury(address(usdt));

        // Admin cannot withdraw (only treasurer)
        vm.expectRevert();
        vm.prank(admin);
        solarPass.withdrawTreasury(address(usdt));

        // Owner cannot withdraw (only treasurer)
        vm.expectRevert();
        vm.prank(owner);
        solarPass.withdrawTreasury(address(usdt));

        // Agent cannot withdraw
        vm.expectRevert();
        vm.prank(agent1);
        solarPass.withdrawTreasury(address(usdt));

        // Treasurer can withdraw
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(usdt), 100 * 10 ** 6);

        vm.prank(treasury);
        solarPass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + 100 * 10 ** 6);
        assertEq(usdt.balanceOf(address(solarPass)), 0);
    }

    function test_OnlyAdmin_CanPauseUnpause() public {
        // Regular user cannot pause
        vm.expectRevert();
        vm.prank(user1);
        solarPass.pause();

        // Treasury cannot pause
        vm.expectRevert();
        vm.prank(treasury);
        solarPass.pause();

        // Agent cannot pause
        vm.expectRevert();
        vm.prank(agent1);
        solarPass.pause();

        // Admin can pause
        vm.prank(admin);
        solarPass.pause();

        assertTrue(solarPass.paused());

        // When paused, minting should fail
        vm.warp(wlStartTime);
        vm.expectRevert();
        vm.prank(user1);
        solarPass.mint(1, user1Proof);

        // Agent minting should also fail when paused
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = user1;
        amounts[0] = 1;

        vm.expectRevert();
        vm.prank(agent1);
        solarPass.agentMint(recipients, amounts);

        // Regular user cannot unpause
        vm.expectRevert();
        vm.prank(user1);
        solarPass.unpause();

        // Treasury cannot unpause
        vm.expectRevert();
        vm.prank(treasury);
        solarPass.unpause();

        // Admin can unpause
        vm.prank(admin);
        solarPass.unpause();

        assertFalse(solarPass.paused());

        // After unpause, minting should work
        vm.prank(user1);
        solarPass.mint(1, user1Proof);

        assertEq(solarPass.balanceOf(user1), 1);

        // Owner can also pause/unpause
        vm.prank(owner);
        solarPass.pause();
        assertTrue(solarPass.paused());

        vm.prank(owner);
        solarPass.unpause();
        assertFalse(solarPass.paused());
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                ROYALTY TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_DefaultRoyalty_SetOnInitialization() public view {
        (address receiver, uint256 royaltyAmount) = solarPass.royaltyInfo(1, 10000);

        assertEq(receiver, treasury);
        assertEq(royaltyAmount, 300); // 3% of 10000 = 300
    }

    function test_RoyaltyInfo_DifferentSalePrices() public view {
        uint256 salePrice1 = 1000 * 10 ** 6; // 1000 USDT
        uint256 salePrice2 = 50 * 10 ** 6; // 50 USDT

        (address receiver1, uint256 royalty1) = solarPass.royaltyInfo(1, salePrice1);
        (address receiver2, uint256 royalty2) = solarPass.royaltyInfo(2, salePrice2);

        assertEq(receiver1, treasury);
        assertEq(receiver2, treasury);
        assertEq(royalty1, salePrice1 * 300 / 10000); // 3%
        assertEq(royalty2, salePrice2 * 300 / 10000); // 3%
    }

    function test_SetRoyaltyInfo_OnlyAdmin() public {
        address newRoyaltyReceiver = makeAddr("royaltyReceiver");
        uint96 newRoyaltyFee = 750; // 7.5%

        vm.expectRevert();
        vm.prank(user1);
        solarPass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        vm.expectRevert();
        vm.prank(treasury);
        solarPass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        // Admin can set royalty
        vm.prank(admin);
        solarPass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        (address receiver, uint256 royaltyAmount) = solarPass.royaltyInfo(1, 10000);

        assertEq(receiver, newRoyaltyReceiver);
        assertEq(royaltyAmount, 750); // 7.5% of 10000
    }

    function test_RoyaltyInfo_SupportsInterface() public view {
        // ERC2981 interface ID
        bytes4 ERC2981_INTERFACE_ID = 0x2a55205a;
        assertTrue(solarPass.supportsInterface(ERC2981_INTERFACE_ID));

        // AccessControl interface ID
        bytes4 ACCESS_CONTROL_INTERFACE_ID = 0x7965db0b;
        assertTrue(solarPass.supportsInterface(ACCESS_CONTROL_INTERFACE_ID));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              TREASURY WITHDRAWAL TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WithdrawTreasury_USDT() public {
        // Send USDT to contract
        uint256 amount = 500 * 10 ** 6; // 500 USDT
        usdt.transfer(address(solarPass), amount);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(usdt), amount);

        vm.prank(treasury);
        solarPass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + amount);
        assertEq(usdt.balanceOf(address(solarPass)), 0);
    }

    function test_WithdrawTreasury_ETH() public {
        uint256 amount = 1 ether;
        vm.deal(address(solarPass), amount);

        uint256 treasuryBalanceBefore = treasury.balance;

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(0), amount);

        vm.prank(treasury);
        solarPass.withdrawTreasury(address(0));

        assertEq(treasury.balance, treasuryBalanceBefore + amount);
        assertEq(address(solarPass).balance, 0);
    }

    function test_WithdrawTreasury_EmptyBalance() public {
        assertEq(usdt.balanceOf(address(solarPass)), 0);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(treasury);
        solarPass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore);
    }

    function test_WithdrawTreasury_AfterTreasuryChange() public {
        // Send funds to contract
        uint256 amount = 200 * 10 ** 6;
        usdt.transfer(address(solarPass), amount);

        // Owner Change treasury
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        solarPass.setTreasuryReceiver(newTreasury);

        // Old treasury cannot withdraw
        vm.expectRevert();
        vm.prank(treasury);
        solarPass.withdrawTreasury(address(usdt));

        // New treasury can withdraw
        uint256 newTreasuryBalanceBefore = usdt.balanceOf(newTreasury);

        vm.prank(newTreasury);
        solarPass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(newTreasury), newTreasuryBalanceBefore + amount);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                METADATA TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_SetBaseURI_OnlyAdmin() public {
        string memory newBaseURI = "https://newapi.example.com/";

        vm.expectRevert();
        vm.prank(user1);
        solarPass.setBaseURI(newBaseURI);

        // Admin can set base URI
        vm.expectEmit(true, true, true, true);
        emit BaseURIUpdated(newBaseURI);

        vm.prank(admin);
        solarPass.setBaseURI(newBaseURI);
    }

    function test_FreezeMetadata_Permanent() public {
        string memory initialURI = "https://api.example.com/";
        string memory newURI = "https://newapi.example.com/";

        vm.prank(admin);
        solarPass.setBaseURI(initialURI);

        // Freeze metadata
        vm.expectEmit(true, true, true, true);
        emit MetadataFrozened();

        vm.prank(admin);
        solarPass.freezeMetadata();

        // Check frozen status
        (,,, bool metadataFrozen,,) = solarPass.config();
        assertTrue(metadataFrozen);

        vm.expectRevert("MetadataFrozen");
        vm.prank(admin);
        solarPass.setBaseURI(newURI);

        vm.expectRevert("MetadataFrozen");
        vm.prank(owner);
        solarPass.setBaseURI(newURI);
    }

    function test_BaseURI_TokenURI() public {
        string memory baseURI = "https://api.solarpass.com/metadata/";

        vm.prank(admin);
        solarPass.setBaseURI(baseURI);

        vm.warp(wlStartTime);
        vm.prank(user1);
        solarPass.mint(1, user1Proof);

        // Token ID starts from 1 (due to _startTokenId override)
        uint256 tokenId = 1;

        string memory tokenURI = solarPass.tokenURI(tokenId);

        string memory expectedURI = string(abi.encodePacked(baseURI, "1"));

        assertEq(tokenURI, expectedURI);
    }

    function test_BaseURI_MultipleTokens() public {
        string memory baseURI = "https://metadata.example.com/json/";

        // Set base URI
        vm.prank(admin);
        solarPass.setBaseURI(baseURI);

        // Mint multiple tokens
        vm.warp(wlStartTime);
        vm.prank(user1);
        solarPass.mint(2, user1Proof);

        // Check each token's URI
        for (uint256 i = 1; i <= 2; i++) {
            string memory tokenURI = solarPass.tokenURI(i);
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
        solarPass.pause();

        // 2. Set metadata
        vm.prank(admin);
        solarPass.setBaseURI("https://api.example.com/");

        // 3. Unpause and start sale
        vm.prank(admin);
        solarPass.unpause();

        // 4. Agent premint
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = makeAddr("premintUser");
        amounts[0] = 50;

        vm.prank(agent1);
        solarPass.agentMint(recipients, amounts);

        // 5. Whitelist mint
        vm.warp(wlStartTime);
        vm.prank(user1);
        solarPass.mint(2, user1Proof);

        // 6. Public mint
        vm.warp(wlEndTime + 1);
        vm.prank(user3);
        solarPass.mint(2, new bytes32[](0));

        // 7. Freeze metadata
        vm.prank(admin);
        solarPass.freezeMetadata();

        // 8. Verify final state
        assertEq(solarPass.totalSupply(), 54); // 50 + 2 + 2

        (,,, bool metadataFrozen, uint256 publicMinted, uint256 reservedMinted) = solarPass.config();
        assertEq(publicMinted, 4); // 2 + 2
        assertEq(reservedMinted, 50);
        assertTrue(metadataFrozen);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              DUPLICATE TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_MultipleMints_SameUser_SameBlock() public {
        vm.warp(wlStartTime);

        // Multiple mints in same block should work (up to limit)
        vm.startPrank(user1);
        solarPass.mint(1, user1Proof);
        solarPass.mint(1, user1Proof);
        vm.stopPrank();

        assertEq(solarPass.numberMinted(user1), 2);
        assertEq(solarPass.balanceOf(user1), 2);
    }

    function test_DuplicateProof_DifferentUsers() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        solarPass.mint(1, user1Proof);

        vm.expectRevert("NotWhitelisted");
        vm.prank(user2);
        solarPass.mint(1, user1Proof);

        // user2 uses correct proof
        vm.prank(user2);
        solarPass.mint(1, user2Proof);

        assertEq(solarPass.numberMinted(user1), 1);
        assertEq(solarPass.numberMinted(user2), 1);
    }
}
