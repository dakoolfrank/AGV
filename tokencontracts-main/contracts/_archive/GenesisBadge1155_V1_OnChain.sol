// =====================================================================
// GenesisBadge1155 — BscScan Verified Source (Archive Only, DO NOT COMPILE)
// =====================================================================
// Contract:    GenesisBadge1155 (Airdrop Badge)
// Address:     0x704fa14df689ebdfaa4615019ab23a99c6041b29
// Chain:       BSC Mainnet (56)
// Compiler:    v0.8.27+commit.40a35a09
// Type:        ERC1155 + AccessControl + Pausable (non-upgradeable)
// Deployer:    Old AGV Protocol team (NOT AGV NEXRUR)
// Status:      ACTIVE — max 2000 badges
// Retrieved:   2026-03-16 via Etherscan V2 API (chainid=56)
// Source:      src/GenesisBadge.sol (main contract from Standard JSON)
//
// NOTE: This file is archived for reference only.
//       It uses OZ 5.x imports that exist in local lib/.
//       The contract is deployed and owned by old team.
// =====================================================================

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title GenesisBadge1155
 * @notice Soulbound ERC-1155 activation badge with flexible claiming mechanisms
 *
 * BADGE ID EXPLANATION:
 * - Badge IDs allow you to run multiple campaigns with different rules
 * - Example: ID 1 = "Early Adopter Round" (1000 preGGP), ID 2 = "Community Round" (500 preGGP)
 * - Each ID can have its own:
 *   - Claim method: Free claim, Merkle whitelist, or paid
 *   - Total supply cap
 *   - Claim/redeem windows
 *   - Per-user claim limits
 * - Your backend tracks which ID was activated to credit correct preGGP amount
 */
contract GenesisBadge1155 is ERC1155, AccessControl, Pausable {
    // Roles
    bytes32 public constant ROOT_SETTER_ROLE = keccak256("ROOT_SETTER_ROLE");

    // Badge configuration per ID
    struct BadgeConfig {
        bytes32 merkleRoot; // Merkle root for whitelist (ignored if useMerkle = false)
        uint256 maxSupply; // Max total supply for this badge ID (0 = unlimited)
        uint256 totalClaimed; // Current claimed count
        uint256 maxPerWallet; // Max each wallet can claim (0 = unlimited)
        uint256 claimPrice; // Price to claim in wei (0 = free)
        bool claimOpen; // Is claiming enabled?
        bool redeemOpen; // Is redemption/activation enabled?
        bool useMerkle; // If false, anyone can claim (no whitelist check)
    }

    // Storage
    mapping(uint256 => BadgeConfig) public badges;
    mapping(address => mapping(uint256 => uint256)) public claimed; // user => badgeId => amount claimed
    mapping(address => uint256) public activationNonceOf;

    // Events
    event RootUpdated(uint256 indexed id, bytes32 oldRoot, bytes32 newRoot);
    event ClaimOpened(uint256 indexed id, bool isOpen);
    event RedeemOpened(uint256 indexed id, bool isOpen);
    event MerkleToggled(uint256 indexed id, bool useMerkle);
    event BadgeClaimed(address indexed to, uint256 indexed id, uint256 amount);
    event Activated(address indexed account, uint256 indexed id, uint256 amount, uint256 activationNonce);
    event MaxSupplySet(uint256 indexed id, uint256 oldMax, uint256 newMax);
    event MaxPerWalletSet(uint256 indexed id, uint256 maxPerWallet);
    event ClaimPriceSet(uint256 indexed id, uint256 price);

    constructor(string memory uri_) ERC1155(uri_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ROOT_SETTER_ROLE, msg.sender);
    }

    // ============ CLAIM FUNCTIONS ============

    /**
     * @notice Claim badges - with optional Merkle proof gating and optional payment
     * @param id Badge token ID (which campaign/tier)
     * @param amount Amount to claim
     * @param proof Merkle proof (can be empty array if useMerkle = false)
     *
     * HOW IT WORKS:
     * - If claimPrice = 0: Free claim (just connect wallet)
     * - If claimPrice > 0: Must send exact ETH amount
     * - If useMerkle[id] = true: Must provide valid Merkle proof
     * - If useMerkle[id] = false: Anyone can claim (no proof needed)
     * - Stops when maxSupply is reached
     * - Always respects maxPerWallet limits
     */
    function claim(uint256 id, uint256 amount, bytes32[] calldata proof) external payable whenNotPaused {
        BadgeConfig storage badge = badges[id];

        require(badge.claimOpen, "Claim not open");
        require(amount > 0, "Amount must be > 0");

        // Check total supply (stops when reached)
        require(badge.maxSupply == 0 || badge.totalClaimed + amount <= badge.maxSupply, "Max supply reached");

        // Check per-wallet limit
        require(
            badge.maxPerWallet == 0 || claimed[msg.sender][id] + amount <= badge.maxPerWallet, "Exceeds wallet limit"
        );

        // Check payment (if claimPrice = 0, no payment needed)
        uint256 totalPrice = badge.claimPrice * amount;
        require(msg.value == totalPrice, "Incorrect payment");

        // Merkle proof check (only if enabled for this badge ID)
        if (badge.useMerkle) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender, id));
            require(MerkleProof.verify(proof, badge.merkleRoot, leaf), "Invalid proof");
        }

        // Update state
        claimed[msg.sender][id] += amount;
        badge.totalClaimed += amount;

        // Mint
        _mint(msg.sender, id, amount, "");

        emit BadgeClaimed(msg.sender, id, amount);
    }

    /**
     * @notice Simplified free claim (no proof, no payment)
     * @dev Only works if useMerkle = false and claimPrice = 0 for this badge ID
     *
     * SIMPLEST USE CASE:
     * - User just connects wallet and clicks "Claim Badge"
     * - First come first served until maxSupply reached
     */
    function claimFree(uint256 id, uint256 amount) external whenNotPaused {
        BadgeConfig storage badge = badges[id];
        require(!badge.useMerkle, "Use claim() with proof");
        require(badge.claimPrice == 0, "Badge not free");

        // Call main claim function
        bytes32[] memory emptyProof;
        this.claim(id, amount, emptyProof);
    }

    // ============ REDEEM/ACTIVATE FUNCTIONS ============

    /**
     * @notice Burn badge to activate (awards preGGP off-chain)
     * @param id Badge token ID
     * @param amount Amount to burn/activate
     *
     * WHAT HAPPENS:
     * 1. Badge is burned (removed from wallet)
     * 2. Activated event is emitted with badge ID
     * 3. Your backend listens to this event
     * 4. Backend credits preGGP based on which badge ID was activated
     */
    function redeem(uint256 id, uint256 amount) external whenNotPaused {
        require(badges[id].redeemOpen, "Redeem not open");
        require(balanceOf(msg.sender, id) >= amount, "Insufficient balance");

        // Burn
        _burn(msg.sender, id, amount);

        // Increment activation nonce
        uint256 nonce = activationNonceOf[msg.sender]++;

        emit Activated(msg.sender, id, amount, nonce);
    }

    // ============ SOULBOUND (NON-TRANSFERABLE) ============

    function setApprovalForAll(address, bool) public pure override {
        revert("SBT: approvals disabled");
    }

    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public pure override {
        revert("SBT: non-transferable");
    }

    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override
    {
        revert("SBT: non-transferable");
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update metadata URI for all badges
     */
    function setURI(string memory newUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newUri);
    }

    /**
     * @notice Set Merkle root for a specific badge ID
     * @param id Badge ID to configure
     * @param root New Merkle root
     */
    function setMerkleRoot(uint256 id, bytes32 root) external onlyRole(ROOT_SETTER_ROLE) {
        bytes32 oldRoot = badges[id].merkleRoot;
        badges[id].merkleRoot = root;
        emit RootUpdated(id, oldRoot, root);
    }

    /**
     * @notice Toggle Merkle proof requirement for a badge ID
     * @param id Badge ID to configure
     * @param useMerkle True = require proof, False = public claim
     */
    function setUseMerkle(uint256 id, bool useMerkle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badges[id].useMerkle = useMerkle;
        emit MerkleToggled(id, useMerkle);
    }

    /**
     * @notice Set claim price for a badge ID
     * @param id Badge ID to configure
     * @param price Price in wei (0 = free claim)
     *
     * EXAMPLES:
     * - 0 = Free claim (just connect wallet)
     * - 0.01 ether = 0.01 ETH per badge
     * - 1 ether = 1 ETH per badge
     */
    function setClaimPrice(uint256 id, uint256 price) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badges[id].claimPrice = price;
        emit ClaimPriceSet(id, price);
    }

    /**
     * @notice Open/close claiming for a specific badge ID
     * @param id Badge ID to configure
     * @param open True = claiming enabled, False = disabled
     */
    function setClaimOpen(uint256 id, bool open) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badges[id].claimOpen = open;
        emit ClaimOpened(id, open);
    }

    /**
     * @notice Open/close redemption for a specific badge ID
     * @param id Badge ID to configure
     * @param open True = redemption enabled, False = disabled
     */
    function setRedeemOpen(uint256 id, bool open) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badges[id].redeemOpen = open;
        emit RedeemOpened(id, open);
    }

    /**
     * @notice Set max supply for a specific badge ID
     * @param id Badge ID to configure
     * @param maxSupply Maximum total supply (0 = unlimited)
     *
     * NOTE: Claiming automatically stops when maxSupply is reached
     */
    function setMaxSupply(uint256 id, uint256 maxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldMax = badges[id].maxSupply;
        badges[id].maxSupply = maxSupply;
        emit MaxSupplySet(id, oldMax, maxSupply);
    }

    /**
     * @notice Set max badges per wallet for a specific badge ID
     * @param id Badge ID to configure
     * @param maxPerWallet Maximum per wallet (0 = unlimited)
     */
    function setMaxPerWallet(uint256 id, uint256 maxPerWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badges[id].maxPerWallet = maxPerWallet;
        emit MaxPerWalletSet(id, maxPerWallet);
    }

    /**
     * @notice Emergency pause all claiming and redemption
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Admin mint for airdrops/fixes
     * @param to Recipient address
     * @param id Badge ID
     * @param amount Amount to mint
     */
    function adminMint(address to, uint256 id, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badges[id].totalClaimed += amount;
        _mint(to, id, amount, "");
        emit BadgeClaimed(to, id, amount);
    }

    /**
     * @notice Withdraw collected ETH from paid claims
     * @param to Recipient address
     */
    function withdraw(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid address");
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success,) = to.call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // ============ VIEW FUNCTIONS ============

    function merkleRoot(uint256 id) external view returns (bytes32) {
        return badges[id].merkleRoot;
    }

    function claimOpen(uint256 id) external view returns (bool) {
        return badges[id].claimOpen;
    }

    function redeemOpen(uint256 id) external view returns (bool) {
        return badges[id].redeemOpen;
    }

    function maxSupply(uint256 id) external view returns (uint256) {
        return badges[id].maxSupply;
    }

    function totalClaimed(uint256 id) external view returns (uint256) {
        return badges[id].totalClaimed;
    }

    function useMerkle(uint256 id) external view returns (bool) {
        return badges[id].useMerkle;
    }

    function maxPerWallet(uint256 id) external view returns (uint256) {
        return badges[id].maxPerWallet;
    }

    function claimPrice(uint256 id) external view returns (uint256) {
        return badges[id].claimPrice;
    }

    function remainingSupply(uint256 id) external view returns (uint256) {
        BadgeConfig storage badge = badges[id];
        if (badge.maxSupply == 0) return type(uint256).max; // unlimited
        if (badge.totalClaimed >= badge.maxSupply) return 0;
        return badge.maxSupply - badge.totalClaimed;
    }

    function getBadgeConfig(uint256 id) external view returns (BadgeConfig memory) {
        return badges[id];
    }

    // ============ INTERFACE SUPPORT ============

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Required to receive ETH
    receive() external payable {}
}

