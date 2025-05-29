const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
require('dotenv').config();

// Your deployed program ID
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SPL_MINT = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

async function findProgramAccounts() {
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  const mint = new PublicKey(SPL_MINT);

  console.log('🔍 Finding Solana Prize Pool Program Accounts');
  console.log('=============================================');
  console.log('Program ID:', PROGRAM_ID);
  console.log('SPL Mint:', SPL_MINT);
  console.log();

  // Find the program's token account (PDA)
  // Most Solana programs use a PDA like [b"pool", mint.as_ref()]
  try {
    const [poolPda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), mint.toBuffer()],
      programId
    );
    
    console.log('🏦 Program Token Account (PDA):');
    console.log('Pool PDA:', poolPda.toBase58());
    console.log('Bump:', bump);
    
    // Get the associated token account for this PDA
    const poolTokenAccount = await getAssociatedTokenAddress(mint, poolPda, true);
    console.log('Pool Token Account:', poolTokenAccount.toBase58());
    console.log();

    // Check if the token account exists and has balance
    try {
      const accountInfo = await connection.getAccountInfo(poolTokenAccount);
      if (accountInfo) {
        console.log('✅ Pool token account exists');
        // Parse token account data if needed
      } else {
        console.log('❌ Pool token account does not exist yet');
        console.log('💡 You may need to initialize it or fund it first');
      }
    } catch (err) {
      console.log('❌ Error checking pool token account:', err.message);
    }
    console.log();

    return {
      poolPda: poolPda.toBase58(),
      poolTokenAccount: poolTokenAccount.toBase58(),
      bump
    };

  } catch (err) {
    console.error('Error finding program accounts:', err);
  }
}

async function testGameAccount() {
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Example game ID (32 bytes)
  const gameId = '33333333-3333-3333-3333-333333333333';
  const gameIdBytes = Buffer.from(gameId.replace(/-/g, ''), 'hex');
  
  console.log('🎮 Finding Game Account:');
  console.log('========================');
  
  try {
    // Game account PDA - [b"game", game_id.as_ref()]
    const [gamePda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), gameIdBytes],
      programId
    );
    
    console.log('Game ID:', gameId);
    console.log('Game PDA:', gamePda.toBase58());
    console.log('Bump:', bump);
    
    // Check if game account exists
    const accountInfo = await connection.getAccountInfo(gamePda);
    if (accountInfo) {
      console.log('✅ Game account exists');
      console.log('Data length:', accountInfo.data.length);
    } else {
      console.log('❌ Game account does not exist yet');
      console.log('💡 Will be created when setWinners is called');
    }
    console.log();

    return {
      gameId,
      gamePda: gamePda.toBase58(),
      bump
    };

  } catch (err) {
    console.error('Error finding game account:', err);
  }
}

async function main() {
  console.log('Starting Solana Prize Pool Account Discovery...\n');
  
  const poolAccounts = await findProgramAccounts();
  const gameAccount = await testGameAccount();
  
  console.log('📝 Summary for Integration:');
  console.log('===========================');
  console.log('1. Entry fees should go to:', poolAccounts?.poolTokenAccount);
  console.log('2. Game account PDA:', gameAccount?.gamePda);
  console.log('3. Pool authority PDA:', poolAccounts?.poolPda);
  console.log();
  console.log('💡 Next Steps:');
  console.log('- Update entry fee flow to send SPL to pool token account');
  console.log('- Update backend to call setWinners() on game end');
  console.log('- Update frontend to call claim() from program');
}

main().catch(console.error); 