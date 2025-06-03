const pool = require('./database');

console.log('Using DATABASE_URL:', process.env.DATABASE_URL);

async function run() {
  // Old test game
  const gameId1 = '11111111-1111-1111-1111-111111111111';
  const player1 = '0xf64a18162C830312c6ba5e3d9834799B42199A9b'; // MetaMask/ETH
  const player2 = '0xf161cAA3230dDB5f028224d295962c4552Dd2430'; // MetaMask/ETH (second winner)
  try {
    // Insert old test game
    await pool.query(
      `INSERT INTO games (id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'finished', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [gameId1, 'Test Mixed Currency Game']
    );
    await pool.query(
      `INSERT INTO winnings (game_id, player_id, amount, currency, claimed, created_at)
       VALUES ($1, $2, $3, 'ABT', false, NOW()),
              ($1, $4, $5, 'ABT', false, NOW())`,
      [gameId1, player1, 140, player2, 60]
    );
    await pool.query(
      `INSERT INTO payments (game_id, player_id, amount, currency, tx_hash, chain, created_at)
       VALUES ($1, $2, 100, 'ABT', '0xtesttx1', 'eth', NOW()),
              ($1, $3, 100, 'ABT', '0xtesttx2', 'eth', NOW())`,
      [gameId1, player1, player2]
    );
    // New test game
    const gameId2 = '22222222-2222-2222-2222-222222222222';
    await pool.query(
      `INSERT INTO games (id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'finished', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [gameId2, 'Test Mixed Currency Game 2']
    );
    await pool.query(
      `INSERT INTO winnings (game_id, player_id, amount, currency, claimed, created_at)
       VALUES ($1, $2, $3, 'ABT', false, NOW()),
              ($1, $4, $5, 'ABT', false, NOW())`,
      [gameId2, player1, 100, player2, 50]
    );
    await pool.query(
      `INSERT INTO payments (game_id, player_id, amount, currency, tx_hash, chain, created_at)
       VALUES ($1, $2, 100, 'ABT', '0xtesttx3', 'eth', NOW()),
              ($1, $3, 50, 'ABT', '0xtesttx4', 'eth', NOW())`,
      [gameId2, player1, player2]
    );
    console.log('Test games and winnings inserted successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error inserting test data:', err);
    process.exit(1);
  }
}

run(); 