// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "ERC721A-Upgradeable/contracts/ERC721AUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/token/common/ERC2981Upgradeable.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "openzeppelin-contracts-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title SeedPass
 * @dev ERC721A NFT contract with UUPS upgradeability, ERC2981 royalties, and USDT payments
 */
contract SeedPass is
    ERC721AUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // --- Constants ---
    bytes32 internal constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 internal constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    uint256 internal constant MAX_SUPPLY = 600;
    uint256 internal constant MAX_PER_WALLET = 3;
    uint256 internal constant PUBLIC_ALLOCATION = 400;
    uint256 internal constant WHITELIST_ALLOCATION = 200;
    uint256 internal constant PRICE_USDT = 29 * 1e6;
    uint96 internal constant ROYALTY_BPS = 500;

    // --- State Variables ---
    struct Config {
        uint64 wlStartTime;
        uint64 wlEndTime;
        bool saleActive;
        bool metadataFrozen;
        uint16 publicMinted;
        uint16 whitelistMinted;
    }

    Config public config;
    IERC20 public usdtToken;
    bytes32 public whitelistMerkleRoot;
    address public treasuryReceiver;
    string private _baseTokenURI;

    // ----- Events -----
    event PublicMint(address indexed minter, uint256 quantity, uint256 payment);
    event WhitelistMint(address indexed minter, uint256 quantity, uint256 payment);
    event AgentMint(address indexed agent, address indexed recipient, uint256 quantity);
    event SaleConfigUpdated(uint256 wlStartTime, uint256 wlEndTime, bool active);
    event WhitelistUpdated(bytes32 newRoot);
    event AgentUpdated(address indexed agent, bool authorized);
    event MetadataFrozened();
    event BaseURIUpdated(string newBaseURI);
    event TreasuryWithdraw(address indexed token, uint256 amount);

    // --- Initialization ---
    function initialize(
        string memory name,
        string memory symbol,
        address owner,
        address usdtAddress,
        address treasury,
        bytes32 initialMerkleRoot,
        uint256 wlStartTime,
        uint256 wlEndTime
    ) public initializerERC721A initializer {
        __ERC721A_init(name, symbol);
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        __ERC2981_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        require(usdtAddress != address(0) && treasury != address(0) && owner != address(0), "ZeroAddress");
        require(wlStartTime < wlEndTime, "InvalidTimeRange");

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(ADMIN_ROLE, owner);
        _grantRole(TREASURER_ROLE, treasury);

        usdtToken = IERC20(usdtAddress);
        treasuryReceiver = treasury;
        whitelistMerkleRoot = initialMerkleRoot;

        config = Config({
            wlStartTime: uint64(wlStartTime),
            wlEndTime: uint64(wlEndTime),
            saleActive: true,
            metadataFrozen: false,
            publicMinted: 0,
            whitelistMinted: 0
        });

        _setDefaultRoyalty(treasury, ROYALTY_BPS);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // --- Public Functions ---
    function mint(uint256 amount, bytes32[] calldata merkleProof) external nonReentrant whenNotPaused {
        require(config.saleActive, "SaleNotActive");
        require(amount > 0, "InvalidAmount");
        require(totalSupply() + amount <= MAX_SUPPLY, "ExceedsMaxSupply");
        require(_numberMinted(msg.sender) + amount <= MAX_PER_WALLET, "ExceedsWalletLimit");

        bool isWL = block.timestamp >= config.wlStartTime && block.timestamp <= config.wlEndTime;
        bool isPub = block.timestamp > config.wlEndTime;

        require(isWL || isPub, "PublicSaleNotStarted");

        if (isWL) {
            require(config.whitelistMinted + amount <= WHITELIST_ALLOCATION, "ExceedsWhitelistAllocation");
            require(_verifyWL(msg.sender, merkleProof), "NotWhitelisted");

            // Update whitelist minted counter
            config.whitelistMinted += uint16(amount);
            emit WhitelistMint(msg.sender, amount, amount * PRICE_USDT);
        } else {
            require(config.publicMinted + amount <= PUBLIC_ALLOCATION, "ExceedsPublicAllocation");

            // Update public minted counter
            config.publicMinted += uint16(amount);
            emit PublicMint(msg.sender, amount, amount * PRICE_USDT);
        }

        // Transfer payment and mint tokens
        usdtToken.safeTransferFrom(msg.sender, treasuryReceiver, amount * PRICE_USDT);
        _safeMint(msg.sender, amount);
    }

    // ---- Admin Functions ----
    function setSaleConfig(uint256 wlStartTime, uint256 wlEndTime, bool active) external onlyRole(ADMIN_ROLE) {
        require(wlStartTime < wlEndTime, "InvalidTimeRange");
        config.wlStartTime = uint64(wlStartTime);
        config.wlEndTime = uint64(wlEndTime);
        config.saleActive = active;
        emit SaleConfigUpdated(wlStartTime, wlEndTime, active);
    }

    function setWhitelistRoot(bytes32 newRoot) external onlyRole(ADMIN_ROLE) {
        whitelistMerkleRoot = newRoot;
        emit WhitelistUpdated(newRoot);
    }

    function setTreasuryReceiver(address newTreasury) external onlyRole(ADMIN_ROLE) {
        require(newTreasury != address(0), "ZeroAddress");
        revokeRole(TREASURER_ROLE, treasuryReceiver);
        _grantRole(TREASURER_ROLE, newTreasury);
        treasuryReceiver = newTreasury;
    }

    function setRoyaltyInfo(address receiver, uint96 fee) external onlyRole(ADMIN_ROLE) {
        require(receiver != address(0), "ZeroAddress");
        require(fee <= 1000, "FeeTooHigh"); // Max 10%
        _setDefaultRoyalty(receiver, fee);
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(ADMIN_ROLE) {
        require(!config.metadataFrozen, "MetadataFrozen");
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function freezeMetadata() external onlyRole(ADMIN_ROLE) {
        config.metadataFrozen = true;
        emit MetadataFrozened();
    }

    function withdrawTreasury(address token) external onlyRole(TREASURER_ROLE) {
        if (token == address(0)) {
            uint256 balance = address(this).balance;
            if (balance > 0) {
                (bool success,) = payable(treasuryReceiver).call{value: balance}("");
                require(success, "Transfer failed");
                emit TreasuryWithdraw(address(0), balance);
            }
        } else {
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            if (balance > 0) {
                tokenContract.safeTransfer(treasuryReceiver, balance);
                emit TreasuryWithdraw(token, balance);
            }
        }
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    // -------- View Functions --------
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721AUpgradeable, AccessControlUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function getCurrentPhase() external view returns (string memory) {
        if (!config.saleActive) return "INACTIVE";
        if (block.timestamp < config.wlStartTime) return "UPCOMING";
        if (block.timestamp <= config.wlEndTime) return "WHITELIST";
        return "PUBLIC";
    }

    function getRemainingPublicSupply() external view returns (uint256) {
        return PUBLIC_ALLOCATION - config.publicMinted;
    }

    function getRemainingWhitelistSupply() external view returns (uint256) {
        return WHITELIST_ALLOCATION - config.whitelistMinted;
    }

    function numberMinted(address owner) external view returns (uint256) {
        return _numberMinted(owner);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyRole(ADMIN_ROLE) {
        require(newImplementation != address(0), "ZeroAddress");
    }

    function _verifyWL(address account, bytes32[] calldata proof) internal view returns (bool) {
        if (whitelistMerkleRoot == bytes32(0)) return false;
        bytes32 leaf = keccak256(abi.encodePacked(account));
        return MerkleProof.verify(proof, whitelistMerkleRoot, leaf);
    }

    uint256[44] private __gap;
}
