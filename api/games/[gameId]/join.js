/**
 * @route POST /api/games/[gameId]/join
 * @desc Join a game (Vercel serverless function)
 * @body { playerId: string, name: string }
 * @returns { player }
 */
const PlayerManager = require('../../../playerManager.js');

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
  if (!playerId || !name || !gameId) {
    res.status(400).json({ error: 'playerId, name, and gameId are required' });
    return;
  }
  try {
    const player = await PlayerManager.joinPlayer(playerId, name, gameId);
    res.status(200).json(player);
  } catch (err) {
    console.error('Error joining game:', err);
    res.status(500).json({ error: 'Failed to join game' });
  }
} 