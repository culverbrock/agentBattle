const pool = require('./database');

/**
 * Log a game event to the messages table.
 * @param {object} params - { gameId, playerId, type, content }
 */
async function logEvent({ gameId, playerId = null, type, content }) {
  const query = `INSERT INTO messages (game_id, player_id, type, content) VALUES ($1, $2, $3, $4)`;
  const values = [gameId, playerId, type, content];
  await pool.query(query, values);
}

module.exports = { logEvent }; 