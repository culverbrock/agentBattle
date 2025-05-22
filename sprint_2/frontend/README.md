# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Real-Time Lobby UI (Frontend)

## Features
- Create Game form/button
- Join Game form/button (with game list)
- Real-time list of available games and players
- WebSocket client for live lobby updates
- Connects to backend endpoints:
  - POST /games (create game)
  - POST /games/:gameId/join (join game)
  - POST /games/:gameId/leave (leave game)
  - GET /games/lobby (fetch lobby state)
- Uses WebSocket for real-time lobby updates

## Tech Stack
- React (with hooks)
- Vite
- WebSocket API (native)
- Fetch API for REST calls

## Setup
```sh
npm install
npm run dev
```

## Next Steps
- Implement LobbyPage component
- Add WebSocket client logic
- Connect forms to backend

## Deployment (Vercel)
1. Push this folder to a Git repository (GitHub, GitLab, etc.).
2. Connect the repo to Vercel (https://vercel.com/new).
3. Set the following environment variables in the Vercel dashboard:
   - `VITE_API_URL` (e.g., https://your-backend.vercel.app)
   - `VITE_WS_URL` (e.g., wss://your-backend.vercel.app)
4. Vercel will auto-detect the build (`npm run build`) and output (`dist`).
5. Make sure your backend is also deployed and accessible from the frontend.
