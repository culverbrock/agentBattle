const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction, 
  SystemProgram 
} = require('@solana/web3.js');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Calculate the discriminator for setWinners instruction
function getInstructionDiscriminator(instructionName) {
  const hash = crypto.createHash('sha256');
  hash.update(`global:${instructionName}`);
  return hash.digest().slice(0, 8);
}

async function testRawWeb3() {
  console.log('🚀 Testing with Raw @solana/web3.js');
  console.log('===================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load wallet
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    throw new Error('Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
  }
  
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  
  // Test game data - use timestamp to ensure uniqueness
  const timestamp = Date.now().toString();
  const gameId = `raw-web3-${timestamp}`;
  const gameIdBuffer = Buffer.alloc(32);
  const hash = Buffer.from(gameId).toString('hex').padEnd(64, '0');
  for (let i = 0; i < 32; i++) {
    gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  
  const winner = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
  const winners = [winner];
  const amounts = [BigInt(100_000_000)]; // 100 tokens (using BigInt)
  
  console.log("Game ID:", gameId);
  console.log("Winners:", winners.map(w => w.toString()));
  console.log("Amounts:", amounts.map(a => a.toString()));
  
  // Derive game PDA
  const [gamePda] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBuffer],
    programId
  );
  console.log("Game PDA:", gamePda.toString());
  
  // Check if account exists
  const existingAccount = await connection.getAccountInfo(gamePda);
  if (existingAccount) {
    console.log('⚠️ Game account already exists, aborting...');
    return;
  } else {
    console.log('✅ Game account does not exist - good for init');
  }
  
  try {
    console.log('\n🔄 Building transaction...');
    
    // Build instruction data manually
    const discriminator = getInstructionDiscriminator('setWinners');
    console.log(`Discriminator: [${Array.from(discriminator).join(', ')}]`);
    
    // Serialize winners vec
    const winnersLength = Buffer.alloc(4);
    winnersLength.writeUInt32LE(winners.length);
    const winnersData = Buffer.concat([
      winnersLength,
      ...winners.map(pk => pk.toBuffer())
    ]);
    
    // Serialize amounts vec
    const amountsLength = Buffer.alloc(4);
    amountsLength.writeUInt32LE(amounts.length);
    const amountsData = Buffer.concat([
      amountsLength,
      ...amounts.map(amount => {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(amount);
        return buf;
      })
    ]);
    
    const instructionData = Buffer.concat([
      discriminator,      // 8 bytes
      gameIdBuffer,       // 32 bytes
      winnersData,        // 4 + 32*n bytes
      amountsData         // 4 + 8*n bytes
    ]);
    
    console.log(`Instruction data length: ${instructionData.length} bytes`);
    
    // Create instruction
    const setWinnersIx = new TransactionInstruction({
      keys: [
        { pubkey: gamePda, isSigner: false, isWritable: true },           // game (PDA)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },   // authority
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // system_program
      ],
      programId,
      data: instructionData
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(setWinnersIx);
    transaction.feePayer = wallet.publicKey;
    
    console.log('\n📝 Simulating transaction...');
    const simulation = await connection.simulateTransaction(transaction);
    console.log(`Simulation success: ${!simulation.value.err}`);
    
    if (simulation.value.err) {
      console.log(`❌ Simulation error: ${JSON.stringify(simulation.value.err)}`);
      if (simulation.value.logs) {
        console.log('Logs:');
        simulation.value.logs.forEach(log => console.log(`  ${log}`));
      }
      return;
    }
    
    console.log('\n🚀 Sending transaction...');
    const txHash = await connection.sendTransaction(transaction, [wallet]);
    console.log(`✅ Transaction: ${txHash}`);
    
    // Confirm transaction
    await connection.confirmTransaction(txHash);
    console.log('✅ Transaction confirmed!');
    
    // Check the created account
    const gameAccount = await connection.getAccountInfo(gamePda);
    if (gameAccount) {
      console.log('\n📋 Game Account Created:');
      console.log(`  Data length: ${gameAccount.data.length} bytes`);
      console.log(`  Owner: ${gameAccount.owner.toString()}`);
      console.log('\n🎉 Raw Web3.js test PASSED!');
    } else {
      console.log('❌ Game account not found after transaction');
    }
    
  } catch (error) {
    console.error('❌ Transaction failed:', error.message);
    if (error.logs) {
      console.error('Program logs:', error.logs);
    }
    throw error;
  }
}

async function main() {
  try {
    await testRawWeb3();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 