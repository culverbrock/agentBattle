# Claim Architecture Design

## Overview
- The prize pool consists of entry fees collected from both ABT and SPL tokens, stored on-chain or off-chain depending on the currency.
- When a game ends and a proposal wins (≥61% of votes), the backend records the payout breakdown for each player according to the winning proposal's distribution.
- **No auto-distribution:** Winnings are marked as claimable, not immediately paid out.
- Players can claim their winnings at their convenience via a dedicated UI.

## User Requirements & Intent
> The prize pool is wherever we put the entry fees, idk but we are collecting entry fees from both abt and spl and doing somerthing with them, im thinking we have a claim button on the main lobby and it can show all the winnings and has the ability to claim there, or maybe it should even be a new page similar to how leaderboard works

## Backend
- On game end, record the payout breakdown for each player in a new `winnings` table (or similar), including:
  - gameId, playerId, amount, currency, claimed (bool), timestamp
- Add endpoint: `GET /api/winnings/:playerId` to fetch all claimable winnings for a player
- Add endpoint: `POST /api/claim` to process a claim:
  - Verifies user/wallet
  - Checks claimable winnings
  - Triggers payout (on-chain for ABT/SPL, or off-chain transfer)
  - Marks winnings as claimed

## Frontend
- Add a new "Claim Winnings" page or section (in lobby or as a separate page)
- Show all claimable winnings for the logged-in player:
  - Game ID, date, prize pool, their share, currency, claim status
  - "Claim" button for each
- When "Claim" is clicked, call backend to process the claim

## Smart Contract/Wallet Integration
- For ABT/SPL, call the appropriate contract's payout/withdraw/transfer function
- For off-chain, trigger the transfer via backend wallet

## Advantages
- Security: No auto-payouts; users must claim, reducing risk of failed or unwanted transfers
- Transparency: Players can see all their winnings in one place
- Flexibility: Works for both on-chain and off-chain prize pools

## Next Steps
1. Backend: Implement payout recording and claim endpoints
2. Frontend: Build Claim Winnings UI
3. Integrate with smart contracts or custodial wallet as needed 