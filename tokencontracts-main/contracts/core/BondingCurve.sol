// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IGVT is IERC20 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title BondingCurve
 * @notice Implements rGGP → GVT conversion with DAO-governed bonding curve
 * @dev Features:
 * - Configurable conversion ratio (starts ~10:1, adjustable to 50:1, 100:1)
 * - Vesting period (7-30 days)
 * - Optional discount for early conversion
 * - Epoch-based caps to prevent supply shocks
 * - Treasury-aware funding limits
 */
contract BondingCurve is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable rGGP;
    IGVT public immutable GVT;

    // Bonding curve parameters
    struct CurveParams {
        uint256 baseRatio; // rGGP per 1 GVT (e.g., 10 = 10:1 ratio)
        uint256 slope; // Rate of ratio increase per GVT minted
        uint256 discount; // Discount percentage (100 = 1%)
        uint256 minVestingDays; // Minimum vesting period
        uint256 maxVestingDays; // Maximum vesting period
    }

    CurveParams public curveParams;

    // Epoch configuration
    struct EpochConfig {
        uint256 duration; // Epoch duration (e.g., 90 days)
        uint256 startTime; // Current epoch start
        uint256 currentEpoch; // Current epoch number
        uint256 maxGVTPerEpoch; // Max GVT that can be converted per epoch
    }

    EpochConfig public epochConfig;

    // Track conversions per epoch
    mapping(uint256 => uint256) public epochConversions;

    // Vesting positions
    struct VestingPosition {
        uint256 totalGVT; // Total GVT to vest
        uint256 claimedGVT; // GVT already claimed
        uint256 startTime; // Vesting start time
        uint256 duration; // Vesting duration in seconds
    }

    mapping(address => VestingPosition[]) public vestingPositions;

    // Treasury capacity tracking
    uint256 public treasuryCapacity; // Max GVT treasury can support
    uint256 public totalAllocated; // Total GVT allocated but not yet vested

    event ConversionInitiated(
        address indexed user, uint256 rggpAmount, uint256 gvtAmount, uint256 vestingDuration, uint256 positionId
    );

    event TokensClaimed(address indexed user, uint256 positionId, uint256 amount);

    event CurveParamsUpdated(
        uint256 baseRatio, uint256 slope, uint256 discount, uint256 minVestingDays, uint256 maxVestingDays
    );

    event EpochConfigUpdated(uint256 duration, uint256 maxGVTPerEpoch);

    event TreasuryCapacityUpdated(uint256 newCapacity);
    event EpochAdvanced(uint256 newEpoch);

    constructor(address _rGGP, address _GVT, address admin) {
        require(_rGGP != address(0), "Invalid rGGP address");
        require(_GVT != address(0), "Invalid GVT address");

        rGGP = IERC20(_rGGP);
        GVT = IGVT(_GVT);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        // Initialize with bootstrap parameters (10:1 ratio)
        curveParams = CurveParams({
            baseRatio: 10 * 10 ** 18, // 10 rGGP per 1 GVT
            slope: 0, // No slope initially (flat rate)
            discount: 500, // 5% discount
            minVestingDays: 7,
            maxVestingDays: 30
        });

        // Initialize epoch config (quarterly)
        epochConfig = EpochConfig({
            duration: 90 days,
            startTime: block.timestamp,
            currentEpoch: 1,
            maxGVTPerEpoch: 10_000_000 * 10 ** 18 // 10M GVT per epoch
        });

        // Set initial treasury capacity
        treasuryCapacity = 50_000_000 * 10 ** 18; // 50M GVT
    }

    /**
     * @notice Convert rGGP to GVT with vesting
     * @param rggpAmount Amount of rGGP to convert
     * @param vestingDays Vesting period in days (7-30)
     */
    function convert(uint256 rggpAmount, uint256 vestingDays) external nonReentrant whenNotPaused {
        require(rggpAmount > 0, "Amount must be > 0");
        require(
            vestingDays >= curveParams.minVestingDays && vestingDays <= curveParams.maxVestingDays,
            "Invalid vesting period"
        );

        // Advance epoch if needed
        _advanceEpochIfNeeded();

        // Calculate GVT amount based on current ratio
        uint256 gvtAmount = _calculateGVTAmount(rggpAmount);

        // Apply discount based on vesting duration (longer = better discount)
        uint256 discountBonus = ((vestingDays - curveParams.minVestingDays) * curveParams.discount)
            / (curveParams.maxVestingDays - curveParams.minVestingDays);
        gvtAmount = gvtAmount + (gvtAmount * discountBonus / 10000);

        // Check epoch cap
        uint256 currentEpochNum = epochConfig.currentEpoch;
        require(epochConversions[currentEpochNum] + gvtAmount <= epochConfig.maxGVTPerEpoch, "Epoch cap exceeded");

        // Check treasury capacity
        require(totalAllocated + gvtAmount <= treasuryCapacity, "Treasury capacity exceeded");

        // Transfer rGGP from user
        rGGP.safeTransferFrom(msg.sender, address(this), rggpAmount);

        // Create vesting position
        uint256 positionId = vestingPositions[msg.sender].length;
        vestingPositions[msg.sender].push(
            VestingPosition({
                totalGVT: gvtAmount,
                claimedGVT: 0,
                startTime: block.timestamp,
                duration: vestingDays * 1 days
            })
        );

        // Update tracking
        epochConversions[currentEpochNum] += gvtAmount;
        totalAllocated += gvtAmount;

        emit ConversionInitiated(msg.sender, rggpAmount, gvtAmount, vestingDays, positionId);
    }

    /**
     * @notice Claim vested GVT tokens
     * @param positionId Index of vesting position
     */
    function claim(uint256 positionId) external nonReentrant {
        require(positionId < vestingPositions[msg.sender].length, "Invalid position");

        VestingPosition storage position = vestingPositions[msg.sender][positionId];

        uint256 claimable = _calculateClaimable(position);
        require(claimable > 0, "Nothing to claim");

        position.claimedGVT += claimable;
        totalAllocated -= claimable;

        // Mint GVT to user
        GVT.mint(msg.sender, claimable);

        emit TokensClaimed(msg.sender, positionId, claimable);
    }

    /**
     * @notice Claim all vested positions
     */
    function claimAll() external nonReentrant {
        VestingPosition[] storage positions = vestingPositions[msg.sender];
        require(positions.length > 0, "No positions");

        uint256 totalClaimable = 0;

        for (uint256 i = 0; i < positions.length; i++) {
            uint256 claimable = _calculateClaimable(positions[i]);
            if (claimable > 0) {
                positions[i].claimedGVT += claimable;
                totalClaimable += claimable;
            }
        }

        require(totalClaimable > 0, "Nothing to claim");

        totalAllocated -= totalClaimable;
        GVT.mint(msg.sender, totalClaimable);

        emit TokensClaimed(msg.sender, type(uint256).max, totalClaimable);
    }

    /**
     * @notice Calculate GVT amount for given rGGP
     */
    function _calculateGVTAmount(uint256 rggpAmount) private view returns (uint256) {
        // Current ratio with slope applied
        uint256 currentRatio =
            curveParams.baseRatio + (epochConversions[epochConfig.currentEpoch] * curveParams.slope / 10 ** 18);

        // GVT = rGGP / ratio
        return (rggpAmount * 10 ** 18) / currentRatio;
    }

    /**
     * @notice Calculate claimable amount for a position
     */
    function _calculateClaimable(VestingPosition memory position) private view returns (uint256) {
        if (block.timestamp < position.startTime) {
            return 0;
        }

        uint256 elapsed = block.timestamp - position.startTime;

        if (elapsed >= position.duration) {
            return position.totalGVT - position.claimedGVT;
        }

        uint256 vested = (position.totalGVT * elapsed) / position.duration;
        return vested > position.claimedGVT ? vested - position.claimedGVT : 0;
    }

    /**
     * @notice Advance epoch if duration passed
     */
    function _advanceEpochIfNeeded() private {
        if (block.timestamp >= epochConfig.startTime + epochConfig.duration) {
            epochConfig.currentEpoch += 1;
            epochConfig.startTime = block.timestamp;
            emit EpochAdvanced(epochConfig.currentEpoch);
        }
    }

    /**
     * @notice Update curve parameters (DAO governance)
     */
    function updateCurveParams(
        uint256 baseRatio,
        uint256 slope,
        uint256 discount,
        uint256 minVestingDays,
        uint256 maxVestingDays
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(baseRatio > 0, "Invalid base ratio");
        require(minVestingDays <= maxVestingDays, "Invalid vesting range");
        require(discount <= 2000, "Discount too high"); // Max 20%

        curveParams = CurveParams({
            baseRatio: baseRatio,
            slope: slope,
            discount: discount,
            minVestingDays: minVestingDays,
            maxVestingDays: maxVestingDays
        });

        emit CurveParamsUpdated(baseRatio, slope, discount, minVestingDays, maxVestingDays);
    }

    /**
     * @notice Update epoch configuration
     */
    function updateEpochConfig(uint256 duration, uint256 maxGVTPerEpoch) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(duration > 0, "Invalid duration");
        require(maxGVTPerEpoch > 0, "Invalid cap");

        epochConfig.duration = duration;
        epochConfig.maxGVTPerEpoch = maxGVTPerEpoch;

        emit EpochConfigUpdated(duration, maxGVTPerEpoch);
    }

    /**
     * @notice Update treasury capacity
     */
    function updateTreasuryCapacity(uint256 newCapacity) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCapacity >= totalAllocated, "Capacity below allocated");
        treasuryCapacity = newCapacity;
        emit TreasuryCapacityUpdated(newCapacity);
    }

    /**
     * @notice Get user's vesting position count
     */
    function getPositionCount(address user) external view returns (uint256) {
        return vestingPositions[user].length;
    }

    /**
     * @notice Get claimable amount for a position
     */
    function getClaimable(address user, uint256 positionId) external view returns (uint256) {
        require(positionId < vestingPositions[user].length, "Invalid position");
        return _calculateClaimable(vestingPositions[user][positionId]);
    }

    /**
     * @notice Get total claimable across all positions
     */
    function getTotalClaimable(address user) external view returns (uint256) {
        VestingPosition[] storage positions = vestingPositions[user];
        uint256 total = 0;

        for (uint256 i = 0; i < positions.length; i++) {
            total += _calculateClaimable(positions[i]);
        }

        return total;
    }

    /**
     * @notice Get current conversion ratio
     */
    function getCurrentRatio() external view returns (uint256) {
        return curveParams.baseRatio + (epochConversions[epochConfig.currentEpoch] * curveParams.slope / 10 ** 18);
    }

    /**
     * @notice Preview GVT amount for rGGP conversion
     */
    function previewConversion(uint256 rggpAmount, uint256 vestingDays) external view returns (uint256) {
        uint256 gvtAmount = _calculateGVTAmount(rggpAmount);

        if (vestingDays >= curveParams.minVestingDays && vestingDays <= curveParams.maxVestingDays) {
            uint256 discountBonus = ((vestingDays - curveParams.minVestingDays) * curveParams.discount)
                / (curveParams.maxVestingDays - curveParams.minVestingDays);
            gvtAmount = gvtAmount + (gvtAmount * discountBonus / 10000);
        }

        return gvtAmount;
    }

    /**
     * @notice Get remaining epoch capacity
     */
    function getRemainingEpochCapacity() external view returns (uint256) {
        uint256 used = epochConversions[epochConfig.currentEpoch];
        return used < epochConfig.maxGVTPerEpoch ? epochConfig.maxGVTPerEpoch - used : 0;
    }

    /**
     * @notice Withdraw collected rGGP (for burning or treasury)
     */
    function withdrawRGGP(address to, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(to != address(0), "Invalid recipient");
        rGGP.safeTransfer(to, amount);
    }

    /**
     * @notice Pause conversions
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause conversions
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
