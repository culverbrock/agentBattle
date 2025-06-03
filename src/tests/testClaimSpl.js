const { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
require('dotenv').config();

async function testClaimSpl() {
  console.log('🧪 Testing SPL Claim Function');
  console.log('=============================');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const programId = new PublicKey('6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs');
  const mint = new PublicKey('7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb');
  
  // Known game account with SPL winnings
  const gameAccount = new PublicKey('DsvXa7qNAuv2Rkx5cX5aUW1diL4YGyt4EJfqPkWtaqxq');
  
  // Winner wallet (this should match a winner in the game account)
  const winnerAddress = '8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN';
  const winner = new PublicKey(winnerAddress);
  
  // Load the winner's private key (you'll need to provide this)
  // For testing, we'll create a test keypair - replace with actual winner's key
  let winnerKeypair;
  if (process.env.TEST_WINNER_PRIVATE_KEY) {
    try {
      const privateKeyArray = JSON.parse(process.env.TEST_WINNER_PRIVATE_KEY);
      winnerKeypair = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
      console.log('Using winner keypair from env var:', winnerKeypair.publicKey.toBase58());
      if (winnerKeypair.publicKey.toBase58() !== winnerAddress) {
        console.warn('⚠️  Private key wallet does not match expected winner address');
        console.warn('Expected:', winnerAddress);
        console.warn('Got:', winnerKeypair.publicKey.toBase58());
      }
    } catch (err) {
      console.error('Failed to load TEST_WINNER_PRIVATE_KEY:', err.message);
      winnerKeypair = null;
    }
  } else {
    console.log('TEST_WINNER_PRIVATE_KEY not set, will only simulate with correct accounts...');
    winnerKeypair = null;
  }
  
  // Derive PDAs
  const [poolAuthority] = await PublicKey.findProgramAddress(
    [Buffer.from('pool')],
    programId
  );
  
  console.log('Test setup:');
  console.log('- Game Account:', gameAccount.toBase58());
  console.log('- Winner Address:', winnerAddress);
  console.log('- Pool Authority:', poolAuthority.toBase58());
  console.log('- Program ID:', programId.toBase58());
  
  // Get token accounts (use the actual winner address, not a test keypair)
  const poolTokenAccount = await getAssociatedTokenAddress(mint, poolAuthority, true);
  const winnerTokenAccount = await getAssociatedTokenAddress(mint, winner);
  
  console.log('- Pool Token Account:', poolTokenAccount.toBase58());
  console.log('- Winner Token Account:', winnerTokenAccount.toBase58());
  
  // Check if game account exists and read data
  const gameAccountInfo = await connection.getAccountInfo(gameAccount);
  if (!gameAccountInfo) {
    throw new Error('Game account not found');
  }
  
  console.log('\\n📋 Game Account Info:');
  console.log('- Data length:', gameAccountInfo.data.length);
  console.log('- Owner:', gameAccountInfo.owner.toBase58());
  
  // Parse game data to get the actual game ID
  const gameData = gameAccountInfo.data;
  if (gameData.length < 40) {
    throw new Error('Invalid game account data');
  }
  
  const actualGameId = gameData.slice(8, 40); // Skip discriminator, get game_id
  console.log('- Game ID (bytes):', Array.from(actualGameId));
  console.log('- Game ID (hex):', Buffer.from(actualGameId).toString('hex'));
  
  // Check pool token account
  const poolTokenAccountInfo = await connection.getAccountInfo(poolTokenAccount);
  if (!poolTokenAccountInfo) {
    throw new Error('Pool token account does not exist');
  }
  console.log('\\n💰 Pool Token Account Balance:');
  const poolBalance = await connection.getTokenAccountBalance(poolTokenAccount);
  console.log('- Balance:', poolBalance.value.uiAmount, 'SPL');
  
  // Check if winner token account exists
  const winnerTokenAccountInfo = await connection.getAccountInfo(winnerTokenAccount);
  const instructions = [];
  
  if (!winnerTokenAccountInfo) {
    console.log('\\n🔧 Winner token account does not exist');
    console.log('- Would need to create:', winnerTokenAccount.toBase58());
    console.log('- Owner would be:', winner.toBase58());
    
    // Only add create instruction if we have the private key
    if (winnerKeypair) {
      const createWinnerTokenAccountIx = createAssociatedTokenAccountInstruction(
        winnerKeypair.publicKey, // payer
        winnerTokenAccount, // ata
        winner, // owner
        mint // mint
      );
      instructions.push(createWinnerTokenAccountIx);
    }
  } else {
    console.log('\\n💰 Winner Token Account exists');
    const winnerBalance = await connection.getTokenAccountBalance(winnerTokenAccount);
    console.log('- Current balance:', winnerBalance.value.uiAmount, 'SPL');
  }
  
  // Create claim instruction
  console.log('\\n🎯 Creating claim instruction...');
  const discriminator = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
  
  const instructionData = Buffer.concat([
    discriminator,
    actualGameId
  ]);
  
  console.log('- Discriminator:', Array.from(discriminator));
  console.log('- Game ID:', Array.from(actualGameId));
  console.log('- Full instruction data:', Array.from(instructionData));
  
  const claimIx = new TransactionInstruction({
    keys: [
      { pubkey: gameAccount, isSigner: false, isWritable: true },
      { pubkey: winner, isSigner: true, isWritable: true }, // Use actual winner, not keypair
      { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
      { pubkey: winnerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: poolAuthority, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false }
    ],
    programId,
    data: instructionData
  });
  
  instructions.push(claimIx);
  
  console.log('\\n📝 Transaction accounts:');
  claimIx.keys.forEach((key, i) => {
    console.log(`  ${i}: ${key.pubkey.toBase58()} (signer: ${key.isSigner}, writable: ${key.isWritable})`);
  });
  
  // Build transaction
  const tx = new Transaction().add(...instructions);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = winner; // Use actual winner
  
  console.log('\\n🚀 Simulating transaction...');
  try {
    // Simple simulation without signature verification
    const simulation = await connection.simulateTransaction(tx);
    
    if (simulation.value.err) {
      console.error('❌ Simulation failed:');
      console.error('Error:', simulation.value.err);
      console.error('Logs:');
      simulation.value.logs?.forEach(log => console.error('  ', log));
      
      // Let's also check the game account data to see what winners are actually set
      console.log('\\n🔍 Debugging game account data...');
      const gameData = gameAccountInfo.data;
      console.log('- Account owner:', gameAccountInfo.owner.toBase58());
      console.log('- Data length:', gameData.length);
      
      // Parse more of the game account structure
      // [8 bytes discriminator][32 bytes game_id][4 bytes vec len][32*n bytes winners][4 bytes vec len][8*n bytes amounts][4 bytes vec len][n bytes claimed][1 byte winners_set]
      let offset = 8 + 32; // Skip discriminator and game_id
      
      // Read winners vector length
      const winnersLen = gameData.readUInt32LE(offset);
      offset += 4;
      console.log('- Winners count:', winnersLen);
      
      for (let i = 0; i < winnersLen; i++) {
        const winnerBytes = gameData.slice(offset, offset + 32);
        const winnerPubkey = new PublicKey(winnerBytes);
        console.log(`  Winner ${i}:`, winnerPubkey.toBase58());
        offset += 32;
      }
      
      // Read amounts vector length
      const amountsLen = gameData.readUInt32LE(offset);
      offset += 4;
      console.log('- Amounts count:', amountsLen);
      
      for (let i = 0; i < amountsLen; i++) {
        const amount = gameData.readBigUInt64LE(offset);
        console.log(`  Amount ${i}:`, amount.toString());
        offset += 8;
      }
      
      return;
    }
    
    console.log('✅ Simulation successful!');
    console.log('Logs:');
    simulation.value.logs?.forEach(log => console.log('  ', log));
    
    // If simulation passes and we have private key, send real transaction
    if (winnerKeypair) {
      console.log('\\n🎯 Simulation passed! Sending real transaction...');
      
      // Sign and send
      tx.partialSign(winnerKeypair);
      const signature = await connection.sendRawTransaction(tx.serialize());
      console.log('📡 Transaction sent:', signature);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        console.error('❌ Transaction failed:', confirmation.value.err);
      } else {
        console.log('✅ Transaction confirmed!');
        
        // Check balances after
        const newWinnerBalance = await connection.getTokenAccountBalance(winnerTokenAccount);
        const newPoolBalance = await connection.getTokenAccountBalance(poolTokenAccount);
        console.log('\\n💰 Final balances:');
        console.log('- Winner:', newWinnerBalance.value.uiAmount, 'SPL');
        console.log('- Pool:', newPoolBalance.value.uiAmount, 'SPL');
      }
    } else {
      console.log('\\n⚠️  Set TEST_WINNER_PRIVATE_KEY to send real transaction');
      console.log('   The private key should be the 64-element array for:', winnerAddress);
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err);
  }
}

if (require.main === module) {
  testClaimSpl().catch(console.error);
}

module.exports = { testClaimSpl }; 