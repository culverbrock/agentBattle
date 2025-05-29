const { Connection, PublicKey, Transaction, Keypair } = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  transfer,
  TOKEN_PROGRAM_ID 
} = require('@solana/spl-token');
require('dotenv').config();

async function setupPool() {
  console.log('🏊 Setting up SPL Prize Pool');
  console.log('===========================');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const mint = new PublicKey('7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb');
  const programId = new PublicKey('6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs');
  
  // Load the authority keypair
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    throw new Error('Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
  }
  
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const authority = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Authority: ${authority.publicKey.toBase58()}`);
  
  // Derive the pool authority PDA
  const [poolAuthority] = await PublicKey.findProgramAddress(
    [Buffer.from('pool')],
    programId
  );
  console.log(`Pool Authority PDA: ${poolAuthority.toBase58()}`);
  
  // Get the associated token accounts
  const poolTokenAccount = await getAssociatedTokenAddress(mint, poolAuthority, true);
  const authorityTokenAccount = await getAssociatedTokenAddress(mint, authority.publicKey);
  
  console.log(`Pool Token Account: ${poolTokenAccount.toBase58()}`);
  console.log(`Authority Token Account: ${authorityTokenAccount.toBase58()}`);
  
  // Check if pool token account exists
  const poolAccountInfo = await connection.getAccountInfo(poolTokenAccount);
  
  if (!poolAccountInfo) {
    console.log('\n📝 Creating pool token account...');
    
    const createPoolAccountIx = createAssociatedTokenAccountInstruction(
      authority.publicKey, // payer
      poolTokenAccount,    // ata
      poolAuthority,       // owner
      mint                 // mint
    );
    
    const transaction = new Transaction().add(createPoolAccountIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authority.publicKey;
    
    transaction.sign(authority);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`✅ Pool token account created: ${signature}`);
  } else {
    console.log('✅ Pool token account already exists');
  }
  
  // Check authority token account balance
  console.log('\n💰 Checking token balances...');
  const authorityBalance = await connection.getTokenAccountBalance(authorityTokenAccount);
  console.log(`Authority balance: ${authorityBalance.value.amount} (${authorityBalance.value.uiAmount})`);
  
  const poolBalance = await connection.getTokenAccountBalance(poolTokenAccount);
  console.log(`Pool balance: ${poolBalance.value.amount} (${poolBalance.value.uiAmount})`);
  
  // Transfer some tokens to the pool if needed
  const poolBalanceAmount = parseInt(poolBalance.value.amount);
  const minPoolBalance = 1000 * 1_000_000; // 1000 SPL tokens (6 decimals)
  
  if (poolBalanceAmount < minPoolBalance) {
    const transferAmount = minPoolBalance - poolBalanceAmount;
    console.log(`\n💸 Transferring ${transferAmount / 1_000_000} SPL to pool...`);
    
    const transferSig = await transfer(
      connection,
      authority,                // payer
      authorityTokenAccount,    // source
      poolTokenAccount,         // destination
      authority,                // owner
      transferAmount            // amount
    );
    
    console.log(`✅ Transferred tokens to pool: ${transferSig}`);
    
    // Check new balance
    const newPoolBalance = await connection.getTokenAccountBalance(poolTokenAccount);
    console.log(`New pool balance: ${newPoolBalance.value.amount} (${newPoolBalance.value.uiAmount})`);
  } else {
    console.log('✅ Pool has sufficient balance');
  }
  
  console.log('\n🎉 Pool setup complete!');
  console.log(`Pool Authority: ${poolAuthority.toBase58()}`);
  console.log(`Pool Token Account: ${poolTokenAccount.toBase58()}`);
}

setupPool().catch(console.error); 