const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const BN = require('bn.js');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// IDL from our source code
const IDL = {
  "version": "0.1.0",
  "name": "solana_prize_pool",
  "instructions": [
    {
      "name": "set_winners",
      "accounts": [
        {"name": "game", "isMut": true, "isSigner": false},
        {"name": "authority", "isMut": true, "isSigner": true},
        {"name": "systemProgram", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "gameId", "type": {"array": ["u8", 32]}},
        {"name": "winners", "type": {"vec": "publicKey"}},
        {"name": "amounts", "type": {"vec": "u64"}}
      ]
    },
    {
      "name": "claim",
      "accounts": [
        {"name": "game", "isMut": true, "isSigner": false},
        {"name": "winner", "isMut": true, "isSigner": true},
        {"name": "prizePoolTokenAccount", "isMut": true, "isSigner": false},
        {"name": "winnerTokenAccount", "isMut": true, "isSigner": false},
        {"name": "prizePoolAuthority", "isMut": false, "isSigner": false},
        {"name": "tokenProgram", "isMut": false, "isSigner": false}
      ],
      "args": [
        {"name": "gameId", "type": {"array": ["u8", 32]}}
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
  ],
  "errors": [
    {"code": 6000, "name": "InvalidInput", "msg": "Invalid input parameters"},
    {"code": 6001, "name": "WinnersAlreadySet", "msg": "Winners already set for this game"},
    {"code": 6002, "name": "WinnersNotSet", "msg": "Winners not set for this game"},
    {"code": 6003, "name": "InvalidGameId", "msg": "Invalid game ID"},
    {"code": 6004, "name": "NotAWinner", "msg": "Not a winner"},
    {"code": 6005, "name": "AlreadyClaimed", "msg": "Prize already claimed"}
  ]
};

async function testSetWinners() {
  console.log('🚀 Testing setWinners with Anchor Framework');
  console.log('============================================');
  
  // Setup connection and provider
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  
  // Load admin wallet
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    throw new Error('Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
  }
  
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  
  // Create provider and program
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: 'confirmed' }
  );
  anchor.setProvider(provider);
  
  const program = new anchor.Program(IDL, PROGRAM_ID, provider);
  console.log(`Program ID: ${program.programId.toString()}`);
  
  // Test game data
  const gameId = "test-local-001";
  const gameIdBuffer = Buffer.alloc(32);
  const hash = Buffer.from(gameId).toString('hex').padEnd(64, '0');
  for (let i = 0; i < 32; i++) {
    gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  const gameIdBytes = Array.from(gameIdBuffer);
  
  const winner = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
  const winners = [winner];
  const amounts = [new BN(100000000)]; // 100 tokens
  
  console.log("Game ID:", gameId);
  console.log("Winners:", winners.map(w => w.toString()));
  console.log("Amounts:", amounts.map(a => a.toString()));
  
  // Derive game PDA
  const [gamePda] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBuffer],
    program.programId
  );
  console.log("Game PDA:", gamePda.toString());
  
  // Check if account exists
  const existingAccount = await connection.getAccountInfo(gamePda);
  if (existingAccount) {
    console.log('⚠️ Game account already exists, skipping...');
    return;
  }
  
  try {
    console.log('\n🔄 Sending setWinners transaction...');
    
    // Call setWinners using Anchor - try with underscore
    const txHash = await program.methods
      .set_winners(gameIdBytes, winners, amounts)
      .accounts({
        game: gamePda,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
      
    console.log(`✅ Transaction: ${txHash}`);
    
    // Confirm transaction
    await connection.confirmTransaction(txHash);
    console.log('✅ Transaction confirmed!');
    
    // Fetch and verify the account
    const gameAccount = await program.account.game.fetch(gamePda);
    console.log('\n📋 Game Account Data:');
    console.log('  Game ID:', Buffer.from(gameAccount.gameId).toString('hex'));
    console.log('  Winners:', gameAccount.winners.map(w => w.toString()));
    console.log('  Amounts:', gameAccount.amounts.map(a => a.toString()));
    console.log('  Winners Set:', gameAccount.winnersSet);
    console.log('  Claimed:', gameAccount.claimed);
    
    console.log('\n🎉 setWinners test passed!');
    
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
    await testSetWinners();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 