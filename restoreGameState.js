/**
 * restoreGameState fetches the latest game state from the DB for state machine initialization.
 * @returns {Promise<{players: object[], proposals: object[], round: number}>}
 */
const PlayerManager = require('./playerManager');
const ProposalManager = require('./proposalManager');
const pool = require('./database');

async function restoreGameState() {
  // Get all connected players
  const players = await PlayerManager.getPlayers('connected');
  // Get all proposals
  const proposals = await ProposalManager.getProposals();
  // Get latest round number from round_logs if available, else default to 1
  let round = 1;
  try {
    const res = await pool.query('SELECT MAX(round_number) as max_round FROM round_logs');
    if (res.rows[0] && res.rows[0].max_round) {
      round = parseInt(res.rows[0].max_round, 10);
    }
  } catch (err) {
    console.warn('Could not fetch round from round_logs, defaulting to 1:', err);
  }
  return { players, proposals, round };
}

module.exports = restoreGameState; 