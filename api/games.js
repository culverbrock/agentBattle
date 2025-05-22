/**
 * @route POST /api/games
 * @desc Create a new game (Vercel serverless function)
 * @body { name: string }
 * @returns { id, name, status, created_at, updated_at }
 */
import { v4 as uuidv4 } from 'uuid';
import pool from '../database';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Game name is required' });
    return;
  }
  const id = uuidv4();
  try {
    const query = `INSERT INTO games (id, name, status) VALUES ($1, $2, 'lobby') RETURNING *`;
    const { rows } = await pool.query(query, [id, name]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ error: 'Failed to create game' });
  }
} 