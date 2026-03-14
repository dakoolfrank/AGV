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
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IAgentRegistry.sol";

/**
 * @title ComputePass
 * @dev ERC721A NFT contract with UUPS upgradeability, ERC2981 royalties, and USDT payments
 */
contract ComputePass is
    ERC721AUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // --- Constants ---
    bytes32 internal constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 internal constant AGENT_MINTER_ROLE = keccak256("AGENT_MINTER_ROLE");
    bytes32 internal constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    uint256 internal constant MAX_SUPPLY = 99; // 99 total NFTs
    uint256 internal constant MAX_PER_WALLET = 1;
    uint256 internal constant PUBLIC_ALLOCATION = 49;
    uint256 internal constant RESERVED_ALLOCATION = 50;
    uint256 internal constant WL_PRICE_USDT = 899 * 1e6;
    uint256 internal constant PUBLIC_PRICE_USDT = 899 * 1e6;
    uint256 internal constant AGENT_PRICE_USDT = 499 * 1e6;

    uint96 internal constant ROYALTY_BPS = 300; // 3% royalty fee

    // --- State Variables ---
    struct Config {
        uint64 wlStartTime;
        uint64 wlEndTime;
        bool saleActive;
        bool metadataFrozen;
        uint256 publicMinted;
        uint256 reservedMinted;
    }

    Config public config;
    IERC20 public usdtToken;
    bytes32 public whitelistMerkleRoot;
    address public treasuryReceiver;
    string private _baseTokenURI;

    /// @notice AgentRegistry for per-agent quota tracking (optional, backward-compatible)
    IAgentRegistry public agentRegistry;

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
        __ERC2981_init();
        __AccessControl_init();
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
            reservedMinted: 0
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

        require(config.publicMinted + amount <= PUBLIC_ALLOCATION, "ExceedsPublicAllocation");

        uint256 payment;

        if (isWL) {
            require(_verifyWL(msg.sender, merkleProof), "NotWhitelisted");

            config.publicMinted += amount;
            payment = amount * WL_PRICE_USDT;
            usdtToken.safeTransferFrom(msg.sender, treasuryReceiver, payment);
            _safeMint(msg.sender, amount);

            emit WhitelistMint(msg.sender, amount, payment);
        } else if (isPub) {
            config.publicMinted += amount;
            payment = amount * PUBLIC_PRICE_USDT;
            usdtToken.safeTransferFrom(msg.sender, treasuryReceiver, payment);
            _safeMint(msg.sender, amount);

            emit PublicMint(msg.sender, amount, payment);
        } else {
            revert("SaleNotStarted");
        }
    }

    function agentMint(address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyRole(AGENT_MINTER_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(recipients.length == amounts.length, "InvalidConfiguration");

        uint256 total;
        uint256 totalPayment;

        for (uint256 i; i < amounts.length;) {
            total += amounts[i];
            totalPayment += amounts[i] * AGENT_PRICE_USDT;
            unchecked {
                ++i;
            }
        }

        require(totalSupply() + total <= MAX_SUPPLY, "ExceedsMaxSupply");
        require(config.reservedMinted + total <= RESERVED_ALLOCATION, "ExceedsReservedAllocation");

        // Per-agent quota deduction (if AgentRegistry is configured)
        if (address(agentRegistry) != address(0)) {
            agentRegistry.deductQuota(msg.sender, total);
        }

        config.reservedMinted += total;

        //Agent pays for minting at agent price
        if (totalPayment > 0) {
            usdtToken.safeTransferFrom(msg.sender, treasuryReceiver, totalPayment);
        }

        for (uint256 i = 0; i < recipients.length;) {
            if (amounts[i] > 0) {
                _safeMint(recipients[i], amounts[i]);
                emit AgentMint(msg.sender, recipients[i], amounts[i]);
            }
            unchecked {
                ++i;
            }
        }
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

    function grantAgentRole(address agent) external onlyRole(ADMIN_ROLE) {
        require(agent != address(0), "ZeroAddress");
        _grantRole(AGENT_MINTER_ROLE, agent);
        emit AgentUpdated(agent, true);
    }

    function revokeAgentRole(address agent) external onlyRole(ADMIN_ROLE) {
        _revokeRole(AGENT_MINTER_ROLE, agent);
        emit AgentUpdated(agent, false);
    }

    /**
     * @notice Set the AgentRegistry for per-agent quota tracking
     * @param registry Address of the AgentRegistry contract (address(0) to disable)
     */
    function setAgentRegistry(address registry) external onlyRole(ADMIN_ROLE) {
        agentRegistry = IAgentRegistry(registry);
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
        return ERC721AUpgradeable.supportsInterface(interfaceId)
            || AccessControlUpgradeable.supportsInterface(interfaceId)
            || ERC2981Upgradeable.supportsInterface(interfaceId);
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

    function getRemainingReservedSupply() external view returns (uint256) {
        return RESERVED_ALLOCATION - config.reservedMinted;
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
