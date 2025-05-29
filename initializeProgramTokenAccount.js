const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } = require('@solana/spl-token');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SPL_MINT = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

async function initializeProgramTokenAccount() {
  console.log('🏦 Initializing Program Token Account');
  console.log('=====================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  const mint = new PublicKey(SPL_MINT);

  // Get the pool authority PDA
  const [poolAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), mint.toBuffer()],
    programId
  );

  console.log('Program ID:', PROGRAM_ID);
  console.log('SPL Mint:', SPL_MINT);
  console.log('Pool Authority PDA:', poolAuthority.toBase58());
  console.log('Bump:', bump);

  // Get the associated token account for the pool authority
  const poolTokenAccount = await getAssociatedTokenAddress(mint, poolAuthority, true);
  console.log('Pool Token Account:', poolTokenAccount.toBase58());
  console.log();

  // Check if it exists
  try {
    const accountInfo = await connection.getAccountInfo(poolTokenAccount);
    if (accountInfo) {
      console.log('✅ Pool token account already exists!');
      console.log('Account data length:', accountInfo.data.length);
      return poolTokenAccount.toBase58();
    }
  } catch (err) {
    console.log('Token account does not exist, need to create it...');
  }

  // To create the account, we need a payer with SOL
  // In a real deployment, you'd use your deployer wallet
  console.log('❌ Pool token account does not exist yet');
  console.log();
  console.log('🔧 To create the account, you need to:');
  console.log('1. Fund a wallet with SOL for transaction fees');
  console.log('2. Run this command with that wallet:');
  console.log();
  console.log('   spl-token create-account --owner', poolAuthority.toBase58(), SPL_MINT);
  console.log();
  console.log('   OR use this JavaScript code with a funded keypair:');
  console.log();
  console.log('   ```javascript');
  console.log('   const payer = Keypair.fromSecretKey(/* your funded keypair */);');
  console.log('   const ix = createAssociatedTokenAccountInstruction(');
  console.log('     payer.publicKey,     // payer');
  console.log('     poolTokenAccount,    // ata');
  console.log('     poolAuthority,       // owner');
  console.log('     mint                 // mint');
  console.log('   );');
  console.log('   const tx = new Transaction().add(ix);');
  console.log('   await connection.sendTransaction(tx, [payer]);');
  console.log('   ```');
  
  return null;
}

async function main() {
  console.log('Starting Program Token Account Initialization...\n');
  
  try {
    const result = await initializeProgramTokenAccount();
    
    console.log('\n📝 Summary:');
    console.log('===========');
    if (result) {
      console.log('✅ Program token account ready:', result);
      console.log('🎯 Entry fees can now be sent to this account');
    } else {
      console.log('❌ Program token account needs to be created');
      console.log('💡 Follow the instructions above to create it');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main().catch(console.error); 