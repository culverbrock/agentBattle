/**
 * PlayerManager handles CRUD operations for players.
 */
const pool = require('./database');

class PlayerManager {
  /**
   * Add a new player or update status to connected if exists.
   * @param {string} id - Player ID.
   * @param {string} name - Player name.
   * @param {string} gameId - Game ID.
   * @returns {Promise<object>} The player record.
   */
  static async joinPlayer(id, name, gameId) {
    const query = `INSERT INTO players (id, name, status, game_id) VALUES ($1, $2, 'connected', $3)
      ON CONFLICT (id) DO UPDATE SET status = 'connected', name = $2, game_id = $3 RETURNING *`;
    const values = [id, name, gameId];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Set a player as disconnected.
   * @param {string} id - Player ID.
   * @returns {Promise<object|null>} The updated player or null if not found.
   */
  static async leavePlayer(id) {
    const query = `UPDATE players SET status = 'disconnected' WHERE id = $1 RETURNING *`;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Get a player by ID.
   * @param {string} id - Player ID.
   * @returns {Promise<object|null>} The player or null if not found.
   */
  static async getPlayer(id) {
    const query = `SELECT * FROM players WHERE id = $1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Get all players, optionally filtered by status.
   * @param {string} [status] - Optional status filter.
   * @returns {Promise<object[]>} List of players.
   */
  static async getPlayers(status) {
    let query = `SELECT * FROM players`;
    let values = [];
    if (status) {
      query += ` WHERE status = $1`;
      values = [status];
    }
    const { rows } = await pool.query(query, values);
    return rows;
  }

  /**
   * Delete a player by ID.
   * @param {string} id - Player ID.
   * @returns {Promise<boolean>} True if deleted, false otherwise.
   */
  static async deletePlayer(id) {
    const query = `DELETE FROM players WHERE id = $1`;
    const { rowCount } = await pool.query(query, [id]);
    return rowCount > 0;
  }
}

module.exports = PlayerManager; 