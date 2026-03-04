// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/registry/AgentRegistry.sol";
import "../contracts/interfaces/IAgentRegistry.sol";
import "../contracts/nft/ComputePass.sol";
import "../contracts/nft/SolarPass.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ════════════════════════════════════════════════════════════════════════════════
//                              MOCK CONTRACTS
// ════════════════════════════════════════════════════════════════════════════════

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {
        _mint(msg.sender, 10_000_000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Mock NFT contract that simulates calling deductQuota
contract MockNFTContract {
    IAgentRegistry public registry;

    constructor(address _registry) {
        registry = IAgentRegistry(_registry);
    }

    function simulateAgentMint(address agent, uint256 amount) external {
        registry.deductQuota(agent, amount);
    }
}

// ════════════════════════════════════════════════════════════════════════════════
//                          AGENT REGISTRY UNIT TESTS
// ════════════════════════════════════════════════════════════════════════════════

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    MockNFTContract public mockNFT;
    MockNFTContract public mockNFT2;

    address public admin = makeAddr("admin");
    address public agentA = makeAddr("agentA");
    address public agentB = makeAddr("agentB");
    address public agentC = makeAddr("agentC");
    address public attacker = makeAddr("attacker");

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant NFT_CONTRACT_ROLE = keccak256("NFT_CONTRACT_ROLE");

    // ════════════════════════════════════════════════════════════════════
    //                          EVENTS
    // ════════════════════════════════════════════════════════════════════

    event AgentRegistered(address indexed agent);
    event QuotaSet(address indexed agent, address indexed nftContract, uint256 quota);
    event QuotaBatchSet(address indexed nftContract, uint256 agentCount);
    event QuotaDeducted(address indexed agent, address indexed nftContract, uint256 amount, uint256 remaining);
    event AgentRevoked(address indexed agent, address indexed nftContract);
    event NFTContractRegistered(address indexed nftContract);
    event NFTContractUnregistered(address indexed nftContract);

    function setUp() public {
        vm.startPrank(admin);

        registry = new AgentRegistry(admin);

        // Deploy mock NFT contracts
        mockNFT = new MockNFTContract(address(registry));
        mockNFT2 = new MockNFTContract(address(registry));

        // Register mock NFT contracts
        registry.registerNFTContract(address(mockNFT));
        registry.registerNFTContract(address(mockNFT2));

        vm.stopPrank();
    }

    // ════════════════════════════════════════════════════════════════════
    //                    CONSTRUCTOR / INIT TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_Constructor_Success() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(ADMIN_ROLE, admin));
        assertEq(registry.getAgentCount(), 0);
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        new AgentRegistry(address(0));
    }

    // ════════════════════════════════════════════════════════════════════
    //                    SET QUOTA (CERTIFICATION) TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_SetQuota_CreatesAgent() public {
        vm.prank(admin);

        vm.expectEmit(true, false, false, false);
        emit AgentRegistered(agentA);
        vm.expectEmit(true, true, false, true);
        emit QuotaSet(agentA, address(mockNFT), 10);

        registry.setQuota(agentA, address(mockNFT), 10);

        assertEq(registry.agentQuota(agentA, address(mockNFT)), 10);
        assertTrue(registry.isRegistered(agentA));
        assertEq(registry.getAgentCount(), 1);
        assertTrue(registry.isAgent(agentA, address(mockNFT)));
    }

    function test_SetQuota_UpdateExistingQuota() public {
        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);
        registry.setQuota(agentA, address(mockNFT), 20);
        vm.stopPrank();

        assertEq(registry.agentQuota(agentA, address(mockNFT)), 20);
        // Agent count should still be 1 (not double-registered)
        assertEq(registry.getAgentCount(), 1);
    }

    function test_SetQuota_MultipleNFTContracts() public {
        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);
        registry.setQuota(agentA, address(mockNFT2), 25);
        vm.stopPrank();

        assertEq(registry.agentQuota(agentA, address(mockNFT)), 10);
        assertEq(registry.agentQuota(agentA, address(mockNFT2)), 25);
        assertEq(registry.getAgentCount(), 1);
    }

    function test_SetQuota_RevertsZeroAgentAddress() public {
        vm.prank(admin);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.setQuota(address(0), address(mockNFT), 10);
    }

    function test_SetQuota_RevertsZeroNFTAddress() public {
        vm.prank(admin);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.setQuota(agentA, address(0), 10);
    }

    function test_SetQuota_RevertsIfBelowMinted() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        // Agent mints 5
        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 5);

        // Try to set quota below minted (< 5)
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.QuotaBelowMinted.selector, agentA, address(mockNFT), 3, 5)
        );
        registry.setQuota(agentA, address(mockNFT), 3);
    }

    function test_SetQuota_CanSetToExactlyMinted() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 5);

        // Set quota to exactly minted amount (= freeze, no more mints)
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 5);

        assertEq(registry.getRemaining(agentA, address(mockNFT)), 0);
        assertFalse(registry.isAgent(agentA, address(mockNFT)));
    }

    function test_SetQuota_OnlyAdmin() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.setQuota(agentA, address(mockNFT), 10);
    }

    // ════════════════════════════════════════════════════════════════════
    //                    BATCH SET QUOTA TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_BatchSetQuota_MultipleAgents() public {
        address[] memory agents = new address[](3);
        agents[0] = agentA;
        agents[1] = agentB;
        agents[2] = agentC;

        uint256[] memory quotas = new uint256[](3);
        quotas[0] = 10;
        quotas[1] = 20;
        quotas[2] = 30;

        vm.prank(admin);
        registry.batchSetQuota(agents, address(mockNFT), quotas);

        assertEq(registry.agentQuota(agentA, address(mockNFT)), 10);
        assertEq(registry.agentQuota(agentB, address(mockNFT)), 20);
        assertEq(registry.agentQuota(agentC, address(mockNFT)), 30);
        assertEq(registry.getAgentCount(), 3);
    }

    function test_BatchSetQuota_RevertsLengthMismatch() public {
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = agentB;

        uint256[] memory quotas = new uint256[](3);
        quotas[0] = 10;
        quotas[1] = 20;
        quotas[2] = 30;

        vm.prank(admin);
        vm.expectRevert(AgentRegistry.LengthMismatch.selector);
        registry.batchSetQuota(agents, address(mockNFT), quotas);
    }

    function test_BatchSetQuota_RevertsZeroNFTAddress() public {
        address[] memory agents = new address[](1);
        agents[0] = agentA;
        uint256[] memory quotas = new uint256[](1);
        quotas[0] = 10;

        vm.prank(admin);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.batchSetQuota(agents, address(0), quotas);
    }

    function test_BatchSetQuota_RevertsZeroAgentInArray() public {
        address[] memory agents = new address[](2);
        agents[0] = agentA;
        agents[1] = address(0); // bad

        uint256[] memory quotas = new uint256[](2);
        quotas[0] = 10;
        quotas[1] = 20;

        vm.prank(admin);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.batchSetQuota(agents, address(mockNFT), quotas);
    }

    function test_BatchSetQuota_OnlyAdmin() public {
        address[] memory agents = new address[](1);
        agents[0] = agentA;
        uint256[] memory quotas = new uint256[](1);
        quotas[0] = 10;

        vm.prank(attacker);
        vm.expectRevert();
        registry.batchSetQuota(agents, address(mockNFT), quotas);
    }

    // ════════════════════════════════════════════════════════════════════
    //                    DEDUCT QUOTA TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_DeductQuota_ReducesRemaining() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        vm.expectEmit(true, true, false, true);
        emit QuotaDeducted(agentA, address(mockNFT), 3, 7);

        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 3);

        (uint256 quota, uint256 minted, uint256 remaining) = registry.getAgentInfo(agentA, address(mockNFT));
        assertEq(quota, 10);
        assertEq(minted, 3);
        assertEq(remaining, 7);
    }

    function test_DeductQuota_MultipleDeductions() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        vm.startPrank(address(mockNFT));
        registry.deductQuota(agentA, 3);
        registry.deductQuota(agentA, 4);
        registry.deductQuota(agentA, 3);
        vm.stopPrank();

        (uint256 quota, uint256 minted, uint256 remaining) = registry.getAgentInfo(agentA, address(mockNFT));
        assertEq(quota, 10);
        assertEq(minted, 10);
        assertEq(remaining, 0);
        assertFalse(registry.isAgent(agentA, address(mockNFT)));
    }

    function test_DeductQuota_RevertsWhenExceedsQuota() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 5);

        vm.prank(address(mockNFT));
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.ExceedsAgentQuota.selector, agentA, address(mockNFT), 6, 5)
        );
        registry.deductQuota(agentA, 6);
    }

    function test_DeductQuota_RevertsWhenNoQuota() public {
        // agentA has no quota set
        vm.prank(address(mockNFT));
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.ExceedsAgentQuota.selector, agentA, address(mockNFT), 1, 0)
        );
        registry.deductQuota(agentA, 1);
    }

    function test_DeductQuota_RevertsAfterExhausted() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 5);

        vm.startPrank(address(mockNFT));
        registry.deductQuota(agentA, 5); // exhaust

        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.ExceedsAgentQuota.selector, agentA, address(mockNFT), 1, 0)
        );
        registry.deductQuota(agentA, 1);
        vm.stopPrank();
    }

    function test_DeductQuota_OnlyNFTContractRole() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        // Attacker can't call deductQuota
        vm.prank(attacker);
        vm.expectRevert();
        registry.deductQuota(agentA, 1);

        // Admin can't call deductQuota directly either
        vm.prank(admin);
        vm.expectRevert();
        registry.deductQuota(agentA, 1);
    }

    function test_DeductQuota_IndependentPerNFTContract() public {
        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);
        registry.setQuota(agentA, address(mockNFT2), 20);
        vm.stopPrank();

        // Deduct from mockNFT
        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 5);

        // mockNFT2 quota is independent
        assertEq(registry.getRemaining(agentA, address(mockNFT)), 5);
        assertEq(registry.getRemaining(agentA, address(mockNFT2)), 20);
    }

    function test_DeductQuota_IndependentPerAgent() public {
        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);
        registry.setQuota(agentB, address(mockNFT), 15);
        vm.stopPrank();

        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 8);

        // agentB is unaffected
        assertEq(registry.getRemaining(agentA, address(mockNFT)), 2);
        assertEq(registry.getRemaining(agentB, address(mockNFT)), 15);
    }

    // ════════════════════════════════════════════════════════════════════
    //                    REVOKE AGENT TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_RevokeAgent_SetsQuotaToZero() public {
        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);
        registry.revokeAgent(agentA, address(mockNFT));
        vm.stopPrank();

        assertEq(registry.agentQuota(agentA, address(mockNFT)), 0);
        assertFalse(registry.isAgent(agentA, address(mockNFT)));
    }

    function test_RevokeAgent_PreservesHistory() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 7);

        vm.prank(admin);
        registry.revokeAgent(agentA, address(mockNFT));

        // quota = 0 but minted history is preserved
        assertEq(registry.agentQuota(agentA, address(mockNFT)), 0);
        assertEq(registry.agentMinted(agentA, address(mockNFT)), 7);
    }

    function test_RevokeAgent_DoesNotAffectOtherContracts() public {
        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);
        registry.setQuota(agentA, address(mockNFT2), 20);
        registry.revokeAgent(agentA, address(mockNFT));
        vm.stopPrank();

        assertEq(registry.agentQuota(agentA, address(mockNFT)), 0);
        assertEq(registry.agentQuota(agentA, address(mockNFT2)), 20);
    }

    // ════════════════════════════════════════════════════════════════════
    //                    PAUSE TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_Pause_BlocksDeduction() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        vm.prank(admin);
        registry.pause();

        vm.prank(address(mockNFT));
        vm.expectRevert();
        registry.deductQuota(agentA, 1);
    }

    function test_Unpause_AllowsDeduction() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        vm.prank(admin);
        registry.pause();

        vm.prank(admin);
        registry.unpause();

        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 1);
        assertEq(registry.getRemaining(agentA, address(mockNFT)), 9);
    }

    function test_Pause_OnlyAdmin() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.pause();
    }

    // ════════════════════════════════════════════════════════════════════
    //                    NFT CONTRACT REGISTRATION TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_RegisterNFTContract() public {
        MockNFTContract mockNFT3 = new MockNFTContract(address(registry));

        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit NFTContractRegistered(address(mockNFT3));
        registry.registerNFTContract(address(mockNFT3));

        assertTrue(registry.hasRole(NFT_CONTRACT_ROLE, address(mockNFT3)));
    }

    function test_UnregisterNFTContract() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit NFTContractUnregistered(address(mockNFT));
        registry.unregisterNFTContract(address(mockNFT));

        assertFalse(registry.hasRole(NFT_CONTRACT_ROLE, address(mockNFT)));
    }

    function test_RegisterNFTContract_RevertsZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerNFTContract(address(0));
    }

    // ════════════════════════════════════════════════════════════════════
    //                    VIEW FUNCTION TESTS
    // ════════════════════════════════════════════════════════════════════

    function test_IsAgent_ReturnsFalseForZeroQuota() public view {
        assertFalse(registry.isAgent(agentA, address(mockNFT)));
    }

    function test_GetRemaining_ReturnsZeroForNewAgent() public view {
        assertEq(registry.getRemaining(agentA, address(mockNFT)), 0);
    }

    function test_GetAgentInfo_FullCycle() public {
        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), 10);

        (uint256 q, uint256 m, uint256 r) = registry.getAgentInfo(agentA, address(mockNFT));
        assertEq(q, 10);
        assertEq(m, 0);
        assertEq(r, 10);

        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, 3);

        (q, m, r) = registry.getAgentInfo(agentA, address(mockNFT));
        assertEq(q, 10);
        assertEq(m, 3);
        assertEq(r, 7);
    }

    function test_GetAgents_Pagination() public {
        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 1);
        registry.setQuota(agentB, address(mockNFT), 1);
        registry.setQuota(agentC, address(mockNFT), 1);
        vm.stopPrank();

        // Get first 2
        address[] memory page1 = registry.getAgents(0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], agentA);
        assertEq(page1[1], agentB);

        // Get remaining
        address[] memory page2 = registry.getAgents(2, 10);
        assertEq(page2.length, 1);
        assertEq(page2[0], agentC);

        // Offset beyond length
        address[] memory empty = registry.getAgents(100, 10);
        assertEq(empty.length, 0);
    }

    function test_GetAgentCount() public {
        assertEq(registry.getAgentCount(), 0);

        vm.startPrank(admin);
        registry.setQuota(agentA, address(mockNFT), 1);
        assertEq(registry.getAgentCount(), 1);

        registry.setQuota(agentB, address(mockNFT), 1);
        assertEq(registry.getAgentCount(), 2);

        // Setting quota again doesn't double-count
        registry.setQuota(agentA, address(mockNFT), 5);
        assertEq(registry.getAgentCount(), 2);
        vm.stopPrank();
    }

    // ════════════════════════════════════════════════════════════════════
    //                    FUZZ TESTS
    // ════════════════════════════════════════════════════════════════════

    function testFuzz_DeductNeverExceedsQuota(uint256 quota, uint256 amount) public {
        quota = bound(quota, 1, 1000);
        amount = bound(amount, 1, 1000);

        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), quota);

        if (amount <= quota) {
            vm.prank(address(mockNFT));
            registry.deductQuota(agentA, amount);
            assertEq(registry.agentMinted(agentA, address(mockNFT)), amount);
            assertEq(registry.getRemaining(agentA, address(mockNFT)), quota - amount);
        } else {
            vm.prank(address(mockNFT));
            vm.expectRevert();
            registry.deductQuota(agentA, amount);
        }
    }

    function testFuzz_SetQuotaMustBeAboveMinted(uint256 initialQuota, uint256 mintAmount, uint256 newQuota) public {
        initialQuota = bound(initialQuota, 1, 1000);
        mintAmount = bound(mintAmount, 1, initialQuota);
        newQuota = bound(newQuota, 0, 1000);

        vm.prank(admin);
        registry.setQuota(agentA, address(mockNFT), initialQuota);

        vm.prank(address(mockNFT));
        registry.deductQuota(agentA, mintAmount);

        if (newQuota >= mintAmount) {
            vm.prank(admin);
            registry.setQuota(agentA, address(mockNFT), newQuota);
            assertEq(registry.agentQuota(agentA, address(mockNFT)), newQuota);
        } else {
            vm.prank(admin);
            vm.expectRevert();
            registry.setQuota(agentA, address(mockNFT), newQuota);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════════
//                INTEGRATION TESTS: ComputePass + AgentRegistry
// ════════════════════════════════════════════════════════════════════════════════

contract AgentRegistryIntegrationTest is Test {
    AgentRegistry public registry;
    ComputePass public computePassImpl;
    ComputePass public computePass;
    SolarPass public solarPassImpl;
    SolarPass public solarPass;
    MockUSDT public usdt;

    address public owner = makeAddr("owner");
    address public treasury = makeAddr("treasury");
    address public agentA = makeAddr("agentA");
    address public agentB = makeAddr("agentB");
    address public buyer1 = makeAddr("buyer1");
    address public buyer2 = makeAddr("buyer2");
    address public buyer3 = makeAddr("buyer3");

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AGENT_MINTER_ROLE = keccak256("AGENT_MINTER_ROLE");

    uint256 public constant AGENT_PRICE_COMPUTE = 499 * 10 ** 6;
    uint256 public constant AGENT_PRICE_SOLAR = 199 * 10 ** 6;

    function setUp() public {
        usdt = new MockUSDT();

        // Deploy AgentRegistry
        vm.startPrank(owner);
        registry = new AgentRegistry(owner);

        // Deploy ComputePass via proxy
        computePassImpl = new ComputePass();
        bytes memory computeInitData = abi.encodeCall(
            ComputePass.initialize,
            (
                "ComputePass",
                "COMPUTE",
                owner,
                address(usdt),
                treasury,
                bytes32(0),
                block.timestamp,
                block.timestamp + 1
            )
        );
        ERC1967Proxy computeProxy = new ERC1967Proxy(address(computePassImpl), computeInitData);
        computePass = ComputePass(address(computeProxy));

        // Deploy SolarPass via proxy
        solarPassImpl = new SolarPass();
        bytes memory solarInitData = abi.encodeCall(
            SolarPass.initialize,
            (
                "SolarPass",
                "SOLAR",
                owner,
                address(usdt),
                treasury,
                bytes32(0),
                block.timestamp,
                block.timestamp + 1
            )
        );
        ERC1967Proxy solarProxy = new ERC1967Proxy(address(solarPassImpl), solarInitData);
        solarPass = SolarPass(address(solarProxy));

        // Grant agent roles on NFT contracts
        computePass.grantAgentRole(agentA);
        computePass.grantAgentRole(agentB);
        solarPass.grantAgentRole(agentA);

        // Register NFT contracts in AgentRegistry
        registry.registerNFTContract(address(computePass));
        registry.registerNFTContract(address(solarPass));

        // Set agent quotas
        registry.setQuota(agentA, address(computePass), 5);
        registry.setQuota(agentA, address(solarPass), 10);
        registry.setQuota(agentB, address(computePass), 3);

        // Set AgentRegistry on NFT contracts
        computePass.setAgentRegistry(address(registry));
        solarPass.setAgentRegistry(address(registry));

        vm.stopPrank();

        // Fund agents with USDT
        usdt.mint(agentA, 500_000 * 10 ** 6);
        usdt.mint(agentB, 500_000 * 10 ** 6);

        vm.prank(agentA);
        usdt.approve(address(computePass), type(uint256).max);
        vm.prank(agentA);
        usdt.approve(address(solarPass), type(uint256).max);
        vm.prank(agentB);
        usdt.approve(address(computePass), type(uint256).max);
    }

    function test_Integration_AgentMintDeductsFromRegistry() public {
        address[] memory recipients = new address[](1);
        recipients[0] = buyer1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        vm.prank(agentA);
        computePass.agentMint(recipients, amounts);

        // Check Registry state
        (uint256 quota, uint256 minted, uint256 remaining) = registry.getAgentInfo(agentA, address(computePass));
        assertEq(quota, 5);
        assertEq(minted, 1);
        assertEq(remaining, 4);

        // Check NFT was minted
        assertEq(computePass.ownerOf(1), buyer1);
    }

    function test_Integration_AgentMintMultipleRecipients() public {
        address[] memory recipients = new address[](2);
        recipients[0] = buyer1;
        recipients[1] = buyer2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.prank(agentA);
        computePass.agentMint(recipients, amounts);

        assertEq(registry.getRemaining(agentA, address(computePass)), 3);
        assertEq(computePass.ownerOf(1), buyer1);
        assertEq(computePass.ownerOf(2), buyer2);
    }

    function test_Integration_AgentMintRevertsWhenQuotaExhausted() public {
        // agentB has quota of 3 for ComputePass
        address[] memory recipients = new address[](1);
        recipients[0] = buyer1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        vm.startPrank(agentB);
        // Mint 3 (exhaust quota)
        for (uint256 i = 0; i < 3; i++) {
            recipients[0] = makeAddr(string(abi.encodePacked("buyer_", i)));
            computePass.agentMint(recipients, amounts);
        }

        // 4th should revert
        recipients[0] = buyer3;
        vm.expectRevert();
        computePass.agentMint(recipients, amounts);
        vm.stopPrank();

        assertEq(registry.getRemaining(agentB, address(computePass)), 0);
    }

    function test_Integration_MultipleAgentsMintIndependently() public {
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        // agentA mints 2
        recipients[0] = buyer1;
        vm.prank(agentA);
        computePass.agentMint(recipients, amounts);

        recipients[0] = buyer2;
        vm.prank(agentA);
        computePass.agentMint(recipients, amounts);

        // agentB mints 1
        recipients[0] = buyer3;
        vm.prank(agentB);
        computePass.agentMint(recipients, amounts);

        // Verify independent tracking
        assertEq(registry.getRemaining(agentA, address(computePass)), 3); // 5 - 2
        assertEq(registry.getRemaining(agentB, address(computePass)), 2); // 3 - 1
    }

    function test_Integration_CrossContractQuotaIndependence() public {
        address[] memory recipients = new address[](1);
        recipients[0] = buyer1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        // agentA mints on ComputePass
        vm.prank(agentA);
        computePass.agentMint(recipients, amounts);

        // agentA mints on SolarPass
        vm.prank(agentA);
        solarPass.agentMint(recipients, amounts);

        // Quotas are independent per contract
        assertEq(registry.getRemaining(agentA, address(computePass)), 4); // 5 - 1
        assertEq(registry.getRemaining(agentA, address(solarPass)), 9); // 10 - 1
    }

    function test_Integration_USDTPaymentToTreasury() public {
        uint256 treasuryBefore = usdt.balanceOf(treasury);

        address[] memory recipients = new address[](2);
        recipients[0] = buyer1;
        recipients[1] = buyer2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.prank(agentA);
        computePass.agentMint(recipients, amounts);

        uint256 treasuryAfter = usdt.balanceOf(treasury);
        assertEq(treasuryAfter - treasuryBefore, 2 * AGENT_PRICE_COMPUTE);
    }
}
