// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PassBase.sol";

/**
 * @title SolarPass
 * @notice Tier 3 — premium NFT Pass. $299 USDT per mint.
 */
contract SolarPass is PassBase {
    uint256 private constant SOLAR_PRICE = 299 * 1e18;

    function initialize(address admin_, address usdt_, address treasury_)
        public
        initializerERC721A
        initializer
    {
        __PassBase_init("Solar Pass", "SOLAR", admin_, usdt_, treasury_);
    }

    function price() public pure override returns (uint256) {
        return SOLAR_PRICE;
    }
}
