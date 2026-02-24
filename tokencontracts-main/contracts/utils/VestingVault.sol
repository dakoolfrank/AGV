// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VestingVault
 * @notice Manages token vesting schedules for team, advisors, and investors
 * @dev Supports multiple vesting schedules per beneficiary with cliff periods
 *
 * Features:
 * - Linear vesting with cliff period
 * - Multiple schedules per beneficiary
 * - Revocable vesting (for team members)
 * - Batch operations for efficiency
 * - Emergency pause mechanism
 *
 * Vesting Categories (from handbook):
 * - Team & Advisors: 6mo cliff, 30-36mo linear
 * - Strategic/Private: 3-6mo cliff, 18-24mo linear
 * - Public Sale: No cliff, ≤6mo to 100%
 * - Ecosystem: DAO-gated, up to 48mo
 */
contract VestingVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE"); // Role for managing admin functions
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE"); // Role for creating vesting schedules

    IERC20 public immutable token;

    struct VestingSchedule {
        uint256 totalAmount; // Total tokens to vest
        uint256 amountClaimed; // Tokens already claimed
        uint256 startTime; // Vesting start timestamp
        uint256 cliffDuration; // Cliff period in seconds
        uint256 vestingDuration; // Total vesting duration in seconds
        bool revocable; // Can be revoked by admin
        bool revoked; // Has been revoked
        string category; // "Team", "Strategic", "Public", etc.
    }

    // Beneficiary => Schedule ID => VestingSchedule
    mapping(address => mapping(uint256 => VestingSchedule)) public vestingSchedules;
    mapping(address => uint256) public scheduleCount;

    // Category tracking
    mapping(string => uint256) public categoryTotalAllocated;
    mapping(string => uint256) public categoryTotalClaimed;

    // Statistics
    uint256 public totalAllocated;
    uint256 public totalClaimed;
    uint256 public totalRevoked;

    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 indexed scheduleId,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        string category
    );

    event TokensClaimed(address indexed beneficiary, uint256 indexed scheduleId, uint256 amount);

    event VestingRevoked(address indexed beneficiary, uint256 indexed scheduleId, uint256 revokedAmount);

    event EmergencyWithdraw(address indexed to, uint256 amount);

    constructor(address _token, address admin) {
        require(_token != address(0), "Invalid token address");

        token = IERC20(_token);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /**
     * @notice Create vesting schedule for beneficiary
     * @param beneficiary Address to receive vested tokens
     * @param amount Total tokens to vest
     * @param cliffMonths Cliff period in months
     * @param vestingMonths Total vesting duration in months
     * @param revocable Can schedule be revoked
     * @param category Allocation category ("Team", "Strategic", etc.)
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliffMonths,
        uint256 vestingMonths,
        bool revocable,
        string memory category
    ) public onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be > 0");
        require(vestingMonths > 0, "Vesting duration must be > 0");

        uint256 scheduleId = scheduleCount[beneficiary];
        scheduleCount[beneficiary]++;

        uint256 cliffDuration = cliffMonths * 30 days;
        uint256 vestingDuration = vestingMonths * 30 days;

        vestingSchedules[beneficiary][scheduleId] = VestingSchedule({
            totalAmount: amount,
            amountClaimed: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revocable: revocable,
            revoked: false,
            category: category
        });

        totalAllocated += amount;
        categoryTotalAllocated[category] += amount;

        emit VestingScheduleCreated(beneficiary, scheduleId, amount, cliffDuration, vestingDuration, category);

        return scheduleId;
    }

    /**
     * @notice Create multiple vesting schedules in batch
     * @param beneficiaries Array of beneficiary addresses
     * @param amounts Array of total amounts to vest
     * @param cliffMonths Array of cliff periods in months
     * @param vestingMonths Array of total vesting durations in months
     * @param revocable Array of revocability flags
     * @param categories Array of allocation categories
     * @dev All input arrays must be of equal length
     */
    function batchCreateVestingSchedules(
        address[] calldata beneficiaries,
        uint256[] calldata amounts,
        uint256[] calldata cliffMonths,
        uint256[] calldata vestingMonths,
        bool[] calldata revocable,
        string[] calldata categories
    ) external onlyRole(OPERATOR_ROLE) {
        require(beneficiaries.length == amounts.length, "Length mismatch");
        require(beneficiaries.length == cliffMonths.length, "Length mismatch");
        require(beneficiaries.length == vestingMonths.length, "Length mismatch");
        require(beneficiaries.length == revocable.length, "Length mismatch");
        require(beneficiaries.length == categories.length, "Length mismatch");

        for (uint256 i = 0; i < beneficiaries.length; i++) {
            createVestingSchedule(
                beneficiaries[i], amounts[i], cliffMonths[i], vestingMonths[i], revocable[i], categories[i]
            );
        }
    }

    /**
     * @notice Claim vested tokens for a specific schedule
     * @param scheduleId Schedule ID to claim from
     * @dev Beneficiary calls this function
     */
    function claim(uint256 scheduleId) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[msg.sender][scheduleId];
        require(schedule.totalAmount > 0, "Schedule does not exist");
        require(!schedule.revoked, "Schedule revoked");

        uint256 claimable = _calculateClaimable(schedule);
        require(claimable > 0, "Nothing to claim");

        schedule.amountClaimed += claimable;
        totalClaimed += claimable;
        categoryTotalClaimed[schedule.category] += claimable;

        token.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, scheduleId, claimable);
    }

    /**
     * @notice Claim all vested tokens across all schedules
     * @dev Beneficiary calls this function
     */
    function claimAll() external nonReentrant {
        uint256 totalClaimable = 0;
        uint256 count = scheduleCount[msg.sender];

        require(count > 0, "No schedules");

        for (uint256 i = 0; i < count; i++) {
            VestingSchedule storage schedule = vestingSchedules[msg.sender][i];

            if (schedule.revoked || schedule.totalAmount == 0) {
                continue;
            }

            uint256 claimable = _calculateClaimable(schedule);

            if (claimable > 0) {
                schedule.amountClaimed += claimable;
                totalClaimed += claimable;
                categoryTotalClaimed[schedule.category] += claimable;
                totalClaimable += claimable;

                emit TokensClaimed(msg.sender, i, claimable);
            }
        }

        require(totalClaimable > 0, "Nothing to claim");
        token.safeTransfer(msg.sender, totalClaimable);
    }

    /**
     * @notice Calculate claimable amount for a schedule
     * @param schedule Vesting schedule
     * @return Claimable token amount
     * @dev Internal helper function
     */
    function _calculateClaimable(VestingSchedule memory schedule) private view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0; // Still in cliff period
        }

        uint256 elapsed = block.timestamp - schedule.startTime;

        if (elapsed >= schedule.vestingDuration) {
            // Fully vested
            return schedule.totalAmount - schedule.amountClaimed;
        }

        // Linear vesting after cliff
        uint256 vested = (schedule.totalAmount * elapsed) / schedule.vestingDuration;
        return vested > schedule.amountClaimed ? vested - schedule.amountClaimed : 0;
    }

    /**
     * @notice Revoke vesting schedule (for revocable schedules only)
     * @param beneficiary Beneficiary address
     * @param scheduleId Schedule ID to revoke
     * @dev Only ADMIN_ROLE can call this function
     */
    function revokeVesting(address beneficiary, uint256 scheduleId) external onlyRole(ADMIN_ROLE) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary][scheduleId];
        require(schedule.totalAmount > 0, "Schedule does not exist");
        require(schedule.revocable, "Schedule not revocable");
        require(!schedule.revoked, "Already revoked");

        // Calculate what's already vested
        uint256 vested = _calculateClaimable(schedule) + schedule.amountClaimed;
        uint256 revokedAmount = schedule.totalAmount - vested;

        schedule.revoked = true;
        schedule.totalAmount = vested; // Reduce to vested amount

        totalRevoked += revokedAmount;

        emit VestingRevoked(beneficiary, scheduleId, revokedAmount);
    }

    /**
     * @notice Get claimable amount for a schedule
     * @param beneficiary Beneficiary address
     * @param scheduleId Schedule ID
     * @return Claimable token amount
     * @dev View function, does not modify state
     */
    function getClaimable(address beneficiary, uint256 scheduleId) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary][scheduleId];
        if (schedule.revoked || schedule.totalAmount == 0) {
            return 0;
        }
        return _calculateClaimable(schedule);
    }

    /**
     * @notice Get total claimable across all schedules
     * @param beneficiary Beneficiary address
     * @return Total claimable token amount
     * @dev View function, does not modify state
     */
    function getTotalClaimable(address beneficiary) external view returns (uint256) {
        uint256 totalClaimable = 0;
        uint256 count = scheduleCount[beneficiary];

        for (uint256 i = 0; i < count; i++) {
            VestingSchedule memory schedule = vestingSchedules[beneficiary][i];
            if (!schedule.revoked && schedule.totalAmount > 0) {
                totalClaimable += _calculateClaimable(schedule);
            }
        }

        return totalClaimable;
    }

    /**
     * @notice Get schedule details
     * @param beneficiary Beneficiary address
     * @param scheduleId Schedule ID
     */
    function getSchedule(address beneficiary, uint256 scheduleId)
        external
        view
        returns (
            uint256 totalAmount,
            uint256 amountClaimed,
            uint256 startTime,
            uint256 cliffEnd,
            uint256 vestingEnd,
            bool revocable,
            bool revoked,
            string memory category,
            uint256 claimable
        )
    {
        VestingSchedule memory schedule = vestingSchedules[beneficiary][scheduleId];

        return (
            schedule.totalAmount,
            schedule.amountClaimed,
            schedule.startTime,
            schedule.startTime + schedule.cliffDuration,
            schedule.startTime + schedule.vestingDuration,
            schedule.revocable,
            schedule.revoked,
            schedule.category,
            _calculateClaimable(schedule)
        );
    }

    /**
     * @notice Get all schedules for beneficiary
     * @param beneficiary Beneficiary address
     * @return Array of VestingSchedule structs
     */
    function getScheduleCount(address beneficiary) external view returns (uint256) {
        return scheduleCount[beneficiary];
    }

    /**
     * @notice Get category statistics
     * @param category Category name
     * @return allocated Total allocated to category
     * @return claimed Total claimed from category
     * @return remaining Remaining unclaimed in category
     * @dev View function, does not modify state
     */
    function getCategoryStats(string memory category)
        external
        view
        returns (uint256 allocated, uint256 claimed, uint256 remaining)
    {
        allocated = categoryTotalAllocated[category];
        claimed = categoryTotalClaimed[category];
        remaining = allocated > claimed ? allocated - claimed : 0;
    }

    /**
     * @notice Get global statistics
     * @return allocated Total allocated across all categories
     * @return claimed Total claimed across all categories
     * @return revoked Total revoked across all categories
     * @return remaining Remaining unclaimed across all categories
     * @return vaultBalance Current token balance in vault
     * @dev View function, does not modify state
     */
    function getGlobalStats()
        external
        view
        returns (uint256 allocated, uint256 claimed, uint256 revoked, uint256 remaining, uint256 vaultBalance)
    {
        allocated = totalAllocated;
        claimed = totalClaimed;
        revoked = totalRevoked;
        remaining = allocated > (claimed + revoked) ? allocated - claimed - revoked : 0;
        vaultBalance = token.balanceOf(address(this));
    }

    /**
     * @notice Deposit tokens into vault
     * @param amount Amount of tokens to deposit
     * @dev Operator role can call this function to fund the vault
     */
    function deposit(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(amount > 0, "Amount must be > 0");
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Emergency withdraw (admin only, for migration)
     * @param to Recipient address
     * @param amount Amount of tokens to withdraw
     * @dev Only DEFAULT_ADMIN_ROLE can call this function
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid recipient");
        token.safeTransfer(to, amount);
        emit EmergencyWithdraw(to, amount);
    }

    /**
     * @notice Helper to create standard team vesting (6mo cliff, 36mo linear)
     * @param beneficiary Beneficiary address
     * @param amount Total tokens to vest
     * @return scheduleId Created schedule ID
     */
    function createTeamVesting(address beneficiary, uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256)
    {
        return createVestingSchedule(
            beneficiary,
            amount,
            6, // 6 month cliff
            36, // 36 month vesting
            true, // revocable
            "Team"
        );
    }

    /**
     * @notice Helper to create strategic investor vesting (6mo cliff, 24mo linear)
     * @param beneficiary Beneficiary address
     * @param amount Total tokens to vest
     * @return scheduleId Created schedule ID
     * @dev Can be adjusted to 3mo cliff, 18mo linear if needed
     */
    function createStrategicVesting(address beneficiary, uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256)
    {
        return createVestingSchedule(
            beneficiary,
            amount,
            6, // 6 month cliff
            24, // 24 month vesting
            false, // not revocable
            "Strategic"
        );
    }

    /**
     * @notice Helper to create public sale vesting (no cliff, 6mo linear)
     * @param beneficiary Beneficiary address
     * @param amount Total tokens to vest
     * @return scheduleId Created schedule ID
     * @dev No cliff, fully vested in 6 months
     */
    function createPublicVesting(address beneficiary, uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256)
    {
        return createVestingSchedule(
            beneficiary,
            amount,
            0, // no cliff
            6, // 6 month vesting
            false, // not revocable
            "Public"
        );
    }
}
