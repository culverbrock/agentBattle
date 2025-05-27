const express = require('express');
const router = express.Router();
const { saveGameState, loadGameState } = require('../gameStatePersistence');
const createGameStateMachine = require('../gameStateMachine');
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { broadcastGameEvent, broadcastGameRoomState } = require('../gameRoomWebSocketServer');
const agentInvoker = require('../agentInvoker');
const eventLogger = require('../eventLogger');
const { State } = require('xstate');

// In-memory cache for active state machines (for demo/dev)
const machines = {};

function getOrCreateMachine(gameId) {
  if (!machines[gameId]) {
    machines[gameId] = createGameStateMachine();
  }
  return machines[gameId];
}

// Create a new game
router.post('/create', async (req, res) => {
  const gameId = uuidv4();
  const machine = createGameStateMachine({ gameId });
  await saveGameState(gameId, machine.context);
  machines[gameId] = machine;
  res.json({ gameId, state: machine.context });
});

// Get current game state
router.get('/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  // Add 'ready' property to each player
  if (state.players && state.strategyMessages) {
    state.players = state.players.map(p => ({
      ...p,
      ready: !!state.strategyMessages[p.id]
    }));
  }
  res.json({ gameId, state });
});

// Helper: Auto-submit default strategy for disconnected players
async function autoSubmitDefaultStrategies(gameId, state) {
  const round = state.round;
  const players = state.players || [];
  const eliminated = state.eliminated || [];
  const strategyMessages = state.strategyMessages || {};
  let updated = false;
  let machine = createGameStateMachine(state);
  for (const p of players) {
    if (
      !eliminated.includes(p.id) &&
      p.status === 'disconnected' &&
      !strategyMessages[p.id]
    ) {
      const nextState = machine.transition(machine.initialState, { type: 'SUBMIT_STRATEGY', playerId: p.id, message: 'default' });
      machine = machine.withContext(nextState.context);
      updated = true;
    }
  }
  if (updated) {
    await saveGameState(gameId, machine.context);
    broadcastGameEvent(gameId, { type: 'state_update', data: machine.context });
    return machine.context;
  }
  return state;
}

// Helper: Auto-speak for disconnected agent if it's their turn in negotiation
async function autoSpeakForDisconnectedAgent(gameId, state) {
  if (state.phase !== 'negotiation') return state;
  const players = state.players || [];
  const eliminated = state.eliminated || [];
  const speakingOrder = state.speakingOrder || [];
  const idx = state.currentSpeakerIdx || 0;
  const currentSpeakerId = speakingOrder[idx];
  const player = players.find(p => p.id === currentSpeakerId);
  if (!player || eliminated.includes(player.id) || player.status !== 'disconnected') return state;
  // Generate agent message
  const agent = player.agent || { strategy: 'default', type: 'default' };
  const message = agentInvoker.generateNegotiationMessage(state, agent);
  let machine = createGameStateMachine(state);
  const nextState = machine.transition(state, { type: 'SPEAK', playerId: player.id, message });
  machine = machine.withContext(nextState.context);
  await saveGameState(gameId, machine.context);
  broadcastGameEvent(gameId, { type: 'state_update', data: machine.context });
  // Recursively check if the next speaker is also disconnected
  return autoSpeakForDisconnectedAgent(gameId, machine.context);
}

// Helper: Agent-driven phase progression
async function agentPhaseHandler(gameId, state) {
  let machine = createGameStateMachine(state);
  let currentState = State.create({ value: state.phase, context: state, _event: { type: 'xstate.init' } });
  let context = state;
  // Negotiation phase: each player in speaking order speaks in turn
  if (context.phase === 'negotiation') {
    const players = context.players.filter(p => !context.eliminated.includes(p.id));
    let idx = context.currentSpeakerIdx || 0;
    while (idx < context.speakingOrder.length) {
      // Guard: break if phase is no longer negotiation
      if (context.phase !== 'negotiation') {
        console.log(`[AGENT] Breaking negotiation loop: phase is now ${context.phase}`);
        break;
      }
      const playerId = context.speakingOrder[idx];
      const player = players.find(p => p.id === playerId);
      console.log(`[AGENT] Negotiation phase, idx=${idx}, playerId=${playerId}, phase=${context.phase}`);
      if (player) {
        const agent = player.agent || { strategy: 'default', type: 'default' };
        let message;
        try {
          message = await agentInvoker.generateNegotiationMessage(context, agent);
        } catch (err) {
          console.error('Agent negotiation error:', err);
          message = `Agent (${agent.strategy || 'default'}): Let's cooperate for a fair split!`;
        }
        const nextState = machine.transition(currentState, { type: 'SPEAK', playerId, message });
        await eventLogger.logEvent({ gameId, playerId, type: 'negotiation', content: message });
        machine = machine.withContext(nextState.context);
        currentState = nextState;
        context = nextState.context;
        idx++;
      } else {
        idx++;
      }
    }
    await saveGameState(gameId, context);
    broadcastGameEvent(gameId, { type: 'state_update', data: context });
    return context;
  }
  // Proposal phase: each player submits a proposal
  if (context.phase === 'proposal') {
    const players = context.players.filter(p => !context.eliminated.includes(p.id));
    for (const player of players) {
      const agent = player.agent || { strategy: 'default', type: 'default' };
      let proposal;
      try {
        proposal = await agentInvoker.generateProposal(context, agent);
      } catch (err) {
        console.error('Agent proposal error:', err);
        proposal = { split: 'equal', details: 'Even split for all remaining players.' };
      }
      const nextState = machine.transition(machine.initialState, { type: 'SUBMIT_PROPOSAL', playerId: player.id, proposal });
      await eventLogger.logEvent({ gameId, playerId: player.id, type: 'proposal', content: JSON.stringify(proposal) });
      machine = machine.withContext(nextState.context);
      context = nextState.context;
    }
    await saveGameState(gameId, context);
    broadcastGameEvent(gameId, { type: 'state_update', data: context });
    return context;
  }
  // Voting phase: each player submits a vote
  if (context.phase === 'voting') {
    const players = context.players.filter(p => !context.eliminated.includes(p.id));
    for (const player of players) {
      const agent = player.agent || { strategy: 'default', type: 'default' };
      let votes;
      try {
        votes = await agentInvoker.generateVote(context, agent);
      } catch (err) {
        console.error('Agent vote error:', err);
        votes = { proposalIndex: 0 };
      }
      const nextState = machine.transition(machine.initialState, { type: 'SUBMIT_VOTE', playerId: player.id, votes });
      await eventLogger.logEvent({ gameId, playerId: player.id, type: 'vote', content: JSON.stringify(votes) });
      machine = machine.withContext(nextState.context);
      context = nextState.context;
    }
    await saveGameState(gameId, context);
    broadcastGameEvent(gameId, { type: 'state_update', data: context });
    return context;
  }
  // Elimination phase: each player submits an elimination vote
  if (context.phase === 'elimination') {
    const players = context.players.filter(p => !context.eliminated.includes(p.id));
    for (const player of players) {
      const agent = player.agent || { strategy: 'default', type: 'default' };
      let eliminatedId;
      try {
        eliminatedId = await agentInvoker.generateEliminationVote(context, agent, player.id);
      } catch (err) {
        console.error('Agent elimination error:', err);
        const candidates = (context.players || []).filter(p => !context.eliminated?.includes(p.id) && p.id !== player.id);
        eliminatedId = candidates.length > 0 ? candidates[0].id : null;
      }
      if (eliminatedId) {
        const nextState = machine.transition(machine.initialState, { type: 'ELIMINATE', eliminated: [eliminatedId] });
        await eventLogger.logEvent({ gameId, playerId: player.id, type: 'elimination', content: eliminatedId });
        machine = machine.withContext(nextState.context);
        context = nextState.context;
      }
    }
    await saveGameState(gameId, context);
    broadcastGameEvent(gameId, { type: 'state_update', data: context });
    return context;
  }
  // ...
  return context;
}

// Start game
router.post('/:gameId/start', async (req, res) => {
  const { gameId } = req.params;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  // --- PATCH: Ensure all players with a strategy are marked ready ---
  if (state.players && state.strategyMessages) {
    state.players = state.players.map(p =>
      state.strategyMessages[p.id] ? { ...p, ready: true } : p
    );
  }
  const machine = createGameStateMachine(state);
  let nextState = machine.transition(machine.initialState, { type: 'START_GAME' });
  let newContext = nextState.context;
  console.log(`[START_GAME] After START_GAME event, phase: ${newContext.phase}`);
  // If entering strategy phase, auto-submit for disconnected
  if (newContext.phase === 'strategy') {
    newContext = await autoSubmitDefaultStrategies(gameId, newContext);
    // If all players have a strategy, immediately transition to negotiation
    const allHaveStrategy = (newContext.players || []).every(p => newContext.strategyMessages && newContext.strategyMessages[p.id]);
    if (allHaveStrategy) {
      // Move directly to negotiation phase
      const order = (newContext.players || []).filter(p => !(newContext.eliminated || []).includes(p.id));
      newContext = {
        ...newContext,
        phase: 'negotiation',
        speakingOrder: order.map(p => p.id),
        currentSpeakerIdx: 0
      };
      // Immediately save and broadcast negotiation state
      await saveGameState(gameId, newContext);
      broadcastGameRoomState(gameId, newContext);
      machines[gameId] = createGameStateMachine(newContext);
      broadcastGameEvent(gameId, { type: 'state_update', data: newContext });
    }
  }
  console.log(`[START_GAME] Before agentPhaseHandler, phase: ${newContext.phase}`);
  newContext = await agentPhaseHandler(gameId, newContext);
  console.log(`[START_GAME] After agentPhaseHandler, phase: ${newContext.phase}`);
  await saveGameState(gameId, newContext);
  broadcastGameRoomState(gameId, newContext);
  machines[gameId] = machine.withContext(newContext);
  broadcastGameEvent(gameId, { type: 'state_update', data: newContext });
  res.json({ gameId, state: newContext });
});

// Speak (negotiation)
router.post('/:gameId/speak', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, message } = req.body;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const machine = createGameStateMachine(state);
  const nextState = machine.transition(machine.initialState, { type: 'SPEAK', playerId, message });
  let newContext = nextState.context;
  // If still in negotiation, check if next speaker is disconnected
  if (newContext.phase === 'negotiation') {
    newContext = await autoSpeakForDisconnectedAgent(gameId, newContext);
  }
  await saveGameState(gameId, newContext);
  machines[gameId] = machine.withContext(newContext);
  broadcastGameEvent(gameId, { type: 'state_update', data: newContext });
  res.json({ gameId, state: newContext });
});

// Submit proposal
router.post('/:gameId/proposal', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, proposal } = req.body;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const machine = createGameStateMachine(state);
  const nextState = machine.transition(machine.initialState, { type: 'SUBMIT_PROPOSAL', playerId, proposal });
  await saveGameState(gameId, nextState.context);
  machines[gameId] = machine.withContext(nextState.context);
  broadcastGameEvent(gameId, { type: 'proposal', data: { proposal, state: nextState.context } });
  res.json({ gameId, state: nextState.context });
});

// Submit vote
router.post('/:gameId/vote', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, votes } = req.body;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const machine = createGameStateMachine(state);
  const nextState = machine.transition(machine.initialState, { type: 'SUBMIT_VOTE', playerId, votes });
  await saveGameState(gameId, nextState.context);
  machines[gameId] = machine.withContext(nextState.context);
  broadcastGameEvent(gameId, { type: 'vote', data: { votes, state: nextState.context } });
  res.json({ gameId, state: nextState.context });
});

// Eliminate players
router.post('/:gameId/eliminate', async (req, res) => {
  const { gameId } = req.params;
  const { eliminated } = req.body;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const machine = createGameStateMachine(state);
  const nextState = machine.transition(machine.initialState, { type: 'ELIMINATE', eliminated });
  await saveGameState(gameId, nextState.context);
  machines[gameId] = machine.withContext(nextState.context);
  broadcastGameEvent(gameId, { type: 'elimination', data: { eliminated, state: nextState.context } });
  res.json({ gameId, state: nextState.context });
});

// Continue (next round or end)
router.post('/:gameId/continue', async (req, res) => {
  const { gameId } = req.params;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const machine = createGameStateMachine(state);
  const nextState = machine.transition(machine.initialState, { type: 'CONTINUE' });
  let newContext = nextState.context;
  // If entering strategy phase, auto-submit for disconnected
  if (newContext.phase === 'strategy') {
    newContext = await autoSubmitDefaultStrategies(gameId, newContext);
  }
  // Agent-driven phase progression
  newContext = await agentPhaseHandler(gameId, newContext);
  await saveGameState(gameId, newContext);
  machines[gameId] = machine.withContext(newContext);
  broadcastGameEvent(gameId, { type: 'state_update', data: newContext });
  res.json({ gameId, state: newContext });
});

// End game
router.post('/:gameId/end', async (req, res) => {
  const { gameId } = req.params;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const machine = createGameStateMachine(state);
  const nextState = machine.transition(machine.initialState, { type: 'END_GAME' });
  await saveGameState(gameId, nextState.context);
  machines[gameId] = machine.withContext(nextState.context);
  broadcastGameEvent(gameId, { type: 'end', data: nextState.context });
  res.json({ gameId, state: nextState.context });
});

// Send a message (chat or system)
router.post('/:gameId/message', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, content, type } = req.body;
  if (!content || !type) return res.status(400).json({ error: 'content and type are required' });
  try {
    const query = `INSERT INTO messages (game_id, player_id, content, type) VALUES ($1, $2, $3, $4) RETURNING *`;
    const { rows } = await pool.query(query, [gameId, playerId || null, content, type]);
    const message = rows[0];
    // Broadcast to all clients in the game room
    broadcastGameEvent(gameId, { type: 'message', data: message });
    res.status(201).json(message);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get all messages for a game
router.get('/:gameId/messages', async (req, res) => {
  const { gameId } = req.params;
  try {
    const query = `SELECT * FROM messages WHERE game_id = $1 ORDER BY created_at ASC`;
    const { rows } = await pool.query(query, [gameId]);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get full game history (states + messages)
router.get('/:gameId/history', async (req, res) => {
  const { gameId } = req.params;
  try {
    const statesQ = `SELECT * FROM game_states WHERE game_id = $1 ORDER BY id ASC`;
    const messagesQ = `SELECT * FROM messages WHERE game_id = $1 ORDER BY created_at ASC`;
    const [statesRes, messagesRes] = await Promise.all([
      pool.query(statesQ, [gameId]),
      pool.query(messagesQ, [gameId])
    ]);
    res.status(200).json({ states: statesRes.rows, messages: messagesRes.rows });
  } catch (err) {
    console.error('Error fetching game history:', err);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// Mark player as ready (lobby phase)
router.post('/:gameId/ready', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, strategy } = req.body;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  const machine = createGameStateMachine(state);
  const nextState = machine.transition(machine.initialState, { type: 'PLAYER_READY', playerId, strategy });
  await saveGameState(gameId, nextState.context);
  broadcastGameRoomState(gameId, nextState.context);
  machines[gameId] = machine.withContext(nextState.context);
  broadcastGameEvent(gameId, { type: 'state_update', data: nextState.context });
  res.json({ gameId, state: nextState.context });
});

module.exports = router; 