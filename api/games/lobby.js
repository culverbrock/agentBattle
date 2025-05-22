/**
 * @route GET /api/games/lobby
 * @desc Fetch current lobby state: open games and their players
 * @returns { games: [ { id, name, players: [ ... ] } ] }
 */
const pool = require('../../database.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    // Fetch open games
    const gamesQ = `SELECT id, name FROM games WHERE status = 'lobby'`;
    const { rows: games } = await pool.query(gamesQ);
    // Fetch players for each game
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
}; 