/**
 * @route POST /api/games/[gameId]/proposals
 * @desc Submit a proposal (Vercel serverless function)
 * @body { playerId: string, content: string }
 * @returns { proposal }
 */
const proposalManager = require('../../../proposalManager.js');

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
  const { playerId, content } = req.body;
  const { gameId } = req.query;
  if (!playerId || !content || !gameId) {
    res.status(400).json({ error: 'playerId, content, and gameId are required' });
    return;
  }
  try {
    const proposal = await proposalManager.createProposal({ gameId, playerId, content });
    res.status(201).json(proposal);
  } catch (err) {
    console.error('Error submitting proposal:', err);
    res.status(500).json({ error: 'Failed to submit proposal' });
  }
} 