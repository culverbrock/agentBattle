# Sprint 1: User Stories

## User Story 1: Implement Game State Machine
- **Description**: As a developer, I want to implement a finite state machine to manage game phases, so that the game progresses smoothly through different states.
- **Tasks**:
  - Define states: Lobby, Active Game, Proposal, Voting.
    - **Subtasks**:
      - Research state machine libraries or frameworks.
      - Design state diagrams for each phase.
      - Implement state transitions in code.
  - Implement transitions between states based on game events.
    - **Subtasks**:
      - Identify key game events that trigger state changes.
      - Write unit tests for state transitions.
- **Acceptance Criteria**:
  - The game transitions correctly between states based on predefined events.
  - State transitions are logged for debugging purposes.

## User Story 2: Develop Round State Tracking
- **Description**: As a developer, I want to track the progress of rounds within a game phase, so that each round is executed correctly.
- **Tasks**:
  - Implement a counter for the current round.
    - **Subtasks**:
      - Initialize round counter at the start of each phase.
      - Update counter at the end of each round.
  - Log completed rounds for reference.
    - **Subtasks**:
      - Create a logging mechanism for round completion.
      - Store round logs in the database.
- **Acceptance Criteria**:
  - The current round is accurately tracked and updated.
  - Completed rounds are logged and accessible.

## User Story 3: Implement Player State Management
- **Description**: As a developer, I want to manage each player's status and actions, so that player interactions are accurately reflected in the game.
- **Tasks**:
  - Track player connection status and activity.
    - **Subtasks**:
      - Implement a heartbeat mechanism to monitor connections.
      - Update player status based on connection activity.
  - Update player actions (e.g., submitted proposal, voted).
    - **Subtasks**:
      - Create an action log for player activities.
      - Integrate action updates with the game state.
- **Acceptance Criteria**:
  - Player statuses are updated in real-time.
  - Player actions are logged and retrievable.

## User Story 4: Set Up Proposal State Management
- **Description**: As a developer, I want to track proposals made by players, so that proposals are managed efficiently during the game.
- **Tasks**:
  - Store proposals with status (e.g., pending, accepted, rejected).
    - **Subtasks**:
      - Design a data model for proposals.
      - Implement CRUD operations for proposal management.
  - Implement a proposal queue or list.
    - **Subtasks**:
      - Develop a queue system for proposal processing.
      - Ensure proposals are processed in order.
- **Acceptance Criteria**:
  - Proposals are stored and updated correctly.
  - Proposal statuses are accurately reflected.

## User Story 5: Configure Database Schema
- **Description**: As a developer, I want to set up a PostgreSQL database, so that game data is stored and retrieved efficiently.
- **Tasks**:
  - Create tables for games, players, messages, proposals, votes, strategies, and transactions.
    - **Subtasks**:
      - Define table schemas and relationships.
      - Write SQL scripts to create tables.
  - Ensure data integrity and relationships between tables.
    - **Subtasks**:
      - Implement foreign key constraints.
      - Test data insertion and retrieval for consistency.
- **Acceptance Criteria**:
  - The database schema is set up and accessible.
  - Data is stored and retrieved accurately.

## User Story 6: Integrate State Machine with Database
- **Description**: As a developer, I want the game state machine to persist and fetch state from the database, so that game progress is durable and recoverable.
- **Tasks**:
  - On proposal submission, create a proposal in the DB.
  - On player join/leave, update player state in the DB.
  - On state machine startup, fetch current state from the DB if available.
- **Acceptance Criteria**:
  - State machine actions are reflected in the DB.
  - State can be restored from the DB after a restart.

## User Story 7: Implement Game API Endpoints
- **Description**: As a developer, I want REST (or WebSocket) endpoints for core game actions, so that clients can interact with the game.
- **Tasks**:
  - Endpoint to create/join a game.
  - Endpoint to submit a proposal.
  - Endpoint to vote.
  - Endpoint to fetch game/player/proposal state.
- **Acceptance Criteria**:
  - Endpoints are documented and tested.
  - Endpoints interact with the state machine and DB.

## User Story 8: Implement Message/Event Logging
- **Description**: As a developer, I want to log all game events/messages to the database, so that I can audit or replay game history.
- **Tasks**:
  - Create a `messages` or `events` table.
  - Log all significant game events (state transitions, proposals, votes, etc.).
  - Provide an endpoint to fetch event history.
- **Acceptance Criteria**:
  - All events are logged with timestamp and relevant data.
  - Event history can be queried.

## User Story 9: Integration Test Coverage
- **Description**: As a developer, I want integration tests that cover the full flow from API to state machine to DB, so that I can be confident the system works end-to-end.
- **Tasks**:
  - Write integration tests for a full game round (join, propose, vote, complete round).
  - Test DB state and API responses.
- **Acceptance Criteria**:
  - Integration tests pass and cover all major flows. 