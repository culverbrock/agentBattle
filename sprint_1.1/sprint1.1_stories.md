# Sprint 1.1: Modernize API, DB, and Real-Time Integration

## Overview
Sprint 1.1 focuses on replacing the backend API and DB integration, using WebSockets for real-time features, and ensuring the frontend can interact with the backend smoothly. The goal is to deploy the backend on a platform that supports persistent connections (e.g., Railway, Fly.io, Render), use Neon or another Postgres provider, and provide robust, frontend-friendly endpoints.

---

## Goals
- Replace/upgrade backend API and DB integration for reliability and scalability.
- Use WebSockets for real-time features (lobby/game updates).
- Ensure all endpoints are robust and frontend-friendly.
- Provide clear, testable API contracts for the frontend.

---

## User Stories & Detailed Steps

### **Story 1: Backend Hosting Migration**
**As a** developer,
**I want** to deploy the backend to a platform that supports persistent Postgres connections,
**so that** the API is reliable and scalable.

#### Steps:
- [ ] Choose a hosting platform (Railway, Fly.io, Render)
- [ ] Create an account and new project
- [ ] Link your GitHub repo or push code
- [ ] Set up environment variables for DB connection
- [ ] Deploy the backend and verify deployment
- [ ] Update backend API URL for frontend use

### **Story 2: Database Integration Update**
**As a** developer,
**I want** the backend to connect to Neon (or another Postgres) with the correct host, port, and SSL,
**so that** all DB operations are reliable.

#### Steps:
- [ ] Create a new Neon (or other) Postgres database if needed
- [ ] Copy connection details (host, port, user, password, db)
- [ ] Update `.env` and platform environment variables
- [ ] Update `knexfile.js` for SSL and correct port
- [ ] Run migrations on the new database
- [ ] Test DB connection locally and on the deployed backend
- [ ] (Optional) Migrate existing data if needed

### **Story 3: REST API Refactor**
**As a** frontend developer,
**I want** robust REST endpoints for all game actions,
**so that** the frontend can interact with the backend easily.

#### Steps:
- [ ] Review and refactor existing API endpoints
- [ ] Implement endpoints for:
  - [ ] Create game
  - [ ] Join game
  - [ ] Leave game
  - [ ] Submit proposal
  - [ ] Vote
  - [ ] Fetch lobby state
  - [ ] Fetch game state
- [ ] Ensure all endpoints return clear, consistent JSON
- [ ] Add error handling and validation
- [ ] Write tests for each endpoint
- [ ] Document API routes and request/response formats

### **Story 4: WebSocket Real-Time Updates**
**As a** player,
**I want** to see real-time updates in the lobby and game,
**so that** I am always aware of the current state.

#### Steps:
- [ ] Choose a WebSocket library (`ws`, `socket.io`, etc.)
- [ ] Implement WebSocket server in backend
- [ ] Define WS events for:
  - [ ] Lobby updates
  - [ ] Game state changes
  - [ ] Player join/leave
  - [ ] Proposal/vote updates
- [ ] Broadcast updates to connected clients
- [ ] Add fallback polling logic for environments without WS
- [ ] Test real-time updates with multiple clients
- [ ] Document WS event contracts

### **Story 5: Frontend API Client Update**
**As a** frontend developer,
**I want** the frontend to use the new API and WebSocket endpoints,
**so that** the UI is always in sync with the backend.

#### Steps:
- [ ] Update API client to use new backend URL
- [ ] Add WebSocket client logic
- [ ] Handle WS events and update UI in real-time
- [ ] Implement polling fallback if WS fails
- [ ] Handle API/WS errors gracefully
- [ ] Test all flows (create/join/leave game, proposals, votes, etc.)
- [ ] Ensure SPA routing and refreshes work
- [ ] Update environment variable usage (`VITE_API_URL`, `VITE_WS_URL`)

### **Story 6: Documentation & DevOps**
**As a** developer,
**I want** clear documentation and setup instructions,
**so that** anyone can run, test, and deploy the project.

#### Steps:
- [ ] Update README with new setup and deployment instructions
- [ ] Provide example `.env` files for local and production
- [ ] Document all API endpoints and WS events
- [ ] Add troubleshooting and FAQ section
- [ ] Document migration and seeding process
- [ ] Ensure CI/CD pipeline is updated for new platform

---

## Notes
- Prioritize backend migration and DB integration first.
- Implement WebSocket server and REST endpoints in parallel.
- Update frontend integration and test all flows.
- Document everything for future contributors. 