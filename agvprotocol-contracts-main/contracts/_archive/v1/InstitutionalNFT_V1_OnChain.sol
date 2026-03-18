// SPDX-License-Identifier: MIT
//
// ============================================================================
// Source: BscScan verified source code (Etherscan V2 API, chainid=56)
// Contract: InstitutionalNFT (ERC1155, non-upgradeable)
// Address: 0x4C472a0888f09cC604e265de593FA913aCfAFf3E
// Compiler: v0.8.27+commit.40a35a09
// Chain: BSC Mainnet (Chain 56)
//
// On-chain State (2026-03-16):
//   - Bytecode: EXISTS (BscScan verified ✅)
//   - Token count: 5 枚 (ERC1155)
//   - Owner: 0xAC380431eC7F6E7c8F43D52F286f638fc9311Ca5 (我方 deployer)
//   - Status: ⛔ 已弃用 — 被 V3 Distribution License 模型取代
//
// No local contracts/nft/ version exists. This is the only source.
//
// Strategic Purpose:
//   InstitutionalNFT 是早期机构凭证 (ERC1155, Ownable)，已发行 5 枚。
//   已被 V3 NexrurPass Distribution License 架构取代。
//   保留此存档仅供审计和历史参考。
// ============================================================================

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/*
 * @title InstitutionalNFT
 * @notice ERC-1155 contract for Institutional Authorization NFTs
 * @dev Single shared metadata file for all token IDs
 */
contract InstitutionalNFT is ERC1155, Ownable {
    // Authorized multisig minter
    address public minter;

    // Shared metadata URI (points directly to metadata.json)
    string private _metadataURI;

    // Events
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event TokenMinted(address indexed to, uint256 indexed id, uint256 amount);
    event TokenBatchMinted(address indexed to, uint256[] ids, uint256[] amounts);
    event MetadataURIUpdated(string oldURI, string newURI);

    // Errors
    error OnlyMinter();
    error InvalidMinter();

    modifier onlyMinter() {
        if (msg.sender != minter) revert OnlyMinter();
        _;
    }

    /*
     * @param metadataURI_ Full URI to metadata.json (HTTPS gateway)
     * @param minter_ Address of multisig authorized to mint
     */
    constructor(string memory metadataURI_, address minter_)
        ERC1155("")
        Ownable(msg.sender)
    {
        if (minter_ == address(0)) revert InvalidMinter();
        minter = minter_;
        _metadataURI = metadataURI_;
    }

    /*
     * @notice Always return the same metadata URI for all token IDs
     */
    function uri(uint256) public view override returns (string memory) {
        return _metadataURI;
    }

    /*
     * @notice Mint a single token ID
     */
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyMinter {
        _mint(to, id, amount, data);
        emit TokenMinted(to, id, amount);
    }

    /*
     * @notice Mint multiple token IDs
     */
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external onlyMinter {
        _mintBatch(to, ids, amounts, data);
        emit TokenBatchMinted(to, ids, amounts);
    }

    /*
     * @notice Update the authorized minter
     */
    function setMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) revert InvalidMinter();
        address oldMinter = minter;
        minter = newMinter;
        emit MinterUpdated(oldMinter, newMinter);
    }

    /**
     * @notice Update metadata URI (emergency / upgrade)
     */
    function setMetadataURI(string memory newURI) external onlyOwner {
        string memory oldURI = _metadataURI;
        _metadataURI = newURI;
        emit MetadataURIUpdated(oldURI, newURI);
    }
}