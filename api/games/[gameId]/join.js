/**
 * @route POST /api/games/[gameId]/join
 * @desc Join a game (Vercel serverless function)
 * @body { playerId: string, name: string }
 * @returns { player }
 */
const pool = require('../../../database');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { playerId, name } = req.body;
  const { gameId } = req.query;
  if (!playerId || !name) {
    res.status(400).json({ error: 'playerId and name are required' });
    return;
  }
  try {
    const query = `INSERT INTO players (id, name, status, game_id) VALUES ($1, $2, 'connected', $3)
      ON CONFLICT (id) DO UPDATE SET name = $2, status = 'connected', game_id = $3 RETURNING *`;
    const { rows } = await pool.query(query, [playerId, name, gameId]);
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error joining game:', err);
    res.status(500).json({ error: 'Failed to join game' });
  }
} 