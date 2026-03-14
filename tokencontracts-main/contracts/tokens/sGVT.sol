// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IsGVTRegistry {
    function isApproved(address account) external view returns (bool);
}

/**
 * @title sGVT
 * @notice ERC-20 institutional accounting certificate with registry-gated transfers
 * @dev Aligned with deployed V2 (0xA9765C7a4aDA027f33F87621e2F91bbe30C90E90)
 *      + Pausable emergency mechanism (modular improvement)
 *
 * Features:
 * - Tier 1: Fast local compliance registry (transfer gating) — NO external calls in hot path
 * - Tier 2: Registry controls mint/burn only (institutional ledger)
 * - Static price: $0.50 USD
 * - One-time finalization locks transfer policy permanently
 * - Post-finalize: operator <-> LP pair transfers only (via router intermediation)
 * - Post-finalize: Can still register new investors for ongoing onboarding
 * - No blacklist, freeze, honeypot, or confiscation mechanics
 * - PancakeSwap V2/V3 compatible router paths
 *
 * Deployment Flow:
 * 1. Deploy with multisig + registry + USDT address
 * 2. Grant MINTER/BURNER roles to registry contract
 * 3. Register operator, router, treasury in compliance system
 * 4. Create LP pair (sGVT/USDT) on PancakeSwap
 * 5. setLpPair(pairAddress)
 * 6. setRouter(routerAddress)
 * 7. Complete all distributions
 * 8. finalize() — locks transfer policy permanently
 */
contract sGVT is ERC20, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // === IMMUTABLE CONFIGURATION ===
    uint256 public constant PRICE_USD = 0.5e18;
    uint256 public immutable maxSupply;
    address public immutable registry;
    address public immutable quoteAsset;
    uint8 public immutable pancakeSwapVersion;

    // === MUTABLE STATE (locked after finalize) ===
    mapping(address => bool) public eligibleAddress;
    address public lpPair;
    address public priceOperator;
    address public router;
    address public treasury;
    bool public finalized;

    // === EVENTS ===
    event EligibilityUpdated(address indexed account, bool status, string reason);
    event MintedByRegistry(address indexed to, uint256 amount, string investorId);
    event BurnedByRegistry(address indexed from, uint256 amount, string investorId);
    event LpPairSet(address indexed lpPair, address indexed quoteAsset);
    event PriceOperatorSet(address indexed priceOperator);
    event RouterSet(address indexed router);
    event TreasurySet(address indexed treasury);
    event Finalized(uint256 timestamp);
    event SwapRecorded(
        address indexed operator,
        string direction,
        uint256 amount,
        string txHash,
        uint256 timestamp
    );

    constructor(
        address defaultAdmin,
        address registry_,
        address quoteAsset_,
        uint8 pancakeVersion,
        uint256 maxSupply_
    ) ERC20("sGVT", "sGVT") {
        require(defaultAdmin != address(0), "Invalid admin");
        require(registry_ != address(0), "Invalid registry");
        require(quoteAsset_ != address(0), "Invalid quote asset");
        require(pancakeVersion == 2 || pancakeVersion == 3, "Invalid PancakeSwap version");
        require(maxSupply_ > 0, "Invalid max supply");

        maxSupply = maxSupply_;
        registry = registry_;
        quoteAsset = quoteAsset_;
        pancakeSwapVersion = pancakeVersion;

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);

        eligibleAddress[defaultAdmin] = true;
        emit EligibilityUpdated(defaultAdmin, true, "admin");
    }

    // ============ Eligibility Management ============

    function updateEligibility(address account, bool status, string calldata reason)
        external
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || msg.sender == address(registry),
            "Unauthorized: only admin or registry"
        );
        require(account != address(0), "Invalid address");
        eligibleAddress[account] = status;
        emit EligibilityUpdated(account, status, reason);
    }

    function batchUpdateEligibility(
        address[] calldata accounts,
        bool status,
        string calldata reason
    ) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || msg.sender == address(registry),
            "Unauthorized: only admin or registry"
        );
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Invalid address");
            eligibleAddress[accounts[i]] = status;
            emit EligibilityUpdated(accounts[i], status, reason);
        }
    }

    // ============ Infrastructure Setup (one-time, pre-finalize) ============

    function setLpPair(address lpPair_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(lpPair == address(0), "LP pair already set");
        require(lpPair_ != address(0), "Invalid LP pair");

        lpPair = lpPair_;
        eligibleAddress[lpPair_] = true;
        emit LpPairSet(lpPair_, quoteAsset);
    }

    function setPriceOperator(address priceOperator_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(priceOperator == address(0), "Price operator already set");
        require(priceOperator_ != address(0), "Invalid price operator");

        priceOperator = priceOperator_;
        eligibleAddress[priceOperator_] = true;
        _grantRole(OPERATOR_ROLE, priceOperator_);
        emit PriceOperatorSet(priceOperator_);
    }

    function setRouter(address router_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(router == address(0), "Router already set");
        require(router_ != address(0), "Invalid router");

        router = router_;
        eligibleAddress[router_] = true;
        emit RouterSet(router_);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(treasury == address(0), "Treasury already set");
        require(treasury_ != address(0), "Invalid treasury");

        treasury = treasury_;
        eligibleAddress[treasury_] = true;
        emit TreasurySet(treasury_);
    }

    // ============ Finalization ============

    function finalize() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(lpPair != address(0), "LP pair not set");
        require(priceOperator != address(0), "Price operator not set");
        require(router != address(0), "Router not set");
        require(treasury != address(0), "Treasury not set");

        finalized = true;
        emit Finalized(block.timestamp);
    }

    // ============ Mint / Burn (Registry-controlled) ============

    function mint(address to, uint256 amount, string calldata investorId)
        external
        onlyRole(MINTER_ROLE)
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");

        if (!eligibleAddress[to]) {
            eligibleAddress[to] = true;
            emit EligibilityUpdated(to, true, string(abi.encodePacked("minted:", investorId)));
        }

        _mint(to, amount);
        emit MintedByRegistry(to, amount, investorId);
    }

    function burn(address from, uint256 amount, string calldata investorId)
        external
        onlyRole(BURNER_ROLE)
    {
        require(from != address(0), "Invalid account");
        require(amount > 0, "Invalid amount");
        _burn(from, amount);
        emit BurnedByRegistry(from, amount, investorId);
    }

    // ============ Swap Audit ============

    function recordSwap(
        string calldata direction,
        uint256 amount,
        string calldata txHash
    ) external onlyRole(OPERATOR_ROLE) {
        require(
            keccak256(bytes(direction)) == keccak256(bytes("buy"))
                || keccak256(bytes(direction)) == keccak256(bytes("sell")),
            "Invalid direction"
        );
        require(amount > 0, "Invalid amount");
        require(bytes(txHash).length > 0, "Invalid tx hash");

        emit SwapRecorded(msg.sender, direction, amount, txHash, block.timestamp);
    }

    // ============ Pause (Emergency — modular improvement) ============

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ============ Transfer Logic ============

    /**
     * @notice Internal transfer override with Tier 1 eligibility check (NO external calls)
     *
     * Transfer policy:
     * - Before finalize: to address must be eligible (registered)
     * - After finalize: ONLY allow operator <-> LP pair (with router intermediation)
     * - Minting/burning always allowed via mint/burn functions
     *
     * Post-finalize allowed transfers (PancakeSwap V2/V3 compatible):
     * 1. lpPair -> priceOperator
     * 2. priceOperator -> lpPair
     * 3. priceOperator -> router
     * 4. router -> lpPair
     * 5. lpPair -> router
     * 6. router -> priceOperator
     */
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        // Minting / burning always allowed
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        // Tier 1: local eligibility check (NO external calls in hot path)
        require(eligibleAddress[to], "Recipient not eligible");

        // Pre-finalize: eligible addresses can transfer freely
        if (!finalized) {
            super._update(from, to, value);
            return;
        }

        // Post-finalize: only operator <-> LP pair (with router intermediation)
        require(_isAllowedPostFinalize(from, to), "Transfer not allowed after finalization");

        super._update(from, to, value);
    }

    function _isAllowedPostFinalize(address from, address to) internal view returns (bool) {
        // Direct operator <-> LP swaps
        if ((from == lpPair && to == priceOperator) ||
            (from == priceOperator && to == lpPair)) {
            return true;
        }

        // Router-mediated paths (PancakeSwap V2/V3 compatible)
        if ((from == priceOperator && to == router) ||
            (from == router && to == lpPair) ||
            (from == lpPair && to == router) ||
            (from == router && to == priceOperator)) {
            return true;
        }

        return false;
    }

    // ============ View Functions ============

    function tokenClassification() external pure returns (string memory) {
        return "institutional-accounting-certificate";
    }

    function referencePrice() external pure returns (uint256) { return PRICE_USD; }
    function priceUSD() external pure returns (uint256) { return PRICE_USD; }
    function getPrice() external pure returns (uint256) { return PRICE_USD; }
    function latestAnswer() external pure returns (int256) { return int256(PRICE_USD); }
    function hasStaticPrice() external pure returns (bool) { return true; }

    function isFinalized() external view returns (bool) { return finalized; }
    function isEligible(address account) external view returns (bool) { return eligibleAddress[account]; }
    function isWhitelisted(address account) external view returns (bool) { return eligibleAddress[account]; }

    function getConfiguration()
        external
        view
        returns (
            address lpPairAddr,
            address operatorAddr,
            address routerAddr,
            address treasuryAddr,
            address quoteAssetAddr,
            uint8 pancakeVersion,
            bool isFinal
        )
    {
        return (lpPair, priceOperator, router, treasury, quoteAsset, pancakeSwapVersion, finalized);
    }
}
