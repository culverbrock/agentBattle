const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// EXACT IDL from the user - the deployed program
const EXACT_IDL = {
  "version": "0.1.0",
  "name": "solana_prize_pool",
  "instructions": [
    {
      "name": "setWinners",
      "accounts": [
        {"name": "game", "isMut": true, "isSigner": true},           // ✅ THIS IS THE KEY - game IS a signer!
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

async function testWithExactIDL() {
  console.log('🚀 Testing with EXACT IDL from Deployed Program');
  console.log('===============================================');
  
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
  
  const program = new anchor.Program(EXACT_IDL, PROGRAM_ID, provider);
  console.log(`Program ID: ${program.programId.toString()}`);
  
  // Test game data
  const timestamp = Date.now().toString();
  const gameId = `exact-idl-${timestamp}`;
  const gameIdBuffer = Buffer.alloc(32);
  const hash = Buffer.from(gameId).toString('hex').padEnd(64, '0');
  for (let i = 0; i < 32; i++) {
    gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  const gameIdBytes = Array.from(gameIdBuffer);
  
  const winner = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
  const winners = [winner];
  const amounts = [new anchor.BN(100_000_000)]; // 100 tokens with 6 decimals
  
  console.log("Game ID:", gameId);
  console.log("Winners:", winners.map(w => w.toString()));
  console.log("Amounts:", amounts.map(a => a.toString()));
  
  // 🔑 KEY INSIGHT: Game account must be a Keypair (signer), not a PDA!
  const gameKeypair = Keypair.generate();
  console.log("Game Keypair (signer):", gameKeypair.publicKey.toString());
  
  try {
    console.log('\n🔄 Sending setWinners transaction...');
    console.log('💡 Using game account as SIGNER (not PDA)');
    
    // Call setWinners with the game account as a signer
    const txHash = await program.methods
      .setWinners(gameIdBytes, winners, amounts)
      .accounts({
        game: gameKeypair.publicKey,                              // 🔑 Game account (signer)
        authority: wallet.publicKey,                              // 🔑 Authority (signer)
        systemProgram: anchor.web3.SystemProgram.programId,      // System program
      })
      .signers([gameKeypair])                                     // 🔑 Game keypair must sign!
      .rpc();
      
    console.log(`✅ Transaction: ${txHash}`);
    
    // Confirm transaction
    await connection.confirmTransaction(txHash);
    console.log('✅ Transaction confirmed!');
    
    // Fetch and verify the account
    const gameAccount = await program.account.game.fetch(gameKeypair.publicKey);
    console.log('\n📋 Game Account Data:');
    console.log('  Game ID:', Buffer.from(gameAccount.gameId).toString('hex'));
    console.log('  Winners:', gameAccount.winners.map(w => w.toString()));
    console.log('  Amounts:', gameAccount.amounts.map(a => a.toString()));
    console.log('  Winners Set:', gameAccount.winnersSet);
    console.log('  Claimed:', gameAccount.claimed);
    
    console.log('\n🎉 SUCCESS! setWinners worked with exact IDL!');
    console.log('💡 The key was using a Keypair (signer) for the game account, not a PDA.');
    
    // Test multiple winners
    console.log('\n🔄 Testing with multiple winners...');
    
    const gameKeypair2 = Keypair.generate();
    const gameId2 = `exact-idl-multi-${timestamp}`;
    const gameIdBuffer2 = Buffer.alloc(32);
    const hash2 = Buffer.from(gameId2).toString('hex').padEnd(64, '0');
    for (let i = 0; i < 32; i++) {
      gameIdBuffer2[i] = parseInt(hash2.substr(i * 2, 2), 16);
    }
    const gameIdBytes2 = Array.from(gameIdBuffer2);
    
    const winner1 = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
    const winner2 = new PublicKey("92d5uAumDAzFSXBCUfRU28GCKVHLVE6GgLwAPeZfG5so");
    const multiWinners = [winner1, winner2];
    const multiAmounts = [new anchor.BN(75_000_000), new anchor.BN(25_000_000)]; // 75 + 25 = 100 tokens
    
    const txHash2 = await program.methods
      .setWinners(gameIdBytes2, multiWinners, multiAmounts)
      .accounts({
        game: gameKeypair2.publicKey,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([gameKeypair2])
      .rpc();
      
    console.log(`✅ Multi-winner transaction: ${txHash2}`);
    await connection.confirmTransaction(txHash2);
    
    const gameAccount2 = await program.account.game.fetch(gameKeypair2.publicKey);
    console.log('\n📋 Multi-Winner Game Account:');
    console.log('  Winners:', gameAccount2.winners.map(w => w.toString()));
    console.log('  Amounts:', gameAccount2.amounts.map(a => a.toString()));
    
    console.log('\n🎉🎉 ALL TESTS PASSED! The program works perfectly!');
    
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
    await testWithExactIDL();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 