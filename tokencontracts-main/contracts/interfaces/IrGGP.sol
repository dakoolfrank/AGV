// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IrGGP {
    enum AssetType {
        SOLAR,
        ORCHARD,
        COMPUTE
    }

    function mintFromOutput(
        address recipient,
        uint256 outputAmount,
        AssetType assetType,
        bytes32 sourceId,
        uint256 timestamp,
        bytes memory signature
    ) external;
}
