// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "ERC721A-Upgradeable/contracts/ERC721AUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/token/common/ERC2981Upgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PassBase
 * @notice V3 NFT Pass — single pool + Agent License model
 * @dev Abstract base for 4 Pass types (Seed / Tree / Solar / Compute).
 *
 * Architecture:
 *   - Single MAX_SUPPLY pool (1,000,000) — no Public/Agent/Reserve split
 *   - Collectible NFTs: tradeable ERC721A tokens purchased via mint() or airdropped via adminMint()
 *   - License NFTs: soulbound ERC721A tokens representing Agent authorization
 *   - Agent settlement: off-chain payment → Admin calls adminMintForAgent() on-chain
 *
 * BSC USDT (Binance-Peg BSC-USD): 0x55d398326f99059fF775485246999027B3197955 — 18 decimals
 */
abstract contract PassBase is
    ERC721AUpgradeable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ERC2981Upgradeable,
    ReentrancyGuard,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ──────────────────── Roles ────────────────────
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    // ──────────────────── Constants ────────────────────
    uint256 public constant MAX_SUPPLY = 1_000_000;
    uint96 internal constant ROYALTY_BPS = 500; // 5%

    // ──────────────────── Storage ────────────────────
    IERC20 public usdtToken;
    address public treasury;
    string private _collectibleBaseURI;
    string private _licenseBaseURI;
    bool public metadataFrozen;
    bool public saleActive;

    /// @dev Agent License book-keeping.
    struct License {
        uint256 tokenId; // ERC721A token minted to agent as license proof
        uint256 quota;   // Total qty this agent may distribute
        uint256 used;    // Qty already fulfilled via adminMintForAgent
        bool active;     // Can be revoked by admin
    }

    mapping(address => License) private _licenses;
    mapping(uint256 => bool) private _isLicenseToken;

    // ──────────────────── Events ────────────────────
    event Mint(address indexed buyer, uint256 quantity, uint256 payment);
    event AdminMint(address indexed to, uint256 quantity);
    event AgentMintFulfilled(address indexed agent, address indexed to, uint256 quantity);
    event LicenseGranted(address indexed agent, uint256 tokenId, uint256 quota);
    event LicenseRevoked(address indexed agent, uint256 tokenId);
    event QuotaAdjusted(address indexed agent, uint256 oldQuota, uint256 newQuota);
    event SaleActiveChanged(bool active);
    event CollectibleBaseURIUpdated(string uri);
    event LicenseBaseURIUpdated(string uri);
    event MetadataFrozen();
    event TreasuryUpdated(address indexed newTreasury);
    event TreasuryWithdraw(address indexed token, uint256 amount);

    // ──────────────────── Errors ────────────────────
    error ZeroAddress();
    error ZeroQuantity();
    error ExceedsMaxSupply();
    error SaleNotActive();
    error AlreadyLicensed();
    error NotLicensed();
    error QuotaBelowUsed();
    error ExceedsQuota();
    error SoulboundToken();
    error MetadataIsFrozen();

    // ──────────────────── Abstract ────────────────────
    /// @notice USDT price per NFT (18 decimals on BSC). Each child overrides.
    function price() public view virtual returns (uint256);

    // ══════════════════════════════════════════════════
    //              INITIALIZER
    // ══════════════════════════════════════════════════

    function __PassBase_init(
        string memory name_,
        string memory symbol_,
        address admin_,
        address usdt_,
        address treasury_
    ) internal onlyInitializing {
        __ERC721A_init(name_, symbol_);
        __AccessControl_init();
        __ERC2981_init();
        __Pausable_init();

        if (admin_ == address(0) || usdt_ == address(0) || treasury_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
        _grantRole(TREASURER_ROLE, treasury_);

        usdtToken = IERC20(usdt_);
        treasury = treasury_;
        saleActive = true;

        _setDefaultRoyalty(treasury_, ROYALTY_BPS);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ══════════════════════════════════════════════════
    //              CORE — Public Mint
    // ══════════════════════════════════════════════════

    /// @notice Retail self-service purchase. Buyer pays USDT → treasury.
    function mint(uint256 qty) external nonReentrant whenNotPaused {
        if (!saleActive) revert SaleNotActive();
        if (qty == 0) revert ZeroQuantity();
        if (totalSupply() + qty > MAX_SUPPLY) revert ExceedsMaxSupply();

        uint256 payment = qty * price();
        usdtToken.safeTransferFrom(msg.sender, treasury, payment);
        _safeMint(msg.sender, qty);

        emit Mint(msg.sender, qty, payment);
    }

    // ══════════════════════════════════════════════════
    //              CORE — Admin Mint
    // ══════════════════════════════════════════════════

    /// @notice Admin airdrop / giveaway — no USDT payment.
    function adminMint(address to, uint256 qty) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (qty == 0) revert ZeroQuantity();
        if (totalSupply() + qty > MAX_SUPPLY) revert ExceedsMaxSupply();

        _safeMint(to, qty);
        emit AdminMint(to, qty);
    }

    /// @notice Agent settlement — Admin mints on behalf of Agent after off-chain payment.
    function adminMintForAgent(
        address agent,
        address to,
        uint256 qty
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (qty == 0) revert ZeroQuantity();
        if (totalSupply() + qty > MAX_SUPPLY) revert ExceedsMaxSupply();

        License storage lic = _licenses[agent];
        if (!lic.active) revert NotLicensed();
        if (lic.used + qty > lic.quota) revert ExceedsQuota();

        lic.used += qty;
        _safeMint(to, qty);

        emit AgentMintFulfilled(agent, to, qty);
    }

    // ══════════════════════════════════════════════════
    //              CORE — License Management
    // ══════════════════════════════════════════════════

    /// @notice Grant a soulbound License NFT to an agent with an initial quota.
    function grantLicense(address agent, uint256 quota) external onlyRole(ADMIN_ROLE) {
        if (agent == address(0)) revert ZeroAddress();
        if (quota == 0) revert ZeroQuantity();
        if (_licenses[agent].active) revert AlreadyLicensed();
        if (totalSupply() + 1 > MAX_SUPPLY) revert ExceedsMaxSupply();

        uint256 tokenId = _nextTokenId();
        _safeMint(agent, 1);
        _isLicenseToken[tokenId] = true;

        _licenses[agent] = License({tokenId: tokenId, quota: quota, used: 0, active: true});

        emit LicenseGranted(agent, tokenId, quota);
    }

    /// @notice Revoke an agent's license. The soulbound NFT remains as proof of past authorization.
    function revokeLicense(address agent) external onlyRole(ADMIN_ROLE) {
        License storage lic = _licenses[agent];
        if (!lic.active) revert NotLicensed();

        lic.active = false;
        emit LicenseRevoked(agent, lic.tokenId);
    }

    /// @notice Adjust an agent's quota. Cannot set below already-used amount.
    function adjustQuota(address agent, uint256 newQuota) external onlyRole(ADMIN_ROLE) {
        License storage lic = _licenses[agent];
        if (!lic.active) revert NotLicensed();
        if (newQuota < lic.used) revert QuotaBelowUsed();

        uint256 oldQuota = lic.quota;
        lic.quota = newQuota;

        emit QuotaAdjusted(agent, oldQuota, newQuota);
    }

    // ══════════════════════════════════════════════════
    //              VIEW — Queries
    // ══════════════════════════════════════════════════

    /// @notice Full license info for an agent.
    function getLicense(address agent)
        external
        view
        returns (uint256 tokenId, uint256 quota, uint256 used, uint256 remaining, bool active)
    {
        License storage lic = _licenses[agent];
        uint256 rem = lic.active ? lic.quota - lic.used : 0;
        return (lic.tokenId, lic.quota, lic.used, rem, lic.active);
    }

    /// @notice Overall supply info.
    function supplyInfo() external view returns (uint256 minted, uint256 maxSupply, uint256 remaining) {
        uint256 s = totalSupply();
        return (s, MAX_SUPPLY, MAX_SUPPLY - s);
    }

    /// @notice Whether a given tokenId is a soulbound License NFT.
    function isLicenseToken(uint256 tokenId) external view returns (bool) {
        return _isLicenseToken[tokenId];
    }

    /// @notice Number of tokens minted by a specific address.
    function numberMinted(address addr) external view returns (uint256) {
        return _numberMinted(addr);
    }

    // ══════════════════════════════════════════════════
    //              ADMIN — Config
    // ══════════════════════════════════════════════════

    function setSaleActive(bool active) external onlyRole(ADMIN_ROLE) {
        saleActive = active;
        emit SaleActiveChanged(active);
    }

    function setCollectibleBaseURI(string calldata uri) external onlyRole(ADMIN_ROLE) {
        if (metadataFrozen) revert MetadataIsFrozen();
        _collectibleBaseURI = uri;
        emit CollectibleBaseURIUpdated(uri);
    }

    function setLicenseBaseURI(string calldata uri) external onlyRole(ADMIN_ROLE) {
        if (metadataFrozen) revert MetadataIsFrozen();
        _licenseBaseURI = uri;
        emit LicenseBaseURIUpdated(uri);
    }

    function freezeMetadata() external onlyRole(ADMIN_ROLE) {
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setRoyaltyInfo(address receiver, uint96 fee) external onlyRole(ADMIN_ROLE) {
        if (receiver == address(0)) revert ZeroAddress();
        require(fee <= 1000, "FeeTooHigh"); // Max 10%
        _setDefaultRoyalty(receiver, fee);
    }

    /// @notice Withdraw any ERC-20 or native BNB accidentally sent to contract.
    function withdrawTreasury(address token) external onlyRole(TREASURER_ROLE) {
        if (token == address(0)) {
            uint256 bal = address(this).balance;
            if (bal > 0) {
                (bool ok,) = payable(treasury).call{value: bal}("");
                require(ok, "TransferFailed");
                emit TreasuryWithdraw(address(0), bal);
            }
        } else {
            IERC20 t = IERC20(token);
            uint256 bal = t.balanceOf(address(this));
            if (bal > 0) {
                t.safeTransfer(treasury, bal);
                emit TreasuryWithdraw(token, bal);
            }
        }
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ══════════════════════════════════════════════════
    //              INTERNAL — Overrides
    // ══════════════════════════════════════════════════

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    /// @dev Soulbound enforcement: License tokens cannot be transferred.
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId_,
        uint256 quantity
    ) internal virtual override {
        // Only check user-initiated transfers (skip mint & burn)
        if (from != address(0) && to != address(0)) {
            for (uint256 i; i < quantity;) {
                if (_isLicenseToken[startTokenId_ + i]) revert SoulboundToken();
                unchecked {
                    ++i;
                }
            }
        }
        super._beforeTokenTransfers(from, to, startTokenId_, quantity);
    }

    /// @dev Dual URI routing: License → _licenseBaseURI ; Collectible → _collectibleBaseURI.
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        string memory base = _isLicenseToken[tokenId] ? _licenseBaseURI : _collectibleBaseURI;
        return bytes(base).length > 0 ? string(abi.encodePacked(base, _toString(tokenId))) : "";
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyRole(ADMIN_ROLE) {
        if (newImplementation == address(0)) revert ZeroAddress();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721AUpgradeable, AccessControlUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return ERC721AUpgradeable.supportsInterface(interfaceId)
            || AccessControlUpgradeable.supportsInterface(interfaceId)
            || ERC2981Upgradeable.supportsInterface(interfaceId);
    }

    /// @dev Storage gap for future upgrades.
    uint256[43] private __gap;
}
