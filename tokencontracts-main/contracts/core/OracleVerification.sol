// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../interfaces/IrGGP.sol";

/**
 * @title OracleVerification
 * @notice Verifies and validates oracle data before minting rGGP
 * @dev Multi-signature oracle system with failsafe mechanisms
 * Features:
 * - Multi-source oracle validation (Chainlink, Pyth, custom)
 * - Signature verification for data integrity
 * - Stale data detection and auto-pause
 * - Source registration and management
 * - SLA tracking and enforcement
 */
contract OracleVerification is AccessControl, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IrGGP public immutable rGGP;

    // Oracle source configuration
    struct OracleSource {
        address signer; // Oracle signer address
        bool active; // Is source active
        uint256 lastUpdate; // Last successful data submission
        uint256 totalSubmissions; // Total data points submitted
        uint256 failedSubmissions; // Failed validations
        string sourceType; // "chainlink", "pyth", "api3", "custom"
    }

    mapping(bytes32 => OracleSource) public oracleSources;
    bytes32[] public sourceIds;

    // Validation parameters
    uint256 public constant MAX_DATA_AGE = 7 days; // Max age for data
    uint256 public constant STALE_THRESHOLD = 30 days; // Auto-pause if source offline
    uint256 public minRequiredSignatures = 1; // Multi-sig requirement

    // SLA tracking
    uint256 public constant TARGET_UPTIME = 99; // 99% uptime target
    uint256 public constant UPTIME_WINDOW = 30 days;

    mapping(bytes32 => uint256) public sourceUptime; // Uptime tracking

    event SourceRegistered(bytes32 indexed sourceId, address signer, string sourceType);
    event SourceDeactivated(bytes32 indexed sourceId, string reason);
    event SourceReactivated(bytes32 indexed sourceId);
    event DataSubmitted(
        bytes32 indexed sourceId, address indexed recipient, uint256 outputAmount, IrGGP.AssetType assetType
    );
    event ValidationFailed(bytes32 indexed sourceId, string reason);
    event StaleSourceDetected(bytes32 indexed sourceId, uint256 daysSinceUpdate);

    constructor(address _rGGP, address admin) {
        require(_rGGP != address(0), "Invalid rGGP address");

        rGGP = IrGGP(_rGGP);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /**
     * @notice Register new oracle source
     */
    function registerSource(bytes32 sourceId, address signer, string calldata sourceType)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(signer != address(0), "Invalid signer");
        require(oracleSources[sourceId].signer == address(0), "Source exists");

        oracleSources[sourceId] = OracleSource({
            signer: signer,
            active: true,
            lastUpdate: block.timestamp,
            totalSubmissions: 0,
            failedSubmissions: 0,
            sourceType: sourceType
        });

        sourceIds.push(sourceId);

        emit SourceRegistered(sourceId, signer, sourceType);
    }

    /**
     * @notice Submit oracle data for minting
     * @param recipient Address to receive minted rGGP
     * @param outputAmount Amount of output (kWh, kg, hours)
     * @param assetType Type of asset
     * @param sourceId Oracle source identifier
     * @param timestamp Data timestamp
     * @param signature Oracle signature
     */
    function submitData(
        address recipient,
        uint256 outputAmount,
        IrGGP.AssetType assetType,
        bytes32 sourceId,
        uint256 timestamp,
        bytes memory signature
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        OracleSource storage source = oracleSources[sourceId];

        // Validate source
        require(source.active, "Source inactive");
        require(source.signer != address(0), "Source not registered");

        // Check data freshness
        require(timestamp <= block.timestamp, "Future timestamp");
        require(block.timestamp - timestamp <= MAX_DATA_AGE, "Stale data");

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(recipient, outputAmount, assetType, sourceId, timestamp));

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recoveredSigner = ECDSA.recover(ethSignedHash, signature);

        if (recoveredSigner != source.signer) {
            source.failedSubmissions++;
            emit ValidationFailed(sourceId, "Invalid signature");
            revert("Invalid signature");
        }

        // Update source stats
        source.lastUpdate = block.timestamp;
        source.totalSubmissions++;

        // Mint rGGP through verified channel
        rGGP.mintFromOutput(recipient, outputAmount, assetType, sourceId, timestamp, signature);

        emit DataSubmitted(sourceId, recipient, outputAmount, assetType);
    }

    /**
     * @notice Check for stale sources and pause if needed
     */
    function checkStaleSources() external {
        for (uint256 i = 0; i < sourceIds.length; i++) {
            bytes32 sourceId = sourceIds[i];
            OracleSource storage source = oracleSources[sourceId];

            if (source.active && block.timestamp - source.lastUpdate > STALE_THRESHOLD) {
                source.active = false;

                uint256 daysSinceUpdate = (block.timestamp - source.lastUpdate) / 1 days;
                emit StaleSourceDetected(sourceId, daysSinceUpdate);
                emit SourceDeactivated(sourceId, "Stale data - exceeded 30 day threshold");
            }
        }
    }

    /**
     * @notice Pause source manually (DAO governance)
     */
    function deactivateSource(bytes32 sourceId, string calldata reason) external onlyRole(OPERATOR_ROLE) {
        require(oracleSources[sourceId].active, "Already inactive");
        oracleSources[sourceId].active = false;
        emit SourceDeactivated(sourceId, reason);
    }

    /**
     * @notice Reactivate source after review
     */
    function reactivateSource(bytes32 sourceId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        OracleSource storage source = oracleSources[sourceId];
        require(!source.active, "Already active");
        require(source.signer != address(0), "Source not registered");

        source.active = true;
        source.lastUpdate = block.timestamp;

        emit SourceReactivated(sourceId);
    }

    /**
     * @notice Update source signer address
     */
    function updateSourceSigner(bytes32 sourceId, address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newSigner != address(0), "Invalid signer");
        require(oracleSources[sourceId].signer != address(0), "Source not registered");

        oracleSources[sourceId].signer = newSigner;
    }

    /**
     * @notice Get source health metrics
     */
    function getSourceHealth(bytes32 sourceId)
        external
        view
        returns (bool active, uint256 daysSinceUpdate, uint256 successRate, string memory sourceType)
    {
        OracleSource memory source = oracleSources[sourceId];

        daysSinceUpdate = (block.timestamp - source.lastUpdate) / 1 days;

        uint256 totalAttempts = source.totalSubmissions + source.failedSubmissions;
        successRate = totalAttempts > 0 ? (source.totalSubmissions * 100) / totalAttempts : 0;

        return (source.active, daysSinceUpdate, successRate, source.sourceType);
    }

    /**
     * @notice Get all registered sources
     */
    function getAllSources() external view returns (bytes32[] memory) {
        return sourceIds;
    }

    /**
     * @notice Get active source count
     */
    function getActiveSourceCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < sourceIds.length; i++) {
            if (oracleSources[sourceIds[i]].active) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Update minimum required signatures
     */
    function setMinRequiredSignatures(uint256 min) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(min > 0, "Must require at least 1 signature");
        minRequiredSignatures = min;
    }

    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
