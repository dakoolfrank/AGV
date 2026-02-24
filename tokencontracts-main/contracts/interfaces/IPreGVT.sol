// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPreGVT {
    function mint(address to, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function pause() external;
    function paused() external view returns (bool);
}
