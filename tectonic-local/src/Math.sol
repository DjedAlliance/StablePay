// SPDX-License-Identifier: AEL
pragma solidity ^0.8.0;

library Math {
    function min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
    function max(uint256 a, uint256 b) internal pure returns (uint256) { return a > b ? a : b; }
}
