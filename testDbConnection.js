require('dotenv').config();
const pool = require('./database');

(async () => {
  try {
    // Print the actual config (redact password)
    const dbConfig = {
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DATABASE,
      password: process.env.POSTGRES_PASSWORD ? '***REDACTED***' : undefined,
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
    };
    console.log('Testing DB connection with config:', dbConfig);
    // Try a simple query
    const result = await pool.query('SELECT NOW()');
    console.log('DB connection successful! Server time:', result.rows[0].now);
    process.exit(0);
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
})(); 