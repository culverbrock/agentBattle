require('dotenv').config();
const pool = require('./database');

(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connection test succeeded:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection test failed:', err);
    process.exit(1);
  }
})(); 