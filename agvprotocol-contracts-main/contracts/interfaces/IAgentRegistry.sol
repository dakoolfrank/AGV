// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAgentRegistry
 * @notice Interface for AgentRegistry — called by NFT Pass contracts during agentMint
 */
interface IAgentRegistry {
    /// @notice Deduct quota from an agent. Only callable by registered NFT contracts.
    /// @param agent The agent whose quota to deduct
    /// @param amount The amount to deduct
    function deductQuota(address agent, uint256 amount) external;

    /// @notice Check if an agent has remaining quota for a given NFT contract
    /// @param agent The agent address
    /// @param nftContract The NFT contract address
    /// @return true if agent has remaining quota > 0
    function isAgent(address agent, address nftContract) external view returns (bool);

    /// @notice Get remaining mintable quota for an agent
    /// @param agent The agent address
    /// @param nftContract The NFT contract address
    /// @return Remaining quota
    function getRemaining(address agent, address nftContract) external view returns (uint256);

    /// @notice Get full agent info for a given NFT contract
    /// @param agent The agent address
    /// @param nftContract The NFT contract address
    /// @return quota Total allocated quota
    /// @return minted Amount already used
    /// @return remaining Amount still available
    function getAgentInfo(address agent, address nftContract)
        external
        view
        returns (uint256 quota, uint256 minted, uint256 remaining);
}
