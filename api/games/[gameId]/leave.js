/**
 * @route POST /api/games/[gameId]/leave
 * @desc Leave a game (Vercel serverless function)
 * @body { playerId: string }
 * @returns { player }
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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { playerId } = req.body;
  const { gameId } = req.query;
  if (!playerId || !gameId) {
    res.status(400).json({ error: 'playerId and gameId are required' });
    return;
  }
  try {
    const query = `UPDATE players SET status = 'disconnected', game_id = NULL WHERE id = $1 AND game_id = $2 RETURNING *`;
    const { rows } = await pool.query(query, [playerId, gameId]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Player not found in this game' });
      return;
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error leaving game:', err);
    res.status(500).json({ error: 'Failed to leave game' });
  }
}; 