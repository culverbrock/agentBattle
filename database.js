require('dotenv').config();

const { Pool } = require('pg');

// Log the connection config (redact password)
const dbConfig = {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD ? '***REDACTED***' : undefined,
  port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
};
console.log('DB connection config:', dbConfig);

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432, // Default PostgreSQL port
});

// Log when a connection is attempted
pool.on('connect', () => {
  console.log('Database connection established');
});

module.exports = pool; 