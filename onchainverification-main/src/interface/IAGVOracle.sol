// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAGVOracle
 * @notice Defines the external interface for the on-chain oracle and settlement contract.
 * @dev Mapped directly from the Oracle & Contract section of the On-Chain Oracle Implementation Plan.
 */
interface IAGVOracle {
    // ===== Daily snapshot (evidence only; not mint-determining) =====
    // Event emitted when a daily snapshot is stored on-chain.
    // "YYYY-MM-DD" (UTC) [cite: 66]
    // [cite: 67]
    // kWh*10 [cite: 68]
    // kWh*10 [cite: 69]
    // h*10 [cite: 70]
    // expected 96 [cite: 71]
    // daily CSV SHA-256 [cite: 72]
    // optional: EIP-712 signer [cite: 73]
    event DailySnapshotStored( // keccak256(JSON; sorted keys; integerized; scaled decimals) [cite: 65]
        bytes32 indexed snapshotHash,
        string date,
        string stationId,
        uint256 solarKWhSum_x10,
        uint256 selfConsumedKWh_x10,
        uint256 computeHoursSum_x10,
        uint16 records,
        bytes32 sheetSha256,
        address signer
    );

    // ===== Monthly settlement (sole minting anchor) =====
    // Event emitted when a monthly settlement (or a new revision) is stored.
    // [cite: 78]
    // kWh*10 [cite: 79]
    // kWh*10 [cite: 80]
    // tariff * 10000 [cite: 81]
    // aggregated hash [cite: 82]
    // State Grid bill PDF hash [cite: 83]
    // bank receipt hash (optional) [cite: 84]
    // starts from 1 [cite: 85]
    // multisig/role [cite: 86]
    event MonthlySettlementStored( // "YYYY-MM" [cite: 77]
        string period,
        string stationId,
        uint256 gridDeliveredKWh_x10,
        uint256 selfConsumedKWh_x10,
        uint256 tariff_bp,
        bytes32 monthFilesAggSha256,
        bytes32 settlementPdfSha256,
        bytes32 bankSlipSha256,
        uint8 revision,
        address reconciler
    );

    // Event emitted when a previously stored monthly settlement is amended.
    event MonthlySettlementAmended( // [cite: 89]
        // [cite: 90]
        // [cite: 91]
        // [cite: 92]
        // red invoice / supplement / cross-period correction / other [cite: 93]
    string period, string stationId, uint8 oldRevision, uint8 newRevision, string reason);

    // Note: Since the contract uses structs for data input,
    // we use a simplified function signature in the interface definition.
    // The implementation (AGVOracle.sol) handles the actual parameters.

    // Function signatures
    function storeDailySnapshot(bytes memory data, bytes memory signature) external;
    function storeMonthlySettlement(bytes memory data) external;
    function amendMonthlySettlement(bytes memory data) external;

    // View: return the "current effective revision" for given period+station
    function getEffectiveMonthlySettlement(string calldata period, string calldata stationId)
        external
        view
        returns (bytes memory); /* fields including revision */
}
