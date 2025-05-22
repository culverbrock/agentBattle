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