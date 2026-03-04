// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title pGVT (P Green Value Token)
 * @notice Lightweight presale airdrop token
 * @dev
 * - Admin can mint to any address (MINTER_ROLE)
 * - Burnable + Pausable for standard utility
 * - No stage management — for direct mint/airdrop use
 */
contract pGVT is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Hard cap — cannot mint beyond this (250M, same ceiling as PreGVT)
    uint256 public constant MAX_SUPPLY = 250_000_000 * 10 ** 18;

    error ExceedsMaxSupply();
    error AmountIsZero();

    constructor(address admin) ERC20("P Green Value Token", "pGVT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Mint pGVT to any address
     * @param to Recipient
     * @param amount Amount (18 decimals)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (amount == 0) revert AmountIsZero();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
