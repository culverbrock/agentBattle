const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Test games and winnings
const testGames = [
  {
    gameId: '33333333-3333-3333-3333-333333333333',
    winners: ['8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN'],
    amounts: [250] // 250 SPL tokens
  },
  {
    gameId: '44444444-4444-4444-4444-444444444444', 
    winners: ['8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN'],
    amounts: [180] // 180 SPL tokens
  },
  {
    gameId: '11111111-1111-1111-1111-111111111111',
    winners: ['8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN'], 
    amounts: [60] // 60 SPL tokens (latest)
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
  
  // Create setWinners instruction
  // Instruction discriminator for setWinners (first 8 bytes of sha256("global:set_winners"))
  const discriminator = Buffer.from([88, 229, 122, 118, 245, 197, 175, 192]);
  
  // Serialize gameId (32 bytes)
  const gameIdSerialized = gameIdBytes;
  
  // Serialize winners array
  const winnersLength = Buffer.alloc(4);
  winnersLength.writeUInt32LE(winnerPubkeys.length);
  const winnersData = Buffer.concat([
    winnersLength,
    ...winnerPubkeys.map(pk => pk.toBuffer())
  ]);
  
  // Serialize amounts array  
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
    gameIdSerialized,
    winnersData,
    amountsData
  ]);
  
  console.log(`Instruction data length: ${instructionData.length} bytes`);
  
  const setWinnersIx = new TransactionInstruction({
    keys: [
      { pubkey: gamePda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: new PublicKey('11111111111111111111111111111112'), isSigner: false, isWritable: false } // SystemProgram
    ],
    programId,
    data: instructionData
  });
  
  const tx = new Transaction().add(setWinnersIx);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  try {
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
    console.error(err);
  }
}

async function main() {
  console.log('🚀 Setting Winners for Test Games');
  console.log('=================================');
  
  for (const gameData of testGames) {
    try {
      await setWinnersForGame(gameData);
    } catch (err) {
      console.error(`Failed to set winners for ${gameData.gameId}:`, err.message);
    }
  }
  
  console.log('\n🎉 Done! You can now test on-chain claiming in the frontend.');
  console.log('Visit the claim winnings page and click "Claim SPL (Phantom)" buttons.');
}

main().catch(console.error); 