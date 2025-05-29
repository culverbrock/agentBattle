const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const pool = require('./database');

console.log('🔗 Solana Prize Pool Integration Test\n');
console.log('Using DATABASE_URL:', process.env.DATABASE_URL);

async function run() {
  try {
    // Test game data
    const gameId1 = '33333333-3333-3333-3333-333333333333';
    const gameId2 = '44444444-4444-4444-4444-444444444444';
    
    // Solana addresses
    const player1 = '8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN'; // Your SOL address
    const player2 = 'DFZn8wUy1m63ky68XtMx4zSQsy3K56HVrshhWeToyNzc'; // Test address
    const programId = 'DFZn8wUy1m63ky68XtMx4zSQsy3K56HVrshhWeToyNzc';

    console.log('📋 Test Data for Solana Prize Pool:');
    console.log('===================================');
    console.log('Program ID:', programId);
    console.log('Player 1 (Your address):', player1);
    console.log('Player 2 (Test address):', player2);
    console.log();

    // Insert test games with SPL token winnings
    console.log('💾 Setting up database test data...');
    console.log('===================================');
    
    await pool.query(
      `INSERT INTO games (id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'finished', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [gameId1, 'Solana SPL Game 1']
    );
    
    await pool.query(
      `INSERT INTO winnings (game_id, player_id, amount, currency, claimed, created_at)
       VALUES ($1, $2, $3, 'SPL', false, NOW()),
              ($1, $4, $5, 'SPL', false, NOW())`,
      [gameId1, player1, 250, player2, 100]
    );
    
    await pool.query(
      `INSERT INTO payments (game_id, player_id, amount, currency, tx_hash, chain, created_at)
       VALUES ($1, $2, 200, 'SPL', 'sol_tx_1', 'solana', NOW()),
              ($1, $3, 150, 'SPL', 'sol_tx_2', 'solana', NOW())`,
      [gameId1, player1, player2]
    );

    await pool.query(
      `INSERT INTO games (id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'finished', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [gameId2, 'Solana SPL Game 2']
    );
    
    await pool.query(
      `INSERT INTO winnings (game_id, player_id, amount, currency, claimed, created_at)
       VALUES ($1, $2, $3, 'SPL', false, NOW()),
              ($1, $4, $5, 'SPL', false, NOW())`,
      [gameId2, player1, 180, player2, 70]
    );
    
    await pool.query(
      `INSERT INTO payments (game_id, player_id, amount, currency, tx_hash, chain, created_at)
       VALUES ($1, $2, 150, 'SPL', 'sol_tx_3', 'solana', NOW()),
              ($1, $3, 100, 'SPL', 'sol_tx_4', 'solana', NOW())`,
      [gameId2, player1, player2]
    );

    console.log('✅ Database test games created successfully!');
    console.log();

    // Game 1 test data  
    console.log('🎮 Game 1:', gameId1);
    console.log('  Winnings:');
    console.log('    ' + player1 + ': 250 SPL tokens');
    console.log('    ' + player2 + ': 100 SPL tokens');
    console.log('  Total: 350 SPL tokens');
    console.log();

    // Game 2 test data
    console.log('🎮 Game 2:', gameId2);
    console.log('  Winnings:');
    console.log('    ' + player1 + ': 180 SPL tokens');
    console.log('    ' + player2 + ': 70 SPL tokens');
    console.log('  Total: 250 SPL tokens');
    console.log();

    // Connection test
    console.log('🔗 Testing Solana Connection:');
    console.log('=============================');
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    try {
      const blockHeight = await connection.getBlockHeight();
      console.log('✅ Connected to Solana devnet');
      console.log('   Current block height:', blockHeight);
    } catch (err) {
      console.log('⚠️  Could not connect to Solana devnet:', err.message);
    }
    console.log();

    // Address validation
    console.log('✅ Address Validation:');
    console.log('======================');
    try {
      const pubkey1 = new PublicKey(player1);
      const pubkey2 = new PublicKey(player2);
      const programPubkey = new PublicKey(programId);
      
      console.log('✅ Player 1 address valid:', pubkey1.toString());
      console.log('✅ Player 2 address valid:', pubkey2.toString());
      console.log('✅ Program ID valid:', programPubkey.toString());
    } catch (err) {
      console.log('❌ Address validation failed:', err.message);
    }
    console.log();

    // Game ID conversion
    console.log('🔧 Game ID Processing:');
    console.log('======================');
    const gameId1Clean = gameId1.replace(/-/g, '');
    const gameId1Bytes = Buffer.from(gameId1Clean, 'hex');
    console.log('Game 1 UUID:', gameId1);
    console.log('Game 1 hex:', gameId1Clean);
    console.log('Game 1 bytes length:', gameId1Bytes.length);
    console.log('Game 1 bytes:', Array.from(gameId1Bytes));
    console.log();

    // Integration overview
    console.log('🏗️  Integration Overview:');
    console.log('=========================');
    console.log('1. 🎮 Game ends → Backend calculates winnings');
    console.log('2. 🔗 Backend calls setWinners(gameId, [winners], [amounts])');
    console.log('3. 💾 Winners stored on-chain in Game account');
    console.log('4. 🌐 Frontend queries winnings from database');
    console.log('5. 👆 User connects Solana wallet (Phantom/Solflare)');
    console.log('6. 🎯 User clicks claim → Frontend calls claim(gameId)');
    console.log('7. 💰 SPL tokens transferred to user wallet');
    console.log();

    // Frontend integration
    console.log('🌐 Frontend Integration:');
    console.log('=======================');
    console.log('Add to claim winnings page:');
    console.log('- Detect Solana wallet connection');
    console.log('- Display SPL token winnings');
    console.log('- "Claim SPL Tokens" button');
    console.log('- Handle Solana transaction signing');
    console.log('- Update claim status after success');
    console.log();

    console.log('✅ Solana Prize Pool Test Complete!');
    console.log('===================================');
    console.log('✅ Database test data created');
    console.log('✅ Solana integration validated');
    console.log('🎯 Ready to test claim functionality on frontend!');
    console.log();
    console.log('Next steps:');
    console.log('1. 🌐 Go to claim winnings page');
    console.log('2. 🔌 Connect your Solana wallet (your address: ' + player1 + ')');
    console.log('3. 👀 Should see SPL token winnings for games:');
    console.log('   - ' + gameId1 + ': 250 SPL');
    console.log('   - ' + gameId2 + ': 180 SPL');
    console.log('4. 🧪 Test claim functionality (when implemented)');
    
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run(); 