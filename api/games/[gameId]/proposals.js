/**
 * @route POST /api/games/[gameId]/proposals
 * @desc Submit a proposal (Vercel serverless function)
 * @body { playerId: string, content: string }
 * @returns { proposal }
 */
const proposalManager = require('../../../proposalManager.js');

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
  // TODO: Implement proposal submission
  res.status(501).json({ message: 'Not implemented' });
}; 