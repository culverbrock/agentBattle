const pool = require('./database');

// Function to log round completions to the database
async function logRoundCompletion(roundNumber) {
  const logMessage = `Round ${roundNumber} completed at ${new Date().toISOString()}`;
  console.log(logMessage);

  try {
    const query = 'INSERT INTO round_logs (round_number, timestamp) VALUES ($1, $2)';
    const values = [roundNumber, new Date()];
    await pool.query(query, values);
    console.log('Round log inserted into database');
  } catch (error) {
    console.error('Error inserting round log into database:', error);
  }
}

module.exports = logRoundCompletion; 