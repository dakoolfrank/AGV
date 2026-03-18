// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgentRegistry (v2 — ERC1155 + Quota)
 * @notice Institutional agent registry — unified Certification (ERC1155 Soulbound) & per-agent quota management
 * @dev
 * - ERC1155: Each NFT Pass type maps to one tokenId. Agent receives a Soulbound ERC1155 token as certification.
 * - Soulbound: Only mint (setQuota) and burn (revokeAgent) allowed; transfers revert.
 * - Quota: setQuota → agentQuota mapping + auto-mint ERC1155; deductQuota → per-agent deduction.
 * - Immutable deployment (no upgrade proxy) — simple logic, reduced risk.
 *
 *  Architecture (v2):
 *  ┌──────────────────────────────────────────┐
 *  │    AgentRegistry (ERC1155 + Quota)        │
 *  │  ERC1155: tokenId 1=ComputePass           │  ← Certification (Soulbound)
 *  │           tokenId 2=SolarPass              │
 *  │  Quota:   agent→nft→quota                 │  ← Per-agent quota
 *  │           agent→nft→minted                │
 *  └──────────────────┬───────────────────────┘
 *              ┌──────┴──────┐
 *              ▼             ▼
 *         ComputePass   SolarPass  (call deductQuota on agentMint)
 */
contract AgentRegistry is ERC1155, ERC1155Burnable, ERC1155Supply, ERC1155URIStorage, AccessControl, Pausable {
    // ===================== Roles =====================
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant NFT_CONTRACT_ROLE = keccak256("NFT_CONTRACT_ROLE");

    // ===================== State =====================

    /// @notice agent => nftContract => allocated total quota
    mapping(address => mapping(address => uint256)) public agentQuota;

    /// @notice agent => nftContract => amount already consumed
    mapping(address => mapping(address => uint256)) public agentMinted;

    /// @notice All registered agent addresses (for enumeration / snapshot)
    address[] public agentList;
    mapping(address => bool) public isRegistered;

    /// @notice NFT contract address => ERC1155 tokenId (bidirectional)
    mapping(address => uint256) public nftContractToTokenId;
    mapping(uint256 => address) public tokenIdToNFTContract;

    // ===================== Events =====================
    event AgentRegistered(address indexed agent);
    event QuotaSet(address indexed agent, address indexed nftContract, uint256 quota);
    event QuotaBatchSet(address indexed nftContract, uint256 agentCount);
    event QuotaDeducted(address indexed agent, address indexed nftContract, uint256 amount, uint256 remaining);
    event AgentRevoked(address indexed agent, address indexed nftContract);
    event NFTContractRegistered(address indexed nftContract, uint256 indexed tokenId);
    event NFTContractUnregistered(address indexed nftContract);

    // ===================== Errors =====================
    error ZeroAddress();
    error LengthMismatch();
    error QuotaBelowMinted(address agent, address nftContract, uint256 quota, uint256 minted);
    error ExceedsAgentQuota(address agent, address nftContract, uint256 requested, uint256 remaining);
    error SoulboundTransfer();
    error TokenIdAlreadyRegistered(uint256 tokenId);
    error NFTContractAlreadyRegistered(address nftContract);
    error NFTContractNotRegistered(address nftContract);
    error InvalidTokenId();

    // ===================== Constructor =====================
    constructor(address admin) ERC1155("") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ===================== Soulbound: Block Transfers =====================

    /**
     * @dev Override _update to enforce Soulbound: only mint (from == 0) and burn (to == 0) allowed.
     */
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        if (from != address(0) && to != address(0)) {
            revert SoulboundTransfer();
        }
        super._update(from, to, ids, values);
    }

    /**
     * @dev Override to disable safeTransferFrom (Soulbound).
     */
    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public pure override {
        revert SoulboundTransfer();
    }

    /**
     * @dev Override to disable safeBatchTransferFrom (Soulbound).
     */
    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override
    {
        revert SoulboundTransfer();
    }

    // ===================== Admin: NFT Contract Registration =====================

    /**
     * @notice Register an NFT contract with a tokenId mapping and grant NFT_CONTRACT_ROLE
     * @param nftContract NFT Pass contract address
     * @param tokenId ERC1155 tokenId to associate with this NFT contract
     */
    function registerNFTContract(address nftContract, uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        if (nftContract == address(0)) revert ZeroAddress();
        if (tokenId == 0) revert InvalidTokenId();
        if (nftContractToTokenId[nftContract] != 0) revert NFTContractAlreadyRegistered(nftContract);
        if (tokenIdToNFTContract[tokenId] != address(0)) revert TokenIdAlreadyRegistered(tokenId);

        nftContractToTokenId[nftContract] = tokenId;
        tokenIdToNFTContract[tokenId] = nftContract;
        _grantRole(NFT_CONTRACT_ROLE, nftContract);

        emit NFTContractRegistered(nftContract, tokenId);
    }

    /**
     * @notice Revoke an NFT contract's permission and clear tokenId mapping
     */
    function unregisterNFTContract(address nftContract) external onlyRole(ADMIN_ROLE) {
        uint256 tokenId = nftContractToTokenId[nftContract];
        if (tokenId != 0) {
            delete tokenIdToNFTContract[tokenId];
            delete nftContractToTokenId[nftContract];
        }
        _revokeRole(NFT_CONTRACT_ROLE, nftContract);

        emit NFTContractUnregistered(nftContract);
    }

    // ===================== Admin: Certification Management =====================

    /**
     * @notice Set an agent's quota for a specific NFT contract (= issue Certification)
     * @param agent Agent address
     * @param nftContract NFT Pass contract address (ComputePass / SolarPass etc.)
     * @param quota Allocated mint quota count
     * @dev On first quota assignment, auto-mints ERC1155 Soulbound certification token.
     *      On subsequent calls, only updates the quota mapping.
     */
    function setQuota(address agent, address nftContract, uint256 quota) external onlyRole(ADMIN_ROLE) {
        if (agent == address(0) || nftContract == address(0)) revert ZeroAddress();
        uint256 minted = agentMinted[agent][nftContract];
        if (quota < minted) revert QuotaBelowMinted(agent, nftContract, quota, minted);

        _registerAgent(agent);

        // Auto-mint ERC1155 certification if first time and tokenId is registered
        uint256 tokenId = nftContractToTokenId[nftContract];
        if (tokenId != 0 && balanceOf(agent, tokenId) == 0) {
            _mint(agent, tokenId, 1, "");
        }

        agentQuota[agent][nftContract] = quota;
        emit QuotaSet(agent, nftContract, quota);
    }

    /**
     * @notice Batch set quotas for multiple agents on the same NFT contract
     * @param agents Agent address array
     * @param nftContract NFT Pass contract address
     * @param quotas Quota array (1:1 with agents)
     */
    function batchSetQuota(address[] calldata agents, address nftContract, uint256[] calldata quotas)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (agents.length != quotas.length) revert LengthMismatch();
        if (nftContract == address(0)) revert ZeroAddress();

        uint256 tokenId = nftContractToTokenId[nftContract];

        for (uint256 i; i < agents.length;) {
            address agent = agents[i];
            if (agent == address(0)) revert ZeroAddress();

            uint256 minted = agentMinted[agent][nftContract];
            if (quotas[i] < minted) revert QuotaBelowMinted(agent, nftContract, quotas[i], minted);

            _registerAgent(agent);

            // Auto-mint ERC1155 certification
            if (tokenId != 0 && balanceOf(agent, tokenId) == 0) {
                _mint(agent, tokenId, 1, "");
            }

            agentQuota[agent][nftContract] = quotas[i];
            emit QuotaSet(agent, nftContract, quotas[i]);

            unchecked {
                ++i;
            }
        }
        emit QuotaBatchSet(nftContract, agents.length);
    }

    /**
     * @notice Revoke an agent's entire quota for a specific NFT contract
     * @dev Burns the ERC1155 certification token if held. Preserves agentMinted history.
     */
    function revokeAgent(address agent, address nftContract) external onlyRole(ADMIN_ROLE) {
        agentQuota[agent][nftContract] = 0;

        // Burn ERC1155 certification if held
        uint256 tokenId = nftContractToTokenId[nftContract];
        if (tokenId != 0 && balanceOf(agent, tokenId) > 0) {
            _burn(agent, tokenId, 1);
        }

        emit AgentRevoked(agent, nftContract);
    }

    // ===================== NFT Contract Calls: Quota Deduction =====================

    /**
     * @notice Called by NFT contracts during agentMint to deduct per-agent quota
     * @param agent The agent executing the mint
     * @param amount Number of NFTs being minted
     */
    function deductQuota(address agent, uint256 amount) external onlyRole(NFT_CONTRACT_ROLE) whenNotPaused {
        address nftContract = msg.sender;
        uint256 quota = agentQuota[agent][nftContract];
        uint256 minted = agentMinted[agent][nftContract];
        uint256 remaining = quota - minted;

        if (amount > remaining) {
            revert ExceedsAgentQuota(agent, nftContract, amount, remaining);
        }

        agentMinted[agent][nftContract] = minted + amount;
        emit QuotaDeducted(agent, nftContract, amount, remaining - amount);
    }

    // ===================== Admin: URI Management =====================

    /**
     * @notice Set the URI for a specific ERC1155 tokenId (certification metadata)
     */
    function setTokenURI(uint256 tokenId, string calldata tokenURI) external onlyRole(ADMIN_ROLE) {
        _setURI(tokenId, tokenURI);
    }

    /**
     * @notice Set the base URI for all ERC1155 tokens
     */
    function setBaseURI(string calldata baseURI) external onlyRole(ADMIN_ROLE) {
        _setBaseURI(baseURI);
    }

    // ===================== Admin: Pause =====================

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ===================== View Functions =====================

    /**
     * @notice Check if an agent has remaining quota for a given NFT contract
     */
    function isAgent(address agent, address nftContract) external view returns (bool) {
        return agentQuota[agent][nftContract] > agentMinted[agent][nftContract];
    }

    /**
     * @notice Get remaining mintable quota for an agent on a specific NFT contract
     */
    function getRemaining(address agent, address nftContract) external view returns (uint256) {
        return agentQuota[agent][nftContract] - agentMinted[agent][nftContract];
    }

    /**
     * @notice Get full agent info for a given NFT contract
     */
    function getAgentInfo(address agent, address nftContract)
        external
        view
        returns (uint256 quota, uint256 minted, uint256 remaining)
    {
        quota = agentQuota[agent][nftContract];
        minted = agentMinted[agent][nftContract];
        remaining = quota - minted;
    }

    /**
     * @notice Get the tokenId mapped to an NFT contract
     */
    function getTokenId(address nftContract) external view returns (uint256) {
        return nftContractToTokenId[nftContract];
    }

    /**
     * @notice Get the NFT contract mapped to a tokenId
     */
    function getNFTContract(uint256 tokenId) external view returns (address) {
        return tokenIdToNFTContract[tokenId];
    }

    /**
     * @notice Get total registered agent count
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @notice Paginated agent list retrieval (prevents gas limit issues)
     */
    function getAgents(uint256 offset, uint256 limit) external view returns (address[] memory agents) {
        uint256 total = agentList.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        agents = new address[](end - offset);
        for (uint256 i = offset; i < end;) {
            agents[i - offset] = agentList[i];
            unchecked {
                ++i;
            }
        }
    }

    // ===================== ERC1155 Overrides (Diamond Resolution) =====================

    function uri(uint256 tokenId) public view override(ERC1155, ERC1155URIStorage) returns (string memory) {
        return ERC1155URIStorage.uri(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return ERC1155.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    // ===================== Internal =====================

    function _registerAgent(address agent) internal {
        if (!isRegistered[agent]) {
            isRegistered[agent] = true;
            agentList.push(agent);
            emit AgentRegistered(agent);
        }
    }
}
