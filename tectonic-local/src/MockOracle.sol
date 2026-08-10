// SPDX-License-Identifier: AEL
pragma solidity ^0.8.0;

import "./IOracle.sol";

/// @title MockOracle
/// @notice Settable price feed for local development. Lets you drive the
///         reserve ratio across the critical/safe thresholds on demand, which
///         is how you exercise stability fees and triggered redemptions on a
///         local chain without waiting for real market movement.
/// @dev    Local use only. Never deploy this to a public network.
contract MockOracle is IOracle {
    uint256 private price;
    address public immutable owner;

    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    /// @param initialPrice wei of basecoin per 1 whole stablecoin (18 decimals)
    constructor(uint256 initialPrice) {
        require(initialPrice > 0, "MockOracle: price must be positive");
        price = initialPrice;
        owner = msg.sender;
    }

    function readData() external view returns (uint256) {
        return price;
    }

    /// @notice Set the target price. Raising it increases liabilities and
    ///         therefore lowers the reserve ratio (simulates the basecoin
    ///         losing value against the peg asset).
    function setPrice(uint256 newPrice) external {
        require(msg.sender == owner, "MockOracle: unauthorized");
        require(newPrice > 0, "MockOracle: price must be positive");
        emit PriceUpdated(price, newPrice);
        price = newPrice;
    }
}
