// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PassBase.sol";

/**
 * @title TreePass
 * @notice Tier 2 — standard NFT Pass. $59 USDT per mint.
 */
contract TreePass is PassBase {
    uint256 private constant TREE_PRICE = 59 * 1e18;

    function initialize(address admin_, address usdt_, address treasury_)
        public
        initializerERC721A
        initializer
    {
        __PassBase_init("Tree Pass", "TREE", admin_, usdt_, treasury_);
    }

    function price() public pure override returns (uint256) {
        return TREE_PRICE;
    }
}
