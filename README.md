# Backend Deployment Guide

## Deployment Options

### 1. Vercel (Serverless Functions)
- Move your API endpoints to the `/api` directory as serverless functions (see Vercel docs).
- WebSocket support is limited on Vercel; for real-time features, use Railway, Fly.io, or a dedicated VPS.
- Set environment variables (DB connection, etc.) in the Vercel dashboard.

### 2. Railway (Recommended for WebSockets)
- Deploy your Express app directly (no serverless conversion needed).
- WebSocket support is native.
- Set environment variables in the Railway dashboard.
- Point your frontend's `VITE_API_URL` and `VITE_WS_URL` to your Railway backend URL.

### 3. Other Hosts (Fly.io, Heroku, VPS, etc.)
- Any host that supports Node.js and WebSockets will work.
- Set environment variables as needed.

## Environment Variables
- `DATABASE_URL` or individual DB config vars
- Any other secrets (JWT, etc.)

## Notes
- Make sure your backend is accessible from your frontend (CORS, network, etc.).
- For production, use HTTPS and WSS for WebSocket URLs.

## Quick Start
1. Deploy backend to Railway (or your preferred host).
2. Set environment variables.
3. Deploy frontend to Vercel, set `VITE_API_URL` and `VITE_WS_URL` to backend URLs.
4. Test full flow: create/join/leave game, real-time updates.

# Agent Battle Prize Pool Setup

## Ethereum (Sepolia, ABT ERC-20)

1. Deploy the ABTPrizePool contract:
   - Contract address: 0x94Aba2204C686f41a1fC7dd5DBaA56172844593a
   - ABT token address: 0x799b7b7cC889449952283CF23a15956920E7f85B
   - Set your Sepolia RPC and deployer key in `.env` as `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY`

2. Players must approve and call `enter(100e18)` to join.
3. After the game, backend calls `setWinner(winnerAddress)`.
4. Winner calls `withdraw()` to claim the prize.

## Solana (Devnet, SPL Token)

1. Prize pool wallet: 6y1zGrQnVwGpkBF9KttimW9skiG5yfnXWso3XCEvEury
2. Prize pool token account: AhKmoZR7KHQzUYpV9WEAR8FBLi4SxXAAcMSfYTPnH4he
3. SPL mint address: 7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb
4. Players send 100 SPL to this token account to join.
5. After the game, backend signs a transfer of the pool to the winner.

## Next Steps
- Deploy the Ethereum contract and create the Solana wallet/token account.
- Paste the addresses into plan.txt and configs.
- Let the assistant know when done to wire up the frontend/backend for on-chain entrance fees.

See plan.txt for full checklist and integration steps. 