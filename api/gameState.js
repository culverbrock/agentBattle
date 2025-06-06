const express = require('express');
const router = express.Router();
const { saveGameState, loadGameState } = require('../gameStatePersistence');
const { createGameStateMachine } = require('../gameStateMachine');
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { broadcastGameEvent, broadcastGameRoomState } = require('../gameRoomWebSocketServer');
const agentInvoker = require('../agentInvoker');
const eventLogger = require('../eventLogger');
const { State } = require('xstate');
const bridgeUtils = require('../bridgeUtils');
const { setSolanaWinners } = require('../solanaProgram');

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

// Join a game (ensure agent is created for each player)
router.post('/:gameId/join', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, name, strategy } = req.body;
  let state = await loadGameState(gameId);
  if (!state) return res.status(404).json({ error: 'Game not found' });
  // Add player if not already present
  if (!state.players.some(p => p.id === playerId)) {
    state.players.push({
      id: playerId,
      name: name || playerId,
      status: 'connected',
      ready: false,
      agent: { strategy: strategy || '', type: 'llm' }
    });
  }
  await saveGameState(gameId, state);
  machines[gameId] = createGameStateMachine(state);
  broadcastGameRoomState(gameId, state);
  broadcastGameEvent(gameId, { type: 'state_update', data: state });
  res.json({ gameId, state });
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
  console.log(`[AGENT PHASE HANDLER] Entered with phase: ${state.phase} for game ${gameId}`);
  let machine = createGameStateMachine(state);
  let currentState = State.create({ value: state.phase, context: state, _event: { type: 'xstate.init' } });
  let context = state;
  // Negotiation phase: loop through all rounds, each agent speaks in turn each round
  if (context.phase === 'negotiation') {
    const players = context.players;
    let round = context.round || 1;
    let negotiationHistory = context.negotiationHistory || [];
    const maxRounds = context.maxRounds || 5;
    // Randomize speaking order only for the first round
    if (!context.speakingOrder || context.speakingOrder.length !== players.length) {
      context.speakingOrder = players.map(p => p.id).sort(() => Math.random() - 0.5);
    }
    const speakingOrder = context.speakingOrder;
    while (round <= maxRounds) {
      for (let idx = 0; idx < speakingOrder.length; idx++) {
        const playerId = speakingOrder[idx];
        const player = players.find(p => p.id === playerId);
        if (player) {
          const agent = player.agent || { strategy: '', type: 'llm' };
          let message;
          try {
            message = await agentInvoker.generateNegotiationMessage({ ...context, negotiationHistory }, agent);
          } catch (err) {
            console.error('Agent negotiation error:', err);
            message = '[ERROR] Agent failed to generate negotiation message.';
          }
          negotiationHistory.push({
            playerId,
            message,
            round,
            turn: idx
          });
          await eventLogger.logEvent({ gameId, playerId, type: 'negotiation', content: message });
          const nextState = machine.transition(currentState, { type: 'SPEAK', playerId, message });
          machine = machine.withContext(nextState.context);
          currentState = nextState;
          context = nextState.context;
          broadcastGameEvent(gameId, { type: 'state_update', data: context });
          await new Promise(res => setTimeout(res, 1000));
        }
      }
      round++;
      context.round = round;
      context.negotiationHistory = negotiationHistory;
      if (context.phase !== 'negotiation') break;
    }
    // Add detailed logging before transition
    console.log('[NEGOTIATION END] round:', round, 'phase:', context.phase);
    console.log('[NEGOTIATION END] negotiationHistory:', JSON.stringify(context.negotiationHistory, null, 2));
    console.log('[NEGOTIATION END] speakingOrder:', context.speakingOrder);
    // After all rounds, move to proposal phase if still in negotiation
    if (context.phase === 'negotiation') {
      console.log('[NEGOTIATION->PROPOSAL] Transitioning to proposal phase via state machine event...');
      // Use state machine event to transition
      const nextState = machine.transition(currentState, { type: 'SPEAK', playerId: null, message: null });
      machine = machine.withContext(nextState.context);
      context = nextState.context;
      await saveGameState(gameId, context);
      broadcastGameEvent(gameId, { type: 'state_update', data: context });
      // Immediately process proposal phase
      return await agentPhaseHandler(gameId, context);
    } else if (context.phase === 'proposal') {
      // If phase is already proposal, immediately process proposal phase
      console.log('[NEGOTIATION->PROPOSAL] Phase is already proposal after negotiation loop, processing proposals...');
      return await agentPhaseHandler(gameId, context);
    } else {
      console.log('[NEGOTIATION END] Not transitioning to proposal. Current phase:', context.phase);
    }
    await saveGameState(gameId, context);
    broadcastGameEvent(gameId, { type: 'state_update', data: context });
    return context;
  }
  // Proposal phase: each agent submits a proposal (auto, LLM, with validation and broadcast)
  if (context.phase === 'proposal') {
    console.log(`[PROPOSAL PHASE] Entered proposal phase for game ${gameId}`);
    console.log(`[PROPOSAL PHASE] Players:`, context.players.map(p => p.id));
    console.log(`[PROPOSAL PHASE] Eliminated:`, context.eliminated);
    console.log(`[PROPOSAL PHASE] Negotiation history:`, context.negotiationHistory);
    // Only allow eligible proposers (not ineligibleProposers)
    const ineligibleProposers = context.ineligibleProposers || [];
    const players = context.players.filter(p => !context.eliminated.includes(p.id) && !ineligibleProposers.includes(p.id));
    if (players.length === 0) {
      console.warn(`[PROPOSAL PHASE] No eligible players to propose for game ${gameId}`);
    }
    const negotiationHistory = context.negotiationHistory || [];
    const proposals = [];
    // Log prize pool info
    if (context.prizePool) {
      console.log(`[PROPOSAL PHASE] Prize pool:`, context.prizePool);
    } else {
      console.warn(`[PROPOSAL PHASE] No prize pool found in context! Setting dummy prize pool for debugging.`);
      context.prizePool = { total: 100, currency: 'DEBUG' };
    }
    for (const player of players) {
      const agent = player.agent || { strategy: '', type: 'llm' };
      let proposal;
      let attempts = 0;
      while (attempts < 2) { // Try twice if invalid
        attempts++;
        try {
          console.log(`[PROPOSAL PHASE] Agent ${player.id} generating proposal (attempt ${attempts})...`);
          proposal = await agentInvoker.generateProposal({ ...context, negotiationHistory }, agent, players);
          console.log(`[PROPOSAL PHASE] Agent ${player.id} raw proposal:`, proposal);
        } catch (err) {
          console.error(`[PROPOSAL PHASE] Agent proposal error for ${player.id}:`, err);
          proposal = null;
        }
        // Validate proposal (currently always true)
        if (proposal && validateProposal(proposal, players)) {
          break;
        } else {
          proposal = null;
        }
      }
      if (proposal) {
        proposals.push({ playerId: player.id, proposal }); // Attach proposer
        await eventLogger.logEvent({ gameId, playerId: player.id, type: 'proposal', content: JSON.stringify(proposal) });
        // Broadcast proposal as it is made
        broadcastGameEvent(gameId, { type: 'proposal', data: { playerId: player.id, proposal, state: context } });
        await new Promise(res => setTimeout(res, 1000));
      } else {
        console.error(`[PROPOSAL PHASE] Invalid proposal from agent ${player.id}, skipping.`);
      }
    }
    console.log(`[PROPOSAL PHASE] Final proposals array:`, proposals);
    context.proposals = proposals; // Set proposals in context before transition
    console.log('[PROPOSAL PHASE] About to fire ALL_PROPOSALS_SUBMITTED. Current phase:', context.phase, 'Proposals:', JSON.stringify(context.proposals));
    // Guard: Ensure context.phase is a string and valid
    if (typeof context.phase !== 'string' || !['lobby','strategy','negotiation','proposal','voting','elimination','endgame'].includes(context.phase)) {
      console.error('[PROPOSAL PHASE] ERROR: context.phase is not a valid string state:', context.phase, 'Full context:', JSON.stringify(context));
      throw new Error('Invalid context.phase for state machine transition: ' + context.phase);
    }
    // Use the current XState State object for transition, as in earlier phases
    console.log('[PROPOSAL PHASE] Transitioning to voting:');
    console.log('  currentState.value:', currentState.value);
    console.log('  currentState.context:', JSON.stringify(currentState.context));
    console.log('  Event: { type: ALL_PROPOSALS_SUBMITTED }');
    const nextState = machine.transition(currentState, { type: 'ALL_PROPOSALS_SUBMITTED' });
    console.log('  nextState.value:', nextState.value);
    console.log('  nextState.context:', JSON.stringify(nextState.context));
    machine = machine.withContext(nextState.context);
    context = machine.context;
    await saveGameState(gameId, context);
    broadcastGameEvent(gameId, { type: 'state_update', data: context });
    console.log('[PROPOSAL PHASE] Saved and broadcasted after ALL_PROPOSALS_SUBMITTED. Final phase:', context.phase);
    if (context.phase === 'voting') {
      console.log('[PROPOSAL->VOTING] Phase is voting after proposal, processing votes...');
      return await agentPhaseHandler(gameId, context);
    }
    return context;
  }
  // Strategy phase: allow new strategy messages, auto-progress after 15s
  if (context.phase === 'strategy') {
    console.log(`[STRATEGY PHASE] Entered strategy phase for game ${gameId}`);
    // Allow 15s for new strategies
    let strategiesSubmitted = context.strategyMessages ? Object.keys(context.strategyMessages).length : 0;
    const totalPlayers = context.players ? context.players.length : 0;
    let waited = 0;
    const waitMs = 15000;
    const intervalMs = 1000;
    while (waited < waitMs) {
      // Check if all players have submitted
      strategiesSubmitted = context.strategyMessages ? Object.keys(context.strategyMessages).length : 0;
      if (strategiesSubmitted >= totalPlayers) {
        console.log('[STRATEGY PHASE] All strategies submitted, progressing to negotiation.');
        break;
      }
      await new Promise(res => setTimeout(res, intervalMs));
      waited += intervalMs;
    }
    if (waited >= waitMs) {
      console.log('[STRATEGY PHASE] 15s elapsed, auto-progressing to negotiation.');
    }
    // Progress to negotiation
    context.phase = 'negotiation';
    await saveGameState(gameId, context);
    broadcastGameEvent(gameId, { type: 'state_update', data: context });
    return await agentPhaseHandler(gameId, context);
  }
  // Voting phase: each player submits a vote
  if (context.phase === 'voting') {
    const players = context.players.filter(p => !context.eliminated.includes(p.id));
    const proposals = context.proposals || [];
    // Initialize ineligibleProposers if not present
    if (!context.ineligibleProposers) context.ineligibleProposers = [];
    const allVotes = [];
    let currentState = machine.initialState;
    for (const player of players) {
      const agent = player.agent || { strategy: 'default', type: 'default' };
      let votes;
      try {
        votes = await agentInvoker.generateVote(context, agent);
      } catch (err) {
        console.error('Agent vote error:', err);
        // Default: vote for own proposal if possible, else first proposal
        votes = { [proposals[0]?.playerId || 0]: 100 };
      }
      allVotes.push({ playerId: player.id, votes });
      const nextState = machine.transition(currentState, { type: 'SUBMIT_VOTE', playerId: player.id, votes });
      await eventLogger.logEvent({ gameId, playerId: player.id, type: 'vote', content: JSON.stringify(votes) });
      machine = machine.withContext(nextState.context);
      context = nextState.context;
      currentState = nextState;
      broadcastGameEvent(gameId, { type: 'vote', data: { playerId: player.id, votes, state: context } });
    }
    // Tally votes by proposer playerId
    const proposalVoteTotals = {};
    for (const proposal of proposals) {
      proposalVoteTotals[proposal.playerId] = 0;
    }
    for (const v of allVotes) {
      for (const [pid, count] of Object.entries(v.votes)) {
        if (proposalVoteTotals.hasOwnProperty(pid)) {
          proposalVoteTotals[pid] += Number(count);
        }
      }
    }
    const totalVotes = Object.values(proposalVoteTotals).reduce((a, b) => a + b, 0);
    console.log('[VOTING PHASE] Proposal vote totals by playerId:', proposalVoteTotals, 'Total votes:', totalVotes);
    let winnerPlayerId = null;
    for (const [pid, count] of Object.entries(proposalVoteTotals)) {
      if (count / totalVotes >= 0.61) {
        winnerPlayerId = pid;
        break;
      }
    }
    if (winnerPlayerId) {
      const winnerProposal = proposals.find(p => p.playerId === winnerPlayerId);
      console.log(`[VOTING PHASE] Proposal by ${winnerPlayerId} is the winner with ${(proposalVoteTotals[winnerPlayerId] / totalVotes * 100).toFixed(2)}% of votes.`);
      context.winnerProposal = winnerProposal;
      context.ended = true;
      context.phase = 'endgame';
      broadcastGameEvent(gameId, { type: 'winner', data: { winnerProposal: context.winnerProposal, state: context } });
      // --- NEW: Smart cross-chain prize pool management ---
      try {
        // 1. Aggregate entry fees by currency
        const { rows: paymentRows } = await pool.query(
          `SELECT currency, SUM(amount) as total FROM payments WHERE game_id = $1 GROUP BY currency`,
          [gameId]
        );
        const poolByCurrency = {};
        for (const row of paymentRows) {
          poolByCurrency[row.currency] = Number(row.total);
        }
        
        // 2. Calculate total prize pool and individual currency needs
        const total = Object.values(poolByCurrency).reduce((a, b) => a + b, 0);
        const proposalDist = winnerProposal.proposal || {};
        
        // Group winners by their currency preference (based on their payment)
        const winnersByCurrency = { ABT: [], SPL: [] };
        const payoutsByCurrency = { ABT: 0, SPL: 0 };
        
        for (const [playerId, percent] of Object.entries(proposalDist)) {
          const amount = (Number(percent) / 100) * total;
          if (amount > 0) {
            // Find what currency this player paid in (their preferred payout currency)
            const { rows: payRows } = await pool.query(
              `SELECT currency FROM payments WHERE game_id = $1 AND player_id = $2 LIMIT 1`,
              [gameId, playerId]
            );
            const currency = payRows.length > 0 ? payRows[0].currency : 'ABT';
            
            winnersByCurrency[currency].push({ playerId, amount, percent });
            payoutsByCurrency[currency] += amount;
            
            // Record in winnings table with their preferred currency
            await pool.query(
              `INSERT INTO winnings (game_id, player_id, amount, currency, claimed, created_at) VALUES ($1, $2, $3, $4, false, NOW())`,
              [gameId, playerId, amount, currency]
            );
            console.log(`[WINNINGS] Recorded: player ${playerId} gets ${amount} ${currency} for game ${gameId}`);
          }
        }
        
        // 3. Check if cross-chain balancing is needed
        const abtAvailable = poolByCurrency.ABT || 0;
        const splAvailable = poolByCurrency.SPL || 0;
        const abtNeeded = payoutsByCurrency.ABT;
        const splNeeded = payoutsByCurrency.SPL;
        
        console.log(`[BRIDGE] Prize pool analysis for game ${gameId}:`);
        console.log(`[BRIDGE] - ABT: ${abtAvailable} available, ${abtNeeded} needed`);
        console.log(`[BRIDGE] - SPL: ${splAvailable} available, ${splNeeded} needed`);
        
        // 4. Handle cross-chain transfers if needed
        if (abtNeeded > abtAvailable) {
          const deficit = abtNeeded - abtAvailable;
          const splSurplus = splAvailable - splNeeded;
          if (splSurplus >= deficit) {
            console.log(`[BRIDGE] Handling ABT deficit of ${deficit} using SPL surplus of ${splSurplus}`);
            await bridgeUtils.handleCrossChainPayout('ABT', deficit, 'SPL', splSurplus);
          } else {
            console.error(`[BRIDGE] Insufficient funds: ABT deficit ${deficit} > SPL surplus ${splSurplus}`);
          }
        } else if (splNeeded > splAvailable) {
          const deficit = splNeeded - splAvailable;
          const abtSurplus = abtAvailable - abtNeeded;
          if (abtSurplus >= deficit) {
            console.log(`[BRIDGE] Handling SPL deficit of ${deficit} using ABT surplus of ${abtSurplus}`);
            await bridgeUtils.handleCrossChainPayout('SPL', deficit, 'ABT', abtSurplus);
          } else {
            console.error(`[BRIDGE] Insufficient funds: SPL deficit ${deficit} > ABT surplus ${abtSurplus}`);
          }
        } else {
          console.log(`[BRIDGE] No cross-chain balancing needed - sufficient funds on both chains`);
        }
        
        // 5. Set winners on Solana program if there are SPL payouts
        if (winnersByCurrency.SPL.length > 0) {
          try {
            console.log(`[SOLANA] Setting winners on-chain for ${winnersByCurrency.SPL.length} SPL recipients...`);
            const splDistribution = {};
            for (const winner of winnersByCurrency.SPL) {
              splDistribution[winner.playerId] = winner.percent;
            }
            await setSolanaWinners(gameId, splDistribution, total);
          } catch (err) {
            console.error(`[SOLANA] Failed to set winners on-chain for game ${gameId}:`, err);
            // Don't fail the whole process - winnings are still in database
          }
        }
        
      } catch (err) {
        console.error('[WINNINGS/BRIDGE] Error recording payouts or handling bridge:', err);
      }
    } else {
      // No winner: eliminate the proposal with the fewest votes
      let minVotes = Infinity;
      let eliminatedProposer = null;
      for (const [pid, count] of Object.entries(proposalVoteTotals)) {
        if (count < minVotes) {
          minVotes = count;
          eliminatedProposer = pid;
        }
      }
      if (eliminatedProposer) {
        context.ineligibleProposers.push(eliminatedProposer);
        context.proposals = context.proposals.filter(p => p.playerId !== eliminatedProposer);
        console.log(`[VOTING PHASE] No proposal reached 61% threshold. Eliminating proposal by ${eliminatedProposer} (received ${minVotes} votes).`);
        broadcastGameEvent(gameId, { type: 'proposal_eliminated', data: { eliminatedProposer, minVotes, state: context } });
      }
      // Go back to strategy phase for new round
      context.phase = 'strategy';
      // Optionally, reset strategyMessages for new input
      // context.strategyMessages = {};
      await saveGameState(gameId, context);
      broadcastGameEvent(gameId, { type: 'state_update', data: context });
      return context;
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

// Proposal validation helper
function validateProposal(proposal, players) {
  // TEMP: Disable validation for debugging
  return true;
}

// Helper: Extract only valid state machine context keys
function getStateMachineContext(state) {
  const {
    round, maxRounds, players, eliminated, strategyMessages,
    negotiationHistory, proposals, votes, speakingOrder, currentSpeakerIdx,
    winnerProposal, ended
  } = state;
  return {
    round, maxRounds, players, eliminated, strategyMessages,
    negotiationHistory, proposals, votes, speakingOrder, currentSpeakerIdx,
    winnerProposal, ended
  };
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

module.exports = {
  agentPhaseHandler,
  router
}; 