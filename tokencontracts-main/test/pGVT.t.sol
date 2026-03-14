// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../contracts/tokens/pGVT.sol";

// ===================== Mock Contracts =====================

contract MockUSDT {
    string public name = "Mock USDT";
    string public symbol = "USDT";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockMigrator is IMigrator {
    address public lastUser;
    uint256 public lastAmount;
    uint256 public totalMigrated;

    function migrateToGVT(address user, uint256 amount) external override {
        lastUser = user;
        lastAmount = amount;
        totalMigrated += amount;
    }
}

contract MockStaking is IStakingContract {
    mapping(address => uint256) public stakeEndTimes;

    function setStakeEndTime(address user, uint256 endTime) external {
        stakeEndTimes[user] = endTime;
    }

    function getStakeEndTime(address user) external view override returns (uint256) {
        return stakeEndTimes[user];
    }
}

// ===================== Tests =====================

contract pGVTTest is Test {
    pGVT public pgvt;
    MockUSDT public usdt;
    MockMigrator public migrator;
    MockStaking public staking;

    address public admin = address(1);
    address public user1 = address(3);
    address public user2 = address(4);
    address public treasuryAddr = address(5);

    uint256 constant MAX_SUPPLY = 100_000_000 * 10 ** 18;
    uint256 constant PRICE = 5e15; // 0.005 USDT per pGVT
    uint256 constant PRESALE_CAP = 10_000_000 * 10 ** 18;

    function setUp() public {
        vm.startPrank(admin);

        pgvt = new pGVT(admin);
        usdt = new MockUSDT();
        migrator = new MockMigrator();
        staking = new MockStaking();

        // Configure presale
        pgvt.setPaymentToken(address(usdt));
        pgvt.setTreasury(treasuryAddr);
        pgvt.setPresaleConfig(PRICE, PRESALE_CAP, 0);
        pgvt.setPresaleActive(true);

        // Configure GVT conversion
        pgvt.setGvtToken(address(usdt)); // placeholder — just needs non-zero
        pgvt.setMigrator(address(migrator));

        vm.stopPrank();
    }

    // ===================== Initial State =====================

    function testInitialState() public view {
        assertEq(pgvt.name(), "pGVT");
        assertEq(pgvt.symbol(), "pGVT");
        assertEq(pgvt.decimals(), 18);
        assertEq(pgvt.MAX_SUPPLY(), MAX_SUPPLY);
        assertEq(pgvt.totalSupply(), 0);
        assertEq(pgvt.totalMinted(), 0);
        assertFalse(pgvt.vestingSealed());
        assertFalse(pgvt.globalVestingEnabled());
        assertFalse(pgvt.stakingEnabled());
    }

    function testAllRolesGrantedToAdmin() public view {
        assertTrue(pgvt.hasRole(pgvt.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(pgvt.hasRole(pgvt.MINTER_ROLE(), admin));
        assertTrue(pgvt.hasRole(pgvt.VESTING_CONFIG_ROLE(), admin));
        assertTrue(pgvt.hasRole(pgvt.PRICE_MANAGER_ROLE(), admin));
        assertTrue(pgvt.hasRole(pgvt.TREASURY_ROLE(), admin));
        assertTrue(pgvt.hasRole(pgvt.STAKING_MANAGER_ROLE(), admin));
        assertTrue(pgvt.hasRole(pgvt.SYSTEM_ROLE(), admin));
    }

    // ===================== Minting =====================

    function testMintSuccess() public {
        uint256 amount = 1_000_000 * 10 ** 18;

        vm.prank(admin);
        pgvt.mint(user1, amount);

        assertEq(pgvt.balanceOf(user1), amount);
        assertEq(pgvt.totalSupply(), amount);
        assertEq(pgvt.totalMinted(), amount);
    }

    function testMintRevertsExceedsMaxSupply() public {
        vm.startPrank(admin);
        pgvt.mint(user1, MAX_SUPPLY);

        vm.expectRevert(pGVT.ExceedsMaxSupply.selector);
        pgvt.mint(user2, 1);
        vm.stopPrank();
    }

    function testMintRevertsZeroAmount() public {
        vm.prank(admin);
        vm.expectRevert(pGVT.ZeroAmount.selector);
        pgvt.mint(user1, 0);
    }

    function testMintRevertsUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.mint(user1, 1000);
    }

    // ===================== Presale (buy) =====================

    function testBuySuccess() public {
        uint256 buyAmount = 1000 * 10 ** 18; // 1000 pGVT
        uint256 cost = (buyAmount * PRICE) / 1e18; // 5e18 (5 USDT-units)

        usdt.mint(user1, cost);
        vm.prank(user1);
        usdt.approve(address(pgvt), cost);

        vm.prank(user1);
        pgvt.buy(buyAmount);

        assertEq(pgvt.balanceOf(user1), buyAmount);
        assertEq(pgvt.presaleSold(), buyAmount);
        assertEq(usdt.balanceOf(treasuryAddr), cost);
    }

    function testBuyRevertsWhenNotActive() public {
        vm.prank(admin);
        pgvt.setPresaleActive(false);

        vm.prank(user1);
        vm.expectRevert(pGVT.PresaleNotActive.selector);
        pgvt.buy(1000);
    }

    function testBuyRevertsExceedsPresaleCap() public {
        uint256 overCap = PRESALE_CAP + 1;
        uint256 cost = (overCap * PRICE) / 1e18;

        usdt.mint(user1, cost);
        vm.prank(user1);
        usdt.approve(address(pgvt), cost);

        vm.prank(user1);
        vm.expectRevert(pGVT.ExceedsPresaleCap.selector);
        pgvt.buy(overCap);
    }

    function testBuyRevertsExceedsUserLimit() public {
        vm.prank(admin);
        pgvt.setPresaleConfig(PRICE, PRESALE_CAP, 500 * 10 ** 18); // max 500 per user

        uint256 amount = 501 * 10 ** 18;
        uint256 cost = (amount * PRICE) / 1e18;
        usdt.mint(user1, cost);
        vm.prank(user1);
        usdt.approve(address(pgvt), cost);

        vm.prank(user1);
        vm.expectRevert(pGVT.ExceedsUserLimit.selector);
        pgvt.buy(amount);
    }

    function testBuyAppliesGlobalVesting() public {
        // Set up global vesting: 1 year, 3 month cliff
        vm.prank(admin);
        pgvt.setGlobalVesting(
            uint64(block.timestamp),
            uint64(90 days),
            uint64(365 days)
        );

        uint256 buyAmount = 1000 * 10 ** 18;
        uint256 cost = (buyAmount * PRICE) / 1e18;
        usdt.mint(user1, cost);
        vm.prank(user1);
        usdt.approve(address(pgvt), cost);

        vm.prank(user1);
        pgvt.buy(buyAmount);

        // Should have vesting schedule set
        (uint64 start,,, uint256 total,) = pgvt.vestingSchedules(user1);
        assertEq(total, buyAmount);
        assertEq(uint256(start), block.timestamp);
    }

    function testCalculateCost() public view {
        uint256 amount = 1000 * 10 ** 18;
        uint256 cost = pgvt.calculateCost(amount);
        assertEq(cost, (amount * PRICE) / 1e18);
    }

    // ===================== Price Stages =====================

    function testSetPriceStages() public {
        uint256[] memory prices = new uint256[](2);
        prices[0] = 5e15;
        prices[1] = 10e15;
        uint256[] memory caps = new uint256[](2);
        caps[0] = 5_000_000 * 10 ** 18;
        caps[1] = 10_000_000 * 10 ** 18;

        vm.prank(admin);
        pgvt.setPriceStages(prices, caps);

        assertEq(pgvt.getCurrentStage(), 0);
        assertEq(pgvt.getCurrentPrice(), 5e15);
    }

    function testGetCurrentStageAdvancesWithSales() public {
        uint256[] memory prices = new uint256[](2);
        prices[0] = 5e15;
        prices[1] = 10e15;
        uint256[] memory caps = new uint256[](2);
        caps[0] = 1000 * 10 ** 18; // Stage 0 cap: 1000
        caps[1] = PRESALE_CAP;

        vm.prank(admin);
        pgvt.setPriceStages(prices, caps);

        // Buy 1000 → fills stage 0
        uint256 cost = (1000 * 10 ** 18 * PRICE) / 1e18;
        usdt.mint(user1, cost);
        vm.prank(user1);
        usdt.approve(address(pgvt), cost);
        vm.prank(user1);
        pgvt.buy(1000 * 10 ** 18);

        // Now stage should be 1
        assertEq(pgvt.getCurrentStage(), 1);
        assertEq(pgvt.getCurrentPrice(), 10e15);
    }

    // ===================== Vesting =====================

    function testSetGlobalVesting() public {
        vm.prank(admin);
        pgvt.setGlobalVesting(
            uint64(block.timestamp),
            uint64(90 days),
            uint64(365 days)
        );

        assertTrue(pgvt.globalVestingEnabled());
        (uint64 start, uint64 cliff, uint64 duration,,) = pgvt.globalVesting();
        assertEq(uint256(start), block.timestamp);
        assertEq(uint256(cliff), 90 days);
        assertEq(uint256(duration), 365 days);
    }

    function testSetVestingSchedule() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(block.timestamp),
            uint64(30 days),
            uint64(180 days),
            1000 * 10 ** 18
        );

        (uint64 start,,, uint256 total,) = pgvt.vestingSchedules(user1);
        assertEq(total, 1000 * 10 ** 18);
        assertEq(uint256(start), block.timestamp);
    }

    function testVestedAmountNoSchedule() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        // No vesting schedule → full balance is vested
        assertEq(pgvt.vestedAmount(user1), 1000 * 10 ** 18);
    }

    function testVestedAmountBeforeCliff() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(block.timestamp),
            uint64(90 days),
            uint64(365 days),
            1000 * 10 ** 18
        );

        // Before cliff → 0 vested
        vm.warp(block.timestamp + 30 days);
        assertEq(pgvt.vestedAmount(user1), 0);
    }

    function testVestedAmountLinear() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        uint256 start = block.timestamp;
        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(start),
            uint64(0),        // no cliff
            uint64(100 days), // 100 day duration
            1000 * 10 ** 18
        );

        // At 50 days → 50% vested
        vm.warp(start + 50 days);
        uint256 vested = pgvt.vestedAmount(user1);
        assertEq(vested, 500 * 10 ** 18);
    }

    function testVestedAmountFullyVested() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(block.timestamp),
            uint64(0),
            uint64(100 days),
            1000 * 10 ** 18
        );

        // After full duration → 100% vested
        vm.warp(block.timestamp + 200 days);
        assertEq(pgvt.vestedAmount(user1), 1000 * 10 ** 18);
    }

    function testTransferBlockedByVesting() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(block.timestamp),
            uint64(90 days), // 90 day cliff
            uint64(365 days),
            1000 * 10 ** 18
        );

        // Before cliff: 0 transferable
        vm.prank(user1);
        vm.expectRevert(pGVT.TransferExceedsUnlocked.selector);
        pgvt.transfer(user2, 1);
    }

    function testTransferAllowedAfterVesting() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(block.timestamp),
            uint64(0),
            uint64(100 days),
            1000 * 10 ** 18
        );

        // At 50% vesting → 500 transferable
        vm.warp(block.timestamp + 50 days);
        uint256 transferable = pgvt.transferableBalance(user1);
        assertEq(transferable, 500 * 10 ** 18);

        // Transfer within limit
        vm.prank(user1);
        pgvt.transfer(user2, 400 * 10 ** 18);
        assertEq(pgvt.balanceOf(user2), 400 * 10 ** 18);
    }

    function testSealVesting() public {
        vm.startPrank(admin);
        pgvt.setGlobalVesting(uint64(block.timestamp), 0, uint64(100 days));
        pgvt.sealVesting();
        vm.stopPrank();
        assertTrue(pgvt.vestingSealed());

        // Cannot set vesting after seal
        vm.prank(admin);
        vm.expectRevert(pGVT.VestingIsSealed.selector);
        pgvt.setGlobalVesting(uint64(block.timestamp), 0, uint64(100 days));
    }

    function testSealVestingRevertsWithoutGlobalVesting() public {
        vm.prank(admin);
        vm.expectRevert("Global vesting not configured");
        pgvt.sealVesting();
    }

    function testMakeVestingImmutable() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.startPrank(admin);
        pgvt.setVestingSchedule(user1, uint64(block.timestamp), 0, uint64(100 days), 1000 * 10 ** 18);
        pgvt.makeVestingImmutable(user1);
        vm.stopPrank();

        // Cannot modify immutable schedule
        vm.prank(admin);
        vm.expectRevert(pGVT.VestingIsImmutable.selector);
        pgvt.setVestingSchedule(user1, uint64(block.timestamp), 0, uint64(200 days), 1000 * 10 ** 18);
    }

    // ===================== Staking Tracking =====================

    function testStakingTransferTracksBalance() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.startPrank(admin);
        pgvt.setStakingEnabled(true);
        pgvt.whitelistStakingContract(address(staking), true);
        vm.stopPrank();

        // Staking contract needs a far-future endTime (no vesting to violate)
        staking.setStakeEndTime(user1, block.timestamp + 365 days);

        vm.prank(user1);
        pgvt.transfer(address(staking), 500 * 10 ** 18);

        assertEq(pgvt.stakedBalances(user1), 500 * 10 ** 18);
    }

    function testStakingViolatesVestingReverts() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        // Set vesting for 365 days
        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(block.timestamp),
            uint64(0),
            uint64(365 days),
            1000 * 10 ** 18
        );

        vm.startPrank(admin);
        pgvt.setStakingEnabled(true);
        pgvt.whitelistStakingContract(address(staking), true);
        vm.stopPrank();

        // Stake end time < vesting end → should revert
        staking.setStakeEndTime(user1, block.timestamp + 100 days);

        vm.prank(user1);
        vm.expectRevert(pGVT.StakeViolatesVesting.selector);
        pgvt.transfer(address(staking), 500 * 10 ** 18);
    }

    function testUnstakeReducesStakedBalance() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.startPrank(admin);
        pgvt.setStakingEnabled(true);
        pgvt.whitelistStakingContract(address(staking), true);
        vm.stopPrank();

        staking.setStakeEndTime(user1, block.timestamp + 365 days);

        // Stake
        vm.prank(user1);
        pgvt.transfer(address(staking), 500 * 10 ** 18);
        assertEq(pgvt.stakedBalances(user1), 500 * 10 ** 18);

        // Unstake (staking contract → user1)
        vm.prank(address(staking));
        pgvt.transfer(user1, 300 * 10 ** 18);
        assertEq(pgvt.stakedBalances(user1), 200 * 10 ** 18);
    }

    function testTransferableBalanceAccountsForStaking() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.startPrank(admin);
        pgvt.setStakingEnabled(true);
        pgvt.whitelistStakingContract(address(staking), true);
        vm.stopPrank();

        staking.setStakeEndTime(user1, block.timestamp + 365 days);

        vm.prank(user1);
        pgvt.transfer(address(staking), 400 * 10 ** 18);

        // 1000 - 400 staked = 600 transferable (no vesting)
        assertEq(pgvt.transferableBalance(user1), 600 * 10 ** 18);
    }

    // ===================== GVT Conversion =====================

    function testConvertToGVT() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        vm.prank(user1);
        pgvt.convertToGVT(500 * 10 ** 18);

        // pGVT burned
        assertEq(pgvt.balanceOf(user1), 500 * 10 ** 18);
        // Migrator called
        assertEq(migrator.lastUser(), user1);
        assertEq(migrator.lastAmount(), 500 * 10 ** 18);
        assertEq(migrator.totalMigrated(), 500 * 10 ** 18);
    }

    function testConvertToGVTRevertsNoMigrator() public {
        // Deploy fresh pGVT without migrator set
        vm.startPrank(admin);
        pGVT fresh = new pGVT(admin);
        fresh.setGvtToken(address(usdt)); // set gvtToken but not migrator
        fresh.mint(user1, 1000 * 10 ** 18);
        vm.stopPrank();

        vm.prank(user1);
        vm.expectRevert(pGVT.NoMigrator.selector);
        fresh.convertToGVT(100 * 10 ** 18);
    }

    function testConvertToGVTRevertsNoGvtToken() public {
        vm.startPrank(admin);
        pGVT fresh = new pGVT(admin);
        fresh.setMigrator(address(migrator));
        fresh.mint(user1, 1000 * 10 ** 18);
        vm.stopPrank();

        vm.prank(user1);
        vm.expectRevert(pGVT.NoGvtToken.selector);
        fresh.convertToGVT(100 * 10 ** 18);
    }

    function testConvertToGVTRespectsVesting() public {
        vm.prank(admin);
        pgvt.mint(user1, 1000 * 10 ** 18);

        // Lock with vesting (0% unlocked at start with cliff)
        vm.prank(admin);
        pgvt.setVestingSchedule(
            user1,
            uint64(block.timestamp),
            uint64(90 days),
            uint64(365 days),
            1000 * 10 ** 18
        );

        // Before cliff: 0 transferable → cannot convert
        vm.prank(user1);
        vm.expectRevert(pGVT.TransferExceedsUnlocked.selector);
        pgvt.convertToGVT(1);
    }

    // ===================== Migration (V2→V3) =====================

    function testInitializeFromMigration() public {
        vm.prank(admin);
        pgvt.initializeFromMigration(user1, 5000 * 10 ** 18);

        assertEq(pgvt.balanceOf(user1), 5000 * 10 ** 18);
        assertEq(pgvt.totalMinted(), 5000 * 10 ** 18);
    }

    function testInitializeFromMigrationRevertsUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.initializeFromMigration(user1, 1000 * 10 ** 18);
    }

    function testInitializeFromMigrationEnforcesMigrationSource() public {
        vm.prank(admin);
        pgvt.setMigrationSource(address(42));

        // admin has SYSTEM_ROLE but is not migrationSource
        vm.prank(admin);
        vm.expectRevert(pGVT.InvalidMigrationSource.selector);
        pgvt.initializeFromMigration(user1, 1000 * 10 ** 18);
    }

    function testMigrationAppliesGlobalVesting() public {
        vm.startPrank(admin);
        pgvt.setGlobalVesting(
            uint64(block.timestamp),
            uint64(30 days),
            uint64(180 days)
        );
        pgvt.initializeFromMigration(user1, 1000 * 10 ** 18);
        vm.stopPrank();

        (,,,uint256 total,) = pgvt.vestingSchedules(user1);
        assertEq(total, 1000 * 10 ** 18);
    }

    // ===================== Presale Config Access Control =====================

    function testOnlyPriceManagerCanSetPresaleConfig() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.setPresaleConfig(1e15, 5_000_000 * 10 ** 18, 0);
    }

    function testOnlyTreasuryRoleCanSetTreasury() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.setTreasury(address(99));
    }

    function testOnlyStakingManagerCanWhitelist() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.whitelistStakingContract(address(staking), true);
    }

    function testOnlyAdminCanSealVesting() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.sealVesting();
    }

    function testOnlyAdminCanSetGvtToken() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.setGvtToken(address(99));
    }

    function testOnlyAdminCanSetMigrator() public {
        vm.prank(user1);
        vm.expectRevert();
        pgvt.setMigrator(address(99));
    }

    // ===================== Zero-Address Guards =====================

    function testSetPaymentTokenRevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(pGVT.ZeroAddress.selector);
        pgvt.setPaymentToken(address(0));
    }

    function testSetTreasuryRevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(pGVT.ZeroAddress.selector);
        pgvt.setTreasury(address(0));
    }

    function testSetGvtTokenRevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(pGVT.ZeroAddress.selector);
        pgvt.setGvtToken(address(0));
    }

    function testSetMigratorRevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(pGVT.ZeroAddress.selector);
        pgvt.setMigrator(address(0));
    }

    function testWhitelistStakingRevertsZero() public {
        vm.prank(admin);
        vm.expectRevert(pGVT.ZeroAddress.selector);
        pgvt.whitelistStakingContract(address(0), true);
    }

    // ===================== Fuzz Tests =====================

    function testFuzz_MintNeverExceedsMax(uint256 amount) public {
        amount = bound(amount, 1, MAX_SUPPLY);

        vm.prank(admin);
        pgvt.mint(user1, amount);

        assertLe(pgvt.totalSupply(), MAX_SUPPLY);
        assertLe(pgvt.totalMinted(), MAX_SUPPLY);
    }

    function testFuzz_VestingLinear(uint256 elapsed) public {
        uint256 total = 1000 * 10 ** 18;
        uint256 duration = 365 days;
        elapsed = bound(elapsed, 0, duration * 2);

        vm.prank(admin);
        pgvt.mint(user1, total);

        uint256 start = block.timestamp;
        vm.prank(admin);
        pgvt.setVestingSchedule(user1, uint64(start), 0, uint64(duration), total);

        vm.warp(start + elapsed);

        uint256 vested = pgvt.vestedAmount(user1);
        if (elapsed >= duration) {
            assertEq(vested, total);
        } else {
            assertEq(vested, (total * elapsed) / duration);
        }
    }
}
