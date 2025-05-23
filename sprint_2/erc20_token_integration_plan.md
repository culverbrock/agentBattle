# ERC-20 Token (ABT) Integration Plan

## A. Token Deployment (One-Time Setup)

1. **Create and deploy the ABT ERC-20 token contract**
   - Use Hardhat + OpenZeppelin (see contract code below).
   - Deploy to Goerli or Sepolia testnet.
   - Save the contract address.

## B. Frontend Integration

### 1. Add "Add ABT to Wallet" Button
- Use `wallet_watchAsset` for MetaMask.
- When clicked, prompt the wallet to add the ABT token.

### 2. Show ABT Balance
- Read the ABT token balance for the connected wallet.
- Display it in the lobby UI.

### 3. Deduct ABT on Join
- When a user clicks "Join", call the ABT contract's `transfer` (or `transferFrom` if using an allowance/PrizePool).
- Only allow joining if the user has enough ABT.
- Show a transaction confirmation in the wallet.

## C. Backend/PrizePool (Optional, for real escrow)
- Deploy a PrizePool contract to hold entrance fees.
- On join, transfer ABT to the PrizePool contract.
- Track who has paid in your DB.

## D. UI/UX
- Show "Add ABT to Wallet" button.
- Show ABT balance.
- Show "Pay Entrance Fee" or "Join" button (disabled if not enough ABT).
- Show transaction status/errors.

## E. Step-by-Step Implementation

### 1. Generate/Deploy Token Contract
- Use Hardhat or Remix to deploy the contract below:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AgentBattleToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("AgentBattleToken", "ABT") {
        _mint(msg.sender, initialSupply * (10 ** decimals()));
    }
}
```

### 2. Frontend: Add Token to Wallet
- Add a button that calls `wallet_watchAsset` for MetaMask.
- For Phantom, this is not supported for ERC-20 (EVM only).

### 3. Frontend: Show ABT Balance
- Use ethers.js/web3.js to read the balance:

```js
import { ethers } from 'ethers';
const provider = new ethers.providers.Web3Provider(window.ethereum);
const token = new ethers.Contract('YOUR_ABT_CONTRACT_ADDRESS', ERC20_ABI, provider);
const balance = await token.balanceOf(userAddress);
```

### 4. Frontend: Deduct ABT on Join
- On join, call `token.transfer(prizePoolAddress, amount)` or `token.transferFrom(user, prizePool, amount)` if using allowance.
- Wait for transaction confirmation before allowing join.

---

**Follow this plan to enable ABT token integration, wallet add, balance display, and deduction on join!** 