// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IMigrator
 * @notice Interface for the GVT migration contract
 */
interface IMigrator {
    function migrateToGVT(address user, uint256 amount) external;
}

/**
 * @title IStakingContract
 * @notice Interface for whitelisted staking contracts
 */
interface IStakingContract {
    function getStakeEndTime(address user) external view returns (uint256);
}

/**
 * @title pGVT
 * @notice Compliance-layer presale voucher with vesting, staking tracking, and GVT conversion
 * @dev V3-aligned architecture (deployed on BSC as vPreGVT at 0xD41D6CE...640):
 *   - Built-in presale: buy() with USDT payment token
 *   - Vesting: global + per-user schedules, sealVesting() makes permanently immutable
 *   - Staking tracking: whitelisted staking contracts, balance tracking in _update
 *   - Migration: initializeFromMigration() from V2→V3 bridge
 *   - Conversion: convertToGVT() burns pGVT and calls migrator
 *
 * Lifecycle:
 *   Deploy → configure presale → buy/mint → vesting lockup → convertToGVT at TGE
 */
contract pGVT is ERC20, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===================== Constants =====================

    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;

    // ===================== Roles (7 total including DEFAULT_ADMIN_ROLE) =====================

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

    // ===================== Events =====================

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event VestingScheduleSet(address indexed user, uint64 start, uint64 cliff, uint64 duration, uint256 total);
    event GlobalVestingSet(uint64 start, uint64 cliff, uint64 duration);
    event VestingSealed();
    event VestingMadeImmutable(address indexed user);
    event ConvertedToGVT(address indexed user, uint256 amount);
    event StakingContractWhitelisted(address indexed stakingContract, bool status);
    event MigratorSet(address indexed newMigrator);
    event GvtTokenSet(address indexed newGvtToken);
    event PresaleConfigUpdated(uint256 price, uint256 cap, uint256 perUserLimit);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event MigrationInitialized(address indexed user, uint256 amount);
    event TreasuryUpdated(address indexed newTreasury);
    event PresaleEnded(address indexed presaleContract);

    // ===================== Errors =====================

    error ExceedsMaxSupply();
    error PresaleNotActive();
    error ExceedsPresaleCap();
    error ExceedsUserLimit();
    error VestingIsSealed();
    error VestingIsImmutable();
    error TransferExceedsUnlocked();
    error ZeroAddress();
    error ZeroAmount();
    error StakeViolatesVesting();
    error NoGvtToken();
    error NoMigrator();
    error InvalidMigrationSource();
    error LengthMismatch();

    // ===================== Constructor =====================

    constructor(address admin) ERC20("pGVT", "pGVT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(VESTING_CONFIG_ROLE, admin);
        _grantRole(PRICE_MANAGER_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
        _grantRole(STAKING_MANAGER_ROLE, admin);
        _grantRole(SYSTEM_ROLE, admin);
    }

    // ===================== Presale =====================

    /**
     * @notice Buy pGVT with payment token (e.g. USDT)
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
        if (globalVestingEnabled) {
            _applyGlobalVesting(msg.sender, amount);
        }

        emit TokensPurchased(msg.sender, amount, cost);
    }

    /**
     * @notice Calculate cost in payment token for a given pGVT amount
     * @param amount pGVT amount (18 decimals)
     * @return cost Payment token amount
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

    /**
     * @notice End presale and revoke MINTER_ROLE from the presale contract
     * @param presaleContract Address of the external pSale contract to revoke
     */
    function endPresaleAndRevokeMinter(address presaleContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        presaleActive = false;
        if (presaleContract != address(0) && hasRole(MINTER_ROLE, presaleContract)) {
            _revokeRole(MINTER_ROLE, presaleContract);
        }
        emit PresaleEnded(presaleContract);
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
        emit TreasuryUpdated(_treasury);
    }

    function setPriceStages(
        uint256[] calldata _prices,
        uint256[] calldata _caps
    ) external onlyRole(PRICE_MANAGER_ROLE) {
        if (_prices.length != _caps.length) revert LengthMismatch();
        stagePrices = _prices;
        stageCaps = _caps;
    }

    function withdrawFunds(address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        paymentToken.safeTransfer(to, amount);
        emit FundsWithdrawn(to, amount);
    }

    // ===================== Minting =====================

    /**
     * @notice Mint pGVT (admin/system use)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (totalMinted + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        totalMinted += amount;
        _mint(to, amount);
    }

    // ===================== Migration (V2→V3) =====================

    /**
     * @notice Initialize user balance from V2→V3 migration bridge
     * @dev Only callable by SYSTEM_ROLE; if migrationSource is set, caller must also match it
     * @param user Recipient of migrated balance
     * @param amount Amount to migrate
     */
    function initializeFromMigration(
        address user,
        uint256 amount
    ) external onlyRole(SYSTEM_ROLE) {
        if (migrationSource != address(0) && msg.sender != migrationSource) {
            revert InvalidMigrationSource();
        }
        if (amount == 0) revert ZeroAmount();
        if (totalMinted + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        totalMinted += amount;
        _mint(user, amount);

        if (globalVestingEnabled) {
            _applyGlobalVesting(user, amount);
        }

        emit MigrationInitialized(user, amount);
    }

    function setMigrationSource(address _source) external onlyRole(DEFAULT_ADMIN_ROLE) {
        migrationSource = _source;
    }

    // ===================== Vesting =====================

    /**
     * @notice Set global vesting parameters (applied to new buyers/migrants)
     */
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
            immutable_: false
        });
        globalVestingEnabled = true;
        emit GlobalVestingSet(start, cliff, duration);
    }

    /**
     * @notice Set a specific user's vesting schedule
     */
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
     * @notice Seal vesting — no further changes to any vesting schedule (irreversible)
     * @dev Requires globalVestingEnabled to prevent sealing before configuration
     */
    function sealVesting() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(globalVestingEnabled, "Global vesting not configured");
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
     * @dev No vesting schedule → full balance is vested
     *      Before cliff → 0 vested
     *      After full duration → total vested
     *      Otherwise → linear vesting
     */
    function vestedAmount(address user) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[user];
        if (schedule.total == 0) return balanceOf(user) + stakedBalances[user];

        uint256 start = uint256(schedule.start);
        uint256 cliff = uint256(schedule.cliff);
        uint256 duration = uint256(schedule.duration);

        if (block.timestamp < start + cliff) return 0;
        if (block.timestamp >= start + duration) return schedule.total;

        return (schedule.total * (block.timestamp - start)) / duration;
    }

    /**
     * @notice Calculate unlocked (vesting-aware) amount for a user
     * @dev balance - lockedAmount, where lockedAmount = total - vestedAmount
     */
    function unlockedAmount(address user) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[user];
        if (schedule.total == 0) return balanceOf(user) + stakedBalances[user];

        uint256 vested = vestedAmount(user);
        uint256 locked = schedule.total > vested ? schedule.total - vested : 0;
        uint256 totalBalance = balanceOf(user) + stakedBalances[user];
        return totalBalance > locked ? totalBalance - locked : 0;
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
     * @notice Convert pGVT to GVT — burns pGVT and calls migrator
     * @param amount Amount to convert
     */
    function convertToGVT(uint256 amount) external nonReentrant {
        if (address(gvtToken) == address(0)) revert NoGvtToken();
        if (address(migrator) == address(0)) revert NoMigrator();
        if (amount == 0) revert ZeroAmount();

        uint256 transferable = transferableBalance(msg.sender);
        if (amount > transferable) revert TransferExceedsUnlocked();

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
     *   3. Transfer FROM whitelisted staking contract (unstaking):
     *      - Untrack stakedBalances
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
            VestingSchedule storage schedule = vestingSchedules[from];
            if (schedule.total > 0) {
                uint256 stakeEnd = IStakingContract(to).getStakeEndTime(from);
                uint256 vestingEnd = uint256(schedule.start) + uint256(schedule.duration);
                if (stakeEnd < vestingEnd) revert StakeViolatesVesting();
            }
            stakedBalances[from] += value;
            super._update(from, to, value);
            return;
        }

        // Transfer FROM staking contract (unstaking)
        if (stakingEnabled && whitelistedStakingContracts[from]) {
            require(stakedBalances[to] >= value, "Unstake exceeds tracked balance");
            stakedBalances[to] -= value;
            super._update(from, to, value);
            return;
        }

        // Normal transfer: enforce vesting
        uint256 transferable = transferableBalance(from);
        if (value > transferable) revert TransferExceedsUnlocked();
        super._update(from, to, value);
    }

    // ===================== Internal Helpers =====================

    /**
     * @dev Apply global vesting schedule to a user (called during buy/migration)
     */
    function _applyGlobalVesting(address user, uint256 amount) internal {
        if (vestingSchedules[user].total == 0) {
            vestingSchedules[user] = VestingSchedule({
                start: globalVesting.start,
                cliff: globalVesting.cliff,
                duration: globalVesting.duration,
                total: amount,
                immutable_: false
            });
        } else {
            vestingSchedules[user].total += amount;
        }
    }
}
