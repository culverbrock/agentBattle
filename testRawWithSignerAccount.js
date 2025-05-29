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

async function testRawWithSignerAccount() {
  console.log('🚀 Testing Raw Web3.js with Game Account as SIGNER');
  console.log('=================================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load wallet
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  
  // Test game data
  const timestamp = Date.now().toString();
  const gameId = `raw-signer-${timestamp}`;
  const gameIdBuffer = Buffer.alloc(32);
  const hash = Buffer.from(gameId).toString('hex').padEnd(64, '0');
  for (let i = 0; i < 32; i++) {
    gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  
  const winner = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
  const winners = [winner];
  const amounts = [BigInt(100_000_000)]; // 100 tokens with 6 decimals
  
  console.log("Game ID:", gameId);
  console.log("Winners:", winners.map(w => w.toString()));
  console.log("Amounts:", amounts.map(a => a.toString()));
  
  // 🔑 KEY: Generate a NEW keypair for the game account (it must be a signer!)
  const gameKeypair = Keypair.generate();
  console.log("Game Keypair (signer):", gameKeypair.publicKey.toString());
  
  // Use the correct discriminator (we found this works)
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
    console.log('\n🔄 Building transaction with game as SIGNER...');
    
    // Create instruction with game account as SIGNER
    const instruction = new TransactionInstruction({
      keys: [
        // 🔑 Game account - IS a signer, IS writable (new account)
        { pubkey: gameKeypair.publicKey, isSigner: true, isWritable: true },
        
        // Authority - IS a signer and writable (payer)
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
    // 🔑 IMPORTANT: Both wallet AND gameKeypair must sign!
    const txHash = await connection.sendTransaction(transaction, [wallet, gameKeypair]);
    console.log(`✅ Transaction: ${txHash}`);
    
    // Confirm transaction
    console.log('⏳ Confirming transaction...');
    await connection.confirmTransaction(txHash);
    console.log('✅ Transaction confirmed!');
    
    // Check the created account
    const gameAccount = await connection.getAccountInfo(gameKeypair.publicKey);
    if (gameAccount) {
      console.log('\n📋 Game Account Created Successfully:');
      console.log(`  Address: ${gameKeypair.publicKey.toString()}`);
      console.log(`  Data length: ${gameAccount.data.length} bytes`);
      console.log(`  Owner: ${gameAccount.owner.toString()}`);
      console.log(`  Lamports: ${gameAccount.lamports}`);
      
      // Try to parse some basic data
      if (gameAccount.data.length >= 40) {
        const accountDiscriminator = gameAccount.data.slice(0, 8);
        const gameIdFromAccount = gameAccount.data.slice(8, 40);
        console.log(`  Account discriminator: [${Array.from(accountDiscriminator).join(', ')}]`);
        console.log(`  Game ID (hex): ${gameIdFromAccount.toString('hex')}`);
      }
      
      console.log('\n🎉 SUCCESS! setWinners worked with game account as signer!');
      console.log('💡 The deployed program expects:');
      console.log('   1. Correct discriminator for "set_winners"');
      console.log('   2. Game account as a SIGNER (Keypair), not PDA');
      console.log('   3. Both authority and game account signing the transaction');
      
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
    await testRawWithSignerAccount();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 