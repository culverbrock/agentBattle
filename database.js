require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Log when a connection is attempted
pool.on('connect', () => {
  console.log('Database connection established');
});

module.exports = pool; 