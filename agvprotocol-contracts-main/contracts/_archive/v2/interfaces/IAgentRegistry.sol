// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAgentRegistry
 * @notice Interface for AgentRegistry v2 — called by NFT Pass contracts during agentMint
 * @dev v2 adds ERC1155 Soulbound certification + tokenId mapping
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

    /// @notice Get the ERC1155 tokenId mapped to an NFT contract
    function getTokenId(address nftContract) external view returns (uint256);

    /// @notice Get the NFT contract mapped to an ERC1155 tokenId
    function getNFTContract(uint256 tokenId) external view returns (address);
}
