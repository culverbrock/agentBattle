const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
require('dotenv').config();

// Load the IDL from file
const idl = JSON.parse(fs.readFileSync('./solana_prize_pool_idl.json', 'utf8'));

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Test games
const testGames = [
  {
    gameId: '33333333-3333-3333-3333-333333333333',
    winners: ['8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN'],
    amounts: [250] // 250 SPL tokens
  }
];

async function setWinnersForGame(program, gameData, admin) {
  console.log(`\n🎮 Setting winners for game: ${gameData.gameId}`);
  
  // Convert gameId to bytes32
  const gameIdBytes = Buffer.alloc(32);
  const gameIdStr = gameData.gameId.replace(/-/g, '');
  const gameIdHex = Buffer.from(gameIdStr, 'hex');
  gameIdHex.copy(gameIdBytes, 0, 0, Math.min(16, gameIdHex.length));
  
  // Derive game PDA
  const [gamePda] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBytes],
    program.programId
  );
  
  console.log(`Game PDA: ${gamePda.toBase58()}`);
  
  // Check if game account already exists
  try {
    const gameAccount = await program.account.game.fetch(gamePda);
    console.log('⚠️ Game account already exists, skipping...');
    return;
  } catch (err) {
    // Account doesn't exist, which is expected
    console.log('✅ Game account doesn\'t exist, proceeding with creation...');
  }
  
  // Convert winners to PublicKeys and amounts to proper format
  const winnerPubkeys = gameData.winners.map(w => new PublicKey(w));
  const amounts = gameData.amounts.map(a => new anchor.BN(a * 10 ** 6)); // Convert to lamports (6 decimals)
  
  console.log('Winners:', gameData.winners);
  console.log('Amounts (lamports):', amounts.map(a => a.toString()));
  
  try {
    const tx = await program.methods
      .setWinners(Array.from(gameIdBytes), winnerPubkeys, amounts)
      .accounts({
        game: gamePda,
        authority: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    
    console.log(`✅ setWinners transaction sent: ${tx}`);
    
    // Wait a moment for confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify the account was created
    const gameAccount = await program.account.game.fetch(gamePda);
    console.log(`✅ Game account created successfully!`);
    console.log(`   Game ID: ${Buffer.from(gameAccount.gameId).toString('hex')}`);
    console.log(`   Winners: ${gameAccount.winners.map(w => w.toBase58())}`);
    console.log(`   Amounts: ${gameAccount.amounts.map(a => a.toString())}`);
    console.log(`   Winners Set: ${gameAccount.winnersSet}`);
    
  } catch (err) {
    console.error(`❌ Error setting winners: ${err.message}`);
    if (err.logs) {
      console.error('Program logs:', err.logs);
    }
  }
}

async function main() {
  console.log('🚀 Setting Winners for Test Games (Using Proper IDL)');
  console.log('==================================================');
  
  // Set up connection and provider
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  
  // Load admin wallet
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    throw new Error('Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
  }
  
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const admin = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Admin wallet: ${admin.publicKey.toBase58()}`);
  
  // Create provider and program
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(admin),
    { commitment: 'confirmed' }
  );
  
  const program = new anchor.Program(idl, PROGRAM_ID, provider);
  console.log(`Program ID: ${PROGRAM_ID}`);
  
  for (const gameData of testGames) {
    try {
      await setWinnersForGame(program, gameData, admin);
    } catch (err) {
      console.error(`Failed to set winners for ${gameData.gameId}:`, err.message);
    }
  }
  
  console.log('\n🎉 Done! You can now test on-chain claiming in the frontend.');
}

main().catch(console.error); 