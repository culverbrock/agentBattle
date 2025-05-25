// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ABTPrizePool {
    address public owner;
    address public abtToken;
    address public winner;
    uint256 public totalPool;

    constructor(address _abtToken) {
        owner = msg.sender;
        abtToken = _abtToken;
    }

    function enter(uint256 amount) external {
        require(winner == address(0), "Game ended");
        require(amount == 100 * 1e18, "Must send exactly 100 ABT");
        require(IERC20(abtToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        totalPool += amount;
    }

    function setWinner(address _winner) external {
        require(msg.sender == owner, "Not authorized");
        require(winner == address(0), "Winner already set");
        winner = _winner;
    }

    function withdraw() external {
        require(msg.sender == winner, "Not the winner");
        uint256 amount = totalPool;
        totalPool = 0;
        require(IERC20(abtToken).transfer(msg.sender, amount), "Withdraw failed");
    }
} 