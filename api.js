const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('./database');
const { startLobbyWebSocketServer, broadcastLobbyState } = require('./lobbyWebSocketServer');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

// Use '/api' prefix for all API routes
const router = express.Router();

const leaderboardHandler = require('./api/leaderboard');

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
router.post('/games/:gameId/proposals', (req, res) => {
  // TODO: Implement proposal submission
  res.status(501).json({ message: 'Not implemented' });
});

/**
 * @route POST /games/:gameId/votes
 * @desc Submit a vote
 */
router.post('/games/:gameId/votes', (req, res) => {
  // TODO: Implement voting
  res.status(501).json({ message: 'Not implemented' });
});

/**
 * @route GET /games/:gameId
 * @desc Fetch game state
 */
router.get('/games/:gameId', (req, res) => {
  // TODO: Implement fetch game state
  res.status(501).json({ message: 'Not implemented' });
});

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
router.get('/games/:gameId/proposals', (req, res) => {
  // TODO: Implement fetch proposals
  res.status(501).json({ message: 'Not implemented' });
});

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
  try {
    const gamesQ = `SELECT id, name FROM games WHERE status = 'lobby'`;
    const { rows: games } = await pool.query(gamesQ);
    for (const game of games) {
      const playersQ = `SELECT id, name, status FROM players WHERE game_id = $1`;
      const { rows: players } = await pool.query(playersQ, [game.id]);
      game.players = players;
    }
    res.status(200).json({ games });
  } catch (err) {
    console.error('Error fetching lobby state:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaderboard', leaderboardHandler);

app.use('/api', router);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

// Start the WebSocket server for lobby updates
startLobbyWebSocketServer(server);

// TODO: After implementing join/leave, call broadcastLobbyState() after those actions as well. 