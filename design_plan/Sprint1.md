# Sprint 1: Foundation Setup

**Goal**: Establish the foundational components necessary for the game's architecture.

#### Components

1. **GameStateManagement**
   - **What**: A comprehensive system to manage the overall state of the game, ensuring smooth transitions between different phases and maintaining the integrity of game operations.
   - **Why**: To provide a structured approach to game progression, ensuring that each phase of the game is executed in a controlled and predictable manner, which is crucial for maintaining game balance and player engagement.
   - **How**:
     - **Game State Machine**: 
       - **Definition**: A finite state machine (FSM) is a model of computation used to design both computer programs and sequential logic circuits. It is a behavior model composed of a finite number of states, transitions between those states, and actions.
       - **Implementation**: Use a state machine library or framework to define states such as 'Lobby', 'Active Game', 'Proposal', and 'Voting'. Transitions between these states are triggered by game events (e.g., all players joined, proposal submitted).
       - **Example**: When all players have joined, the state transitions from 'Lobby' to 'Active Game'. During the 'Active Game' state, players can submit proposals, which transitions the state to 'Proposal'.
     - **Round State Tracking**:
       - **Definition**: The process of monitoring and recording the progress of rounds within a game phase.
       - **Implementation**: Maintain a counter for the current round and a log of completed rounds. This helps in managing the flow of the game and ensuring that each round is executed correctly.
       - **Example**: In the 'Active Game' state, track each player's turn and ensure that all players have had their turn before moving to the next round.
     - **Player State Management**:
       - **Definition**: The management of each player's status and actions within the game.
       - **Implementation**: Use a player state object to track each player's connection status (e.g., connected, disconnected), activity (e.g., active, idle), and actions (e.g., submitted proposal, voted).
       - **Example**: If a player disconnects, update their status to 'disconnected' and notify other players. If a player submits a proposal, update their action status and proceed with the game logic.
     - **Proposal State Management**:
       - **Definition**: The process of tracking and managing proposals made by players during the game.
       - **Implementation**: Store proposals in a proposal queue or list, with each proposal having a status (e.g., pending, accepted, rejected). This allows for efficient management and retrieval of proposals during the game.
       - **Example**: When a proposal is submitted, add it to the proposal list with a 'pending' status. Once reviewed, update the status to 'accepted' or 'rejected' based on the outcome.

2. **DatabaseSchema**
   - **What**: A structured database to store all game-related data.
   - **Why**: To efficiently manage and retrieve data necessary for game operations and player interactions.
   - **How**:
     - **Database Choice**: Use a relational database like PostgreSQL for its robustness, support for complex queries, and data integrity features.
     - **Table Structure**:
       - **Games Table**: Stores game metadata, current state, and configuration.
         - Columns: `game_id`, `state`, `current_round`, `created_at`, `updated_at`
       - **Players Table**: Stores player information and their status in the game.
         - Columns: `player_id`, `game_id`, `status`, `joined_at`, `last_action_at`
       - **Messages Table**: Stores messages exchanged during the game.
         - Columns: `message_id`, `game_id`, `player_id`, `content`, `timestamp`
       - **Proposals Table**: Stores proposals made by players.
         - Columns: `proposal_id`, `game_id`, `player_id`, `content`, `status`, `created_at`
       - **Votes Table**: Stores votes cast by players on proposals.
         - Columns: `vote_id`, `proposal_id`, `player_id`, `votes_cast`, `timestamp`
       - **Strategies Table**: Stores initial and updated strategies for AI agents.
         - Columns: `strategy_id`, `player_id`, `game_id`, `content`, `created_at`
       - **Transactions Table**: Stores financial transactions related to entrance fees and prize distribution.
         - Columns: `transaction_id`, `game_id`, `player_id`, `amount`, `status`, `timestamp`

#### Deliverables
- A functioning game state management system with clear state transitions.
- A fully configured PostgreSQL database with the specified table structure.

#### Testing
- Verify that the game state transitions correctly through different phases.
- Ensure data is stored and retrieved accurately from the database, with integrity constraints enforced. 