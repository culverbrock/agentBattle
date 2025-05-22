/**
 * @route GET /api/games/[gameId]/state
 * @desc Fetch current game state (Vercel serverless function)
 * @returns { game, players, proposals, votes }
 */
const pool = require('../../../database.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { gameId } = req.query;
  if (!gameId) {
    res.status(400).json({ error: 'gameId is required' });
    return;
  }
  try {
    const gameQ = `SELECT * FROM games WHERE id = $1`;
    const playersQ = `SELECT * FROM players WHERE game_id = $1`;
    const proposalsQ = `SELECT * FROM proposals WHERE game_id = $1`;
    const votesQ = `SELECT * FROM votes WHERE game_id = $1`;
    const [game, players, proposals, votes] = await Promise.all([
      pool.query(gameQ, [gameId]),
      pool.query(playersQ, [gameId]),
      pool.query(proposalsQ, [gameId]),
      pool.query(votesQ, [gameId])
    ]);
    res.status(200).json({
      game: game.rows[0],
      players: players.rows,
      proposals: proposals.rows,
      votes: votes.rows
    });
  } catch (err) {
    console.error('Error fetching game state:', err);
    res.status(500).json({ error: 'Failed to fetch game state' });
  }
} 