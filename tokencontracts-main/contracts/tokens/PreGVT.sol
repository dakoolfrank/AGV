// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PreGVT (Pre Green Value Token)
 * @notice Presale voucher ERC20, redeemable 1:1 for GVT at TGE
 * @dev Three-layer cap enforcement:
 *   1. stageCap  — per-stage mint ceiling
 *   2. globalCap — multisig-adjustable ceiling (can only increase, up to ABSOLUTE_CEILING)
 *   3. ABSOLUTE_CEILING — compile-time constant, NEVER changeable
 *
 * Lifecycle:
 *   Deploy → createStage → mint (via Presale) → TGE pause → GVT migration → historical record
 */
contract PreGVT is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant CAP_ADMIN_ROLE = keccak256("CAP_ADMIN_ROLE");

    /// @notice Absolute ceiling — compile-time constant, NEVER changeable
    /// @dev 250M = GVT 1B × (Seed 15% + Public 10%)
    uint256 public constant ABSOLUTE_CEILING = 250_000_000 * 10 ** 18;

    /// @notice Adjustable global cap — multisig can increase (up to ABSOLUTE_CEILING)
    uint256 public globalCap;

    /// @notice Current active stage ID (0 = no stage created yet)
    uint256 public currentStage;

    struct Stage {
        uint256 cap;     // Max mintable in this stage
        uint256 minted;  // Already minted in this stage
        bool active;     // Is this stage currently active
    }

    mapping(uint256 => Stage) public stages;

    event GlobalCapUpdated(uint256 oldCap, uint256 newCap, address indexed updatedBy);
    event StageCreated(uint256 indexed stageId, uint256 cap);
    event StageActivated(uint256 indexed stageId);
    event StageClosed(uint256 indexed stageId, uint256 totalMinted);

    error ExceedsAbsoluteCeiling();
    error BelowCurrentSupply();
    error StageNotActive();
    error StageCapExceeded();
    error GlobalCapExceeded();
    error AmountIsZero();

    constructor(
        address admin,
        uint256 _initialGlobalCap
    ) ERC20("Pre Green Value Token", "preGVT") {
        if (_initialGlobalCap > ABSOLUTE_CEILING) revert ExceedsAbsoluteCeiling();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(CAP_ADMIN_ROLE, admin);

        globalCap = _initialGlobalCap;
    }

    // ===================== Stage Management =====================

    /**
     * @notice Create a new mint stage with a given cap
     * @param cap Maximum preGVT mintable in the new stage
     * @return stageId The ID assigned to the new stage
     */
    function createStage(uint256 cap) external onlyRole(CAP_ADMIN_ROLE) returns (uint256 stageId) {
        if (cap == 0) revert AmountIsZero();

        unchecked { ++currentStage; }
        stageId = currentStage;

        stages[stageId] = Stage({cap: cap, minted: 0, active: true});
        emit StageCreated(stageId, cap);
    }

    /**
     * @notice Close an active stage
     * @param stageId The stage to close
     */
    function closeStage(uint256 stageId) external onlyRole(CAP_ADMIN_ROLE) {
        Stage storage stage = stages[stageId];
        if (!stage.active) revert StageNotActive();

        stage.active = false;
        emit StageClosed(stageId, stage.minted);
    }

    // ===================== Cap Management =====================

    /**
     * @notice Adjust global cap (can only increase, never above ABSOLUTE_CEILING)
     * @param newCap New global cap value
     */
    function setGlobalCap(uint256 newCap) external onlyRole(CAP_ADMIN_ROLE) {
        if (newCap > ABSOLUTE_CEILING) revert ExceedsAbsoluteCeiling();
        if (newCap < totalSupply()) revert BelowCurrentSupply();

        uint256 oldCap = globalCap;
        globalCap = newCap;
        emit GlobalCapUpdated(oldCap, newCap, msg.sender);
    }

    // ===================== Minting =====================

    /**
     * @notice Mint preGVT — called by Presale contract (MINTER_ROLE)
     * @dev Three-layer cap enforcement:
     *   1. stageCap:  stages[currentStage].minted + amount <= stages[currentStage].cap
     *   2. globalCap: totalSupply() + amount <= globalCap
     *   3. ABSOLUTE_CEILING: totalSupply() + amount <= ABSOLUTE_CEILING (defense-in-depth)
     * @param to Recipient address
     * @param amount Amount of preGVT to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (amount == 0) revert AmountIsZero();

        Stage storage stage = stages[currentStage];
        if (!stage.active) revert StageNotActive();
        if (stage.minted + amount > stage.cap) revert StageCapExceeded();
        if (totalSupply() + amount > globalCap) revert GlobalCapExceeded();
        // Defense-in-depth: even if globalCap was somehow misconfigured
        if (totalSupply() + amount > ABSOLUTE_CEILING) revert ExceedsAbsoluteCeiling();

        stage.minted += amount;
        _mint(to, amount);
    }

    // ===================== Pause (for TGE freeze) =====================

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ===================== View helpers =====================

    /**
     * @notice Remaining mintable in current stage
     */
    function stageRemaining() external view returns (uint256) {
        Stage storage stage = stages[currentStage];
        if (!stage.active) return 0;
        return stage.cap - stage.minted;
    }

    /**
     * @notice Remaining mintable under global cap
     */
    function globalRemaining() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply >= globalCap) return 0;
        return globalCap - supply;
    }

    // ===================== Overrides =====================

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
