const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Function to calculate Anchor instruction discriminator
function getAnchorDiscriminator(instructionName) {
  const hash = crypto.createHash('sha256');
  hash.update(`global:${instructionName}`);
  const fullHash = hash.digest();
  return fullHash.slice(0, 8);
}

// Test games and winnings
const testGames = [
  {
    gameId: '33333333-3333-3333-3333-333333333333',
    winners: ['8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN'],
    amounts: [250] // 250 SPL tokens
  }
];

async function setWinnersForGame(gameData) {
  console.log(`\n🎮 Setting winners for game: ${gameData.gameId}`);
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load admin wallet
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    throw new Error('Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
  }
  
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const admin = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Admin wallet: ${admin.publicKey.toBase58()}`);
  
  // Convert gameId to bytes32
  const gameIdBytes = Buffer.alloc(32);
  const gameIdStr = gameData.gameId.replace(/-/g, '');
  const gameIdHex = Buffer.from(gameIdStr, 'hex');
  gameIdHex.copy(gameIdBytes, 0, 0, Math.min(16, gameIdHex.length));
  
  // Derive game PDA
  const [gamePda] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBytes],
    programId
  );
  
  console.log(`Game PDA: ${gamePda.toBase58()}`);
  
  // Check if game account already exists
  const gameAccount = await connection.getAccountInfo(gamePda);
  if (gameAccount) {
    console.log('⚠️ Game account already exists, skipping...');
    return;
  }
  
  // Convert winners to PublicKeys
  const winnerPubkeys = gameData.winners.map(w => new PublicKey(w));
  const amounts = gameData.amounts.map(a => BigInt(a * 10 ** 6)); // Convert to lamports (6 decimals)
  
  console.log('Winners:', gameData.winners);
  console.log('Amounts (lamports):', amounts.map(a => a.toString()));
  
  // Calculate proper Anchor discriminator for setWinners
  const discriminator = getAnchorDiscriminator('setWinners');
  console.log(`setWinners discriminator: [${Array.from(discriminator).join(', ')}]`);
  console.log(`setWinners discriminator hex: ${discriminator.toString('hex')}`);
  
  // Serialize instruction data in Anchor format
  // gameId (32 bytes) + winners (4 bytes length + 32 bytes each) + amounts (4 bytes length + 8 bytes each)
  const winnersLength = Buffer.alloc(4);
  winnersLength.writeUInt32LE(winnerPubkeys.length);
  const winnersData = Buffer.concat([
    winnersLength,
    ...winnerPubkeys.map(pk => pk.toBuffer())
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
    gameIdBytes,
    winnersData,
    amountsData
  ]);
  
  console.log(`Instruction data length: ${instructionData.length} bytes`);
  
  const setWinnersIx = new TransactionInstruction({
    keys: [
      { pubkey: gamePda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    programId,
    data: instructionData
  });
  
  const tx = new Transaction().add(setWinnersIx);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  try {
    // First simulate
    console.log('\n📝 Simulating transaction...');
    const simulation = await connection.simulateTransaction(tx);
    console.log(`Simulation success: ${!simulation.value.err}`);
    
    if (simulation.value.err) {
      console.log(`Error: ${JSON.stringify(simulation.value.err)}`);
      if (simulation.value.logs) {
        console.log('Logs:');
        simulation.value.logs.forEach(log => console.log(`  ${log}`));
      }
      return;
    }
    
    // Send actual transaction
    console.log('\n🚀 Sending transaction...');
    const signature = await connection.sendTransaction(tx, [admin]);
    console.log(`✅ setWinners transaction sent: ${signature}`);
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`✅ Transaction confirmed!`);
    
    // Verify the account was created
    const newGameAccount = await connection.getAccountInfo(gamePda);
    if (newGameAccount) {
      console.log(`✅ Game account created successfully! Size: ${newGameAccount.data.length} bytes`);
    } else {
      console.log('❌ Game account not found after transaction');
    }
    
  } catch (err) {
    console.error(`❌ Error setting winners: ${err.message}`);
    if (err.logs) {
      console.error('Program logs:', err.logs);
    }
  }
}

async function main() {
  console.log('🚀 Setting Winners with Correct Anchor Discriminator');
  console.log('===================================================');
  
  for (const gameData of testGames) {
    try {
      await setWinnersForGame(gameData);
    } catch (err) {
      console.error(`Failed to set winners for ${gameData.gameId}:`, err.message);
    }
  }
  
  console.log('\n🎉 Done! You can now test on-chain claiming in the frontend.');
}

main().catch(console.error); 