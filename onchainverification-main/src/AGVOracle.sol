// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @title AGVOracle
 * @notice On-chain contract for storing evidence (Daily Snapshot) and the sole minting anchor (Monthly Settlement).
 * @dev Implements the IAGVOracle interface from the plan, minimizing on-chain complexity and gas.
 */
contract AGVOracle is AccessControl, Pausable, EIP712 {
    using ECDSA for bytes32;
    using SafeCast for uint256;

    // --- Roles (Mapped to RACI/Plan) ---
    // DAO_MULTISIG for contract management (Pausable/AccessControl Admin)
    // ORACLE_TEAM for Daily Snapshot posting (Tech Lead / Data Admin)
    // SETTLEMENT_MULTISIG for Monthly Settlement (Finance + Tech)
    bytes32 public constant SETTLEMENT_MULTISIG = keccak256("SETTLEMENT_MULTISIG");
    bytes32 public constant ORACLE_TEAM = keccak256("ORACLE_TEAM");

    // --- Data Structures ---
    // Note: All date/datetime are UTC ISO-8601

    // Maps to Daily_Snapshot fields, scaled for on-chain storage
    struct DailySnapshotData {
        uint256 solarKWhSum_x10; // kWh * 10 (Grid-Delivered Basis)
        uint256 selfConsumedKWh_x10; // kWh * 10 (Disclosure only)
        uint256 computeHoursSum_x10; // h * 10
        uint16 records; // Expected 96 (15-minute sampling)
        bytes32 sheetSha256; // SHA-256 of the canonical CSV file
        address signer; // EIP-712 signer
    }

    // Maps to Monthly_Settlement fields, scaled for on-chain storage
    struct MonthlySettlementData {
        uint256 gridDeliveredKWh_x10; // kWh * 10 (State Grid billed energy)
        uint256 selfConsumedKWh_x10; // kWh * 10 (Disclosure only)
        uint256 tariff_bp; // Tariff * 10,000 (Basis Points)
        bytes32 monthFilesAggSha256; // SHA-256 of all daily CSV hashes aggregated
        bytes32 settlementPdfSha256; // SHA-256 of State Grid bill PDF (Audit Master)
        bytes32 bankSlipSha256; // SHA-256 of bank receipt PDF (Optional)
        uint8 revision; // Starts from 1
        uint256 timestamp; // Block timestamp when stored
        address reconciler; // Multisig/Role address that submitted
    }

    // Maps to EIP-712 structure for off-chain signing (DailySnapshot is the example)
    struct DailySnapshotEIP712 {
        string date;
        string stationId;
        uint256 solarKWhSum_x10;
        uint256 selfConsumedKWh_x10;
        uint256 computeHoursSum_x10;
        uint16 records;
        bytes32 sheetSha256;
    }

    // --- Storage ---
    // Daily Snapshots (evidence only, not mint-determining)
    // mapping: stationId => date (YYYY-MM-DD) => DailySnapshotData
    mapping(string => mapping(string => DailySnapshotData)) public dailySnapshots;

    // Monthly Settlements (sole minting anchor)
    // mapping: stationId => period (YYYY-MM) => revision number => MonthlySettlementData
    mapping(string => mapping(string => mapping(uint8 => MonthlySettlementData))) public monthlySettlements;

    // Tracks the current effective revision for a given period and station
    mapping(string => mapping(string => uint8)) public effectiveRevision;

    // EIP-712 Typehash for Daily Snapshot
    bytes32 private constant DAILY_SNAPSHOT_TYPEHASH = keccak256(
        "DailySnapshot(string date,string stationId,uint256 solarKWhSum_x10,uint256 selfConsumedKWh_x10,uint256 computeHoursSum_x10,uint16 records,bytes32 sheetSha256)"
    );

    // --- Events (IAGVOracle interface) ---
    // Daily snapshot event
    // "YYYY-MM-DD" (UTC)
    //
    // kWh*10
    // h*10
    // expected 96
    // daily CSV SHA-256
    // optional: EIP-712 signer
    event DailySnapshotStored( // keccak256(JSON; sorted keys; integerized; scaled decimals)
        bytes32 indexed snapshotHash,
        string date,
        string stationId,
        uint256 solarKWhSum_x10,
        // kWh*10
        uint256 selfConsumedKWh_x10,
        uint256 computeHoursSum_x10,
        uint16 records,
        bytes32 sheetSha256,
        address signer
    );

    // Monthly settlement event
    //
    // kWh*10
    // tariff * 10000
    // aggregated hash
    // State Grid bill PDF hash
    // bank receipt hash (optional)
    // starts from 1
    // multisig/role
    event MonthlySettlementStored( // "YYYY-MM"
        string period,
        string stationId,
        uint256 gridDeliveredKWh_x10,
        // kWh*10
        uint256 selfConsumedKWh_x10,
        uint256 tariff_bp,
        bytes32 monthFilesAggSha256,
        bytes32 settlementPdfSha256,
        bytes32 bankSlipSha256,
        uint8 revision,
        address reconciler
    );

    // Amendment event
    //
    // red invoice / supplement / cross-period correction / other
    event MonthlySettlementAmended( //
        string period,
        string stationId,
        //
        uint8 oldRevision,
        uint8 newRevision,
        //
        string reason
    );

    constructor(address _admin, address[] memory _initialTechTeam, address[] memory _initialSettlementMultisig)
        EIP712("AGV Oracle", "1") // EIP-712 Domain: name="AGV Oracle", version="1", chainId, verifyingContract
    {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(SETTLEMENT_MULTISIG, _admin); // Grant admin the multisig role for initial setup

        // Grant initial roles
        for (uint256 i = 0; i < _initialTechTeam.length; i++) {
            _grantRole(ORACLE_TEAM, _initialTechTeam[i]);
        }
        for (uint256 i = 0; i < _initialSettlementMultisig.length; i++) {
            // For a real multisig, this address would be the Gnosis/Safe contract address
            _grantRole(SETTLEMENT_MULTISIG, _initialSettlementMultisig[i]);
        }
    }

    /**
     * @notice Stores a daily power generation snapshot. Evidence only; does not determine minting.
     * @param data The DailySnapshot EIP-712 data payload.
     * @param signature The EIP-712 signature of the data.
     */
    function storeDailySnapshot(DailySnapshotEIP712 calldata data, bytes calldata signature)
        external
        whenNotPaused
        onlyRole(ORACLE_TEAM)
    {
        // 1. Recover EIP-712 Signer
        bytes32 structHash = keccak256(
            abi.encode(
                DAILY_SNAPSHOT_TYPEHASH,
                keccak256(bytes(data.date)),
                keccak256(bytes(data.stationId)),
                data.solarKWhSum_x10,
                data.selfConsumedKWh_x10,
                data.computeHoursSum_x10,
                data.records,
                data.sheetSha256
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        require(signer != address(0), "Invalid signature or signer");

        // 2. Validate/Store
        require(data.records == 96, "Records must be 96"); // Validation: records = 96

        // Enforce immutability for a given date/station
        require(dailySnapshots[data.stationId][data.date].sheetSha256 == bytes32(0), "Daily snapshot already stored");

        dailySnapshots[data.stationId][data.date] = DailySnapshotData({
            solarKWhSum_x10: data.solarKWhSum_x10,
            selfConsumedKWh_x10: data.selfConsumedKWh_x10,
            computeHoursSum_x10: data.computeHoursSum_x10,
            records: data.records,
            sheetSha256: data.sheetSha256,
            signer: signer
        });

        // 3. Emit event
        // Hash for the event is keccak256(JSON; sorted keys; integerized; scaled decimals)
        // In Solidity, we can re-create the hash by abi.encodePacked to avoid external JSON parsing.
        // We use the EIP-712 structure hash (digest) which includes all necessary fields.

        emit DailySnapshotStored(
            digest, // EIP-712 Digest serves as the snapshotHash
            data.date,
            data.stationId,
            data.solarKWhSum_x10,
            data.selfConsumedKWh_x10,
            data.computeHoursSum_x10,
            data.records,
            data.sheetSha256,
            signer
        );
    }

    /**
     * @notice Stores a monthly settlement. This is the sole minting anchor.
     * @param period The month in "YYYY-MM" format.
     * @param stationId The unique station ID.
     * @param gridDeliveredKWh_x10 State Grid billed energy (kWh*10).
     * @param selfConsumedKWh_x10 Monthly self-consumption (disclosure only, kWh*10).
     * @param tariff_bp Monthly tariff (tariff*10000).
     * @param monthFilesAggSha256 SHA-256 of all daily CSV hashes aggregated.
     * @param settlementPdfSha256 SHA-256 of the State Grid bill PDF (Audit Master).
     * @param bankSlipSha256 SHA-256 of the bank receipt PDF (Optional).
     */
    function storeMonthlySettlement(
        string calldata period,
        string calldata stationId,
        uint256 gridDeliveredKWh_x10,
        uint256 selfConsumedKWh_x10,
        uint256 tariff_bp,
        bytes32 monthFilesAggSha256,
        bytes32 settlementPdfSha256,
        bytes32 bankSlipSha256
    )
        external
        whenNotPaused
        onlyRole(SETTLEMENT_MULTISIG) // Multisig-gated (Finance + Tech)
    {
        uint8 currentRevision = effectiveRevision[stationId][period];
        require(currentRevision == 0, "Initial settlement already stored. Use amendMonthlySettlement.");

        uint8 newRevision = 1; // Starts from 1

        // Store settlement
        monthlySettlements[stationId][period][newRevision] = MonthlySettlementData({
            gridDeliveredKWh_x10: gridDeliveredKWh_x10,
            selfConsumedKWh_x10: selfConsumedKWh_x10,
            tariff_bp: tariff_bp,
            monthFilesAggSha256: monthFilesAggSha256,
            settlementPdfSha256: settlementPdfSha256,
            bankSlipSha256: bankSlipSha256,
            revision: newRevision,
            timestamp: block.timestamp,
            reconciler: msg.sender
        });

        effectiveRevision[stationId][period] = newRevision;

        // Emit event
        emit MonthlySettlementStored(
            period,
            stationId,
            gridDeliveredKWh_x10,
            selfConsumedKWh_x10,
            tariff_bp,
            monthFilesAggSha256,
            settlementPdfSha256,
            bankSlipSha256,
            newRevision,
            msg.sender
        );
    }

    /**
     * @notice Allows revision of a monthly settlement with fully preserved history.
     * @param period The month in "YYYY-MM" format.
     * @param stationId The unique station ID.
     * @param reason The reason for the amendment (e.g., red invoice, supplement, cross-period correction).
     * @param gridDeliveredKWh_x10 Revised State Grid billed energy (kWh*10).
     * @param selfConsumedKWh_x10 Revised Monthly self-consumption (disclosure only, kWh*10).
     * @param tariff_bp Revised Monthly tariff (tariff*10000).
     * @param monthFilesAggSha256 Revised SHA-256 of all daily CSV hashes aggregated (if underlying data changed).
     * @param settlementPdfSha256 Revised SHA-256 of the State Grid bill PDF (new audit master).
     * @param bankSlipSha256 Revised SHA-256 of the bank receipt PDF (Optional).
     */
    function amendMonthlySettlement(
        string calldata period,
        string calldata stationId,
        string calldata reason,
        uint256 gridDeliveredKWh_x10,
        uint256 selfConsumedKWh_x10,
        uint256 tariff_bp,
        bytes32 monthFilesAggSha256,
        bytes32 settlementPdfSha256,
        bytes32 bankSlipSha256
    )
        external
        whenNotPaused
        onlyRole(SETTLEMENT_MULTISIG) // Multisig-gated
    {
        uint8 oldRevision = effectiveRevision[stationId][period];
        require(oldRevision > 0, "No initial settlement to amend.");
        require(oldRevision < type(uint8).max, "Max revision reached");

        uint8 newRevision = oldRevision + 1; // Revision auto-increments

        // Store new settlement data
        monthlySettlements[stationId][period][newRevision] = MonthlySettlementData({
            gridDeliveredKWh_x10: gridDeliveredKWh_x10,
            selfConsumedKWh_x10: selfConsumedKWh_x10,
            tariff_bp: tariff_bp,
            monthFilesAggSha256: monthFilesAggSha256,
            settlementPdfSha256: settlementPdfSha256,
            bankSlipSha256: bankSlipSha256,
            revision: newRevision,
            timestamp: block.timestamp,
            reconciler: msg.sender
        });

        effectiveRevision[stationId][period] = newRevision; // Latest revision is effective

        // Emit amendment event
        emit MonthlySettlementAmended(period, stationId, oldRevision, newRevision, reason);

        // Emit new settlement event for the latest data
        emit MonthlySettlementStored(
            period,
            stationId,
            gridDeliveredKWh_x10,
            selfConsumedKWh_x10,
            tariff_bp,
            monthFilesAggSha256,
            settlementPdfSha256,
            bankSlipSha256,
            newRevision,
            msg.sender
        );
    }

    // --- Views (IAGVOracle interface) ---
    /**
     * @notice Returns the current effective revision of the monthly settlement for a given period and station.
     * @param period The month in "YYYY-MM" format.
     * @param stationId The unique station ID.
     * @return data The full MonthlySettlementData, including the revision.
     */
    function getEffectiveMonthlySettlement(string calldata period, string calldata stationId)
        external
        view
        returns (MonthlySettlementData memory data)
    {
        uint8 currentRevision = effectiveRevision[stationId][period];
        require(currentRevision > 0, "No settlement found for this period/station.");
        return monthlySettlements[stationId][period][currentRevision];
    }

    /**
     * @notice Gets a specific revision of the monthly settlement (for history queryable).
     */
    function getMonthlySettlementByRevision(string calldata period, string calldata stationId, uint8 revision)
        external
        view
        returns (MonthlySettlementData memory data)
    {
        require(revision > 0, "Revision must be greater than 0.");
        data = monthlySettlements[stationId][period][revision];
        require(data.revision == revision, "Revision not found.");
        return data;
    }

    // --- AccessControl/Pausable Helpers ---
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
