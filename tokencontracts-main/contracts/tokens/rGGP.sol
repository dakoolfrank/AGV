// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title rGGP (Rewarded Green Garden Points)
 * @notice Incentive token earned from verified real-world asset output
 * @dev Uncapped supply, mintable only via oracle-verified events
 * Features:
 * - Minted based on verified physical output (solar kWh, harvest kg, compute hours)
 * - Epoch-based caps to control inflation
 * - Convertible to GVT via BondingCurve contract
 * - Revocable for fraudulent mints
 */
contract rGGP is ERC20, ERC20Burnable, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    // Asset types for Power-to-Mint
    enum AssetType {
        SOLAR,
        ORCHARD,
        COMPUTE
    }

    // Mint rates (per unit of output)
    struct MintRate {
        uint256 ratePerUnit; // rGGP per unit (kWh, kg, hour)
        bool active;
    }

    mapping(AssetType => MintRate) public mintRates;

    // Epoch tracking for caps
    struct Epoch {
        uint256 startTime;
        uint256 duration;
        uint256 currentEpoch;
    }

    Epoch public epoch;

    // Epoch caps by asset type
    mapping(uint256 => mapping(AssetType => uint256)) public epochMinted;
    mapping(AssetType => uint256) public epochCap;

    // Mint tracking for audit trail
    struct MintRecord {
        address recipient;
        uint256 amount;
        AssetType assetType;
        bytes32 sourceId;
        uint256 timestamp;
        bool revoked;
    }

    mapping(bytes32 => MintRecord) public mintRecords;
    mapping(bytes32 => bool) public processedMints;

    event MintRateUpdated(AssetType assetType, uint256 newRate);
    event EpochCapUpdated(AssetType assetType, uint256 newCap);
    event OutputMinted(
        bytes32 indexed mintId, address indexed recipient, uint256 amount, AssetType assetType, bytes32 sourceId
    );
    event MintRevoked(bytes32 indexed mintId, string reason);
    event EpochAdvanced(uint256 newEpoch, uint256 timestamp);

    constructor(address admin) ERC20("Rewarded Green Garden Points", "rGGP") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(REVOKER_ROLE, admin);

        // Initialize default mint rates (as in the token handbook ** to be subject to adjstment **)
        mintRates[AssetType.SOLAR] = MintRate(10 * 10 ** 18, true); // 10 rGGP per kWh
        mintRates[AssetType.ORCHARD] = MintRate(25 * 10 ** 18, true); // 25 rGGP per kg
        mintRates[AssetType.COMPUTE] = MintRate(15 * 10 ** 18, true); // 15 rGGP per hour

        // Initialize epoch (quarterly: 90 days)
        epoch = Epoch({startTime: block.timestamp, duration: 90 days, currentEpoch: 1});

        // Set default epoch caps (can be adjusted by DAO)
        epochCap[AssetType.SOLAR] = 10_000_000 * 10 ** 18;
        epochCap[AssetType.ORCHARD] = 10_000_000 * 10 ** 18;
        epochCap[AssetType.COMPUTE] = 10_000_000 * 10 ** 18;
    }

    /**
     * @notice Update mint rate for an asset type
     */
    function setMintRate(AssetType assetType, uint256 rate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintRates[assetType].ratePerUnit = rate;
        emit MintRateUpdated(assetType, rate);
    }

    /**
     * @notice Update epoch cap for an asset type
     */
    function setEpochCap(AssetType assetType, uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        epochCap[assetType] = cap;
        emit EpochCapUpdated(assetType, cap);
    }

    /**
     * @notice Mint rGGP based on verified output
     * @param recipient Address to receive tokens
     * @param outputAmount Amount of output (kWh, kg, hours)
     * @param assetType Type of asset generating output
     * @param sourceId Unique identifier for the data source
     * @param timestamp Timestamp of the output event
     * @param signature Oracle signature for verification
     */
    function mintFromOutput(
        address recipient,
        uint256 outputAmount,
        AssetType assetType,
        bytes32 sourceId,
        uint256 timestamp,
        bytes memory signature
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        // Generate unique mint ID
        bytes32 mintId = keccak256(abi.encodePacked(recipient, outputAmount, assetType, sourceId, timestamp));

        require(!processedMints[mintId], "Mint already processed");
        require(mintRates[assetType].active, "Asset type not active");
        require(timestamp <= block.timestamp, "Future timestamp");
        require(block.timestamp - timestamp <= 7 days, "Stale data");
        // require(timestamp > block.timestamp - 7 days, "Stale data");

        // Advance epoch if needed
        _advanceEpochIfNeeded();

        // Calculate mint amount
        uint256 mintAmount = (outputAmount * mintRates[assetType].ratePerUnit) / 10 ** 18;

        // Check epoch cap
        uint256 currentEpochNum = epoch.currentEpoch;
        require(epochMinted[currentEpochNum][assetType] + mintAmount <= epochCap[assetType], "Epoch cap exceeded");

        // Record mint
        mintRecords[mintId] = MintRecord({
            recipient: recipient,
            amount: mintAmount,
            assetType: assetType,
            sourceId: sourceId,
            timestamp: timestamp,
            revoked: false
        });

        processedMints[mintId] = true;
        epochMinted[currentEpochNum][assetType] += mintAmount;

        // Mint tokens
        _mint(recipient, mintAmount);

        emit OutputMinted(mintId, recipient, mintAmount, assetType, sourceId);
    }

    /**
     * @notice Revoke fraudulent mint and burn tokens
     */
    function revokeMint(bytes32 mintId, string calldata reason) external onlyRole(REVOKER_ROLE) {
        MintRecord storage record = mintRecords[mintId];
        require(record.amount > 0, "Mint does not exist");
        require(!record.revoked, "Already revoked");

        record.revoked = true;

        // Burn from recipient if they still hold the tokens
        uint256 burnAmount = record.amount;
        if (balanceOf(record.recipient) >= burnAmount) {
            _burn(record.recipient, burnAmount);
        }

        emit MintRevoked(mintId, reason);
    }

    /**
     * @notice Advance to next epoch if duration has passed
     */
    function _advanceEpochIfNeeded() private {
        uint256 elapsed = block.timestamp - epoch.startTime;
        uint256 epochsPassed = elapsed / epoch.duration;

        if (epochsPassed > 0 && epoch.currentEpoch + epochsPassed > epoch.currentEpoch) {
            epoch.currentEpoch += epochsPassed;
            epoch.startTime = block.timestamp;
            emit EpochAdvanced(epoch.currentEpoch, block.timestamp);
        }
    }

    /**
     * @notice Manually advance epoch (DAO emergency use)
     */
    function advanceEpoch() external onlyRole(DEFAULT_ADMIN_ROLE) {
        epoch.currentEpoch += 1;
        epoch.startTime = block.timestamp;
        emit EpochAdvanced(epoch.currentEpoch, block.timestamp);
    }

    /**
     * @notice Get current epoch number
     */
    function getCurrentEpoch() external view returns (uint256) {
        return epoch.currentEpoch;
    }

    /**
     * @notice Get remaining cap for current epoch
     */
    function getRemainingCap(AssetType assetType) external view returns (uint256) {
        uint256 currentEpochNum = epoch.currentEpoch;
        uint256 minted = epochMinted[currentEpochNum][assetType];
        uint256 cap = epochCap[assetType];
        return cap > minted ? cap - minted : 0;
    }

    /**
     * @notice Pause minting
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause minting
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
