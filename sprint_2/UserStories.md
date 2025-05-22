# Sprint 2: User Interaction & On-Chain Prize Pool Integration

## User Story 1: Real-Time Game Lobby
- **Description**: As a player, I want to create and join games via a real-time lobby UI, so I can participate in multiplayer games.
- **Tasks**:
  - Frontend: Build lobby page with "Create Game" and "Join Game" forms.
  - Backend: Use `/api/games` and `/api/games/[gameId]/join` endpoints from Sprint 1.
  - Real-time: Implement WebSocket server for lobby/player list changes.
  - Tests: Simulate multiple players joining/leaving, verify lobby state updates.
- **Acceptance Criteria**:
  - Players can create and join games via the lobby UI.
  - Lobby updates in real-time for all connected clients.

## User Story 2: Wallet & On-Chain Prize Pool Integration
- **Description**: As a player, I want to connect my MetaMask wallet, pay an entrance fee using a custom ERC-20 token, and see the prize pool grow on-chain.
- **Tasks**:
  - Deploy a custom ERC-20 token contract to Ethereum testnet (e.g., Goerli/Sepolia).
  - Deploy a PrizePool smart contract to manage entrance fees and claims.
  - Frontend: Integrate MetaMask for wallet connection, show wallet address and token balance.
  - Frontend: UI for approving and sending entrance fee (ERC-20 transfer to PrizePool contract).
  - Backend: Track on-chain transactions and update DB (e.g., `/api/games/[gameId]/enter`).
  - Backend: Store contract addresses and transaction hashes in DB.
  - Tests: Verify token transfer, pool balance, and DB sync.
- **Acceptance Criteria**:
  - Players can connect MetaMask and see their token balance.
  - Players can pay entrance fee (ERC-20 transfer) to join a game.
  - Prize pool contract balance updates on-chain and in backend.

## User Story 3: Prize Pool Claiming
- **Description**: As a winner, I want to claim my share of the prize pool after the game ends, using an on-chain claim function.
- **Tasks**:
  - PrizePool contract: Implement claim function (verifies winner, sends tokens).
  - Backend: `/api/games/[gameId]/claim` endpoint to verify eligibility and trigger contract claim.
  - Frontend: "Claim Winnings" button for eligible players, triggers contract call via MetaMask.
  - Backend: Mark claims as processed, prevent double-claim.
  - Tests: Only winners can claim, pool is distributed correctly, DB and contract state match.
- **Acceptance Criteria**:
  - Only eligible winners can claim from the contract.
  - Claims are processed on-chain and reflected in backend.

## User Story 4: Real-Time Updates for Lobby, Pool, and Claims
- **Description**: As a player, I want to see real-time updates for lobby, prize pool, and claim status.
- **Tasks**:
  - WebSocket server: Broadcast lobby/player/pool/claim events.
  - Frontend: Subscribe and update UI in real-time.
  - Backend: Sync on-chain events (e.g., Transfer, Claim) to DB and broadcast.
  - Tests: Simulate events, verify UI and backend state.
- **Acceptance Criteria**:
  - All relevant state changes are reflected in real-time for all clients.

## Deliverables
- Custom ERC-20 token contract deployed to testnet (address documented).
- PrizePool contract deployed to testnet (address documented).
- Scripts for contract deployment and test token minting.
- Frontend lobby and wallet UI, integrated with MetaMask.
- Backend endpoints for game, entrance, and claim flows, integrated with on-chain contracts.
- WebSocket server for real-time updates.
- End-to-end tests for wallet, pool, and claim flows.

## Testing
- Use Ethereum testnet (Goerli/Sepolia) for all on-chain interactions.
- Automated tests for:
  - Game creation/joining (UI and API)
  - Wallet connection and token transfer
  - Prize pool contract balance and claims
  - Real-time updates
  - Security and correctness of all transactions 