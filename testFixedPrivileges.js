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

function getDiscriminator(name) {
  const hash = crypto.createHash('sha256');
  hash.update(`global:${name}`);
  return hash.digest().slice(0, 8);
}

async function testFixedPrivileges() {
  console.log('🚀 Testing with Fixed Privileges');
  console.log('===============================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load wallet
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  
  // Test game data with timestamp for uniqueness
  const timestamp = Date.now().toString();
  const gameId = `fixed-privileges-${timestamp}`;
  const gameIdBuffer = Buffer.alloc(32);
  const hash = Buffer.from(gameId).toString('hex').padEnd(64, '0');
  for (let i = 0; i < 32; i++) {
    gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  
  const winner = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
  const winners = [winner];
  const amounts = [BigInt(100_000_000)]; // 100 tokens
  
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
  
  // Use the working discriminator
  const discriminator = getDiscriminator('set_winners');
  console.log(`Discriminator: [${Array.from(discriminator).join(', ')}]`);
  
  // Serialize data
  const winnersLength = Buffer.alloc(4);
  winnersLength.writeUInt32LE(winners.length);
  const winnersData = Buffer.concat([
    winnersLength,
    ...winners.map(pk => pk.toBuffer())
  ]);
  
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
    discriminator,
    gameIdBuffer,
    winnersData,
    amountsData
  ]);
  
  console.log(`Instruction data length: ${instructionData.length} bytes`);
  
  try {
    console.log('\n🔄 Building transaction with correct privileges...');
    
    // Create instruction with FIXED privileges
    const instruction = new TransactionInstruction({
      keys: [
        // ❌ BEFORE: { pubkey: gamePda, isSigner: false, isWritable: true }
        // ✅ NOW: Game PDA - NOT a signer, but writable for init
        { pubkey: gamePda, isSigner: false, isWritable: true },
        
        // Authority - IS a signer and writable (payer for init)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        
        // System program - NOT a signer, NOT writable
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: instructionData
    });
    
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    console.log('\n📝 Simulating transaction...');
    const simulation = await connection.simulateTransaction(transaction);
    
    if (simulation.value.err) {
      console.log(`❌ Simulation error: ${JSON.stringify(simulation.value.err)}`);
      if (simulation.value.logs) {
        console.log('Program logs:');
        simulation.value.logs.forEach(log => console.log(`  ${log}`));
      }
      return;
    }
    
    console.log('✅ Simulation successful!');
    
    console.log('\n🚀 Sending transaction...');
    const txHash = await connection.sendTransaction(transaction, [wallet]);
    console.log(`✅ Transaction: ${txHash}`);
    
    // Confirm transaction
    console.log('⏳ Confirming transaction...');
    await connection.confirmTransaction(txHash);
    console.log('✅ Transaction confirmed!');
    
    // Check the created account
    const gameAccount = await connection.getAccountInfo(gamePda);
    if (gameAccount) {
      console.log('\n📋 Game Account Created Successfully:');
      console.log(`  Data length: ${gameAccount.data.length} bytes`);
      console.log(`  Owner: ${gameAccount.owner.toString()}`);
      console.log(`  Lamports: ${gameAccount.lamports}`);
      
      // Try to deserialize some basic info
      if (gameAccount.data.length >= 40) {
        const gameIdFromAccount = gameAccount.data.slice(8, 40); // Skip discriminator
        console.log(`  Game ID (hex): ${gameIdFromAccount.toString('hex')}`);
      }
      
      console.log('\n🎉 SUCCESS! setWinners worked with raw Web3.js!');
      console.log('💡 The key was using the correct discriminator "set_winners" and proper account privileges.');
      
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
    await testFixedPrivileges();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 