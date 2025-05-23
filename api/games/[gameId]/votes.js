/**
 * @route POST /api/games/[gameId]/votes
 * @desc Submit a vote (Vercel serverless function)
 * @body { playerId: string, proposalId: string, vote: string }
 * @returns { vote }
 */
const pool = require('../../database');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // TODO: Implement voting
  res.status(501).json({ message: 'Not implemented' });
}; 