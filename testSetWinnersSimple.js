const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const { serialize } = require('borsh');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Instruction data for setWinners function
// Based on Anchor's instruction discriminator calculation
function getSetWinnersDiscriminator() {
  // setWinners instruction discriminator (first 8 bytes of sha256("global:set_winners"))
  // This is how Anchor calculates it
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update('global:set_winners');
  const fullHash = hash.digest();
  return fullHash.slice(0, 8);
}

// Borsh schema for serializing the instruction data
const instructionSchema = new Map([
  ['SetWinnersArgs', {
    kind: 'struct',
    fields: [
      ['gameId', [32]], // [u8; 32]
      ['winners', ['publicKey']], // Vec<Pubkey>
      ['amounts', ['u64']] // Vec<u64>
    ]
  }]
]);

async function testDeployedProgram() {
  console.log('🚀 Testing Deployed Solana Prize Pool Program');
  console.log('===============================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load admin wallet
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    throw new Error('Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
  }
  
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const admin = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Admin wallet: ${admin.publicKey.toBase58()}`);
  
  // Test data
  const gameId = '11111111-1111-1111-1111-111111111111';
  const gameIdBytes = Buffer.alloc(32);
  const gameIdStr = gameId.replace(/-/g, '');
  const gameIdHex = Buffer.from(gameIdStr, 'hex');
  gameIdHex.copy(gameIdBytes, 0, 0, Math.min(16, gameIdHex.length));
  
  const winners = [new PublicKey('8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN')];
  const amounts = [BigInt(250 * 10 ** 6)]; // 250 SPL tokens
  
  console.log(`\n🎮 Testing game: ${gameId}`);
  console.log(`Winners: ${winners.map(w => w.toBase58())}`);
  console.log(`Amounts: ${amounts.map(a => a.toString())}`);
  
  // Derive game PDA
  const [gamePda] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBytes],
    programId
  );
  
  console.log(`Game PDA: ${gamePda.toBase58()}`);
  
  // Check if account exists
  try {
    const gameAccount = await connection.getAccountInfo(gamePda);
    if (gameAccount) {
      console.log('⚠️ Game account already exists');
      console.log(`   Owner: ${gameAccount.owner.toBase58()}`);
      console.log(`   Data length: ${gameAccount.data.length} bytes`);
      return;
    } else {
      console.log('✅ Game account doesn\'t exist, proceeding...');
    }
  } catch (err) {
    console.log('✅ Game account doesn\'t exist, proceeding...');
  }
  
  // Create instruction data using Anchor's method
  const discriminator = getSetWinnersDiscriminator();
  console.log(`Instruction discriminator: ${discriminator.toString('hex')}`);
  
  // Manual serialization (Anchor format)
  const gameIdArray = Array.from(gameIdBytes);
  const winnersArray = winners.map(w => w.toBytes());
  const amountsArray = amounts.map(a => {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(a);
    return buf;
  });
  
  // Serialize in Anchor format
  let data = Buffer.concat([
    discriminator,
    Buffer.from(gameIdArray),
    Buffer.from([winnersArray.length, 0, 0, 0]), // u32 length prefix
    Buffer.concat(winnersArray),
    Buffer.from([amountsArray.length, 0, 0, 0]), // u32 length prefix
    Buffer.concat(amountsArray)
  ]);
  
  console.log(`Instruction data length: ${data.length} bytes`);
  
  const setWinnersIx = new TransactionInstruction({
    keys: [
      { pubkey: gamePda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    programId,
    data
  });
  
  const tx = new Transaction().add(setWinnersIx);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  try {
    // First simulate
    const simulation = await connection.simulateTransaction(tx);
    console.log('\n📝 Transaction simulation:');
    console.log(`   Success: ${!simulation.value.err}`);
    if (simulation.value.err) {
      console.log(`   Error: ${JSON.stringify(simulation.value.err)}`);
    }
    if (simulation.value.logs) {
      console.log('   Logs:');
      simulation.value.logs.forEach(log => console.log(`     ${log}`));
    }
    
    if (!simulation.value.err) {
      // Send actual transaction
      console.log('\n🚀 Sending transaction...');
      const signature = await connection.sendTransaction(tx, [admin]);
      console.log(`✅ Transaction sent: ${signature}`);
      
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`✅ Transaction confirmed!`);
      
      // Check if account was created
      const newGameAccount = await connection.getAccountInfo(gamePda);
      if (newGameAccount) {
        console.log(`✅ Game account created! Size: ${newGameAccount.data.length} bytes`);
      }
    } else {
      console.log('❌ Simulation failed, not sending transaction');
    }
    
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    if (err.logs) {
      console.error('Program logs:', err.logs);
    }
  }
}

testDeployedProgram().catch(console.error); 