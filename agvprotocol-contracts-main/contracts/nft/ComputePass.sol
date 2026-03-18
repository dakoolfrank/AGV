// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PassBase.sol";

/**
 * @title ComputePass
 * @notice Tier 4 — top-tier NFT Pass. $899 USDT per mint.
 */
contract ComputePass is PassBase {
    uint256 private constant COMPUTE_PRICE = 899 * 1e18;

    function initialize(address admin_, address usdt_, address treasury_)
        public
        initializerERC721A
        initializer
    {
        __PassBase_init("Compute Pass", "COMP", admin_, usdt_, treasury_);
    }

    function price() public pure override returns (uint256) {
        return COMPUTE_PRICE;
    }
}
