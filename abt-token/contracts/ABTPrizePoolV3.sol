// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title ABTPrizePoolV3
 * @dev Multi-game prize pool for Agent Battle. Owner can set winners for each game. Players withdraw per game.
 */
contract ABTPrizePoolV3 is Ownable {
    address public abtToken;
    // gameId => player => amount
    mapping(bytes32 => mapping(address => uint256)) public winnings;
    // gameId => player => withdrawn
    mapping(bytes32 => mapping(address => bool)) public withdrawn;
    // gameId => winners set
    mapping(bytes32 => bool) public winnersSet;

    event SetWinners(bytes32 indexed gameId, address[] winners, uint256[] amounts);
    event Withdraw(bytes32 indexed gameId, address indexed winner, uint256 amount);

    constructor(address _abtToken) {
        abtToken = _abtToken;
    }

    /**
     * @dev Set winners for a game. Can only be called once per gameId.
     * @param gameId The unique game identifier (bytes32, e.g. keccak256 or uuid as bytes32)
     * @param winnerAddresses Array of winner addresses
     * @param amounts Array of payout amounts (same length as winnerAddresses)
     */
    function setWinners(bytes32 gameId, address[] calldata winnerAddresses, uint256[] calldata amounts) external onlyOwner {
        require(!winnersSet[gameId], "Winners already set for this game");
        require(winnerAddresses.length == amounts.length, "Mismatched arrays");
        for (uint256 i = 0; i < winnerAddresses.length; i++) {
            winnings[gameId][winnerAddresses[i]] = amounts[i];
        }
        winnersSet[gameId] = true;
        emit SetWinners(gameId, winnerAddresses, amounts);
    }

    /**
     * @dev Withdraw winnings for a specific game.
     * @param gameId The game identifier
     */
    function withdraw(bytes32 gameId) external {
        require(winnersSet[gameId], "Winners not set for this game");
        require(winnings[gameId][msg.sender] > 0, "No winnings");
        require(!withdrawn[gameId][msg.sender], "Already withdrawn");
        uint256 amount = winnings[gameId][msg.sender];
        withdrawn[gameId][msg.sender] = true;
        require(IERC20(abtToken).transfer(msg.sender, amount), "Withdraw failed");
        emit Withdraw(gameId, msg.sender, amount);
    }

    // For future: add bridge hooks for cross-chain payout
} 