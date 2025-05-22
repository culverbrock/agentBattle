# Sprint 2 Frontend: Real-Time Lobby UI

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
- WebSocket API (native or with a helper lib)
- Fetch API for REST calls

## Setup Plan
1. Scaffold React app in `sprint_2/frontend/`
2. Implement lobby page with forms and real-time updates
3. Connect to backend REST and WebSocket endpoints
4. Test with running backend 