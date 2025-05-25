const pool = require('./database');

async function saveGameState(gameId, state) {
  console.log('saveGameState called:', { gameId, state });
  await pool.query(
    `INSERT INTO game_states (game_id, state, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (game_id) DO UPDATE SET state = $2, updated_at = NOW()`,
    [gameId, JSON.stringify(state)]
  );
}

async function loadGameState(gameId) {
  console.log('loadGameState called:', { gameId });
  const { rows } = await pool.query(
    `SELECT state FROM game_states WHERE game_id = $1`,
    [gameId]
  );
  return rows[0] ? rows[0].state : null;
}

module.exports = { saveGameState, loadGameState }; 