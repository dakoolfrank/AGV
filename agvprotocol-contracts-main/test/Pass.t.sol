// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../contracts/nft/SeedPass.sol";
import "../contracts/nft/TreePass.sol";
import "../contracts/nft/SolarPass.sol";
import "../contracts/nft/ComputePass.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ────────────────────────────────────────────
//  Mock USDT — BSC USDT has 18 decimals
// ────────────────────────────────────────────
contract MockUSDT is ERC20 {
    constructor() ERC20("Binance-Peg BSC-USD", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ────────────────────────────────────────────
//  Mock V2 — for UUPS upgrade test
// ────────────────────────────────────────────
contract SeedPassV2 is SeedPass {
    function version() public pure returns (string memory) {
        return "v2";
    }
}

// ════════════════════════════════════════════
//  Main Test Suite
// ════════════════════════════════════════════
contract PassTest is Test {
    // ── Contracts ──
    SeedPass public seedImpl;
    SeedPass public seed;
    MockUSDT public usdt;
    ERC1967Proxy public proxy;

    // ── Addresses ──
    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public attacker = makeAddr("attacker");

    // ── Constants ──
    uint256 public constant SEED_PRICE = 29 * 1e18;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    // ── Events (mirror for expectEmit) ──
    event Mint(address indexed buyer, uint256 quantity, uint256 payment);
    event AdminMint(address indexed to, uint256 quantity);
    event AgentMintFulfilled(address indexed agent, address indexed to, uint256 quantity);
    event LicenseGranted(address indexed agent, uint256 tokenId, uint256 quota);
    event LicenseRevoked(address indexed agent, uint256 tokenId);
    event QuotaAdjusted(address indexed agent, uint256 oldQuota, uint256 newQuota);
    event SaleActiveChanged(bool active);

    function setUp() public {
        usdt = new MockUSDT();

        seedImpl = new SeedPass();

        bytes memory initData =
            abi.encodeCall(SeedPass.initialize, (admin, address(usdt), treasury));

        proxy = new ERC1967Proxy(address(seedImpl), initData);
        seed = SeedPass(address(proxy));

        // Fund users with USDT and approve
        usdt.mint(user1, 100_000 * 1e18);
        usdt.mint(user2, 100_000 * 1e18);

        vm.prank(user1);
        usdt.approve(address(seed), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(seed), type(uint256).max);
    }

    // ════════════════════════════════════════
    //  Initialization
    // ════════════════════════════════════════

    function test_InitializeCorrectly() public view {
        assertEq(seed.name(), "Seed Pass");
        assertEq(seed.symbol(), "SEED");
        assertEq(seed.price(), SEED_PRICE);
        assertEq(address(seed.usdtToken()), address(usdt));
        assertEq(seed.treasury(), treasury);
        assertTrue(seed.saleActive());
        assertFalse(seed.metadataFrozen());
        assertTrue(seed.hasRole(seed.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(seed.hasRole(ADMIN_ROLE, admin));
        assertTrue(seed.hasRole(TREASURER_ROLE, treasury));
    }

    function test_InitializeRevertZeroAddress() public {
        SeedPass impl2 = new SeedPass();

        // Zero admin
        vm.expectRevert(PassBase.ZeroAddress.selector);
        new ERC1967Proxy(
            address(impl2),
            abi.encodeCall(SeedPass.initialize, (address(0), address(usdt), treasury))
        );
    }

    function test_InitializeCannotReinit() public {
        vm.expectRevert();
        seed.initialize(admin, address(usdt), treasury);
    }

    function test_SupplyInfoInitial() public view {
        (uint256 minted, uint256 max, uint256 remaining) = seed.supplyInfo();
        assertEq(minted, 0);
        assertEq(max, 1_000_000);
        assertEq(remaining, 1_000_000);
    }

    // ════════════════════════════════════════
    //  Public Mint
    // ════════════════════════════════════════

    function test_MintSuccessful() public {
        vm.prank(user1);

        vm.expectEmit(true, false, false, true);
        emit Mint(user1, 3, 3 * SEED_PRICE);

        seed.mint(3);

        assertEq(seed.balanceOf(user1), 3);
        assertEq(seed.ownerOf(1), user1);
        assertEq(seed.ownerOf(3), user1);
        assertEq(usdt.balanceOf(treasury), 3 * SEED_PRICE);
    }

    function test_MintRevertSaleNotActive() public {
        vm.prank(admin);
        seed.setSaleActive(false);

        vm.prank(user1);
        vm.expectRevert(PassBase.SaleNotActive.selector);
        seed.mint(1);
    }

    function test_MintRevertZeroQuantity() public {
        vm.prank(user1);
        vm.expectRevert(PassBase.ZeroQuantity.selector);
        seed.mint(0);
    }

    function test_MintRevertExceedsMaxSupply() public {
        // Directly poke ERC721A internal _currentIndex to simulate MAX_SUPPLY reached.
        // ERC721AStorage.Layout._currentIndex is at slot keccak256('ERC721A.contracts.storage.ERC721A')
        // _startTokenId()=1, so _currentIndex=1_000_001 ⇒ totalSupply()=1_000_000
        bytes32 slot = keccak256("ERC721A.contracts.storage.ERC721A");
        vm.store(address(seed), slot, bytes32(uint256(1_000_001)));
        assertEq(seed.totalSupply(), 1_000_000);

        vm.prank(user1);
        vm.expectRevert(PassBase.ExceedsMaxSupply.selector);
        seed.mint(1);
    }

    function test_MintRevertInsufficientUSDT() public {
        address poorUser = makeAddr("poorUser");
        vm.prank(poorUser);
        usdt.approve(address(seed), type(uint256).max);

        vm.prank(poorUser);
        vm.expectRevert(); // SafeERC20 will revert
        seed.mint(1);
    }

    function test_MintRevertWhenPaused() public {
        vm.prank(admin);
        seed.pause();

        vm.prank(user1);
        vm.expectRevert();
        seed.mint(1);
    }

    // ════════════════════════════════════════
    //  Admin Mint
    // ════════════════════════════════════════

    function test_AdminMintSuccessful() public {
        vm.prank(admin);

        vm.expectEmit(true, false, false, true);
        emit AdminMint(user2, 5);

        seed.adminMint(user2, 5);

        assertEq(seed.balanceOf(user2), 5);
        // No USDT charged
        assertEq(usdt.balanceOf(treasury), 0);
    }

    function test_AdminMintRevertUnauthorized() public {
        vm.prank(attacker);
        vm.expectRevert();
        seed.adminMint(user1, 1);
    }

    function test_AdminMintRevertZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.ZeroAddress.selector);
        seed.adminMint(address(0), 1);
    }

    function test_AdminMintRevertZeroQuantity() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.ZeroQuantity.selector);
        seed.adminMint(user1, 0);
    }

    // ════════════════════════════════════════
    //  License — Grant
    // ════════════════════════════════════════

    function test_GrantLicenseSuccessful() public {
        vm.prank(admin);

        vm.expectEmit(true, false, false, true);
        emit LicenseGranted(agent1, 1, 100); // tokenId = 1 (first mint)

        seed.grantLicense(agent1, 100);

        // Agent holds 1 NFT (the license)
        assertEq(seed.balanceOf(agent1), 1);
        assertEq(seed.ownerOf(1), agent1);
        assertTrue(seed.isLicenseToken(1));

        // License query
        (uint256 tid, uint256 quota, uint256 used, uint256 rem, bool active) = seed.getLicense(agent1);
        assertEq(tid, 1);
        assertEq(quota, 100);
        assertEq(used, 0);
        assertEq(rem, 100);
        assertTrue(active);
    }

    function test_GrantLicenseRevertAlreadyLicensed() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 50);

        vm.expectRevert(PassBase.AlreadyLicensed.selector);
        seed.grantLicense(agent1, 100);
        vm.stopPrank();
    }

    function test_GrantLicenseRevertZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.ZeroAddress.selector);
        seed.grantLicense(address(0), 100);
    }

    function test_GrantLicenseRevertZeroQuota() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.ZeroQuantity.selector);
        seed.grantLicense(agent1, 0);
    }

    function test_GrantLicenseRevertUnauthorized() public {
        vm.prank(attacker);
        vm.expectRevert();
        seed.grantLicense(agent1, 100);
    }

    // ════════════════════════════════════════
    //  License — Revoke
    // ════════════════════════════════════════

    function test_RevokeLicenseSuccessful() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 50);

        vm.expectEmit(true, false, false, true);
        emit LicenseRevoked(agent1, 1);

        seed.revokeLicense(agent1);
        vm.stopPrank();

        (, , , uint256 rem, bool active) = seed.getLicense(agent1);
        assertFalse(active);
        assertEq(rem, 0); // remaining = 0 when inactive

        // Agent still owns the NFT (it's just inactive)
        assertEq(seed.balanceOf(agent1), 1);
    }

    function test_RevokeLicenseRevertNotLicensed() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.NotLicensed.selector);
        seed.revokeLicense(agent1);
    }

    function test_RevokeLicenseRevertUnauthorized() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 50);
        vm.stopPrank();

        vm.prank(attacker);
        vm.expectRevert();
        seed.revokeLicense(agent1);
    }

    // ════════════════════════════════════════
    //  License — Adjust Quota
    // ════════════════════════════════════════

    function test_AdjustQuotaSuccessful() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 50);

        vm.expectEmit(true, false, false, true);
        emit QuotaAdjusted(agent1, 50, 200);

        seed.adjustQuota(agent1, 200);
        vm.stopPrank();

        (, uint256 quota, , uint256 rem, ) = seed.getLicense(agent1);
        assertEq(quota, 200);
        assertEq(rem, 200);
    }

    function test_AdjustQuotaRevertBelowUsed() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 100);
        // Use 30 quota
        seed.adminMintForAgent(agent1, user1, 30);

        vm.expectRevert(PassBase.QuotaBelowUsed.selector);
        seed.adjustQuota(agent1, 20); // 20 < 30 used
        vm.stopPrank();
    }

    function test_AdjustQuotaRevertNotLicensed() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.NotLicensed.selector);
        seed.adjustQuota(agent1, 100);
    }

    // ════════════════════════════════════════
    //  Admin Mint For Agent
    // ════════════════════════════════════════

    function test_AdminMintForAgentSuccessful() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 100);

        vm.expectEmit(true, true, false, true);
        emit AgentMintFulfilled(agent1, user1, 10);

        seed.adminMintForAgent(agent1, user1, 10);
        vm.stopPrank();

        // user1 received 10 NFTs
        assertEq(seed.balanceOf(user1), 10);
        // agent quota updated
        (, , uint256 used, uint256 rem, ) = seed.getLicense(agent1);
        assertEq(used, 10);
        assertEq(rem, 90);
    }

    function test_AdminMintForAgentDeductsQuota() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 20);
        seed.adminMintForAgent(agent1, user1, 8);
        seed.adminMintForAgent(agent1, user2, 12);
        vm.stopPrank();

        (, , uint256 used, uint256 rem, ) = seed.getLicense(agent1);
        assertEq(used, 20);
        assertEq(rem, 0);
    }

    function test_AdminMintForAgentRevertExceedsQuota() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 5);

        vm.expectRevert(PassBase.ExceedsQuota.selector);
        seed.adminMintForAgent(agent1, user1, 6);
        vm.stopPrank();
    }

    function test_AdminMintForAgentRevertNotLicensed() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.NotLicensed.selector);
        seed.adminMintForAgent(agent1, user1, 1);
    }

    function test_AdminMintForAgentRevertRevokedLicense() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 100);
        seed.revokeLicense(agent1);

        vm.expectRevert(PassBase.NotLicensed.selector);
        seed.adminMintForAgent(agent1, user1, 1);
        vm.stopPrank();
    }

    function test_AdminMintForAgentRevertUnauthorized() public {
        vm.startPrank(admin);
        seed.grantLicense(agent1, 100);
        vm.stopPrank();

        vm.prank(attacker);
        vm.expectRevert();
        seed.adminMintForAgent(agent1, user1, 1);
    }

    // ════════════════════════════════════════
    //  Soulbound Enforcement
    // ════════════════════════════════════════

    function test_LicenseTokenIsSoulbound() public {
        vm.prank(admin);
        seed.grantLicense(agent1, 50);

        // Try to transfer the license NFT
        vm.prank(agent1);
        vm.expectRevert(PassBase.SoulboundToken.selector);
        seed.transferFrom(agent1, user1, 1);
    }

    function test_CollectibleTokenIsTransferable() public {
        // Mint a normal collectible
        vm.prank(user1);
        seed.mint(1);

        assertEq(seed.ownerOf(1), user1);
        assertFalse(seed.isLicenseToken(1));

        // Transfer should succeed
        vm.prank(user1);
        seed.transferFrom(user1, user2, 1);
        assertEq(seed.ownerOf(1), user2);
    }

    function test_IsLicenseTokenQuery() public {
        // Mint collectible first
        vm.prank(user1);
        seed.mint(2); // tokens 1, 2

        // Grant license → token 3
        vm.prank(admin);
        seed.grantLicense(agent1, 50);

        assertFalse(seed.isLicenseToken(1));
        assertFalse(seed.isLicenseToken(2));
        assertTrue(seed.isLicenseToken(3));
    }

    // ════════════════════════════════════════
    //  Metadata — Dual URI
    // ════════════════════════════════════════

    function test_TokenURICollectible() public {
        vm.prank(admin);
        seed.setCollectibleBaseURI("https://api.agv.ai/nft/seed/");

        vm.prank(user1);
        seed.mint(1);

        assertEq(seed.tokenURI(1), "https://api.agv.ai/nft/seed/1");
    }

    function test_TokenURILicense() public {
        vm.startPrank(admin);
        seed.setLicenseBaseURI("https://api.agv.ai/license/seed/");
        seed.grantLicense(agent1, 50);
        vm.stopPrank();

        assertEq(seed.tokenURI(1), "https://api.agv.ai/license/seed/1");
    }

    function test_TokenURIEmptyBase() public {
        vm.prank(user1);
        seed.mint(1);

        assertEq(seed.tokenURI(1), "");
    }

    function test_SetBaseURIsRevertWhenFrozen() public {
        vm.startPrank(admin);
        seed.freezeMetadata();

        vm.expectRevert(PassBase.MetadataIsFrozen.selector);
        seed.setCollectibleBaseURI("https://x/");

        vm.expectRevert(PassBase.MetadataIsFrozen.selector);
        seed.setLicenseBaseURI("https://x/");
        vm.stopPrank();
    }

    function test_FreezeMetadata() public {
        vm.prank(admin);
        seed.freezeMetadata();
        assertTrue(seed.metadataFrozen());
    }

    // ════════════════════════════════════════
    //  Supply & Query
    // ════════════════════════════════════════

    function test_SupplyInfoAfterMints() public {
        vm.prank(user1);
        seed.mint(5);

        vm.prank(admin);
        seed.adminMint(user2, 3);

        vm.prank(admin);
        seed.grantLicense(agent1, 50); // +1 license NFT

        (uint256 minted, uint256 max, uint256 remaining) = seed.supplyInfo();
        assertEq(minted, 9); // 5 + 3 + 1
        assertEq(max, 1_000_000);
        assertEq(remaining, 999_991);
    }

    function test_GetLicenseInactive() public {
        // No license → all zeros
        (uint256 tid, uint256 quota, uint256 used, uint256 rem, bool active) = seed.getLicense(agent1);
        assertEq(tid, 0);
        assertEq(quota, 0);
        assertEq(used, 0);
        assertEq(rem, 0);
        assertFalse(active);
    }

    function test_NumberMinted() public {
        vm.prank(user1);
        seed.mint(3);

        assertEq(seed.numberMinted(user1), 3);
        assertEq(seed.numberMinted(user2), 0);
    }

    // ════════════════════════════════════════
    //  Admin Config
    // ════════════════════════════════════════

    function test_SetSaleActive() public {
        vm.startPrank(admin);

        vm.expectEmit(false, false, false, true);
        emit SaleActiveChanged(false);
        seed.setSaleActive(false);
        assertFalse(seed.saleActive());

        seed.setSaleActive(true);
        assertTrue(seed.saleActive());
        vm.stopPrank();
    }

    function test_SetTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(admin);
        seed.setTreasury(newTreasury);
        assertEq(seed.treasury(), newTreasury);
    }

    function test_SetTreasuryRevertZero() public {
        vm.prank(admin);
        vm.expectRevert(PassBase.ZeroAddress.selector);
        seed.setTreasury(address(0));
    }

    function test_WithdrawTreasury() public {
        // Send some USDT to contract accidentally
        usdt.mint(address(seed), 1000 * 1e18);

        uint256 before = usdt.balanceOf(treasury);
        vm.prank(treasury);
        seed.withdrawTreasury(address(usdt));

        assertEq(usdt.balanceOf(treasury) - before, 1000 * 1e18);
        assertEq(usdt.balanceOf(address(seed)), 0);
    }

    function test_WithdrawTreasuryRevertUnauthorized() public {
        vm.prank(attacker);
        vm.expectRevert();
        seed.withdrawTreasury(address(usdt));
    }

    function test_SetRoyaltyInfo() public {
        vm.prank(admin);
        seed.setRoyaltyInfo(treasury, 300); // 3%

        vm.prank(user1);
        seed.mint(1);

        (address receiver, uint256 amount) = seed.royaltyInfo(1, 10000);
        assertEq(receiver, treasury);
        assertEq(amount, 300); // 3% of 10000
    }

    // ════════════════════════════════════════
    //  Pause / Unpause
    // ════════════════════════════════════════

    function test_PauseBlocksMint() public {
        vm.prank(admin);
        seed.pause();

        vm.prank(user1);
        vm.expectRevert();
        seed.mint(1);
    }

    function test_PauseBlocksAdminMint() public {
        vm.startPrank(admin);
        seed.pause();

        vm.expectRevert();
        seed.adminMint(user1, 1);
        vm.stopPrank();
    }

    function test_UnpauseAllowsMint() public {
        vm.startPrank(admin);
        seed.pause();
        seed.unpause();
        vm.stopPrank();

        vm.prank(user1);
        seed.mint(1);
        assertEq(seed.balanceOf(user1), 1);
    }

    // ════════════════════════════════════════
    //  UUPS Upgrade
    // ════════════════════════════════════════

    function test_UpgradeSuccessful() public {
        SeedPassV2 v2Impl = new SeedPassV2();

        vm.prank(admin);
        seed.upgradeToAndCall(address(v2Impl), "");

        SeedPassV2 seedV2 = SeedPassV2(address(proxy));
        assertEq(seedV2.version(), "v2");
        // Old state preserved
        assertEq(seedV2.name(), "Seed Pass");
        assertEq(seedV2.price(), SEED_PRICE);
    }

    function test_UpgradeRevertUnauthorized() public {
        SeedPassV2 v2Impl = new SeedPassV2();

        vm.prank(attacker);
        vm.expectRevert();
        seed.upgradeToAndCall(address(v2Impl), "");
    }

    // ════════════════════════════════════════
    //  supportsInterface (ERC165)
    // ════════════════════════════════════════

    function test_SupportsERC721() public view {
        assertTrue(seed.supportsInterface(0x80ac58cd)); // ERC721
    }

    function test_SupportsERC2981() public view {
        assertTrue(seed.supportsInterface(0x2a55205a)); // ERC2981
    }

    function test_SupportsAccessControl() public view {
        assertTrue(seed.supportsInterface(0x7965db0b)); // IAccessControl
    }

    // ════════════════════════════════════════
    //  All 4 Children — Price Checks
    // ════════════════════════════════════════

    function test_SeedPassPrice() public view {
        assertEq(seed.price(), 29 * 1e18);
    }

    function test_TreePassPrice() public {
        TreePass treeImpl = new TreePass();
        ERC1967Proxy treeProxy = new ERC1967Proxy(
            address(treeImpl),
            abi.encodeCall(TreePass.initialize, (admin, address(usdt), treasury))
        );
        TreePass tree = TreePass(address(treeProxy));

        assertEq(tree.price(), 59 * 1e18);
        assertEq(tree.name(), "Tree Pass");
        assertEq(tree.symbol(), "TREE");
    }

    function test_SolarPassPrice() public {
        SolarPass solarImpl = new SolarPass();
        ERC1967Proxy solarProxy = new ERC1967Proxy(
            address(solarImpl),
            abi.encodeCall(SolarPass.initialize, (admin, address(usdt), treasury))
        );
        SolarPass solar = SolarPass(address(solarProxy));

        assertEq(solar.price(), 299 * 1e18);
        assertEq(solar.name(), "Solar Pass");
        assertEq(solar.symbol(), "SOLAR");
    }

    function test_ComputePassPrice() public {
        ComputePass compImpl = new ComputePass();
        ERC1967Proxy compProxy = new ERC1967Proxy(
            address(compImpl),
            abi.encodeCall(ComputePass.initialize, (admin, address(usdt), treasury))
        );
        ComputePass comp = ComputePass(address(compProxy));

        assertEq(comp.price(), 899 * 1e18);
        assertEq(comp.name(), "Compute Pass");
        assertEq(comp.symbol(), "COMP");
    }

    // ════════════════════════════════════════
    //  End-to-End Scenario
    // ════════════════════════════════════════

    function test_FullBusinessFlow() public {
        // 1. Admin grants license to Agent1
        vm.prank(admin);
        seed.grantLicense(agent1, 50);

        // 2. User1 buys 2 NFTs directly
        vm.prank(user1);
        seed.mint(2);

        // 3. Agent1 sells 10 off-chain → Admin settles on-chain
        vm.prank(admin);
        seed.adminMintForAgent(agent1, user2, 10);

        // 4. Admin airdrops 5 to user1
        vm.prank(admin);
        seed.adminMint(user1, 5);

        // 5. Verify final state
        assertEq(seed.balanceOf(user1), 7); // 2 mint + 5 airdrop
        assertEq(seed.balanceOf(user2), 10); // agent settlement
        assertEq(seed.balanceOf(agent1), 1); // license NFT only

        (uint256 minted, , ) = seed.supplyInfo();
        assertEq(minted, 18); // 1 license + 2 mint + 10 agent + 5 airdrop

        (, , uint256 used, uint256 rem, ) = seed.getLicense(agent1);
        assertEq(used, 10);
        assertEq(rem, 40);

        // USDT: only user1's 2 mints charged
        assertEq(usdt.balanceOf(treasury), 2 * SEED_PRICE);

        // 6. License token is soulbound, collectibles are transferable
        vm.prank(agent1);
        vm.expectRevert(PassBase.SoulboundToken.selector);
        seed.transferFrom(agent1, user1, 1); // tokenId 1 = license

        vm.prank(user1);
        seed.transferFrom(user1, user2, 2); // tokenId 2 = collectible → OK
        assertEq(seed.ownerOf(2), user2);
    }
}
