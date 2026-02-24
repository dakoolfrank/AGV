// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../interfaces/IrGGP.sol";

interface IOracleVerification {
    function submitData(
        address recipient,
        uint256 outputAmount,
        IrGGP.AssetType assetType,
        bytes32 sourceId,
        uint256 timestamp,
        bytes memory signature
    ) external;
}

/**
 * @title PowerToMint
 * @notice Coordinates minting logic with oracle verification
 * @dev Acts as the bridge between IoT data and rGGP token minting
 *
 * Flow: IoT Device → Edge Node → Oracle → PowerToMint → rGGP Mint
 *
 * Features:
 * - Deterministic issuance based on verified output
 * - Asset-specific mint rates (10 rGGP/kWh, 25 rGGP/kg, 15 rGGP/hour)
 * - Duplicate prevention
 * - Batch processing support
 * - Emergency revocation
 */
contract PowerToMint is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IrGGP public immutable rGGP;
    IOracleVerification public oracleVerification;

    // Asset configuration
    struct AssetConfig {
        uint256 ratePerUnit; // rGGP per unit of output
        uint256 minOutput; // Minimum output to process
        uint256 maxOutput; // Maximum output per transaction
        bool active;
    }

    mapping(IrGGP.AssetType => AssetConfig) public assetConfigs;

    // NFT to Asset mapping (for staking rewards)
    struct NFTAsset {
        IrGGP.AssetType assetType;
        bytes32 sourceId;
        address owner;
        bool active;
        uint256 totalOutputRecorded;
        uint256 totalRGGPMinted;
        uint256 lastMintTimestamp;
    }

    mapping(uint256 => NFTAsset) public nftAssets; // NFT tokenId → Asset
    mapping(bytes32 => uint256) public sourceToNFT; // sourceId → NFT tokenId

    // Mint tracking
    mapping(bytes32 => bool) public processedOutputs;

    // Statistics
    struct Statistics {
        uint256 totalMints;
        uint256 totalRGGPMinted;
        uint256 totalOutputProcessed;
    }

    mapping(IrGGP.AssetType => Statistics) public statistics;

    event AssetConfigured(IrGGP.AssetType indexed assetType, uint256 ratePerUnit, uint256 minOutput, uint256 maxOutput);

    event NFTAssetRegistered(uint256 indexed tokenId, IrGGP.AssetType assetType, bytes32 sourceId, address owner);

    event OutputProcessed(
        uint256 indexed nftTokenId,
        address indexed recipient,
        uint256 outputAmount,
        uint256 rggpMinted,
        IrGGP.AssetType assetType,
        bytes32 sourceId
    );

    event BatchProcessed(uint256 batchSize, uint256 totalRGGPMinted);

    event AssetDeactivated(uint256 indexed tokenId, string reason);

    constructor(address _rGGP, address _oracleVerification, address admin) {
        require(_rGGP != address(0), "Invalid rGGP");
        require(_oracleVerification != address(0), "Invalid oracle");

        rGGP = IrGGP(_rGGP);
        oracleVerification = IOracleVerification(_oracleVerification);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        _configureAsset(IrGGP.AssetType.SOLAR, 10 * 10 ** 18, 1 * 10 ** 18, 100000 * 10 ** 18);
        _configureAsset(IrGGP.AssetType.ORCHARD, 25 * 10 ** 18, 1 * 10 ** 18, 10000 * 10 ** 18);
        _configureAsset(IrGGP.AssetType.COMPUTE, 15 * 10 ** 18, 1 * 10 ** 18, 10000 * 10 ** 18);
    }

    /**
     * @notice Configure asset minting parameters
     */
    function configureAsset(IrGGP.AssetType assetType, uint256 ratePerUnit, uint256 minOutput, uint256 maxOutput)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _configureAsset(assetType, ratePerUnit, minOutput, maxOutput);
    }

    function _configureAsset(IrGGP.AssetType assetType, uint256 ratePerUnit, uint256 minOutput, uint256 maxOutput)
        private
    {
        require(ratePerUnit > 0, "Invalid rate");
        require(maxOutput >= minOutput, "Invalid output range");

        assetConfigs[assetType] =
            AssetConfig({ratePerUnit: ratePerUnit, minOutput: minOutput, maxOutput: maxOutput, active: true});

        emit AssetConfigured(assetType, ratePerUnit, minOutput, maxOutput);
    }

    /**
     * @notice Register NFT asset for Power-to-Mint
     * @param tokenId NFT token ID
     * @param assetType Type of physical asset
     * @param sourceId Oracle source identifier
     * @param owner NFT owner address
     */
    function registerNFTAsset(uint256 tokenId, IrGGP.AssetType assetType, bytes32 sourceId, address owner)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(owner != address(0), "Invalid owner");
        require(nftAssets[tokenId].owner == address(0), "NFT already registered");
        require(sourceToNFT[sourceId] == 0, "Source already mapped");

        nftAssets[tokenId] = NFTAsset({
            assetType: assetType,
            sourceId: sourceId,
            owner: owner,
            active: true,
            totalOutputRecorded: 0,
            totalRGGPMinted: 0,
            lastMintTimestamp: 0
        });

        sourceToNFT[sourceId] = tokenId;

        emit NFTAssetRegistered(tokenId, assetType, sourceId, owner);
    }

    /**
     * @notice Process output and mint rGGP
     * @param tokenId NFT representing the asset
     * @param outputAmount Amount of output produced
     * @param timestamp Output timestamp
     * @param signature Oracle signature
     */
    function processOutput(uint256 tokenId, uint256 outputAmount, uint256 timestamp, bytes memory signature)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
        whenNotPaused
    {
        NFTAsset storage asset = nftAssets[tokenId];

        require(asset.active, "Asset inactive");
        require(asset.owner != address(0), "Asset not registered");

        AssetConfig memory config = assetConfigs[asset.assetType];
        require(config.active, "Asset type inactive");
        require(outputAmount >= config.minOutput, "Output too small");
        require(outputAmount <= config.maxOutput, "Output too large");

        // Generate unique output ID
        bytes32 outputId = keccak256(abi.encodePacked(tokenId, asset.sourceId, outputAmount, timestamp));

        require(!processedOutputs[outputId], "Output already processed");
        require(timestamp >= asset.lastMintTimestamp, "Timestamp not sequential");
        require(timestamp <= block.timestamp, "Future timestamp");
        require(block.timestamp - timestamp <= 7 days, "Data too old");

        // Mark as processed
        processedOutputs[outputId] = true;

        // Calculate rGGP to mint
        uint256 rggpAmount = (outputAmount * config.ratePerUnit) / 10 ** 18;

        // Update asset stats
        asset.totalOutputRecorded += outputAmount;
        asset.totalRGGPMinted += rggpAmount;
        asset.lastMintTimestamp = timestamp;

        // Update global statistics
        Statistics storage stats = statistics[asset.assetType];
        stats.totalMints++;
        stats.totalRGGPMinted += rggpAmount;
        stats.totalOutputProcessed += outputAmount;

        // Submit to oracle verification and mint
        oracleVerification.submitData(asset.owner, outputAmount, asset.assetType, asset.sourceId, timestamp, signature);

        emit OutputProcessed(tokenId, asset.owner, outputAmount, rggpAmount, asset.assetType, asset.sourceId);
    }

    /**
     * @notice Batch process multiple outputs
     */
    function batchProcessOutputs(
        uint256[] calldata tokenIds,
        uint256[] calldata outputAmounts,
        uint256[] calldata timestamps,
        bytes[] calldata signatures
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        require(tokenIds.length == outputAmounts.length, "Length mismatch");
        require(tokenIds.length == timestamps.length, "Length mismatch");
        require(tokenIds.length == signatures.length, "Length mismatch");
        require(tokenIds.length <= 50, "Batch too large");

        uint256 totalMinted = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Process each output (reusing single output logic)
            this.processOutput(tokenIds[i], outputAmounts[i], timestamps[i], signatures[i]);

            // Accumulate minted amount
            AssetConfig memory config = assetConfigs[nftAssets[tokenIds[i]].assetType];
            totalMinted += (outputAmounts[i] * config.ratePerUnit) / 10 ** 18;
        }

        emit BatchProcessed(tokenIds.length, totalMinted);
    }

    /**
     * @notice Deactivate asset (stops minting)
     */
    function deactivateAsset(uint256 tokenId, string calldata reason) external onlyRole(OPERATOR_ROLE) {
        require(nftAssets[tokenId].active, "Already inactive");
        nftAssets[tokenId].active = false;
        emit AssetDeactivated(tokenId, reason);
    }

    /**
     * @notice Reactivate asset
     */
    function reactivateAsset(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!nftAssets[tokenId].active, "Already active");
        require(nftAssets[tokenId].owner != address(0), "Asset not registered");
        nftAssets[tokenId].active = true;
    }

    /**
     * @notice Update NFT owner (for transfers)
     */
    function updateAssetOwner(uint256 tokenId, address newOwner) external onlyRole(OPERATOR_ROLE) {
        require(newOwner != address(0), "Invalid owner");
        require(nftAssets[tokenId].owner != address(0), "Asset not registered");
        nftAssets[tokenId].owner = newOwner;
    }

    /**
     * @notice Get asset details
     */
    function getAssetDetails(uint256 tokenId)
        external
        view
        returns (
            IrGGP.AssetType assetType,
            bytes32 sourceId,
            address owner,
            bool active,
            uint256 totalOutput,
            uint256 totalRGGP,
            uint256 lastMint
        )
    {
        NFTAsset memory asset = nftAssets[tokenId];
        return (
            asset.assetType,
            asset.sourceId,
            asset.owner,
            asset.active,
            asset.totalOutputRecorded,
            asset.totalRGGPMinted,
            asset.lastMintTimestamp
        );
    }

    /**
     * @notice Calculate potential rGGP for output
     */
    function calculateRGGP(IrGGP.AssetType assetType, uint256 outputAmount) external view returns (uint256) {
        AssetConfig memory config = assetConfigs[assetType];
        return (outputAmount * config.ratePerUnit) / 10 ** 18;
    }

    /**
     * @notice Get statistics for asset type
     */
    function getStatistics(IrGGP.AssetType assetType)
        external
        view
        returns (uint256 totalMints, uint256 totalRGGPMinted, uint256 totalOutputProcessed)
    {
        Statistics memory stats = statistics[assetType];
        return (stats.totalMints, stats.totalRGGPMinted, stats.totalOutputProcessed);
    }

    /**
     * @notice Update oracle verification contract
     */
    function updateOracleVerification(address newOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newOracle != address(0), "Invalid oracle");
        oracleVerification = IOracleVerification(newOracle);
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
