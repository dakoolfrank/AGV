// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ShadowGVT (sGVT)
 * @notice Fixed-supply display / price-anchor token for AGV Protocol
 * @dev
 * - One-time mint in constructor — NO mint function exists
 * - Serves as early-stage price reference via DEX LP (sGVT-USDT)
 * - Completely independent from GVT — no on-chain redemption
 * - Does NOT count toward GVT 1B hard cap
 *
 * Current deployment: ~22M supply @ $0.5 USDT
 */
contract ShadowGVT is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Total ever-minted — set in constructor, immutable
    uint256 public immutable INITIAL_SUPPLY;

    constructor(
        address admin,
        uint256 initialSupply,
        address treasury
    ) ERC20("Shadow Green Value Token", "sGVT") {
        require(treasury != address(0), "Invalid treasury");
        require(initialSupply > 0, "Supply=0");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        INITIAL_SUPPLY = initialSupply;
        _mint(treasury, initialSupply);
        // NO mint function — supply is permanently fixed
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
