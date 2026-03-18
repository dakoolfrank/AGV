// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PassBase.sol";

/**
 * @title SeedPass
 * @notice Tier 1 — entry-level NFT Pass. $29 USDT per mint.
 */
contract SeedPass is PassBase {
    uint256 private constant SEED_PRICE = 29 * 1e18; // BSC USDT has 18 decimals

    function initialize(address admin_, address usdt_, address treasury_)
        public
        initializerERC721A
        initializer
    {
        __PassBase_init("Seed Pass", "SEED", admin_, usdt_, treasury_);
    }

    function price() public pure override returns (uint256) {
        return SEED_PRICE;
    }
}
