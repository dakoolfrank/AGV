// SPDX-License-Identifier: MIT
// Source: BSCScan verified source code (Exact Match)
// Address: 0x21cCA8546B1550ee47134AF86AE929C1fA3671c9
// Deployed: 2025-11-16 10:48:03 UTC | Block 68385310 | Tx 0x3939172bfb2313f4ab25e2f4e90dbcc83f0f6a8286bcdae92cfe887105529e53
// Compiler: v0.8.27+commit.40a35a09 (assumed same as V2)
// Note: This is the ORIGINAL PreGVT (V1), replaced by V2 at 0xa9e59e... (13 days later)
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IGenesisBadge1155
 * @notice Interface for Genesis Badge contract
 */
interface IGenesisBadge1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function redeem(uint256 id, uint256 amount) external;
    function redeemByOperator(address owner, uint256 id, uint256 amount) external;
}

/**
 * @title PreGVT (V1 — Original)
 * @notice Buy-only pre-token with DEX integration for price visibility
 * @dev Same as V2 but WITHOUT: blacklist, MINTER_ROLE, migration contract, cancel allocations
 *      Sell-block logic checks msg.sender == dexRouter (V2 changed to check to == dexPair directly)
 */
contract PreGVT is ERC20, AccessControl, Pausable, ReentrancyGuard {
    // ============ Roles ============

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant MIGRATOR_SETTER_ROLE = keccak256("MIGRATOR_SETTER_ROLE");
    bytes32 public constant PRICE_MANAGER_ROLE = keccak256("PRICE_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");

    // ============ Immutable State ============

    /// @notice Genesis Badge contract address
    IGenesisBadge1155 public immutable badge;

    /// @notice Badge ID required for claims
    uint256 public immutable badgeId;

    /// @notice Maximum tokens that can ever be minted from airdrop reserve
    uint256 public immutable airdropReserveCap;

    /// @notice Maximum tokens that can be sold in presale
    uint256 public immutable presaleSupplyCap;

    /// @notice Payment token (USDT) address
    IERC20 public immutable paymentToken;

    // ============ Mutable State ============

    /// @notice Treasury address for receiving funds and LP management
    address public treasury;

    /// @notice DEX router address (for sell-blocking logic)
    address public dexRouter;

    /// @notice DEX pair address (preGVT/USDT)
    address public dexPair;

    /// @notice Total tokens minted from airdrop reserve
    uint256 public airdropReserveMinted;

    /// @notice Total tokens sold in presale
    uint256 public presaleSold;

    /// @notice Preloaded allocations per user (Pattern B)
    mapping(address => uint256) public claimable;

    /// @notice Migrator contract address for GVT conversion
    address public migrator;

    /// @notice Whether migration to main token is enabled
    bool public migrationEnabled;

    /// @notice Price per token in payment token units (scaled by 1e18)
    uint256 public pricePerToken;

    /// @notice Whether presale is active
    bool public presaleActive;

    /// @notice Whether badge is required for purchasing
    bool public badgeRequiredForPurchase;

    /// @notice Per-user purchase limit (0 = no limit)
    uint256 public perUserPurchaseLimit;

    /// @notice Track user purchases for limit enforcement
    mapping(address => uint256) public userPurchases;

    /// @notice Whitelisted contracts that can receive transfers (e.g., staking contracts)
    mapping(address => bool) public whitelistedContracts;

    /// @notice Price stages for presale (in payment token units)
    uint256[] public stagePrices;

    /// @notice Supply caps for each stage
    uint256[] public stageCaps;

    /// @notice Current indicative price (for display purposes only)
    uint256 public indicativePrice;

    // ============ Events ============

    event AirdropReserveDefined(uint256 cap);
    event AirdropDistributed(address indexed to, uint256 amount, uint256 newTotalMinted);
    event BatchAirdrop(uint256 indexed count, uint256 totalAmount);
    event BadgeConsumed(address indexed user, uint256 indexed badgeId, uint256 amount);
    event MigrationEnabled(address indexed migrator);
    event Migrated(address indexed user, uint256 preGVTAmount);
    event AllocationSet(address indexed user, uint256 amount);
    event PresaleConfigured(uint256 pricePerToken, bool badgeRequired, uint256 perUserLimit);
    event PresaleStatusChanged(bool active);
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event PriceUpdated(uint256 newPrice);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event ContractWhitelisted(address indexed contractAddress, bool status);
    event PriceStagesConfigured(uint256[] prices, uint256[] caps);
    event IndicativePriceUpdated(uint256 newPrice);
    event TreasuryUpdated(address indexed newTreasury);
    event DexRouterUpdated(address indexed newRouter);
    event DexPairUpdated(address indexed newPair);
    event SellBlocked(address indexed from, address indexed to, uint256 amount);

    // ============ Errors ============

    error TransferNotAllowed();
    error ApprovalNotAllowed();
    error ReserveCapExceeded();
    error NoBadge();
    error NoAllocation();
    error InvalidMigrator();
    error MigrationNotEnabled();
    error ArrayLengthMismatch();
    error ZeroAddress();
    error ZeroAmount();
    error PresaleNotActive();
    error PresaleCapExceeded();
    error InvalidPrice();
    error PurchaseLimitExceeded();
    error BadgeRequiredForPurchase();
    error TreasuryNotSet();
    error PaymentTransferFailed();
    error SellDisabled();

    // ============ Constructor ============

    constructor(
        address _badge,
        uint256 _badgeId,
        uint256 _airdropReserveCap,
        uint256 _presaleSupplyCap,
        address _treasury,
        address _paymentToken,
        address _initialAdmin
    ) ERC20("preGVT", "preGVT") {
        if (_badge == address(0)) revert ZeroAddress();
        if (_paymentToken == address(0)) revert ZeroAddress();
        if (_initialAdmin == address(0)) revert ZeroAddress();
        if (_airdropReserveCap == 0) revert ZeroAmount();

        badge = IGenesisBadge1155(_badge);
        badgeId = _badgeId;
        airdropReserveCap = _airdropReserveCap;
        presaleSupplyCap = _presaleSupplyCap;
        treasury = _treasury;
        paymentToken = IERC20(_paymentToken);

        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(DISTRIBUTOR_ROLE, _initialAdmin);
        _grantRole(MIGRATOR_SETTER_ROLE, _initialAdmin);
        _grantRole(PRICE_MANAGER_ROLE, _initialAdmin);
        _grantRole(TREASURY_ROLE, _initialAdmin);
        _grantRole(WHITELIST_MANAGER_ROLE, _initialAdmin);

        emit AirdropReserveDefined(_airdropReserveCap);
    }

    // ============ View Functions ============

    function airdropReserveRemaining() external view returns (uint256) {
        return airdropReserveCap - airdropReserveMinted;
    }

    function presaleRemaining() external view returns (uint256) {
        return presaleSupplyCap - presaleSold;
    }

    function hasBadge(address user) public view returns (bool) {
        return badge.balanceOf(user, badgeId) > 0;
    }

    function allowanceOf(address user) external view returns (uint256) {
        return claimable[user];
    }

    function calculateCost(uint256 amount) public view returns (uint256 cost) {
        return (amount * pricePerToken) / 1e18;
    }

    function remainingPurchaseLimit(address user) external view returns (uint256) {
        if (perUserPurchaseLimit == 0) return type(uint256).max;
        uint256 purchased = userPurchases[user];
        return purchased >= perUserPurchaseLimit ? 0 : perUserPurchaseLimit - purchased;
    }

    /**
     * @notice Get current price based on sales stages
     * @return Current price in payment token units or indicativePrice if stages not set
     */
    function getCurrentPrice() public view returns (uint256) {
        if (stagePrices.length == 0) {
            return indicativePrice > 0 ? indicativePrice : pricePerToken;
        }

        uint256 sold = presaleSold;
        for (uint256 i = 0; i < stageCaps.length; i++) {
            if (sold < stageCaps[i]) {
                return stagePrices[i];
            }
        }

        return stagePrices[stagePrices.length - 1];
    }

    function getCurrentStage() public view returns (uint256) {
        uint256 sold = presaleSold;
        for (uint256 i = 0; i < stageCaps.length; i++) {
            if (sold < stageCaps[i]) {
                return i;
            }
        }
        return stageCaps.length - 1;
    }

    function getPriceStages()
        external
        view
        returns (uint256[] memory prices, uint256[] memory caps, uint256 currentStage)
    {
        return (stagePrices, stageCaps, getCurrentStage());
    }

    // ============ DEX Management ============

    function setDexRouter(address _router) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_router == address(0)) revert ZeroAddress();
        dexRouter = _router;
        emit DexRouterUpdated(_router);
    }

    function setDexPair(address _pair) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_pair == address(0)) revert ZeroAddress();
        dexPair = _pair;
        emit DexPairUpdated(_pair);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // ============ Whitelist Management ============

    function setWhitelistedContract(address contractAddress, bool status) external onlyRole(WHITELIST_MANAGER_ROLE) {
        if (contractAddress == address(0)) revert ZeroAddress();
        whitelistedContracts[contractAddress] = status;
        emit ContractWhitelisted(contractAddress, status);
    }

    function batchSetWhitelistedContracts(address[] calldata contracts, bool status)
        external
        onlyRole(WHITELIST_MANAGER_ROLE)
    {
        for (uint256 i = 0; i < contracts.length; i++) {
            if (contracts[i] == address(0)) revert ZeroAddress();
            whitelistedContracts[contracts[i]] = status;
            emit ContractWhitelisted(contracts[i], status);
        }
    }

    // ============ Admin Functions ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function configurePresale(uint256 _pricePerToken, bool _badgeRequired, uint256 _perUserLimit)
        external
        onlyRole(PRICE_MANAGER_ROLE)
    {
        if (_pricePerToken == 0) revert InvalidPrice();

        pricePerToken = _pricePerToken;
        badgeRequiredForPurchase = _badgeRequired;
        perUserPurchaseLimit = _perUserLimit;

        emit PresaleConfigured(_pricePerToken, _badgeRequired, _perUserLimit);
    }

    function updatePrice(uint256 _pricePerToken) external onlyRole(PRICE_MANAGER_ROLE) {
        if (_pricePerToken == 0) revert InvalidPrice();
        pricePerToken = _pricePerToken;
        emit PriceUpdated(_pricePerToken);
    }

    function configurePriceStages(uint256[] calldata _prices, uint256[] calldata _caps)
        external
        onlyRole(PRICE_MANAGER_ROLE)
    {
        require(_prices.length == _caps.length, "Length mismatch");
        require(_prices.length > 0, "Empty arrays");

        for (uint256 i = 1; i < _caps.length; i++) {
            require(_caps[i] > _caps[i - 1], "Caps must increase");
        }

        stagePrices = _prices;
        stageCaps = _caps;

        emit PriceStagesConfigured(_prices, _caps);
    }

    function setIndicativePrice(uint256 _price) external onlyRole(PRICE_MANAGER_ROLE) {
        indicativePrice = _price;
        emit IndicativePriceUpdated(_price);
    }

    function setPresaleActive(bool _active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        presaleActive = _active;
        emit PresaleStatusChanged(_active);
    }

    function withdrawFunds() external onlyRole(TREASURY_ROLE) nonReentrant {
        if (treasury == address(0)) revert TreasuryNotSet();

        uint256 balance = paymentToken.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        bool success = paymentToken.transfer(treasury, balance);
        if (!success) revert PaymentTransferFailed();

        emit FundsWithdrawn(treasury, balance);
    }

    function setMigrator(address _migrator) external onlyRole(MIGRATOR_SETTER_ROLE) {
        if (_migrator == address(0)) revert InvalidMigrator();
        if (migrator != address(0)) revert InvalidMigrator();

        migrator = _migrator;
        migrationEnabled = true;

        emit MigrationEnabled(_migrator);
    }

    function setAllocations(address[] calldata users, uint256[] calldata amounts) external onlyRole(DISTRIBUTOR_ROLE) {
        if (users.length != amounts.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) revert ZeroAddress();
            claimable[users[i]] += amounts[i];
            emit AllocationSet(users[i], amounts[i]);
        }
    }

    function batchAirdrop(address[] calldata users, uint256[] calldata amounts)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (users.length != amounts.length) revert ArrayLengthMismatch();

        uint256 totalAmount = 0;

        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) revert ZeroAddress();
            if (!hasBadge(users[i])) revert NoBadge();

            totalAmount += amounts[i];
            _mintFromReserve(users[i], amounts[i]);
        }

        emit BatchAirdrop(users.length, totalAmount);
    }

    // ============ User Functions ============

    function buy(uint256 amount) external whenNotPaused nonReentrant {
        if (!presaleActive) revert PresaleNotActive();
        if (amount == 0) revert ZeroAmount();
        if (badgeRequiredForPurchase && !hasBadge(msg.sender)) {
            revert BadgeRequiredForPurchase();
        }

        if (presaleSold + amount > presaleSupplyCap) revert PresaleCapExceeded();

        if (perUserPurchaseLimit > 0) {
            if (userPurchases[msg.sender] + amount > perUserPurchaseLimit) {
                revert PurchaseLimitExceeded();
            }
        }

        uint256 cost = calculateCost(amount);
        if (cost == 0) revert ZeroAmount();

        bool success = paymentToken.transferFrom(msg.sender, address(this), cost);
        if (!success) revert PaymentTransferFailed();

        presaleSold += amount;
        userPurchases[msg.sender] += amount;

        _mint(msg.sender, amount);

        emit TokensPurchased(msg.sender, amount, cost);
    }

    function claimAllocated() external whenNotPaused nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NoAllocation();
        if (!hasBadge(msg.sender)) revert NoBadge();

        claimable[msg.sender] = 0;

        try badge.redeemByOperator(msg.sender, badgeId, 1) {
            emit BadgeConsumed(msg.sender, badgeId, 1);
        } catch {}

        _mintFromReserve(msg.sender, amount);
    }

    function claimWithBadge(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!hasBadge(msg.sender)) revert NoBadge();

        try badge.redeemByOperator(msg.sender, badgeId, 1) {
            emit BadgeConsumed(msg.sender, badgeId, 1);
        } catch {
            revert NoBadge();
        }

        _mintFromReserve(msg.sender, amount);
    }

    function migrateToGVT() external nonReentrant {
        if (!migrationEnabled) revert MigrationNotEnabled();
        if (migrator == address(0)) revert InvalidMigrator();

        uint256 amount = balanceOf(msg.sender);
        if (amount == 0) revert ZeroAmount();

        _burn(msg.sender, amount);

        emit Migrated(msg.sender, amount);
    }

    // ============ Internal Functions ============

    function _mintFromReserve(address to, uint256 amount) internal {
        if (airdropReserveMinted + amount > airdropReserveCap) {
            revert ReserveCapExceeded();
        }

        airdropReserveMinted += amount;
        _mint(to, amount);

        emit AirdropDistributed(to, amount, airdropReserveMinted);
    }

    /**
     * @notice Override _update to implement sell-blocking logic
     * @dev Blocks: router calling transferFrom(user → pair)
     *      Allows: treasury → pair (LP add), pair → user (buy), mint/burn, whitelisted contracts
     *      NOTE: V1 checks msg.sender == dexRouter; V2 changed to check to == dexPair (stronger)
     */
    function _update(address from, address to, uint256 amount) internal override {
        // Allow mint/burn
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        // Allow whitelisted contracts (staking, etc.)
        if (whitelistedContracts[from] || whitelistedContracts[to]) {
            super._update(from, to, amount);
            return;
        }

        // SELL BLOCK: If router is caller and destination is pair, block (unless from treasury)
        if (msg.sender == dexRouter && to == dexPair && from != treasury) {
            emit SellBlocked(from, to, amount);
            revert SellDisabled();
        }

        // Allow all other transfers (including direct treasury → pair for LP)
        super._update(from, to, amount);
    }
}
