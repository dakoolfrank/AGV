// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";
import "openzeppelin-contracts/contracts/utils/Pausable.sol";

/**
 * @title AgentRegistry
 * @notice Institutional agent registry — unified Certification & per-agent quota management
 * @dev
 * - Certification = setQuota(agent, nft, quota) → agent gains mint eligibility + quota
 * - Institutional NFT = agentMint auto-calls deductQuota() → per-agent quota deduction
 * - Supports multiple NFT contracts sharing a single Registry
 * - Immutable deployment (no upgrade proxy) — simple logic, reduced risk
 *
 *  Architecture:
 *  ┌──────────────────────┐
 *  │    AgentRegistry     │
 *  │  agent→nft→quota     │  ← Certification
 *  │  agent→nft→minted    │  ← Institutional NFT (deduction)
 *  └──────────┬───────────┘
 *       ┌─────┴─────┐
 *       ▼           ▼
 *  ComputePass  SolarPass   (call deductQuota on agentMint)
 */
contract AgentRegistry is AccessControl, Pausable {
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

    // ===================== Events =====================
    event AgentRegistered(address indexed agent);
    event QuotaSet(address indexed agent, address indexed nftContract, uint256 quota);
    event QuotaBatchSet(address indexed nftContract, uint256 agentCount);
    event QuotaDeducted(address indexed agent, address indexed nftContract, uint256 amount, uint256 remaining);
    event AgentRevoked(address indexed agent, address indexed nftContract);
    event NFTContractRegistered(address indexed nftContract);
    event NFTContractUnregistered(address indexed nftContract);

    // ===================== Errors =====================
    error ZeroAddress();
    error LengthMismatch();
    error QuotaBelowMinted(address agent, address nftContract, uint256 quota, uint256 minted);
    error ExceedsAgentQuota(address agent, address nftContract, uint256 requested, uint256 remaining);

    // ===================== Constructor =====================
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ===================== Admin: Certification Management =====================

    /**
     * @notice Set an agent's quota for a specific NFT contract (= issue Certification)
     * @param agent Agent address
     * @param nftContract NFT Pass contract address (ComputePass / SolarPass etc.)
     * @param quota Allocated mint quota count
     * @dev quota = 0 effectively revokes agent eligibility for that contract
     */
    function setQuota(address agent, address nftContract, uint256 quota) external onlyRole(ADMIN_ROLE) {
        if (agent == address(0) || nftContract == address(0)) revert ZeroAddress();
        uint256 minted = agentMinted[agent][nftContract];
        if (quota < minted) revert QuotaBelowMinted(agent, nftContract, quota, minted);

        _registerAgent(agent);
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

        for (uint256 i; i < agents.length;) {
            address agent = agents[i];
            if (agent == address(0)) revert ZeroAddress();

            uint256 minted = agentMinted[agent][nftContract];
            if (quotas[i] < minted) revert QuotaBelowMinted(agent, nftContract, quotas[i], minted);

            _registerAgent(agent);
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
     * @dev Does NOT clear agentMinted records (preserves accounting history)
     */
    function revokeAgent(address agent, address nftContract) external onlyRole(ADMIN_ROLE) {
        agentQuota[agent][nftContract] = 0;
        emit AgentRevoked(agent, nftContract);
    }

    // ===================== NFT Contract Calls: Quota Deduction =====================

    /**
     * @notice Called by NFT contracts during agentMint to deduct per-agent quota
     * @param agent The agent executing the mint
     * @param amount Number of NFTs being minted
     * @dev Only addresses with NFT_CONTRACT_ROLE can call this.
     *      msg.sender = NFT contract address, automatically used as nftContract key.
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

    // ===================== Admin: Registry Management =====================

    /**
     * @notice Grant an NFT contract permission to call deductQuota
     * @param nftContract NFT Pass contract address
     */
    function registerNFTContract(address nftContract) external onlyRole(ADMIN_ROLE) {
        if (nftContract == address(0)) revert ZeroAddress();
        _grantRole(NFT_CONTRACT_ROLE, nftContract);
        emit NFTContractRegistered(nftContract);
    }

    /**
     * @notice Revoke an NFT contract's permission to call deductQuota
     */
    function unregisterNFTContract(address nftContract) external onlyRole(ADMIN_ROLE) {
        _revokeRole(NFT_CONTRACT_ROLE, nftContract);
        emit NFTContractUnregistered(nftContract);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ===================== View Functions =====================

    /**
     * @notice Check if an agent has remaining quota for a given NFT contract
     * @return true if agent has remaining quota > 0
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
     * @return quota Total allocated quota
     * @return minted Amount already consumed
     * @return remaining Amount still available
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
     * @notice Get total registered agent count
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @notice Paginated agent list retrieval (prevents gas limit issues)
     * @param offset Starting index
     * @param limit Maximum number of agents to return
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

    // ===================== Internal =====================

    function _registerAgent(address agent) internal {
        if (!isRegistered[agent]) {
            isRegistered[agent] = true;
            agentList.push(agent);
            emit AgentRegistered(agent);
        }
    }
}
