// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title IpGVT
 * @notice V3-aligned interface for the pGVT presale voucher token
 */
interface IpGVT {
    // ---- ERC20 standard ----
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);

    // ---- Minting ----
    function mint(address to, uint256 amount) external;
    function totalMinted() external view returns (uint256);
    function MAX_SUPPLY() external view returns (uint256);

    // ---- Presale ----
    function buy(uint256 amount) external;
    function calculateCost(uint256 amount) external view returns (uint256);
    function getCurrentPrice() external view returns (uint256);

    // ---- Vesting ----
    function vestedAmount(address user) external view returns (uint256);
    function unlockedAmount(address user) external view returns (uint256);
    function transferableBalance(address user) external view returns (uint256);

    // ---- Conversion ----
    function convertToGVT(uint256 amount) external;
}
