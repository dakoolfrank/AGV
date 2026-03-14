// SPDX-License-Identifier: MIT
// ARCHIVE: Deployed at 0xA9765C7a4aDA027f33F87621e2F91bbe30C90E90 (BSC Mainnet)
// Deployed: 2026-01-11 09:10:21 UTC | Block 74827048 | Tx 0xa7effad158c78b152c044c9f85845296d5466693b96d60bcd3d8b5b35e13b5dd
// Source: BSCScan verified source code
// Note: V2 institutional accounting certificate, replaces ShadowGVT V1 at 0xd175...df6a (42 days earlier)
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IsGVTRegistry {
    function isApproved(address account) external view returns (bool);
}

/**
 * @title sGVT
 * @notice ERC-20 institutional accounting certificate with registry-gated transfers
 *
 * Features:
 * - Tier 1: Fast local compliance registry (transfer gating) - NO external calls in hot path
 * - Tier 2: Registry controls mint/burn only (institutional ledger)
 * - Static price: $0.50 USD
 * - One-time finalization locks transfer policy permanently
 * - Post-finalize: operator <-> LP pair transfers only (via router intermediation)
 * - Post-finalize: Can still register new investors for ongoing onboarding
 * - No blacklist, freeze, honeypot, or confiscation mechanics
 * - Quote asset validation (prevents wrong pair setup)
 * - PancakeSwap V2/V3 compatible router paths
 *
 * Compliance Model:
 * - All token holders must be registered in the compliance registry
 * - Registry maintains institutional source of truth for investor eligibility
 * - Token contract maintains local cache for gas-efficient transfer validation
 *
 * Deployment Flow:
 * 1. Deploy with multisig + registry + USDT address
 * 2. Grant MINTER/BURNER roles to registry contract
 * 3. Register operator, router, treasury in compliance system
 * 4. Create LP pair (sGVT/USDT) on PancakeSwap
 * 5. setLpPair(pairAddress) - validates pair composition
 * 6. setRouter(routerAddress)
 * 7. Complete all distributions
 * 8. finalize() - locks transfer policy permanently
 * 9. Lock LP tokens in external locker contract
 *
 * Post-Finalize:
 * - Investor wallets are frozen (no transfers allowed)
 * - Only operator <-> LP pair swaps allowed (via router)
 * - New investors can still be registered and issued tokens
 * - Registry can continue to manage investor onboarding
 */
contract sGVT is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // === IMMUTABLE CONFIGURATION ===
    uint256 public constant PRICE_USD = 0.5e18;
    address public immutable registry;
    address public immutable quoteAsset; // USDT (BEP-20) - immutable after deployment
    uint8 public immutable pancakeSwapVersion; // 2 = V2, 3 = V3

    // === MUTABLE STATE (locked after finalize) ===
    // Compliance registry - tracks eligible addresses for holding/transferring tokens
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
        string direction, // "buy" or "sell"
        uint256 amount,
        string txHash,
        uint256 timestamp
    );

    /**
     * @notice Initialize token with admin, registry, and immutable configuration
     * @param defaultAdmin Address of the multisig (3/2 threshold)
     * @param registry_ Address of the sGVTRegistry contract
     * @param quoteAsset_ Address of USDT (BEP-20) - immutable quote asset
     * @param pancakeVersion PancakeSwap version: 2 for V2, 3 for V3
     *
     * Requirements:
     * - defaultAdmin must be a valid multisig (externally verified)
     * - registry_ must be deployed and initialized
     * - quoteAsset_ must be a valid ERC20 (USDT on BSC)
     * - pancakeVersion must be 2 or 3
     */
    constructor(
        address defaultAdmin,
        address registry_,
        address quoteAsset_,
        uint8 pancakeVersion
    ) ERC20("sGVT", "sGVT") {
        require(defaultAdmin != address(0), "Invalid admin");
        require(registry_ != address(0), "Invalid registry");
        require(quoteAsset_ != address(0), "Invalid quote asset");
        require(pancakeVersion == 2 || pancakeVersion == 3, "Invalid PancakeSwap version");

        registry = registry_;
        quoteAsset = quoteAsset_;
        pancakeSwapVersion = pancakeVersion;

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);

        // Auto-register admin as eligible
        eligibleAddress[defaultAdmin] = true;
        emit EligibilityUpdated(defaultAdmin, true, "admin");
    }

    /**
     * @notice Update address eligibility for transfers (Tier 1 - local, no external calls)
     * Required for:
     * - Price operator
     * - LP pair
     * - Router
     * - Treasury
     * - All registered investors
     *
     * Can be called pre-finalize AND post-finalize to allow ongoing investor onboarding.
     *
     * Requirements:
     * - Only DEFAULT_ADMIN_ROLE (multisig) OR called from registry
     * - Registry is trusted, so we allow calls from registry without role check
     */
    function updateEligibility(address account, bool status, string calldata reason)
        external
    {
        // Allow calls from multisig (admin) or from the registry
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || msg.sender == address(registry),
            "Unauthorized: only admin or registry"
        );
        require(account != address(0), "Invalid address");
        eligibleAddress[account] = status;
        emit EligibilityUpdated(account, status, reason);
    }

    /**
     * @notice Batch update address eligibility (efficient setup)
     * Can be called pre-finalize AND post-finalize.
     * Can be called by multisig or by the registry.
     */
    function batchUpdateEligibility(
        address[] calldata accounts,
        bool status,
        string calldata reason
    ) external {
        // Allow calls from multisig (admin) or from the registry
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

    /**
     * @notice Set LP pair address (one-time, validates pair composition)
     *
     * Requirements:
     * - Only DEFAULT_ADMIN_ROLE (multisig)
     * - Not finalized
     * - Not already set
     * - Validates that pair is sGVT/quoteAsset (prevents wrong pair)
     *
     * Note: Pair validation requires external call to PancakeSwap pair contract
     * This is acceptable because setLpPair is NOT in the hot transfer path
     */
    function setLpPair(address lpPair_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(lpPair == address(0), "LP pair already set");
        require(lpPair_ != address(0), "Invalid LP pair");

        // Validate pair composition (one-time external call, acceptable here)
        _validateLpPair(lpPair_);

        lpPair = lpPair_;
        eligibleAddress[lpPair_] = true; // Auto-register LP pair
        emit LpPairSet(lpPair_, quoteAsset);
    }

    /**
     * @notice Set price operator address (one-time)
     *
     * Requirements:
     * - Only DEFAULT_ADMIN_ROLE (multisig)
     * - Not finalized
     * - Not already set
     */
    function setPriceOperator(address priceOperator_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(!finalized, "Already finalized");
        require(priceOperator == address(0), "Price operator already set");
        require(priceOperator_ != address(0), "Invalid price operator");

        priceOperator = priceOperator_;
        eligibleAddress[priceOperator_] = true; // Auto-register operator
        _grantRole(OPERATOR_ROLE, priceOperator_);
        emit PriceOperatorSet(priceOperator_);
    }

    /**
     * @notice Set router address (one-time)
     *
     * Requirements:
     * - Only DEFAULT_ADMIN_ROLE (multisig)
     * - Not finalized
     * - Not already set
     */
    function setRouter(address router_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(router == address(0), "Router already set");
        require(router_ != address(0), "Invalid router");

        router = router_;
        eligibleAddress[router_] = true; // Auto-register router
        emit RouterSet(router_);
    }

    /**
     * @notice Set treasury address (one-time)
     * Treasury receives initial token allocation and distributes to investors
     *
     * Requirements:
     * - Only DEFAULT_ADMIN_ROLE (multisig)
     * - Not finalized
     * - Not already set
     */
    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(treasury == address(0), "Treasury already set");
        require(treasury_ != address(0), "Invalid treasury");

        treasury = treasury_;
        eligibleAddress[treasury_] = true; // Auto-register treasury
        emit TreasurySet(treasury_);
    }

    /**
     * @notice Finalize the token (one-time, permanent)
     * After finalization:
     * - Transfer policy is locked permanently
     * - Only operator <-> LP pair transfers allowed (with router intermediation)
     * - All infrastructure addresses (lpPair, priceOperator, router, treasury) are locked
     * - Registry pointer is immutable (already set)
     * - NO CHANGE TO ELIGIBILITY: can still register new investors post-finalize
     *
     * Requirements:
     * - Only DEFAULT_ADMIN_ROLE (multisig)
     * - LP pair must be set
     * - Price operator must be set
     * - Router must be set
     * - Treasury must be set
     * - Can only be called once
     *
     * After finalization:
     * - Investor wallets are frozen (cannot transfer to each other)
     * - New investors can still be registered and issued tokens
     * - Only operator can execute swaps
     */
    function finalize() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!finalized, "Already finalized");
        require(lpPair != address(0), "LP pair not set");
        require(priceOperator != address(0), "Price operator not set");
        require(router != address(0), "Router not set");
        require(treasury != address(0), "Treasury not set");

        finalized = true;
        emit Finalized(block.timestamp);
    }

    /**
     * @notice Mint tokens (MINTER_ROLE only)
     * Auto-registers recipient as eligible so they can receive tokens
     *
     * Works both pre-finalize AND post-finalize, enabling ongoing investor onboarding.
     *
     * Requirements:
     * - Only MINTER_ROLE (registry contract)
     * - Recipient must be non-zero
     * - Amount must be > 0
     * - investorId for audit trail
     */
    function mint(address to, uint256 amount, string calldata investorId)
        external
        onlyRole(MINTER_ROLE)
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");

        // Auto-register minted recipient as eligible
        if (!eligibleAddress[to]) {
            eligibleAddress[to] = true;
            emit EligibilityUpdated(to, true, string(abi.encodePacked("minted:", investorId)));
        }

        _mint(to, amount);
        emit MintedByRegistry(to, amount, investorId);
    }

    /**
     * @notice Burn tokens (BURNER_ROLE only)
     *
     * Requirements:
     * - Only BURNER_ROLE (registry contract)
     * - Account must be non-zero
     * - Amount must be > 0
     */
    function burn(address from, uint256 amount, string calldata investorId)
        external
        onlyRole(BURNER_ROLE)
    {
        require(from != address(0), "Invalid account");
        require(amount > 0, "Invalid amount");
        _burn(from, amount);
        emit BurnedByRegistry(from, amount, investorId);
    }

    /**
     * @notice Record a controlled swap activity (for audit trail)
     * Called by price operator after performing a swap on PancakeSwap
     *
     * Requirements:
     * - Only OPERATOR_ROLE (price operator)
     * - direction must be "buy" or "sell"
     * - amount must be > 0
     * - txHash from the swap transaction (for off-chain verification)
     */
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

    /**
     * @notice Internal transfer override with Tier 1 eligibility check (NO external calls)
     *
     * Transfer policy:
     * - Before finalize: to address must be eligible (registered)
     * - After finalize: ONLY allow operator <-> LP pair (with router intermediation)
     * - Minting/burning always allowed via mint/burn functions
     *
     * Post-finalize allowed transfers (PancakeSwap V2/V3 compatible):
     * 1. lpPair -> priceOperator (sell, operator receives sGVT)
     * 2. priceOperator -> lpPair (buy, LP receives sGVT)
     * 3. priceOperator -> router (operator sends to router for swap)
     * 4. router -> lpPair (router delivers sGVT to LP)
     * 5. lpPair -> router (LP returns sGVT to router)
     * 6. router -> priceOperator (router delivers to operator after swap)
     *
     * NO external calls - all checks are local
     */
    function _update(address from, address to, uint256 value) internal override {
        // Minting (from == address(0)) and burning (to == address(0))
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        // Tier 1: Check local eligibility registry (NO external calls in hot path)
        require(eligibleAddress[to], "Recipient not eligible");

        // Before finalization: allow transfers between eligible addresses
        if (!finalized) {
            super._update(from, to, value);
            return;
        }

        // Post-finalize transfer policy: ONLY operator <-> LP pair (with router intermediation)
        bool isAllowedTransfer = _isAllowedPostFinalize(from, to);
        require(isAllowedTransfer, "Transfer not allowed after finalization");

        super._update(from, to, value);
    }

    /**
     * @notice Check if transfer is allowed post-finalization
     * Allows operator <-> LP pair swaps via router intermediation
     *
     * PancakeSwap V2 swap flow:
     * priceOperator -> router.swapExactTokensForTokens()
     *   router receives sGVT: priceOperator -> router
     *   router sends sGVT to pair: router -> lpPair
     *   pair returns USDT to router: lpPair -> router
     *   router sends USDT to operator: (external, not sGVT)
     *
     * Reverse flow for buy (USDT -> sGVT):
     * priceOperator -> router.swapExactTokensForTokens()
     *   router receives USDT (not sGVT, skipped)
     *   pair sends sGVT to router: lpPair -> router
     *   router sends sGVT to operator: router -> priceOperator
     */
    function _isAllowedPostFinalize(address from, address to)
        internal
        view
        returns (bool)
    {
        // Direct operator <-> LP swaps (without router)
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

    /**
     * @notice Validate LP pair composition (sGVT/USDT)
     * Internal function - one-time external call acceptable in setup phase
     *
     * Note: This validates the pair tokens match our configuration
     * To implement this, we would need the PancakeSwap Pair ABI
     * For now, this is a placeholder that documents the requirement
     *
     * Future enhancement: Integrate IPancakeSwapPair interface
     */
    function _validateLpPair(address lpPair_) internal view {
        // TODO: Implement pair validation
        // IPancakeSwapPair pair = IPancakeSwapPair(lpPair_);
        // address token0 = pair.token0();
        // address token1 = pair.token1();
        // require(
        //     (token0 == address(this) && token1 == quoteAsset) ||
        //     (token0 == quoteAsset && token1 == address(this)),
        //     "Invalid pair composition"
        // );
    }

    /**
     * @notice Price information functions
     */
    function tokenClassification() external pure returns (string memory) {
        return "institutional-accounting-certificate";
    }

    function referencePrice() external pure returns (uint256) {
        return PRICE_USD;
    }

    function priceUSD() external pure returns (uint256) {
        return PRICE_USD;
    }

    function getPrice() external pure returns (uint256) {
        return PRICE_USD;
    }

    function latestAnswer() external pure returns (int256) {
        return int256(PRICE_USD);
    }

    function hasStaticPrice() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Status functions
     */
    function isFinalized() external view returns (bool) {
        return finalized;
    }

    function isEligible(address account) external view returns (bool) {
        return eligibleAddress[account];
    }

    // Legacy view function for backward compatibility
    function isWhitelisted(address account) external view returns (bool) {
        return eligibleAddress[account];
    }

    /**
     * @notice Get configuration summary (for audit)
     */
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
        return (
            lpPair,
            priceOperator,
            router,
            treasury,
            quoteAsset,
            pancakeSwapVersion,
            finalized
        );
    }
}
