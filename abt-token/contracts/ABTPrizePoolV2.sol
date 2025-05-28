// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ABTPrizePoolV2 {
    address public owner;
    address public abtToken;
    uint256 public totalPool;
    bool public winnersSet;

    mapping(address => uint256) public winnings;
    mapping(address => bool) public withdrawn;
    address[] public entrants;

    event Enter(address indexed player, uint256 amount);
    event WinnersSet(address[] winners, uint256[] amounts);
    event Withdraw(address indexed winner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _abtToken) {
        owner = msg.sender;
        abtToken = _abtToken;
    }

    function enter(uint256 amount) external {
        require(!winnersSet, "Game ended");
        require(amount == 100 * 1e18, "Must send exactly 100 ABT");
        require(IERC20(abtToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        totalPool += amount;
        entrants.push(msg.sender);
        emit Enter(msg.sender, amount);
    }

    function setWinners(address[] calldata winnerAddresses, uint256[] calldata amounts) external onlyOwner {
        require(!winnersSet, "Winners already set");
        require(winnerAddresses.length == amounts.length, "Mismatched arrays");
        uint256 sum;
        for (uint256 i = 0; i < winnerAddresses.length; i++) {
            winnings[winnerAddresses[i]] = amounts[i];
            sum += amounts[i];
        }
        require(sum == totalPool, "Payouts must sum to total pool");
        winnersSet = true;
        emit WinnersSet(winnerAddresses, amounts);
    }

    function withdraw() external {
        require(winnersSet, "Winners not set");
        require(winnings[msg.sender] > 0, "No winnings");
        require(!withdrawn[msg.sender], "Already withdrawn");
        uint256 amount = winnings[msg.sender];
        withdrawn[msg.sender] = true;
        require(IERC20(abtToken).transfer(msg.sender, amount), "Withdraw failed");
        emit Withdraw(msg.sender, amount);
    }

    // For future: add bridge hooks for cross-chain payout
} 