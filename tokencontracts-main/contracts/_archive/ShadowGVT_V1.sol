// SPDX-License-Identifier: MIT
// ARCHIVE: Deployed at 0xd175D071a0A726FCDfd682931796317AF9CFdf6a (BSC Mainnet)
// Deployed: 2025-11-30 10:44:20 UTC | Block 69997282 | Tx 0x2514dbc5fa9c7d6037d9f2891e997573b61f1f1740c3668ce6adacfc4aa4b327
// Source: BSCScan verified source code
// Note: V1 "price visibility" token, replaced by sGVT V2 at 0xA976...0E90 (42 days later)
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ShadowGVT
 * @notice transferable preview token for on-chain price visibility before TGE
 *
 *
 * Key properties:
 * - Minting controlled by ADMIN_ROLE (Safe multisig)
 * - No upgradeability, no complex features
 * - Designed for price visibility only - NOT A REAL TOKEN
 */
contract ShadowGVT is ERC20, AccessControl {
    // ============ Roles ============

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BLACKLIST_MANAGER_ROLE = keccak256("BLACKLIST_MANAGER_ROLE");

    // ============ Immutable Metadata ============

    string public constant AGV_NOTICE =
        "ShadowGVT is a Transferable preview token for price visibility only. NOT A REAL TOKEN.";

    // ============ State Variables ============

    /// @notice Blacklisted addresses (failsafe mechanism)
    mapping(address => bool) public blacklisted;

    // ============ Events ============

    event MintedByAdmin(address indexed to, uint256 amount);
    event BurnedByAdmin(address indexed burner, uint256 amount);
    event AddressBlacklisted(address indexed account, bool status);

    // ============ Errors ============

    error Blacklisted();
    error ZeroAddress();

    // ============ Constructor ============

    /**
     * @param _initialAdmin Address to grant ADMIN_ROLE and DEFAULT_ADMIN_ROLE
     */
    constructor(address _initialAdmin) ERC20("Shadow GVT", "sGVT") {
        require(_initialAdmin != address(0), "Invalid admin address");
        // Grant both roles so admin can manage other admins
        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(ADMIN_ROLE, _initialAdmin);
        _grantRole(BLACKLIST_MANAGER_ROLE, _initialAdmin);
    }

    // ============ View Functions ============

    /**
     * @notice Get the AGV notice about this token
     */
    function getNotice() external pure returns (string memory) {
        return AGV_NOTICE;
    }

    /**
     * @notice Check if address has admin role
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // ============ Admin Functions ============

    /**
     * @notice Mint tokens - ADMIN_ROLE only
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be positive");
        _mint(to, amount);
        emit MintedByAdmin(to, amount);
    }

    /**
     * @notice Burn tokens - ADMIN_ROLE only
     * @param amount Amount to burn from caller
     */
    function burn(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(amount > 0, "Amount must be positive");
        _burn(msg.sender, amount);
        emit BurnedByAdmin(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from any address - ADMIN_ROLE only
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address from, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Amount must be positive");
        require(balanceOf(from) >= amount, "Insufficient balance");
        _burn(from, amount);
        emit BurnedByAdmin(from, amount);
    }

    /**
     * @notice Batch mint varying amounts of tokens to multiple recipients
     * @param recipients List of wallet addresses
     * @param amounts List of token amounts per address
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyRole(ADMIN_ROLE) {
        require(recipients.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            address to = recipients[i];
            require(to != address(0), "Cannot mint to zero");

            uint256 amount = amounts[i];
            require(amount > 0, "Amount must be positive");

            _mint(to, amount);
            emit MintedByAdmin(to, amount);
        }
    }

    // ============ Blacklist Management (Failsafe) ============

    /**
     * @notice Blacklist an address (emergency failsafe)
     * @dev Blacklisted addresses cannot mint or burn tokens
     */
    function setBlacklisted(address account, bool status) external onlyRole(BLACKLIST_MANAGER_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        blacklisted[account] = status;
        emit AddressBlacklisted(account, status);
    }

    /**
     * @notice Batch blacklist addresses
     */
    function batchSetBlacklisted(address[] calldata accounts, bool status) external onlyRole(BLACKLIST_MANAGER_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) revert ZeroAddress();
            blacklisted[accounts[i]] = status;
            emit AddressBlacklisted(accounts[i], status);
        }
    }

    // ============ Transfer Blocking Logic ============

    /**
     * @notice Override _update to block all transfers except mint/burn
     * @dev Mint: from == address(0)
     *      Burn: to == address(0)
     *      Transfer: from != address(0) && to != address(0) → REVERT
     */
    function _update(address from, address to, uint256 value) internal override {
        // Block blacklisted addresses (failsafe)
        if (blacklisted[from] || blacklisted[to]) {
            revert Blacklisted();
        }

        super._update(from, to, value);
    }
}
