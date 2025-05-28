const pool = require('./database');

console.log('Using DATABASE_URL:', process.env.DATABASE_URL);

async function run() {
  const gameId = '11111111-1111-1111-1111-111111111111';
  const player1 = '0xf64a18162C830312c6ba5e3d9834799B42199A9b'; // MetaMask/ETH
  const player2 = '0xf161cAA3230dDB5f028224d295962c4552Dd2430'; // MetaMask/ETH (second winner)
  try {
    // Insert test game
    await pool.query(
      `INSERT INTO games (id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'finished', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [gameId, 'Test Mixed Currency Game']
    );
    // Insert winnings: player1 gets 140 ABT, player2 gets 60 ABT
    await pool.query(
      `INSERT INTO winnings (game_id, player_id, amount, currency, claimed, created_at)
       VALUES ($1, $2, $3, 'ABT', false, NOW()),
              ($1, $4, $5, 'ABT', false, NOW())`,
      [gameId, player1, 140, player2, 60]
    );
    // Insert payments for audit trail
    await pool.query(
      `INSERT INTO payments (game_id, player_id, amount, currency, tx_hash, chain, created_at)
       VALUES ($1, $2, 100, 'ABT', '0xtesttx1', 'eth', NOW()),
              ($1, $3, 100, 'ABT', '0xtesttx2', 'eth', NOW())`,
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