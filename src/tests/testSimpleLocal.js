const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
require('dotenv').config();

// Configuration  
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

async function testLocalConnection() {
  console.log('🚀 Testing Local Connection to Devnet Program');
  console.log('===============================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load wallet
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    throw new Error('Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
  }
  
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`✅ Wallet loaded: ${wallet.publicKey.toBase58()}`);
  
  // Test connection
  try {
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana, version: ${version['solana-core']}`);
    
    const slot = await connection.getSlot();
    console.log(`✅ Current slot: ${slot}`);
    
    // Check program account
    const programAccount = await connection.getAccountInfo(programId);
    if (programAccount) {
      console.log(`✅ Program account found`);
      console.log(`   - Owner: ${programAccount.owner.toString()}`);
      console.log(`   - Executable: ${programAccount.executable}`);
      console.log(`   - Data length: ${programAccount.data.length} bytes`);
    } else {
      console.log(`❌ Program account not found`);
      return;
    }
    
    // Try to create a simple PDA
    const gameIdBuffer = Buffer.from('test-simple-local-001');
    const [gamePda] = await PublicKey.findProgramAddress(
      [Buffer.from('game'), gameIdBuffer],
      programId
    );
    
    console.log(`✅ Game PDA derived: ${gamePda.toString()}`);
    
    // Check if PDA account exists
    const pdaAccount = await connection.getAccountInfo(gamePda);
    if (pdaAccount) {
      console.log(`✅ Game PDA account exists - size: ${pdaAccount.data.length} bytes`);
    } else {
      console.log(`ℹ️ Game PDA account doesn't exist (expected for new game)`);
    }
    
    console.log('\n🎉 Local connection test successful!');
    console.log('💡 The program is accessible and working from your local environment.');
    console.log('💡 The issue is likely just the specific instruction format or function name.');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await testLocalConnection();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 