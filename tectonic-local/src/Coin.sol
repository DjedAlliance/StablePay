// SPDX-License-Identifier: AEL
pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract Coin is ERC20 {
    address public immutable owner;

    // Supply created at deployment and owned by no address. It exists so that
    // totalSupply() can never return to zero, which keeps it usable as a
    // denominator. Because it belongs to nobody it can never be transferred,
    // burned or redeemed.
    //
    // It is tracked separately rather than minted because OpenZeppelin's
    // _totalSupply is private and _mint(address(0), ...) reverts, so there is
    // no way to credit supply to no one through the inherited API.
    uint256 public immutable seedSupply;

    modifier onlyOwner() { require(msg.sender == owner, "Unauthorized"); _; }

    constructor(string memory name, string memory symbol, uint256 _seedSupply) ERC20(name, symbol) {
        owner = msg.sender;
        seedSupply = _seedSupply;
    }

    /// Includes the unowned seed, so the sum of balances is less than
    /// totalSupply() by exactly seedSupply.
    function totalSupply() public view override returns (uint256) {
        return super.totalSupply() + seedSupply;
    }

    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
    function burn(address from, uint256 amount) external onlyOwner { _burn(from, amount);}
}
