const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('./database');
const { startLobbyWebSocketServer, broadcastLobbyState } = require('./lobbyWebSocketServer');
const cors = require('cors');
const { ethers } = require('ethers');
const solanaWeb3 = require('@solana/web3.js');
const nacl = require('tweetnacl');
const app = express();
app.use(express.json());
app.use(cors());

// Use '/api' prefix for all API routes
const router = express.Router();

const leaderboardHandler = require('./api/leaderboard');
const gameStateRouter = require('./api/gameState');
const { startGameRoomWebSocketServer } = require('./gameRoomWebSocketServer');
const { saveGameState, loadGameState } = require('./gameStatePersistence');
const claimSplHandler = require('./api/claim-spl');
const claimAbtHandler = require('./api/claim-abt');

/**
 * @route POST /games
 * @desc Create a new game
 * @body { name: string }
 * @returns { id, name, status, created_at, updated_at }
 */
router.post('/games', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Game name is required' });
  }
  const id = uuidv4();
  try {
    const query = `INSERT INTO games (id, name, status) VALUES ($1, $2, 'lobby') RETURNING *`;
    const { rows } = await pool.query(query, [id, name]);
    res.status(201).json(rows[0]);
    // Broadcast lobby state after creating a game
    broadcastLobbyState();
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

/**
 * @route POST /games/:gameId/join
 * @desc Join a game
 */
router.post('/games/:gameId/join', async (req, res) => {
  const { playerId } = req.body;
  const { gameId } = req.params;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  try {
    // Check current player count
    const countQ = `SELECT COUNT(*) FROM players WHERE game_id = $1 AND status = 'connected'`;
    const { rows: countRows } = await pool.query(countQ, [gameId]);
    const playerCount = parseInt(countRows[0].count, 10);
    if (playerCount >= 10) {
      return res.status(400).json({ error: 'Game is full (max 10 players)' });
    }
    // Upsert player into the players table (name is now nullable, use playerId as name fallback)
    const query = `INSERT INTO players (id, name, status, game_id) VALUES ($1, $2, 'connected', $3)
      ON CONFLICT (id) DO UPDATE SET name = $2, status = 'connected', game_id = $3 RETURNING *`;
    const { rows } = await pool.query(query, [playerId, playerId, gameId]);
    // Fetch all players for this game
    const playersQ = `SELECT id, name, status FROM players WHERE game_id = $1`;
    const { rows: players } = await pool.query(playersQ, [gameId]);
    // Update and persist game state
    let state = await loadGameState(gameId);
    if (state) {
      state.players = players;
      await saveGameState(gameId, state);
    } else {
      // Create initial game state if missing
      state = {
        phase: 'lobby',
        round: 0,
        maxRounds: 10,
        players: players,
        eliminated: [],
        proposals: [],
        votes: {},
        speakingOrder: [],
        currentSpeakerIdx: 0,
        strategyMessages: {},
        gameId: gameId,
        winnerProposal: null,
        ended: false
      };
      await saveGameState(gameId, state);
    }
    res.status(200).json(rows[0]);
    // Broadcast lobby state after player joins
    broadcastLobbyState();
  } catch (err) {
    console.error('Error joining game:', err);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

/**
 * @route POST /games/:gameId/proposals
 * @desc Submit a proposal
 */
// router.post('/games/:gameId/proposals', (req, res) => {
//   // TODO: Implement proposal submission
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route POST /games/:gameId/votes
 * @desc Submit a vote
 */
// router.post('/games/:gameId/votes', (req, res) => {
//   // TODO: Implement voting
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route GET /games/:gameId
 * @desc Fetch game state
 */
// router.get('/games/:gameId', (req, res) => {
//   // TODO: Implement fetch game state
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route GET /games/:gameId/players
 * @desc Fetch players in a game
 */
router.get('/games/:gameId/players', (req, res) => {
  // TODO: Implement fetch players
  res.status(501).json({ message: 'Not implemented' });
});

/**
 * @route GET /games/:gameId/proposals
 * @desc Fetch proposals for a game
 */
// router.get('/games/:gameId/proposals', (req, res) => {
//   // TODO: Implement fetch proposals
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route POST /games/:gameId/leave
 * @desc Leave a game
 */
router.post('/games/:gameId/leave', async (req, res) => {
  const { playerId } = req.body;
  const { gameId } = req.params;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  try {
    // Set player status to 'disconnected' and remove game_id
    const query = `UPDATE players SET status = 'disconnected', game_id = NULL WHERE id = $1 AND game_id = $2 RETURNING *`;
    const { rows } = await pool.query(query, [playerId, gameId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found in this game' });
    }
    res.status(200).json(rows[0]);
    // Broadcast lobby state after player leaves
    broadcastLobbyState();
  } catch (err) {
    console.error('Error leaving game:', err);
    res.status(500).json({ error: 'Failed to leave game' });
  }
});

/**
 * @route GET /games/lobby
 * @desc Fetch current lobby state: open games and their players
 */
router.get('/games/lobby', async (req, res) => {
  console.log('--- /api/games/lobby called ---');
  try {
    const gamesQ = `SELECT id, name FROM games WHERE status = 'lobby'`;
    const { rows: games } = await pool.query(gamesQ);
    console.log('Lobby games:', games);
    for (const game of games) {
      const playersQ = `SELECT id, name, status FROM players WHERE game_id = $1`;
      const { rows: players } = await pool.query(playersQ, [game.id]);
      game.players = players;
      console.log(`Players for game ${game.id}:`, players);
    }
    res.status(200).json({ games });
  } catch (err) {
    console.error('Error fetching lobby state:', err.stack || err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

/**
 * @route DELETE /games/:gameId
 * @desc Delete a game and all associated data
 */
router.delete('/games/:gameId', async (req, res) => {
  const { gameId } = req.params;
  try {
    // Delete all associated data (order matters due to FKs)
    await pool.query('DELETE FROM players WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM proposals WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM votes WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM messages WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM strategies WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM transactions WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM game_states WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM games WHERE id = $1', [gameId]);
    res.status(200).json({ success: true });
    broadcastLobbyState();
  } catch (err) {
    console.error('Error deleting game:', err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

router.get('/leaderboard', leaderboardHandler);

router.post('/game-state/:gameId/ready', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, strategy, message, signature, walletType } = req.body;
  console.log('[READY] Incoming:', { gameId, playerId, strategy, message, signature, walletType });
  if (!playerId || !strategy || !message || !signature || !walletType) {
    console.log('[READY] Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }
  let valid = false;
  try {
    if (walletType === 'eth') {
      try {
        const recovered = ethers.utils.verifyMessage(message, signature);
        console.log('[READY][ETH] Recovered:', recovered, 'Expected:', playerId);
        valid = (recovered.toLowerCase() === playerId.toLowerCase());
      } catch (e) {
        console.log('[READY][ETH] Signature verification error:', e);
        return res.status(401).json({ error: 'Invalid ETH signature' });
      }
    } else if (walletType === 'sol') {
      try {
        const pubkey = new solanaWeb3.PublicKey(playerId);
        const msgUint8 = new TextEncoder().encode(message);
        const sigUint8 = Buffer.from(signature, 'base64');
        valid = nacl.sign.detached.verify(msgUint8, sigUint8, pubkey.toBytes());
        console.log('[READY][SOL] Verification result:', valid);
      } catch (e) {
        console.log('[READY][SOL] Signature verification error:', e);
        return res.status(401).json({ error: 'Invalid SOL signature' });
      }
    } else {
      console.log('[READY] Unknown wallet type:', walletType);
      return res.status(400).json({ error: 'Unknown wallet type' });
    }
    if (!valid) {
      console.log('[READY] Signature does not match playerId');
      return res.status(401).json({ error: 'Signature does not match playerId' });
    }
    // --- Mark player as ready and broadcast update ---
    const { saveGameState, loadGameState } = require('./gameStatePersistence');
    const createGameStateMachine = require('./gameStateMachine');
    const { broadcastGameRoomState, broadcastGameEvent } = require('./gameRoomWebSocketServer');
    // Load current state
    let state = await loadGameState(gameId);
    if (!state) return res.status(404).json({ error: 'Game not found' });
    const machine = createGameStateMachine(state);
    const nextState = machine.transition(machine.initialState, { type: 'PLAYER_READY', playerId, strategy });
    await saveGameState(gameId, nextState.context);
    broadcastGameRoomState(gameId, nextState.context);
    broadcastGameEvent(gameId, { type: 'state_update', data: nextState.context });
    res.json({ gameId, state: nextState.context });
  } catch (err) {
    console.error('[READY] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/claim-spl', claimSplHandler);
router.post('/claim-abt', claimAbtHandler);

app.use('/api', router);
app.use('/api/game-state', gameStateRouter);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

// Start the WebSocket server for lobby updates
startLobbyWebSocketServer(server);
// Start the WebSocket server for game room updates
startGameRoomWebSocketServer(server);

// TODO: After implementing join/leave, call broadcastLobbyState() after those actions as well. 