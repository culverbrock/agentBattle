# Project Dependencies

## Production Dependencies

- **express**: Web server for API endpoints
- **knex**: SQL query builder and migration tool
- **pg**: PostgreSQL client for Node.js
- **dotenv**: Loads environment variables from .env files
- **uuid**: Generates unique IDs (used for game IDs, etc.)
- **xstate**: State machine library for game logic
- **ws**: WebSocket server for real-time communication (used for lobby/player updates in Sprint 2)

## Development Dependencies

- **jest**: Testing framework for unit and integration tests

## How dependencies are managed
- All dependencies are listed in `package.json` and installed via `npm install`.
- To install all dependencies, run:
  ```sh
  npm install
  ```
- To see all installed packages, run:
  ```sh
  npm ls --depth=0
  ``` 