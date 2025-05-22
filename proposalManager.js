/**
 * ProposalManager handles CRUD and queue operations for proposals.
 */
const pool = require('./database');

class ProposalManager {
  /**
   * Create a new proposal.
   * @param {object} params - { gameId, playerId, content }
   * @returns {Promise<object>} The created proposal.
   */
  static async createProposal({ gameId, playerId, content }) {
    try {
      const query = `INSERT INTO proposals (game_id, player_id, content, status) VALUES ($1, $2, $3, 'pending') RETURNING *`;
      const values = [gameId, playerId, content];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (err) {
      console.error('Error in createProposal:', err);
      throw err;
    }
  }

  /**
   * Get a proposal by ID.
   * @param {number} id - Proposal ID.
   * @returns {Promise<object|null>} The proposal or null if not found.
   */
  static async getProposal(id) {
    try {
      const query = `SELECT * FROM proposals WHERE id = $1`;
      const { rows } = await pool.query(query, [id]);
      return rows[0] || null;
    } catch (err) {
      console.error('Error in getProposal:', err);
      throw err;
    }
  }

  /**
   * Update a proposal's status.
   * @param {number} id - Proposal ID.
   * @param {string} status - New status ('pending', 'accepted', 'rejected').
   * @returns {Promise<object|null>} The updated proposal or null if not found.
   */
  static async updateProposalStatus(id, status) {
    try {
      const query = `UPDATE proposals SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      const { rows } = await pool.query(query, [status, id]);
      return rows[0] || null;
    } catch (err) {
      console.error('Error in updateProposalStatus:', err);
      throw err;
    }
  }

  /**
   * Delete a proposal by ID.
   * @param {number} id - Proposal ID.
   * @returns {Promise<boolean>} True if deleted, false otherwise.
   */
  static async deleteProposal(id) {
    try {
      const query = `DELETE FROM proposals WHERE id = $1`;
      const { rowCount } = await pool.query(query, [id]);
      return rowCount > 0;
    } catch (err) {
      console.error('Error in deleteProposal:', err);
      throw err;
    }
  }

  /**
   * Get all proposals, optionally filtered by status.
   * @param {string} [status] - Optional status filter.
   * @returns {Promise<object[]>} List of proposals.
   */
  static async getProposals(status) {
    try {
      let query = `SELECT * FROM proposals`;
      let values = [];
      if (status) {
        query += ` WHERE status = $1`;
        values = [status];
      }
      const { rows } = await pool.query(query, values);
      return rows;
    } catch (err) {
      console.error('Error in getProposals:', err);
      throw err;
    }
  }

  /**
   * Get the next pending proposal (queue behavior).
   * @returns {Promise<object|null>} The next pending proposal or null.
   */
  static async getNextPendingProposal() {
    try {
      const query = `SELECT * FROM proposals WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`;
      const { rows } = await pool.query(query);
      return rows[0] || null;
    } catch (err) {
      console.error('Error in getNextPendingProposal:', err);
      throw err;
    }
  }
}

module.exports = ProposalManager; 