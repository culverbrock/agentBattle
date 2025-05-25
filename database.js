require('dotenv').config();

const { Pool } = require('pg');

let pool;

if (process.env.DATABASE_URL) {
  console.log('Connecting to database using DATABASE_URL:', process.env.DATABASE_URL);
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
} else {
  console.log('Connecting to database using individual POSTGRES_* env vars');
  pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
  });
}

// Log when a connection is attempted
pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.stack || err);
});

module.exports = pool; 