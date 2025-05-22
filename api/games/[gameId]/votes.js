/**
 * @route POST /api/games/[gameId]/votes
 * @desc Submit a vote (Vercel serverless function)
 * @body { playerId: string, proposalId: string, vote: string }
 * @returns { vote }
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
  const { playerId, proposalId, vote } = req.body;
  const { gameId } = req.query;
  if (!playerId || !proposalId || !vote || !gameId) {
    res.status(400).json({ error: 'playerId, proposalId, vote, and gameId are required' });
    return;
  }
  try {
    const query = `INSERT INTO votes (game_id, player_id, proposal_id, vote_value) VALUES ($1, $2, $3, $4) RETURNING *`;
    const values = [gameId, playerId, proposalId, vote];
    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error submitting vote:', err);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
} 