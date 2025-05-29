const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } = require('@solana/spl-token');
require('dotenv').config();

// Configuration
const PROGRAM_ID = 'DFZn8wUy1m63ky68XtMx4zSQsy3K56HVrshhWeToyNzc';
const SPL_MINT = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

async function createProgramTokenAccount() {
  console.log('🏗️ Creating Program Token Account');
  console.log('==================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  const mint = new PublicKey(SPL_MINT);

  // Get your funded wallet (same one used for backend transfers)
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    console.error('❌ SOL_PRIZE_POOL_PRIVATE_KEY not found in environment');
    console.log('💡 Make sure you have a .env file with your Solana wallet private key');
    return;
  }

  const payer = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY)));
  console.log('Payer wallet:', payer.publicKey.toBase58());

  // Check payer balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Payer SOL balance:', balance / 1e9, 'SOL');
  
  if (balance < 1000000) { // Less than 0.001 SOL
    console.error('❌ Insufficient SOL for transaction fees');
    return;
  }

  // Get the pool authority PDA (this will own the token account)
  const [poolAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), mint.toBuffer()],
    programId
  );

  console.log('Pool Authority PDA:', poolAuthority.toBase58());
  console.log('Bump:', bump);

  // Get the associated token account address
  const poolTokenAccount = await getAssociatedTokenAddress(mint, poolAuthority, true);
  console.log('Pool Token Account to create:', poolTokenAccount.toBase58());

  // Check if it already exists
  try {
    const accountInfo = await connection.getAccountInfo(poolTokenAccount);
    if (accountInfo) {
      console.log('✅ Pool token account already exists!');
      return poolTokenAccount.toBase58();
    }
  } catch (err) {
    // Account doesn't exist, we'll create it
  }

  console.log('\n🔨 Creating associated token account...');

  try {
    // Create the associated token account instruction
    const createAtaIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,    // payer
      poolTokenAccount,   // ata address  
      poolAuthority,      // owner (the PDA)
      mint               // mint
    );

    // Build and send transaction
    const tx = new Transaction().add(createAtaIx);
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signature = await connection.sendTransaction(tx, [payer]);
    console.log('Transaction signature:', signature);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('✅ Transaction confirmed!');

    // Verify the account was created
    const accountInfo = await connection.getAccountInfo(poolTokenAccount);
    if (accountInfo) {
      console.log('✅ Pool token account successfully created!');
      console.log('Account address:', poolTokenAccount.toBase58());
      console.log('Owner:', poolAuthority.toBase58());
      return poolTokenAccount.toBase58();
    } else {
      console.error('❌ Account creation verification failed');
    }

  } catch (err) {
    console.error('❌ Failed to create token account:', err.message);
  }
}

async function main() {
  console.log('Starting Program Token Account Creation...\n');
  
  try {
    const result = await createProgramTokenAccount();
    
    console.log('\n📝 Summary:');
    console.log('===========');
    if (result) {
      console.log('✅ Program token account ready:', result);
      console.log('🎯 Entry fees can now be sent to this account');
      console.log('🔄 Frontend and backend updated to use this address');
    } else {
      console.log('❌ Failed to create program token account');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main().catch(console.error); 