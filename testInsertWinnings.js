const pool = require('./database');

async function run() {
  const gameId = '11111111-1111-1111-1111-111111111111';
  const player1 = '0xf64a18162C830312c6ba5e3d9834799B42199A9b';
  const player2 = '8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN';
  try {
    // Insert test game
    await pool.query(
      `INSERT INTO games (id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'finished', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [gameId, 'Test Mixed Currency Game']
    );
    // Insert winnings (simulate cross-currency payout: all in SPL)
    await pool.query(
      `INSERT INTO winnings (game_id, player_id, amount, currency, claimed, created_at)
       VALUES ($1, $2, $3, 'SPL', false, NOW()),
              ($1, $4, $5, 'SPL', false, NOW())`,
      [gameId, player1, 140, player2, 60]
    );
    // Insert payments for audit trail
    await pool.query(
      `INSERT INTO payments (game_id, player_id, amount, currency, tx_hash, chain, created_at)
       VALUES ($1, $2, 100, 'ABT', '0xtesttx1', 'eth', NOW()),
              ($1, $3, 100, 'SPL', 'testsig2', 'sol', NOW())`,
      [gameId, player1, player2]
    );
    console.log('Test game and winnings inserted successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error inserting test data:', err);
    process.exit(1);
  }
}

run(); 