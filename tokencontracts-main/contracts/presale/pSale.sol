// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "../interfaces/IpGVT.sol";

/**
 * @title pSale
 * @notice Staged pSale contract — users deposit USDT, receive pGVT
 * @dev Features:
 * - Multi-stage pricing (seed / private / public)
 * - Per-stage whitelist via Merkle root
 * - Per-address purchase limits
 * - Funds go to treasury address
 * - Sales agents can buy on behalf of users (recipient ≠ msg.sender)
 */
contract pSale is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IpGVT public immutable pGVT;
    IERC20 public immutable paymentToken; // USDT (6 decimals)
    address public treasury;

    struct SaleStage {
        uint256 price;         // USDT per pGVT (6-decimal USDT for 1e18 pGVT)
        uint256 cap;           // Max pGVT sellable in this stage
        uint256 sold;          // pGVT sold so far
        uint256 startTime;
        uint256 endTime;
        uint256 maxPerAddress; // Max pGVT per address (0 = unlimited)
        bool whitelistOnly;
        bytes32 whitelistRoot; // Merkle root (if whitelistOnly)
    }

    uint256 public currentStageId;
    mapping(uint256 => SaleStage) public saleStages;
    mapping(uint256 => mapping(address => uint256)) public purchased; // stage => buyer => amount

    event Purchase(
        uint256 indexed stageId,
        address indexed buyer,
        address indexed recipient,
        uint256 usdtAmount,
        uint256 pGVTAmount
    );
    event StageConfigured(uint256 indexed stageId);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    error StageNotActive();
    error AmountIsZero();
    error NotWhitelisted();
    error AmountTooSmall();
    error StageCapExceeded();
    error PerAddressLimitExceeded();
    error InvalidTreasury();

    constructor(
        address _pGVT,
        address _paymentToken,
        address _treasury,
        address admin
    ) {
        require(_pGVT != address(0), "Invalid pGVT");
        require(_paymentToken != address(0), "Invalid payment token");
        require(_treasury != address(0), "Invalid treasury");

        pGVT = IpGVT(_pGVT);
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Buy pGVT — USDT in, pGVT out
     * @param recipient Address to receive pGVT (can differ from msg.sender for agent sales)
     * @param usdtAmount Amount of USDT to spend (6 decimals)
     * @param merkleProof Whitelist proof (empty array if not whitelistOnly)
     */
    function buy(
        address recipient,
        uint256 usdtAmount,
        bytes32[] calldata merkleProof
    ) external nonReentrant whenNotPaused {
        SaleStage storage stage = saleStages[currentStageId];
        if (block.timestamp < stage.startTime || block.timestamp > stage.endTime) {
            revert StageNotActive();
        }
        if (usdtAmount == 0) revert AmountIsZero();

        // Whitelist check
        if (stage.whitelistOnly) {
            bytes32 leaf = keccak256(abi.encodePacked(recipient));
            if (!MerkleProof.verify(merkleProof, stage.whitelistRoot, leaf)) {
                revert NotWhitelisted();
            }
        }

        // Calculate pGVT amount: (usdtAmount * 1e18) / price
        // price is in 6-decimal USDT for 1e18 pGVT
        // Example: price = 5_000 means 0.005 USDT per 1 pGVT
        //   usdtAmount = 1_000_000 (1 USDT) → (1_000_000 * 1e18) / 5_000 = 200e18 pGVT
        uint256 pGVTAmount = (usdtAmount * 1e18) / stage.price;
        if (pGVTAmount == 0) revert AmountTooSmall();

        // Stage cap check
        if (stage.sold + pGVTAmount > stage.cap) revert StageCapExceeded();

        // Per-address limit check
        if (stage.maxPerAddress > 0) {
            if (purchased[currentStageId][recipient] + pGVTAmount > stage.maxPerAddress) {
                revert PerAddressLimitExceeded();
            }
        }

        // Transfer USDT to treasury
        paymentToken.safeTransferFrom(msg.sender, treasury, usdtAmount);

        // Mint pGVT to recipient
        pGVT.mint(recipient, pGVTAmount);

        // Update tracking
        stage.sold += pGVTAmount;
        purchased[currentStageId][recipient] += pGVTAmount;

        emit Purchase(currentStageId, msg.sender, recipient, usdtAmount, pGVTAmount);
    }

    /**
     * @notice Configure a sale stage
     * @param stageId Stage identifier
     * @param price USDT per pGVT (6-decimal USDT for 1e18 pGVT). e.g. 5000 = 0.005 USDT
     * @param cap Max pGVT sellable (18 decimals)
     * @param startTime Unix timestamp for sale open
     * @param endTime Unix timestamp for sale close
     * @param maxPerAddress Max pGVT per wallet (0 = unlimited)
     * @param whitelistOnly Whether a Merkle proof is required
     * @param whitelistRoot Merkle root for whitelist verification
     */
    function configureStage(
        uint256 stageId,
        uint256 price,
        uint256 cap,
        uint256 startTime,
        uint256 endTime,
        uint256 maxPerAddress,
        bool whitelistOnly,
        bytes32 whitelistRoot
    ) external onlyRole(OPERATOR_ROLE) {
        require(price > 0, "Price=0");
        require(cap > 0, "Cap=0");
        require(endTime > startTime, "Invalid time range");

        saleStages[stageId] = SaleStage({
            price: price,
            cap: cap,
            sold: 0,
            startTime: startTime,
            endTime: endTime,
            maxPerAddress: maxPerAddress,
            whitelistOnly: whitelistOnly,
            whitelistRoot: whitelistRoot
        });
        emit StageConfigured(stageId);
    }

    /**
     * @notice Set the active sale stage
     * @param stageId Stage to activate
     */
    function setCurrentStage(uint256 stageId) external onlyRole(OPERATOR_ROLE) {
        currentStageId = stageId;
    }

    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert InvalidTreasury();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ===================== View helpers =====================

    /**
     * @notice Remaining pGVT available in current stage
     */
    function stageRemaining() external view returns (uint256) {
        SaleStage storage stage = saleStages[currentStageId];
        if (stage.sold >= stage.cap) return 0;
        return stage.cap - stage.sold;
    }

    /**
     * @notice How much more a given address can purchase in current stage
     */
    function addressRemaining(address buyer) external view returns (uint256) {
        SaleStage storage stage = saleStages[currentStageId];
        if (stage.maxPerAddress == 0) return type(uint256).max; // unlimited
        uint256 spent = purchased[currentStageId][buyer];
        if (spent >= stage.maxPerAddress) return 0;
        return stage.maxPerAddress - spent;
    }
}
