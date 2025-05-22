/**
 * @route GET /api/games/[gameId]/events
 * @desc Fetch all events/messages for a game
 * @returns { events: [ ... ] }
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
    const query = `SELECT * FROM messages WHERE game_id = $1 ORDER BY created_at DESC`;
    const { rows } = await pool.query(query, [gameId]);
    res.status(200).json({ events: rows });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
} 