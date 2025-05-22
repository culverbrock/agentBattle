const pool = require('./database');

(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('DB connection test successful:', res.rows[0]);
  } catch (err) {
    console.error('DB connection test failed:', err);
  } finally {
    await pool.end();
  }
})(); 