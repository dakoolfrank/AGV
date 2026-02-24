// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GVT (Green Value Token)
 * @notice Governance and utility token for AGV Protocol
 * @dev Fixed supply hard cap of 1,000,000,000 tokens (1e9 * 1e18)
 * Features:
 * - Hard cap at 1B total supply (includes vested releases + direct mints)
 * - Burnable, EIP-2612 permit, Pausable, Role-based controls
 */
contract GVT is ERC20, ERC20Burnable, ERC20Permit, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens with 18 decimals

    // Allocation tracking for transparency
    struct Allocation {
        uint256 amount; // total allocated to beneficiary
        uint256 released; // total released (and minted) so far
        uint256 vestingStart; // timestamp
        uint256 vestingDuration; // seconds
    }

    mapping(address => Allocation) public allocations;

    // Global outstanding (unreleased) allocations to protect cap math
    uint256 public allocatedOutstanding; // sum(allocation.amount - allocation.released) across all

    event AllocationSet(address indexed beneficiary, uint256 amount, uint256 vestingDuration);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event PausedEvent(address indexed account);
    event UnpausedEvent(address indexed account);

    constructor(address admin) ERC20("Green Value Token", "GVT") ERC20Permit("Green Value Token") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Set vesting allocation for a beneficiary
     * @param beneficiary Address to receive vested tokens
     * @param amount Total amount to vest
     * @param vestingDuration Duration in seconds
     */
    function setAllocation(address beneficiary, uint256 amount, uint256 vestingDuration)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(amount > 0, "Amount=0");
        require(allocations[beneficiary].amount == 0, "Allocation already set");

        // Prevent over-allocation beyond the hard cap
        // totalSupply (already minted) + outstanding allocations + new amount <= MAX_SUPPLY
        require(totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY, "Exceeds cap");

        allocations[beneficiary] =
            Allocation({amount: amount, released: 0, vestingStart: block.timestamp, vestingDuration: vestingDuration});

        allocatedOutstanding += amount;

        emit AllocationSet(beneficiary, amount, vestingDuration);
    }

    /**
     * @notice Release vested tokens according to linear vesting schedule
     */
    function releaseVested() external whenNotPaused {
        Allocation storage allocation = allocations[msg.sender];
        require(allocation.amount > 0, "No allocation");

        uint256 releasable = _releasableAmount(allocation);
        require(releasable > 0, "Nothing to release");

        // Ensure the hard cap is respected at release time
        require(totalSupply() + releasable <= MAX_SUPPLY, "Cap exceeded");

        allocation.released += releasable;
        // Outstanding pool decreases by amount released
        allocatedOutstanding -= releasable;

        _mint(msg.sender, releasable);
        emit TokensReleased(msg.sender, releasable);
    }

    /**
     * @notice View function: releasable amount for a beneficiary
     */
    function releasableAmount(address beneficiary) external view returns (uint256) {
        return _releasableAmount(allocations[beneficiary]);
    }

    /**
     * @dev Internal: calculate releasable amount for an allocation
     */
    function _releasableAmount(Allocation memory alloc) private view returns (uint256) {
        if (alloc.amount == 0 || block.timestamp <= alloc.vestingStart) return 0;

        uint256 elapsed = block.timestamp - alloc.vestingStart;
        if (alloc.vestingDuration == 0 || elapsed >= alloc.vestingDuration) {
            return alloc.amount - alloc.released;
        }

        uint256 vested = (alloc.amount * elapsed) / alloc.vestingDuration;
        if (vested <= alloc.released) return 0;
        return vested - alloc.released;
    }

    /**
     * @notice Mint tokens (restricted). Used e.g. by bonding/convert modules.
     * @dev Enforces cap **including** outstanding allocations so vesting cannot be crowded out.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(amount > 0, "Amount=0");
        // Protect vesting headroom: already minted + outstanding allocations + this mint <= cap
        require(totalSupply() + allocatedOutstanding + amount <= MAX_SUPPLY, "Exceeds cap");
        _mint(to, amount);
    }

    /**
     * @notice Pause transfers (role-gated)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit PausedEvent(_msgSender());
    }

    /**
     * @notice Unpause transfers (role-gated)
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit UnpausedEvent(_msgSender());
    }

    /* Overrides required by Solidity for multiple inheritance */
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
