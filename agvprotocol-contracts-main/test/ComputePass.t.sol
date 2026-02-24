// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/nft/ComputePass.sol";
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
 * @title ComputePassTest
 * @dev Comprehensive test suite for ComputePass contract
 */
contract ComputePassTest is Test {
    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                   TEST CONTRACTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    ComputePass public computePassImpl;
    ComputePass public computePass;
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

    uint256 public constant WL_PRICE_USDT = 899 * 10 ** 6; // 899 USDT
    uint256 public constant PUBLIC_PRICE_USDT = 899 * 10 ** 6; // 899 USDT
    uint256 public constant AGENT_PRICE_USDT = 499 * 10 ** 6; // 499 USDT
    uint256 public constant MAX_SUPPLY = 99;
    uint256 public constant MAX_PER_WALLET = 1;
    uint256 public constant PUBLIC_ALLOCATION = 49;
    uint256 public constant RESERVED_ALLOCATION = 50;

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

        computePassImpl = new ComputePass();

        bytes memory initData = abi.encodeCall(
            ComputePass.initialize,
            ("ComputePass", "COMPUTE", owner, address(usdt), treasury, merkleRoot, wlStartTime, wlEndTime)
        );

        // Deploy proxy
        proxy = new ERC1967Proxy(address(computePassImpl), initData);
        computePass = ComputePass(address(proxy));

        vm.startPrank(owner);
        computePass.grantRole(ADMIN_ROLE, admin);
        computePass.grantAgentRole(agent1);
        computePass.grantAgentRole(agent2);
        vm.stopPrank();

        usdt.mint(user1, 10000 * 10 ** 6); // 10,000 USDT
        usdt.mint(user2, 10000 * 10 ** 6);
        usdt.mint(user3, 10000 * 10 ** 6);
        usdt.mint(nonWhitelisted, 10000 * 10 ** 6);
        usdt.mint(agent1, 100000 * 10 ** 6); // Agent needs more USDT for agent minting
        usdt.mint(agent2, 100000 * 10 ** 6);

        vm.prank(user1);
        usdt.approve(address(computePass), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(computePass), type(uint256).max);
        vm.prank(user3);
        usdt.approve(address(computePass), type(uint256).max);
        vm.prank(nonWhitelisted);
        usdt.approve(address(computePass), type(uint256).max);
        vm.prank(agent1);
        usdt.approve(address(computePass), type(uint256).max);
        vm.prank(agent2);
        usdt.approve(address(computePass), type(uint256).max);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              INITIALIZATION TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_Initialize_Success() public view {
        assertEq(computePass.name(), "ComputePass");
        assertEq(computePass.symbol(), "COMPUTE");
        assertEq(computePass.owner(), owner);
        assertEq(address(computePass.usdtToken()), address(usdt));
        assertEq(computePass.treasuryReceiver(), treasury);
        assertEq(computePass.whitelistMerkleRoot(), merkleRoot);

        // Check config struct
        (uint64 wlStart, uint64 wlEnd, bool active, bool metadataFrozen, uint256 publicMinted, uint256 reservedMinted) =
            computePass.config();
        assertEq(wlStart, wlStartTime);
        assertEq(wlEnd, wlEndTime);
        assertTrue(active);
        assertFalse(metadataFrozen);
        assertEq(publicMinted, 0);
        assertEq(reservedMinted, 0);

        // Check roles
        assertTrue(computePass.hasRole(computePass.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(computePass.hasRole(ADMIN_ROLE, owner));
        assertTrue(computePass.hasRole(ADMIN_ROLE, admin));
        assertTrue(computePass.hasRole(TREASURER_ROLE, treasury));
        assertTrue(computePass.hasRole(AGENT_MINTER_ROLE, agent1));

        // Check initial state
        assertFalse(computePass.paused());
    }

    function test_Initialize_ZeroAddressReverts() public {
        ComputePass temporaryImpl = new ComputePass();

        bytes memory initDataWithZeroOwner = abi.encodeCall(
            ComputePass.initialize,
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
        computePass.initialize("Test", "TEST", owner, address(usdt), treasury, bytes32(0), wlStartTime, wlEndTime);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              WHITELIST MINT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WhitelistMint_Success() public {
        vm.warp(wlStartTime);

        uint256 quantity = 1; // Max per wallet is 1
        uint256 expectedPayment = quantity * WL_PRICE_USDT;
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit WhitelistMint(user1, quantity, expectedPayment);

        vm.prank(user1);
        computePass.mint(quantity, user1Proof);

        // Check balances
        assertEq(computePass.balanceOf(user1), quantity);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + expectedPayment);

        // Check config updates
        (,,,, uint256 publicMinted,) = computePass.config();
        assertEq(publicMinted, quantity);
        assertEq(computePass.numberMinted(user1), quantity);
    }

    function test_WhitelistMint_InvalidProof() public {
        vm.warp(wlStartTime);

        vm.expectRevert("NotWhitelisted");
        vm.prank(nonWhitelisted);
        computePass.mint(1, user1Proof); // Wrong proof
    }

    function test_WhitelistMint_ExceedsWalletLimit() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        computePass.mint(1, user1Proof);

        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        computePass.mint(1, user1Proof); // Second mint exceeds limit of 1
    }

    function test_WhitelistMint_BeforeStart() public {
        vm.warp(wlStartTime - 1);

        vm.expectRevert("SaleNotStarted");
        vm.prank(user1);
        computePass.mint(1, user1Proof);
    }

    function test_WhitelistMint_PremiumPricing() public {
        vm.warp(wlStartTime);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(user1);
        computePass.mint(1, user1Proof);

        uint256 payment = usdt.balanceOf(treasury) - treasuryBalanceBefore;
        assertEq(payment, WL_PRICE_USDT);
        assertEq(payment, 899 * 10 ** 6); // 499 USDT
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                PUBLIC MINT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_PublicMint_Success() public {
        vm.warp(wlEndTime + 1);

        uint256 quantity = 1; // Max per wallet is 1
        uint256 expectedPayment = quantity * PUBLIC_PRICE_USDT;

        vm.expectEmit(true, true, true, true);
        emit PublicMint(user3, quantity, expectedPayment);

        vm.prank(user3);
        computePass.mint(quantity, new bytes32[](0)); // No proof needed for public

        assertEq(computePass.balanceOf(user3), quantity);

        (,,,, uint256 publicMinted,) = computePass.config();
        assertEq(publicMinted, quantity);
    }

    function test_PublicMint_NoProofRequired() public {
        vm.warp(wlEndTime + 1);

        vm.prank(nonWhitelisted);
        computePass.mint(1, new bytes32[](0));

        assertEq(computePass.balanceOf(nonWhitelisted), 1);
    }

    function test_PublicMint_ExceedsPublicAllocation() public {
        vm.warp(wlEndTime + 1);

        // Mint 99 NFTs to reach public allocation limit
        for (uint256 i = 0; i < PUBLIC_ALLOCATION; i++) {
            address user = makeAddr(string.concat("user", vm.toString(i)));
            usdt.mint(user, 1000 * 10 ** 6);
            vm.prank(user);
            usdt.approve(address(computePass), type(uint256).max);
            vm.prank(user);
            computePass.mint(1, new bytes32[](0));
        }

        // 100th mint should fail
        address extraUser = makeAddr("extraUser");
        usdt.mint(extraUser, 1000 * 10 ** 6);
        vm.prank(extraUser);
        usdt.approve(address(computePass), type(uint256).max);

        vm.expectRevert("ExceedsPublicAllocation");
        vm.prank(extraUser);
        computePass.mint(1, new bytes32[](0));
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
        computePass.agentMint(recipients, quantities);

        assertEq(computePass.balanceOf(user1), 5);
        assertEq(computePass.balanceOf(user2), 3);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + totalPayment);

        (,,,,, uint256 reservedMinted) = computePass.config();
        assertEq(reservedMinted, 8);
    }

    function test_AgentMint_OnlyAgent() public {
        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user1;
        quantities[0] = 1;

        vm.expectRevert();
        vm.prank(user1);
        computePass.agentMint(recipients, quantities);
    }

    function test_AgentMint_ExceedsReservedAllocation() public {
        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user1;
        quantities[0] = 51; // Exceeds 50 reserved

        vm.expectRevert("ExceedsReservedAllocation");
        vm.prank(agent1);
        computePass.agentMint(recipients, quantities);
    }

    function test_AgentMint_InvalidConfiguration() public {
        address[] memory recipients = new address[](2);
        uint256[] memory quantities = new uint256[](1); // Mismatched lengths

        vm.expectRevert("InvalidConfiguration");
        vm.prank(agent1);
        computePass.agentMint(recipients, quantities);
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
        computePass.agentMint(recipients, quantities);

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
        computePass.mint(300, new bytes32[](0)); // Exceeds 299 max supply
    }

    function test_ExceedsMaxSupply_AgentMint() public {
        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user1;
        quantities[0] = 300; // Exceeds 299 max supply

        vm.expectRevert("ExceedsMaxSupply");
        vm.prank(agent1);
        computePass.agentMint(recipients, quantities);
    }

    function test_MaxSupply_SmallCollection() public pure {
        // Test that total supply correctly reflects the small collection size
        assertEq(MAX_SUPPLY, 99);
        assertEq(PUBLIC_ALLOCATION + RESERVED_ALLOCATION, MAX_SUPPLY);
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
        computePass.setSaleConfig(newWlStart, newWlEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = computePass.config();
        assertEq(wlStart, newWlStart);
        assertEq(wlEnd, newWlEnd);
        assertFalse(active);
    }

    function test_SetWhitelistRoot_Success() public {
        bytes32 newRoot = keccak256("new root");

        vm.expectEmit(true, true, true, true);
        emit WhitelistUpdated(newRoot);

        vm.prank(admin);
        computePass.setWhitelistRoot(newRoot);

        assertEq(computePass.whitelistMerkleRoot(), newRoot);
    }

    function test_SetTreasuryReceiver_Success() public {
        address newTreasury = makeAddr("newTreasury");
        address oldTreasury = computePass.treasuryReceiver();

        vm.prank(owner);
        computePass.setTreasuryReceiver(newTreasury);

        assertEq(computePass.treasuryReceiver(), newTreasury);
        assertFalse(computePass.hasRole(TREASURER_ROLE, oldTreasury));
        assertTrue(computePass.hasRole(TREASURER_ROLE, newTreasury));
    }

    function test_SetRoyaltyInfo_Success() public {
        address royaltyReceiver = makeAddr("royaltyReceiver");
        uint96 royaltyFee = 300; // 3%

        vm.prank(admin);
        computePass.setRoyaltyInfo(royaltyReceiver, royaltyFee);

        (address receiver, uint256 amount) = computePass.royaltyInfo(1, 10000);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 300); // 3% of 10000
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                            ROLE MANAGEMENT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_GrantAgentRole_Success() public {
        address newAgent = makeAddr("newAgent");

        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(newAgent, true);

        vm.prank(admin);
        computePass.grantAgentRole(newAgent);

        assertTrue(computePass.hasRole(AGENT_MINTER_ROLE, newAgent));
    }

    function test_RevokeAgentRole_Success() public {
        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(agent1, false);

        vm.prank(admin);
        computePass.revokeAgentRole(agent1);

        assertFalse(computePass.hasRole(AGENT_MINTER_ROLE, agent1));
    }

    function test_GrantAgentRole_ZeroAddressReverts() public {
        vm.expectRevert("ZeroAddress");
        vm.prank(admin);
        computePass.grantAgentRole(address(0));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_GetCurrentPhase() public {
        assertEq(computePass.getCurrentPhase(), "UPCOMING");

        vm.warp(wlStartTime);
        assertEq(computePass.getCurrentPhase(), "WHITELIST");

        vm.warp(wlEndTime + 1);
        assertEq(computePass.getCurrentPhase(), "PUBLIC");

        vm.prank(admin);
        computePass.setSaleConfig(wlStartTime, wlEndTime, false);
        assertEq(computePass.getCurrentPhase(), "INACTIVE");
    }

    function test_GetRemainingSupply() public {
        assertEq(computePass.getRemainingPublicSupply(), 49);
        assertEq(computePass.getRemainingReservedSupply(), 50);

        // After some mints
        vm.warp(wlEndTime + 1);
        vm.prank(user1);
        computePass.mint(1, new bytes32[](0));

        assertEq(computePass.getRemainingPublicSupply(), 48);

        address[] memory recipients = new address[](1);
        uint256[] memory quantities = new uint256[](1);
        recipients[0] = user2;
        quantities[0] = 10;

        vm.prank(agent1);
        computePass.agentMint(recipients, quantities);

        assertEq(computePass.getRemainingReservedSupply(), 40);
    }

    function test_NumberMinted() public view {
        assertEq(computePass.numberMinted(user1), 0);
        assertEq(computePass.numberMinted(user2), 0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                EDGE CASES TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_MintZeroAmount() public {
        vm.warp(wlStartTime);

        vm.expectRevert("InvalidAmount");
        vm.prank(user1);
        computePass.mint(0, user1Proof);
    }

    function test_SaleInactive() public {
        vm.prank(admin);
        computePass.setSaleConfig(wlStartTime, wlEndTime, false);

        vm.warp(wlStartTime);

        vm.expectRevert("SaleNotActive");
        vm.prank(user1);
        computePass.mint(1, user1Proof);
    }

    function test_ContractPaused() public {
        vm.prank(admin);
        computePass.pause();

        vm.warp(wlStartTime);

        vm.expectRevert();
        vm.prank(user1);
        computePass.mint(1, user1Proof);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              UPGRADE TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_UpgradeAuthorization() public {
        address newImpl = address(new ComputePass());

        vm.expectRevert();
        vm.prank(user1);
        computePass.upgradeToAndCall(newImpl, "");

        // Admin can upgrade
        vm.prank(admin);
        computePass.upgradeToAndCall(newImpl, "");
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              WALLET LIMIT TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WalletLimit_ExactMax() public {
        vm.warp(wlStartTime);

        // Mint exactly MAX_PER_WALLET (1)
        vm.prank(user1);
        computePass.mint(1, user1Proof);

        assertEq(computePass.balanceOf(user1), 1);
        assertEq(computePass.numberMinted(user1), 1);

        // Try to mint 1 more
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        computePass.mint(1, user1Proof);
    }

    function test_WalletLimit_CrossPhase() public {
        vm.warp(wlStartTime);
        vm.prank(user1);
        computePass.mint(1, user1Proof);

        assertEq(computePass.numberMinted(user1), 1);

        vm.warp(wlEndTime + 1);
        vm.expectRevert("ExceedsWalletLimit");
        vm.prank(user1);
        computePass.mint(1, new bytes32[](0));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              ROLE-BASED ACCESS CONTROL TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_OnlyAdmin_CanSetSaleConfig() public {
        uint256 newStart = block.timestamp + 100;
        uint256 newEnd = newStart + 200;

        vm.expectRevert();
        vm.prank(user1);
        computePass.setSaleConfig(newStart, newEnd, false);

        vm.expectRevert();
        vm.prank(agent1);
        computePass.setSaleConfig(newStart, newEnd, false);

        vm.expectRevert();
        vm.prank(treasury);
        computePass.setSaleConfig(newStart, newEnd, false);

        // Admin can set config
        vm.expectEmit(true, true, true, true);
        emit SaleConfigUpdated(newStart, newEnd, false);

        vm.prank(admin);
        computePass.setSaleConfig(newStart, newEnd, false);

        (uint64 wlStart, uint64 wlEnd, bool active,,,) = computePass.config();
        assertEq(wlStart, newStart);
        assertEq(wlEnd, newEnd);
        assertFalse(active);

        // Owner can also set config (has ADMIN_ROLE)
        vm.prank(owner);
        computePass.setSaleConfig(newStart + 100, newEnd + 100, true);

        (wlStart, wlEnd, active,,,) = computePass.config();
        assertEq(wlStart, newStart + 100);
        assertEq(wlEnd, newEnd + 100);
        assertTrue(active);
    }

    function test_OnlyAdmin_CanManageAgents() public {
        address newAgent = makeAddr("newAgent");

        vm.expectRevert();
        vm.prank(user1);
        computePass.grantAgentRole(newAgent);

        // Existing agent cannot grant agent role to others
        vm.expectRevert();
        vm.prank(agent1);
        computePass.grantAgentRole(newAgent);

        vm.expectRevert();
        vm.prank(treasury);
        computePass.grantAgentRole(newAgent);

        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(newAgent, true);

        vm.prank(admin);
        computePass.grantAgentRole(newAgent);

        assertTrue(computePass.hasRole(AGENT_MINTER_ROLE, newAgent));

        // Regular user cannot revoke agent role
        vm.expectRevert();
        vm.prank(user1);
        computePass.revokeAgentRole(newAgent);

        // Agent cannot revoke other agent's role
        vm.expectRevert();
        vm.prank(agent1);
        computePass.revokeAgentRole(newAgent);

        // Admin can revoke agent role
        vm.expectEmit(true, true, true, true);
        emit AgentUpdated(newAgent, false);

        vm.prank(admin);
        computePass.revokeAgentRole(newAgent);

        assertFalse(computePass.hasRole(AGENT_MINTER_ROLE, newAgent));

        // Owner can also manage agents
        vm.prank(owner);
        computePass.grantAgentRole(newAgent);
        assertTrue(computePass.hasRole(AGENT_MINTER_ROLE, newAgent));
    }

    function test_OnlyOwner_CanSetTreasuryReceiver() public {
        address newTreasury = makeAddr("newTreasury");

        // Regular user cannot set treasury
        vm.expectRevert();
        vm.prank(user1);
        computePass.setTreasuryReceiver(newTreasury);

        // Current treasury cannot set new treasury
        vm.expectRevert();
        vm.prank(treasury);
        computePass.setTreasuryReceiver(newTreasury);

        // Agent cannot set treasury
        vm.expectRevert();
        vm.prank(agent1);
        computePass.setTreasuryReceiver(newTreasury);

        // Owner can set treasury
        vm.prank(owner);
        computePass.setTreasuryReceiver(newTreasury);

        assertEq(computePass.treasuryReceiver(), newTreasury);
        assertFalse(computePass.hasRole(TREASURER_ROLE, treasury));
        assertTrue(computePass.hasRole(TREASURER_ROLE, newTreasury));

        // Owner can also set treasury
        address anotherTreasury = makeAddr("anotherTreasury");
        vm.prank(owner);
        computePass.setTreasuryReceiver(anotherTreasury);

        assertEq(computePass.treasuryReceiver(), anotherTreasury);
        assertTrue(computePass.hasRole(TREASURER_ROLE, anotherTreasury));
    }

    function test_OnlyTreasurer_CanWithdraw() public {
        usdt.transfer(address(computePass), 100 * 10 ** 6);

        // Regular user cannot withdraw
        vm.expectRevert();
        vm.prank(user1);
        computePass.withdrawTreasury(address(usdt));

        // Admin cannot withdraw (only treasurer)
        vm.expectRevert();
        vm.prank(admin);
        computePass.withdrawTreasury(address(usdt));

        // Owner cannot withdraw (only treasurer)
        vm.expectRevert();
        vm.prank(owner);
        computePass.withdrawTreasury(address(usdt));

        // Agent cannot withdraw
        vm.expectRevert();
        vm.prank(agent1);
        computePass.withdrawTreasury(address(usdt));

        // Treasurer can withdraw
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(usdt), 100 * 10 ** 6);

        vm.prank(treasury);
        computePass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + 100 * 10 ** 6);
        assertEq(usdt.balanceOf(address(computePass)), 0);
    }

    function test_OnlyAdmin_CanPauseUnpause() public {
        // Regular user cannot pause
        vm.expectRevert();
        vm.prank(user1);
        computePass.pause();

        // Treasury cannot pause
        vm.expectRevert();
        vm.prank(treasury);
        computePass.pause();

        // Agent cannot pause
        vm.expectRevert();
        vm.prank(agent1);
        computePass.pause();

        // Admin can pause
        vm.prank(admin);
        computePass.pause();

        assertTrue(computePass.paused());

        // When paused, minting should fail
        vm.warp(wlStartTime);
        vm.expectRevert();
        vm.prank(user1);
        computePass.mint(1, user1Proof);

        // Agent minting should also fail when paused
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = user1;
        amounts[0] = 1;

        vm.expectRevert();
        vm.prank(agent1);
        computePass.agentMint(recipients, amounts);

        // Regular user cannot unpause
        vm.expectRevert();
        vm.prank(user1);
        computePass.unpause();

        // Treasury cannot unpause
        vm.expectRevert();
        vm.prank(treasury);
        computePass.unpause();

        // Admin can unpause
        vm.prank(admin);
        computePass.unpause();

        assertFalse(computePass.paused());

        // After unpause, minting should work
        vm.prank(user1);
        computePass.mint(1, user1Proof);

        assertEq(computePass.balanceOf(user1), 1);

        // Owner can also pause/unpause
        vm.prank(owner);
        computePass.pause();
        assertTrue(computePass.paused());

        vm.prank(owner);
        computePass.unpause();
        assertFalse(computePass.paused());
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                ROYALTY TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_DefaultRoyalty_SetOnInitialization() public view {
        (address receiver, uint256 royaltyAmount) = computePass.royaltyInfo(1, 10000);

        assertEq(receiver, treasury);
        assertEq(royaltyAmount, 300); // 3% of 10000 = 300
    }

    function test_RoyaltyInfo_DifferentSalePrices() public view {
        uint256 salePrice1 = 1000 * 10 ** 6; // 1000 USDT
        uint256 salePrice2 = 50 * 10 ** 6; // 50 USDT

        (address receiver1, uint256 royalty1) = computePass.royaltyInfo(1, salePrice1);
        (address receiver2, uint256 royalty2) = computePass.royaltyInfo(2, salePrice2);

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
        computePass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        vm.expectRevert();
        vm.prank(treasury);
        computePass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        // Admin can set royalty
        vm.prank(admin);
        computePass.setRoyaltyInfo(newRoyaltyReceiver, newRoyaltyFee);

        (address receiver, uint256 royaltyAmount) = computePass.royaltyInfo(1, 10000);

        assertEq(receiver, newRoyaltyReceiver);
        assertEq(royaltyAmount, 750); // 7.5% of 10000
    }

    function test_RoyaltyInfo_SupportsInterface() public view {
        // ERC2981 interface ID
        bytes4 ERC2981_INTERFACE_ID = 0x2a55205a;
        assertTrue(computePass.supportsInterface(ERC2981_INTERFACE_ID));

        // AccessControl interface ID
        bytes4 ACCESS_CONTROL_INTERFACE_ID = 0x7965db0b;
        assertTrue(computePass.supportsInterface(ACCESS_CONTROL_INTERFACE_ID));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              TREASURY WITHDRAWAL TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_WithdrawTreasury_USDT() public {
        // Send USDT to contract
        uint256 amount = 500 * 10 ** 6; // 500 USDT
        usdt.transfer(address(computePass), amount);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(usdt), amount);

        vm.prank(treasury);
        computePass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + amount);
        assertEq(usdt.balanceOf(address(computePass)), 0);
    }

    function test_WithdrawTreasury_ETH() public {
        uint256 amount = 1 ether;
        vm.deal(address(computePass), amount);

        uint256 treasuryBalanceBefore = treasury.balance;

        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdraw(address(0), amount);

        vm.prank(treasury);
        computePass.withdrawTreasury(address(0));

        assertEq(treasury.balance, treasuryBalanceBefore + amount);
        assertEq(address(computePass).balance, 0);
    }

    function test_WithdrawTreasury_EmptyBalance() public {
        assertEq(usdt.balanceOf(address(computePass)), 0);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(treasury);
        computePass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore);
    }

    function test_WithdrawTreasury_AfterTreasuryChange() public {
        // Send funds to contract
        uint256 amount = 200 * 10 ** 6;
        usdt.transfer(address(computePass), amount);

        // Owner Change treasury
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        computePass.setTreasuryReceiver(newTreasury);

        // Old treasury cannot withdraw
        vm.expectRevert();
        vm.prank(treasury);
        computePass.withdrawTreasury(address(usdt));

        // New treasury can withdraw
        uint256 newTreasuryBalanceBefore = usdt.balanceOf(newTreasury);

        vm.prank(newTreasury);
        computePass.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(newTreasury), newTreasuryBalanceBefore + amount);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                                METADATA TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_SetBaseURI_OnlyAdmin() public {
        string memory newBaseURI = "https://newapi.example.com/";

        vm.expectRevert();
        vm.prank(user1);
        computePass.setBaseURI(newBaseURI);

        // Admin can set base URI
        vm.expectEmit(true, true, true, true);
        emit BaseURIUpdated(newBaseURI);

        vm.prank(admin);
        computePass.setBaseURI(newBaseURI);
    }

    function test_FreezeMetadata_Permanent() public {
        string memory initialURI = "https://api.example.com/";
        string memory newURI = "https://newapi.example.com/";

        vm.prank(admin);
        computePass.setBaseURI(initialURI);

        // Freeze metadata
        vm.expectEmit(true, true, true, true);
        emit MetadataFrozened();

        vm.prank(admin);
        computePass.freezeMetadata();

        // Check frozen status
        (,,, bool metadataFrozen,,) = computePass.config();
        assertTrue(metadataFrozen);

        vm.expectRevert("MetadataFrozen");
        vm.prank(admin);
        computePass.setBaseURI(newURI);

        vm.expectRevert("MetadataFrozen");
        vm.prank(owner);
        computePass.setBaseURI(newURI);
    }

    function test_BaseURI_TokenURI() public {
        string memory baseURI = "https://api.computePass.com/metadata/";

        vm.prank(admin);
        computePass.setBaseURI(baseURI);

        vm.warp(wlStartTime);
        vm.prank(user1);
        computePass.mint(1, user1Proof);

        // Token ID starts from 1 (due to _startTokenId override)
        uint256 tokenId = 1;

        string memory tokenURI = computePass.tokenURI(tokenId);

        string memory expectedURI = string(abi.encodePacked(baseURI, "1"));

        assertEq(tokenURI, expectedURI);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              INTEGRATION TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_CompleteWorkflow() public {
        // 1. Pause contract
        vm.prank(admin);
        computePass.pause();

        // 2. Set metadata
        vm.prank(admin);
        computePass.setBaseURI("https://api.example.com/");

        // 3. Unpause and start sale
        vm.prank(admin);
        computePass.unpause();

        // 4. Agent premint
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = makeAddr("premintUser");
        amounts[0] = 50;

        vm.prank(agent1);
        computePass.agentMint(recipients, amounts);

        // 5. Whitelist mint
        vm.warp(wlStartTime);
        vm.prank(user1);
        computePass.mint(1, user1Proof);

        // 6. Public mint
        vm.warp(wlEndTime + 1);
        vm.prank(user3);
        computePass.mint(1, new bytes32[](0));

        // 7. Freeze metadata
        vm.prank(admin);
        computePass.freezeMetadata();

        // 8. Verify final state
        assertEq(computePass.totalSupply(), 52); // 50 + 2

        (,,, bool metadataFrozen, uint256 publicMinted, uint256 reservedMinted) = computePass.config();
        assertEq(publicMinted, 2); // 2 + 2
        assertEq(reservedMinted, 50);
        assertTrue(metadataFrozen);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    //                              DUPLICATE TESTS
    // ════════════════════════════════════════════════════════════════════════════════════════

    function test_DuplicateProof_DifferentUsers() public {
        vm.warp(wlStartTime);

        vm.prank(user1);
        computePass.mint(1, user1Proof);

        vm.expectRevert("NotWhitelisted");
        vm.prank(user2);
        computePass.mint(1, user1Proof);

        // user2 uses correct proof
        vm.prank(user2);
        computePass.mint(1, user2Proof);

        assertEq(computePass.numberMinted(user1), 1);
        assertEq(computePass.numberMinted(user2), 1);
    }
}
