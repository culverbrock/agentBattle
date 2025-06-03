const fetch = require('node-fetch');
const { ethers } = require('ethers');
const { saveGameState, loadGameState } = require('./gameStatePersistence');
const { agentPhaseHandler } = require('./api/gameState');
const { createGameStateMachine } = require('./gameStateMachine');
const pool = require('./database');

const API = 'http://localhost:3000/api';

// Use two test ETH private keys (Sepolia or local fork)
const wallets = [
  new ethers.Wallet('0x59c6995e998f97a5a0044966f094538e8b8b3e1c7e43c3c3b6c7c3c3c3c3c3c3'), // Example key 1
  new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d2b2d6e6b8c6c6c6c6c6c6c6c6c6c6c6c6c6c6c')  // Example key 2
];

// Helper to strip extra keys for state machine context
function getStateMachineContext(state) {
  const {
    phase, round, maxRounds, players, eliminated, strategyMessages,
    negotiationHistory, proposals, votes, speakingOrder, currentSpeakerIdx
  } = state;
  return {
    phase, round, maxRounds, players, eliminated, strategyMessages,
    negotiationHistory, proposals, votes, speakingOrder, currentSpeakerIdx
  };
}

async function main() {
  // 1. Create game
  let res = await fetch(`${API}/games`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Game' }) });
  let game = await res.json();
  const gameId = game.id;
  console.log('Created game:', gameId);

  // 2. Add two players
  for (let i = 0; i < 2; i++) {
    await fetch(`${API}/games/${gameId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: wallets[i].address }) });
  }
  console.log('Added players', wallets[0].address, 'and', wallets[1].address);

  // 3. Submit strategies (mark ready) with signature
  for (let i = 0; i < 2; i++) {
    const playerId = wallets[i].address;
    const strategy = 'test';
    const message = `Ready for game: ${gameId}`;
    const signature = await wallets[i].signMessage(message);
    await fetch(`${API}/game-state/${gameId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, strategy, message, signature, walletType: 'eth' })
    });
  }
  console.log('Both players submitted strategies with signatures');

  // 4. Start game
  await fetch(`${API}/game-state/${gameId}/start`, { method: 'POST' });
  console.log('Game started');

  // 5. Fetch and print state
  res = await fetch(`${API}/game-state/${gameId}`);
  let state = await res.json();
  console.log('Game state after start:', state.state.phase, '| Round:', state.state.round);
  console.log('Full state:', JSON.stringify(state.state, null, 2));
}

async function quickTest() {
  // Insert dummy game row for FK constraint
  let gameId = '11111111-1111-1111-1111-111111111111';
  await pool.query(`INSERT INTO games (id, name, status) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [gameId, 'Test Game', 'active']);
  let prizePool = { total: 100, currency: 'DEBUG' };
  let state = {
    phase: 'lobby',
    round: 0,
    maxRounds: 2,
    players: [
      { id: 'p1', name: 'A', ready: false, agent: { type: 'llm', strategy: 'aggressive' } },
      { id: 'p2', name: 'B', ready: false, agent: { type: 'llm', strategy: 'cooperative' } }
    ],
    eliminated: [],
    strategyMessages: {},
    negotiationHistory: [],
    proposals: [],
    votes: [],
    speakingOrder: ['p1', 'p2'],
    currentSpeakerIdx: 0,
  };
  // Attach gameId and prizePool for agentPhaseHandler, but do NOT pass to state machine
  state.gameId = gameId;
  state.prizePool = prizePool;

  // 2. Simulate PLAYER_READY for each player
  let machine = createGameStateMachine(getStateMachineContext(state));
  let currentState = machine.initialState;
  for (const player of state.players) {
    const nextState = machine.transition(currentState, { type: 'PLAYER_READY', playerId: player.id, strategy: player.agent.strategy });
    state = { ...nextState.context, gameId, prizePool };
    currentState = nextState;
    machine = createGameStateMachine(getStateMachineContext(state));
  }
  // 3. Trigger START_GAME
  let nextState = machine.transition(currentState, { type: 'START_GAME' });
  state = { ...nextState.context, gameId, prizePool };
  currentState = nextState;
  machine = createGameStateMachine(getStateMachineContext(state));

  // 4. Simulate SUBMIT_STRATEGY for each player
  for (const player of state.players) {
    nextState = machine.transition(currentState, { type: 'SUBMIT_STRATEGY', playerId: player.id, message: player.agent.strategy });
    state = { ...nextState.context, gameId, prizePool };
    currentState = nextState;
    machine = createGameStateMachine(getStateMachineContext(state));
  }
  // Set ready: true for all players before triggering ALL_STRATEGIES_SUBMITTED
  state.players = state.players.map(p => ({ ...p, ready: true }));
  // 5. Trigger ALL_STRATEGIES_SUBMITTED to move to negotiation phase
  nextState = machine.transition(currentState, { type: 'ALL_STRATEGIES_SUBMITTED' });
  state = { ...nextState.context, gameId, prizePool };
  currentState = nextState;
  machine = createGameStateMachine(getStateMachineContext(state));
  await saveGameState(state.gameId, state);

  // 6. Run through phases
  for (let i = 0; i < 10; i++) {
    console.log(`\n[TEST] Step ${i}, phase: ${state.phase}`);
    state = await agentPhaseHandler(state.gameId, state);
    await saveGameState(state.gameId, state);
    if (state.phase === 'endgame' || state.phase === 'end') {
      console.log('[TEST] Game ended.');
      break;
    }
  }
  console.log('[TEST] Final state:', state);
}

if (require.main === module) {
  quickTest();
}
// main(); // Remove or comment out this line to avoid API errors 