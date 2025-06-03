const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// CORRECTED IDL based on what we learned:
// 1. Function discriminator should be for "set_winners" 
// 2. Game account might need to be a signer (based on privilege escalation error)
const WORKING_IDL = {
  "version": "0.1.0",
  "name": "solana_prize_pool",
  "instructions": [
    {
      "name": "setWinners",          // Anchor converts set_winners to setWinners
      "accounts": [
        {"name": "game", "isMut": true, "isSigner": true},        // CHANGED: Based on error, might need to be signer
        {"name": "authority", "isMut": true, "isSigner": true},
        {"name": "systemProgram", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "gameId", "type": {"array": ["u8", 32]}},
        {"name": "winners", "type": {"vec": "publicKey"}},
        {"name": "amounts", "type": {"vec": "u64"}}
      ]
    }
  ],
  "accounts": [
    {
      "name": "Game",
      "type": {
        "kind": "struct",
        "fields": [
          {"name": "gameId", "type": {"array": ["u8", 32]}},
          {"name": "winners", "type": {"vec": "publicKey"}},
          {"name": "amounts", "type": {"vec": "u64"}},
          {"name": "claimed", "type": {"vec": "bool"}},
          {"name": "winnersSet", "type": "bool"}
        ]
      }
    }
  ]
};

async function testAnchorWithCorrectDisc() {
  console.log('🚀 Testing Anchor with Correct Discriminator & Structure');
  console.log('======================================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  
  // Load wallet
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  
  // Create provider and program
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: 'confirmed' }
  );
  
  const program = new anchor.Program(WORKING_IDL, PROGRAM_ID, provider);
  console.log(`Program ID: ${program.programId.toString()}`);
  
  // Test game data
  const timestamp = Date.now().toString();
  const gameId = `anchor-correct-${timestamp}`;
  const gameIdBuffer = Buffer.alloc(32);
  const hash = Buffer.from(gameId).toString('hex').padEnd(64, '0');
  for (let i = 0; i < 32; i++) {
    gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  const gameIdBytes = Array.from(gameIdBuffer);
  
  const winner = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
  const winners = [winner];
  const amounts = [new anchor.BN(100_000_000)]; // 100 tokens
  
  console.log("Game ID:", gameId);
  console.log("Winners:", winners.map(w => w.toString()));
  console.log("Amounts:", amounts.map(a => a.toString()));
  
  // Create a new keypair for the game account if it needs to be a signer
  const gameKeypair = Keypair.generate();
  console.log("Game Keypair (if needed as signer):", gameKeypair.publicKey.toString());
  
  // Also try with PDA approach
  const [gamePda] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBuffer],
    program.programId
  );
  console.log("Game PDA (if needed as non-signer):", gamePda.toString());
  
  // Method 1: Try with game account as signer (new keypair)
  console.log('\n🔄 Method 1: Game account as signer (Keypair)...');
  try {
    const txHash1 = await program.methods
      .setWinners(gameIdBytes, winners, amounts)
      .accounts({
        game: gameKeypair.publicKey,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([gameKeypair])  // Game account signs
      .rpc();
      
    console.log(`✅ Method 1 SUCCESS: ${txHash1}`);
    await connection.confirmTransaction(txHash1);
    console.log('✅ Transaction confirmed with game as signer!');
    return;
    
  } catch (error) {
    console.log(`❌ Method 1 failed: ${error.message}`);
    if (error.logs) {
      console.log('Method 1 logs:', error.logs);
    }
  }
  
  // Method 2: Try with game account as PDA (no signer)
  console.log('\n🔄 Method 2: Game account as PDA (non-signer)...');
  try {
    // Create IDL variant where game is not a signer
    const PDA_IDL = {
      ...WORKING_IDL,
      instructions: [{
        ...WORKING_IDL.instructions[0],
        accounts: [
          {"name": "game", "isMut": true, "isSigner": false},      // PDA approach
          {"name": "authority", "isMut": true, "isSigner": true},
          {"name": "systemProgram", "isMut": false, "isSigner": false}
        ]
      }]
    };
    
    const pdaProgram = new anchor.Program(PDA_IDL, PROGRAM_ID, provider);
    
    const txHash2 = await pdaProgram.methods
      .setWinners(gameIdBytes, winners, amounts)
      .accounts({
        game: gamePda,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
      
    console.log(`✅ Method 2 SUCCESS: ${txHash2}`);
    await connection.confirmTransaction(txHash2);
    console.log('✅ Transaction confirmed with game as PDA!');
    
  } catch (error) {
    console.log(`❌ Method 2 failed: ${error.message}`);
    if (error.logs) {
      console.log('Method 2 logs:', error.logs);
    }
  }
  
  console.log('\n💡 Both methods tested. Check which one worked.');
}

async function main() {
  try {
    await testAnchorWithCorrectDisc();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 