/**
 * @route GET /api/games/lobby
 * @desc Fetch current lobby state: open games and their players
 * @returns { games: [ { id, name, players: [ ... ] } ] }
 */
const pool = require('../../database');

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
  try {
    // Log the DB connection config for debugging
    const dbConfig = {
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DATABASE,
      password: process.env.POSTGRES_PASSWORD ? '***REDACTED***' : undefined,
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
    };
    console.log('API /games/lobby DB config:', dbConfig);
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