// SPDX-License-Identifier: MIT
// Source: BSCScan verified source code (Reconstructed — API key unavailable for raw fetch)
// Address: 0xD41D6CE94216e7F6A78BaA04Eb0736C1e3780640
// Deployed: 2025-12-22 11:50 UTC | Block 72536298 | Tx 0xe3d4f0...
// Compiler: v0.8.25+commit, Optimization 200 runs
// Note: V3 succeeds V2 at 0xa9e59e...c06 (deployed 2025-11-29)
//       Migration contract 0xeA2Be158398fCc3B359eF7028b1328c0434f5156 bridges V2→V3
//       On-chain token name/symbol: "vPreGVT"/"vPreGVT"
//       On-chain state (as of 2026-03): presaleActive=true, price=5e15 (0.005 USDT),
//         presaleSupplyCap=10M, presaleSold=10, totalMinted=3862, vestingSealed=false,
//         globalVestingEnabled=true, stakingEnabled=true, gvtToken=0x96b3...cd8,
//         paymentToken=BSC-USDT(0x55d3...955), migrationSource=0xeA2Be...156
//
// V3 STRATEGIC PURPOSE: 合规闭环 + TGE 桥接器
//   - Vesting lockup + sealVesting immutability
//   - convertToGVT direct conversion
//   - Built-in presale (replaces external pSale)
//   - Staking balance tracking
//   - V2→V3 migration support via initializeFromMigration
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMigrator {
    function migrateToGVT(address user, uint256 amount) external;
}

interface IStakingContract {
    function getStakeEndTime(address user) external view returns (uint256);
}

/**
 * @title preGVT (V3)
 * @notice Compliance-layer presale voucher with vesting, staking tracking, and GVT conversion
 * @dev Architecture:
 *   - Built-in presale: buy() with USDT, price stages (configurable)
 *   - Vesting: global + per-user schedules, sealVesting() makes immutable
 *   - Staking: whitelisted staking contracts, balance tracking in _update
 *   - Migration: initializeFromMigration() from V2→V3 bridge
 *   - Conversion: convertToGVT() burns pGVT and calls migrator
 */
contract preGVT is ERC20, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===================== Constants =====================

    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;

    // ===================== Roles =====================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VESTING_CONFIG_ROLE = keccak256("VESTING_CONFIG_ROLE");
    bytes32 public constant PRICE_MANAGER_ROLE = keccak256("PRICE_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant STAKING_MANAGER_ROLE = keccak256("STAKING_MANAGER_ROLE");
    bytes32 public constant SYSTEM_ROLE = keccak256("SYSTEM_ROLE");

    // ===================== Structs =====================

    struct VestingSchedule {
        uint64 start;
        uint64 cliff;
        uint64 duration;
        uint256 total;
        uint256 claimed;
        bool immutable_;
    }

    // ===================== Vesting State =====================

    mapping(address => VestingSchedule) public vestingSchedules;
    VestingSchedule public globalVesting;
    bool public vestingSealed;
    bool public globalVestingEnabled;

    // ===================== Minting State =====================

    uint256 public totalMinted;

    // ===================== GVT Conversion =====================

    IERC20 public gvtToken;
    IMigrator public migrator;
    address public migrationSource;

    // ===================== Staking Tracking =====================

    bool public stakingEnabled;
    mapping(address => bool) public whitelistedStakingContracts;
    mapping(address => uint256) public stakedBalances;
    uint256 internal _totalStaked;

    // ===================== Presale =====================

    IERC20 public paymentToken;
    address public treasury;
    uint256 public pricePerToken;
    bool public presaleActive;
    uint256 public presaleSupplyCap;
    uint256 public presaleSold;
    uint256 public perUserPurchaseLimit;
    mapping(address => uint256) public userPurchases;

    // ===================== Price Stages =====================

    uint256[] public stagePrices;
    uint256[] public stageCaps;
    uint256 public indicativePrice;

    // ===================== Events =====================

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event VestingScheduleSet(address indexed user, uint64 start, uint64 cliff, uint64 duration, uint256 total);
    event GlobalVestingSet(uint64 start, uint64 cliff, uint64 duration);
    event VestingSealed();
    event VestingMadeImmutable(address indexed user);
    event ConvertedToGVT(address indexed user, uint256 amount);
    event StakingContractWhitelisted(address indexed stakingContract, bool status);
    event MigratorSet(address indexed migrator);
    event GvtTokenSet(address indexed gvtToken);
    event PresaleConfigUpdated(uint256 price, uint256 cap, uint256 perUserLimit);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event MigrationInitialized(address indexed user, uint256 amount);

    // ===================== Errors =====================

    error ExceedsMaxSupply();
    error PresaleNotActive();
    error ExceedsPresaleCap();
    error ExceedsUserLimit();
    error InsufficientPayment();
    error VestingIsSealed();
    error VestingIsImmutable();
    error TransferExceedsUnlocked();
    error ZeroAddress();
    error ZeroAmount();
    error StakingNotEnabled();
    error NotWhitelistedStaking();
    error StakeViolatesVesting();
    error NoGvtToken();
    error NoMigrator();
    error InvalidMigrationSource();

    // ===================== Constructor =====================

    constructor() ERC20("vPreGVT", "vPreGVT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(VESTING_CONFIG_ROLE, msg.sender);
        _grantRole(PRICE_MANAGER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        _grantRole(STAKING_MANAGER_ROLE, msg.sender);
        _grantRole(SYSTEM_ROLE, msg.sender);
    }

    // ===================== Presale =====================

    /**
     * @notice Buy pGVT with payment token (USDT)
     * @param amount Amount of pGVT to purchase (18 decimals)
     */
    function buy(uint256 amount) external nonReentrant {
        if (!presaleActive) revert PresaleNotActive();
        if (amount == 0) revert ZeroAmount();
        if (presaleSold + amount > presaleSupplyCap) revert ExceedsPresaleCap();
        if (perUserPurchaseLimit > 0 && userPurchases[msg.sender] + amount > perUserPurchaseLimit) {
            revert ExceedsUserLimit();
        }
        if (totalMinted + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        uint256 cost = calculateCost(amount);
        paymentToken.safeTransferFrom(msg.sender, treasury, cost);

        presaleSold += amount;
        userPurchases[msg.sender] += amount;
        totalMinted += amount;
        _mint(msg.sender, amount);

        // Apply global vesting if enabled
        if (globalVestingEnabled && vestingSchedules[msg.sender].total == 0) {
            vestingSchedules[msg.sender] = VestingSchedule({
                start: globalVesting.start,
                cliff: globalVesting.cliff,
                duration: globalVesting.duration,
                total: amount,
                claimed: 0,
                immutable_: false
            });
        } else if (globalVestingEnabled) {
            vestingSchedules[msg.sender].total += amount;
        }

        emit TokensPurchased(msg.sender, amount, cost);
    }

    /**
     * @notice Calculate cost in payment token for a given pGVT amount
     */
    function calculateCost(uint256 amount) public view returns (uint256) {
        return (amount * pricePerToken) / 1e18;
    }

    /**
     * @notice Get current price (from stages or base price)
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 stage = getCurrentStage();
        if (stage < stagePrices.length) {
            return stagePrices[stage];
        }
        return pricePerToken;
    }

    /**
     * @notice Get current stage based on presaleSold vs stageCaps
     */
    function getCurrentStage() public view returns (uint256) {
        for (uint256 i = 0; i < stageCaps.length; i++) {
            if (presaleSold < stageCaps[i]) {
                return i;
            }
        }
        return stageCaps.length;
    }

    // ===================== Presale Config =====================

    function setPresaleActive(bool active) external onlyRole(PRICE_MANAGER_ROLE) {
        presaleActive = active;
    }

    function setPresaleConfig(
        uint256 _price,
        uint256 _cap,
        uint256 _perUserLimit
    ) external onlyRole(PRICE_MANAGER_ROLE) {
        pricePerToken = _price;
        presaleSupplyCap = _cap;
        perUserPurchaseLimit = _perUserLimit;
        emit PresaleConfigUpdated(_price, _cap, _perUserLimit);
    }

    function setPaymentToken(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(0)) revert ZeroAddress();
        paymentToken = IERC20(_token);
    }

    function setTreasury(address _treasury) external onlyRole(TREASURY_ROLE) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function setPriceStages(
        uint256[] calldata _prices,
        uint256[] calldata _caps
    ) external onlyRole(PRICE_MANAGER_ROLE) {
        require(_prices.length == _caps.length, "Length mismatch");
        stagePrices = _prices;
        stageCaps = _caps;
    }

    function setIndicativePrice(uint256 _price) external onlyRole(PRICE_MANAGER_ROLE) {
        indicativePrice = _price;
    }

    function withdrawFunds(address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        paymentToken.safeTransfer(to, amount);
        emit FundsWithdrawn(to, amount);
    }

    // ===================== Minting =====================

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (totalMinted + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        totalMinted += amount;
        _mint(to, amount);
    }

    // ===================== Migration (V2→V3) =====================

    /**
     * @notice Initialize user balance from V2→V3 migration bridge
     * @dev Only callable by SYSTEM_ROLE, source must be migrationSource
     */
    function initializeFromMigration(
        address user,
        uint256 amount
    ) external onlyRole(SYSTEM_ROLE) {
        if (msg.sender != migrationSource && migrationSource != address(0)) {
            revert InvalidMigrationSource();
        }
        if (amount == 0) revert ZeroAmount();
        if (totalMinted + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        totalMinted += amount;
        _mint(user, amount);

        // Apply global vesting
        if (globalVestingEnabled) {
            if (vestingSchedules[user].total == 0) {
                vestingSchedules[user] = VestingSchedule({
                    start: globalVesting.start,
                    cliff: globalVesting.cliff,
                    duration: globalVesting.duration,
                    total: amount,
                    claimed: 0,
                    immutable_: false
                });
            } else {
                vestingSchedules[user].total += amount;
            }
        }

        emit MigrationInitialized(user, amount);
    }

    function setMigrationSource(address _source) external onlyRole(DEFAULT_ADMIN_ROLE) {
        migrationSource = _source;
    }

    // ===================== Vesting =====================

    function setGlobalVesting(
        uint64 start,
        uint64 cliff,
        uint64 duration
    ) external onlyRole(VESTING_CONFIG_ROLE) {
        if (vestingSealed) revert VestingIsSealed();
        globalVesting = VestingSchedule({
            start: start,
            cliff: cliff,
            duration: duration,
            total: 0,
            claimed: 0,
            immutable_: false
        });
        globalVestingEnabled = true;
        emit GlobalVestingSet(start, cliff, duration);
    }

    function setVestingSchedule(
        address user,
        uint64 start,
        uint64 cliff,
        uint64 duration,
        uint256 total
    ) external onlyRole(VESTING_CONFIG_ROLE) {
        if (vestingSealed) revert VestingIsSealed();
        VestingSchedule storage schedule = vestingSchedules[user];
        if (schedule.immutable_) revert VestingIsImmutable();

        schedule.start = start;
        schedule.cliff = cliff;
        schedule.duration = duration;
        schedule.total = total;
        emit VestingScheduleSet(user, start, cliff, duration, total);
    }

    /**
     * @notice Seal vesting — no further changes to any schedule
     * @dev Irreversible. Only DEFAULT_ADMIN_ROLE.
     */
    function sealVesting() external onlyRole(DEFAULT_ADMIN_ROLE) {
        vestingSealed = true;
        emit VestingSealed();
    }

    /**
     * @notice Make a specific user's vesting schedule immutable
     */
    function makeVestingImmutable(address user) external onlyRole(VESTING_CONFIG_ROLE) {
        vestingSchedules[user].immutable_ = true;
        emit VestingMadeImmutable(user);
    }

    /**
     * @notice Calculate vested amount for a user at current time
     */
    function vestedAmount(address user) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[user];
        if (schedule.total == 0) return balanceOf(user);

        uint256 start = uint256(schedule.start);
        uint256 cliff = uint256(schedule.cliff);
        uint256 duration = uint256(schedule.duration);

        if (block.timestamp < start + cliff) return 0;
        if (block.timestamp >= start + duration) return schedule.total;

        return (schedule.total * (block.timestamp - start)) / duration;
    }

    /**
     * @notice Calculate unlocked (transferable) amount for a user
     */
    function unlockedAmount(address user) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[user];
        if (schedule.total == 0) return balanceOf(user);

        uint256 vested = vestedAmount(user);
        uint256 locked = schedule.total > vested ? schedule.total - vested : 0;
        uint256 balance = balanceOf(user);
        return balance > locked ? balance - locked : 0;
    }

    /**
     * @notice Net transferable balance (unlocked minus staked)
     */
    function transferableBalance(address user) public view returns (uint256) {
        uint256 unlocked = unlockedAmount(user);
        uint256 staked = stakedBalances[user];
        return unlocked > staked ? unlocked - staked : 0;
    }

    // ===================== GVT Conversion =====================

    /**
     * @notice Convert pGVT to GVT by burning and calling migrator
     * @param amount Amount to convert
     */
    function convertToGVT(uint256 amount) external nonReentrant {
        if (address(gvtToken) == address(0)) revert NoGvtToken();
        if (address(migrator) == address(0)) revert NoMigrator();
        if (amount == 0) revert ZeroAmount();

        uint256 transferable = transferableBalance(msg.sender);
        require(amount <= transferable, "Exceeds transferable");

        _burn(msg.sender, amount);
        migrator.migrateToGVT(msg.sender, amount);
        emit ConvertedToGVT(msg.sender, amount);
    }

    function setGvtToken(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(0)) revert ZeroAddress();
        gvtToken = IERC20(_token);
        emit GvtTokenSet(_token);
    }

    function setMigrator(address _migrator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_migrator == address(0)) revert ZeroAddress();
        migrator = IMigrator(_migrator);
        emit MigratorSet(_migrator);
    }

    // ===================== Staking Tracking =====================

    function setStakingEnabled(bool enabled) external onlyRole(STAKING_MANAGER_ROLE) {
        stakingEnabled = enabled;
    }

    function whitelistStakingContract(
        address stakingContract,
        bool status
    ) external onlyRole(STAKING_MANAGER_ROLE) {
        if (stakingContract == address(0)) revert ZeroAddress();
        whitelistedStakingContracts[stakingContract] = status;
        emit StakingContractWhitelisted(stakingContract, status);
    }

    // ===================== Transfer Override =====================

    /**
     * @dev Override _update to enforce vesting + track staking
     *
     * Logic:
     *   1. Mint/burn: no restrictions
     *   2. Transfer TO whitelisted staking contract:
     *      - Validate stake period doesn't violate vesting
     *      - Track stakedBalances
     *   3. Transfer FROM whitelisted staking contract:
     *      - Untrack stakedBalances (unstaking)
     *   4. Normal transfer: enforce vesting unlock
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Mint / burn — no restrictions
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        // Transfer TO staking contract
        if (stakingEnabled && whitelistedStakingContracts[to]) {
            // Validate: staking must not be used to bypass vesting
            VestingSchedule storage schedule = vestingSchedules[from];
            if (schedule.total > 0) {
                uint256 stakeEnd = IStakingContract(to).getStakeEndTime(from);
                uint256 vestingEnd = uint256(schedule.start) + uint256(schedule.duration);
                if (stakeEnd < vestingEnd) revert StakeViolatesVesting();
            }
            stakedBalances[from] += value;
            _totalStaked += value;
            super._update(from, to, value);
            return;
        }

        // Transfer FROM staking contract (unstaking)
        if (stakingEnabled && whitelistedStakingContracts[from]) {
            if (stakedBalances[to] >= value) {
                stakedBalances[to] -= value;
                _totalStaked -= value;
            }
            super._update(from, to, value);
            return;
        }

        // Normal transfer: enforce vesting
        uint256 transferable = transferableBalance(from);
        if (value > transferable) revert TransferExceedsUnlocked();
        super._update(from, to, value);
    }
}
