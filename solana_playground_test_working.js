// No imports needed: web3, anchor, pg and more are globally available

// Use the correct deployed program ID
const PROGRAM_ID = new web3.PublicKey("6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs");

// Define the IDL explicitly - Updated to match source code
const IDL = {
  "version": "0.1.0",
  "name": "solana_prize_pool",
  "instructions": [
    {
      "name": "setWinners",
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

describe("Solana Prize Pool Tests", () => {
  
  // Setup tests
  before(async () => {
    console.log("🔧 Setting up tests...");
    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Wallet:", pg.wallet.publicKey.toString());
    
    // Test connection first
    try {
      console.log("🌐 Testing RPC connection...");
      const version = await pg.connection.getVersion();
      console.log("✅ RPC connected, Solana version:", version['solana-core']);
      
      const slot = await pg.connection.getSlot();
      console.log("✅ Current slot:", slot);
    } catch (error) {
      console.log("⚠️ RPC connection issue:", error.message);
      console.log("Tests may fail due to network connectivity");
    }
    
    // Update program reference to use correct ID
    if (pg.program.programId.toString() !== PROGRAM_ID.toString()) {
      console.log("⚠️ Program ID mismatch. Current:", pg.program.programId.toString());
      console.log("⚠️ Expected:", PROGRAM_ID.toString());
    }
  });

  it("setWinners - Create game with winners", async () => {
    console.log("🎮 Testing setWinners function...");
    
    // Generate a unique game ID
    const gameIdBuffer = Buffer.alloc(32);
    const testGameId = "test-game-001";
    const hash = Buffer.from(testGameId).toString('hex').padEnd(64, '0');
    for (let i = 0; i < 32; i++) {
      gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
    }
    
    const gameIdBytes = Array.from(gameIdBuffer);
    
    // Winner address and amount
    const winner = new web3.PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
    const winners = [winner];
    const amounts = [new anchor.BN(250000000)]; // 250 SPL tokens (6 decimals)
    
    console.log("Game ID (bytes):", gameIdBytes.slice(0, 16)); // Show first 16 bytes
    console.log("Winners:", winners.map(w => w.toString()));
    console.log("Amounts:", amounts.map(a => a.toString()));
    
    // Derive game PDA using the correct program ID
    const [gamePda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('game'), gameIdBuffer],
      PROGRAM_ID
    );
    
    console.log("Game PDA:", gamePda.toString());
    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Authority:", pg.wallet.publicKey.toString());
    
    // Check if account already exists
    try {
      const existingAccount = await pg.connection.getAccountInfo(gamePda);
      if (existingAccount) {
        console.log("⚠️ Game account already exists, skipping test");
        return;
      }
    } catch (e) {
      console.log("✅ Game account doesn't exist, proceeding...");
    }
    
    try {
      // Use the manual program instantiation
      const program = new anchor.Program(
        IDL,
        PROGRAM_ID,
        pg.provider
      );
      
      console.log("🔄 Sending setWinners transaction...");
      
      // Call setWinners instruction
      const txHash = await program.methods
        .setWinners(gameIdBytes, winners, amounts)
        .accounts({
          game: gamePda,
          authority: pg.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
        
      console.log(`✅ setWinners transaction: ${txHash}`);
      console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

      // Confirm transaction
      await pg.connection.confirmTransaction(txHash);
      console.log("✅ Transaction confirmed!");

      // Fetch the created game account
      const gameAccount = await program.account.game.fetch(gamePda);
      
      console.log("📋 Game Account Data:");
      console.log("  Game ID:", Buffer.from(gameAccount.gameId).toString('hex'));
      console.log("  Winners:", gameAccount.winners.map(w => w.toString()));
      console.log("  Amounts:", gameAccount.amounts.map(a => a.toString()));
      console.log("  Claimed:", gameAccount.claimed);
      console.log("  Winners Set:", gameAccount.winnersSet);

      // Verify the data
      assert(gameAccount.winnersSet === true, "Winners should be set");
      assert(gameAccount.winners.length === 1, "Should have 1 winner");
      assert(gameAccount.winners[0].equals(winner), "Winner address should match");
      assert(gameAccount.amounts[0].eq(amounts[0]), "Amount should match");
      assert(gameAccount.claimed[0] === false, "Should not be claimed yet");
      
      console.log("🎉 setWinners test passed!");
      
    } catch (error) {
      console.error("❌ Transaction failed:", error.message);
      if (error.logs) {
        console.error("Program logs:", error.logs);
      }
      
      // Check if this is a network error
      if (error.message.includes("NetworkError") || error.message.includes("blockhash")) {
        console.log("💡 This appears to be a network connectivity issue with the RPC endpoint.");
        console.log("💡 Try running the test again in a few moments, or check Solana network status.");
        console.log("💡 Sometimes the RPC is temporarily overloaded - just retry the test.");
      }
      
      throw error;
    }
  });
  
  it("setWinners - Multiple winners", async () => {
    console.log("🎮 Testing setWinners with multiple winners...");
    
    // Different gameId for this test
    const gameIdBuffer = Buffer.alloc(32);
    const testGameId = "test-game-002";
    const hash = Buffer.from(testGameId).toString('hex').padEnd(64, '0');
    for (let i = 0; i < 32; i++) {
      gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
    }
    
    const gameIdBytes = Array.from(gameIdBuffer);
    
    // Multiple winners
    const winner1 = new web3.PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
    const winner2 = pg.wallet.publicKey; // Use playground wallet as second winner
    const winners = [winner1, winner2];
    const amounts = [new anchor.BN(150000000), new anchor.BN(100000000)]; // 150 and 100 SPL tokens
    
    console.log("Game ID (bytes):", gameIdBytes.slice(0, 16));
    console.log("Winners:", winners.map(w => w.toString()));
    console.log("Amounts:", amounts.map(a => a.toString()));
    
    const [gamePda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('game'), gameIdBuffer],
      PROGRAM_ID
    );
    
    console.log("Game PDA:", gamePda.toString());
    
    try {
      const program = new anchor.Program(
        IDL,
        PROGRAM_ID,
        pg.provider
      );
      
      console.log("🔄 Sending setWinners transaction...");
      
      // Call setWinners instruction
      const txHash = await program.methods
        .setWinners(gameIdBytes, winners, amounts)
        .accounts({
          game: gamePda,
          authority: pg.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
        
      console.log(`✅ setWinners transaction: ${txHash}`);

      // Confirm transaction
      await pg.connection.confirmTransaction(txHash);
      console.log("✅ Transaction confirmed!");

      // Fetch the created game account
      const gameAccount = await program.account.game.fetch(gamePda);
      
      console.log("📋 Game Account Data:");
      console.log("  Winners:", gameAccount.winners.map(w => w.toString()));
      console.log("  Amounts:", gameAccount.amounts.map(a => a.toString()));
      console.log("  Claimed:", gameAccount.claimed);

      // Verify the data
      assert(gameAccount.winnersSet === true, "Winners should be set");
      assert(gameAccount.winners.length === 2, "Should have 2 winners");
      assert(gameAccount.winners[0].equals(winner1), "First winner should match");
      assert(gameAccount.winners[1].equals(winner2), "Second winner should match");
      assert(gameAccount.amounts[0].eq(amounts[0]), "First amount should match");
      assert(gameAccount.amounts[1].eq(amounts[1]), "Second amount should match");
      
      console.log("🎉 Multiple winners test passed!");
      
    } catch (error) {
      console.error("❌ Transaction failed:", error.message);
      if (error.logs) {
        console.error("Program logs:", error.logs);
      }
      
      // Check if this is a network error
      if (error.message.includes("NetworkError") || error.message.includes("blockhash")) {
        console.log("💡 This appears to be a network connectivity issue with the RPC endpoint.");
        console.log("💡 Try running the test again in a few moments, or check Solana network status.");
        console.log("💡 Sometimes the RPC is temporarily overloaded - just retry the test.");
      }
      
      throw error;
    }
  });
  
  // Test simple single byte array
  it("setWinners - Simple test with incremental bytes", async () => {
    console.log("🎮 Testing setWinners with simple byte pattern...");
    
    // Simple gameId - use a test pattern
    const gameIdBuffer = Buffer.alloc(32);
    const testGameId = "test-game-003";
    const hash = Buffer.from(testGameId).toString('hex').padEnd(64, '0');
    for (let i = 0; i < 32; i++) {
      gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
    }
    
    const gameIdBytes = Array.from(gameIdBuffer);
    
    const winner = new web3.PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
    const winners = [winner];
    const amounts = [new anchor.BN(100000000)]; // 100 SPL tokens
    
    console.log("Game ID (simple bytes):", gameIdBytes);
    console.log("Winners:", winners.map(w => w.toString()));
    console.log("Amounts:", amounts.map(a => a.toString()));
    
    const [gamePda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('game'), gameIdBuffer],
      PROGRAM_ID
    );
    
    console.log("Game PDA:", gamePda.toString());
    
    try {
      const program = new anchor.Program(
        IDL,
        PROGRAM_ID,
        pg.provider
      );
      
      console.log("🔄 Sending setWinners transaction...");
      
      // Call setWinners instruction
      const txHash = await program.methods
        .setWinners(gameIdBytes, winners, amounts)
        .accounts({
          game: gamePda,
          authority: pg.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
        
      console.log(`✅ setWinners transaction: ${txHash}`);

      // Confirm transaction
      await pg.connection.confirmTransaction(txHash);
      console.log("✅ Transaction confirmed!");

      // Fetch the created game account
      const gameAccount = await program.account.game.fetch(gamePda);
      
      console.log("📋 Game Account Data:");
      console.log("  Game ID:", Array.from(gameAccount.gameId));
      console.log("  Winners:", gameAccount.winners.map(w => w.toString()));
      console.log("  Amounts:", gameAccount.amounts.map(a => a.toString()));
      console.log("  Winners Set:", gameAccount.winnersSet);

      // Verify the data
      assert(gameAccount.winnersSet === true, "Winners should be set");
      assert(gameAccount.winners.length === 1, "Should have 1 winner");
      assert(gameAccount.winners[0].equals(winner), "Winner address should match");
      assert(gameAccount.amounts[0].eq(amounts[0]), "Amount should match");
      
      console.log("🎉 Simple setWinners test passed!");
      
    } catch (error) {
      console.error("❌ Transaction failed:", error.message);
      if (error.logs) {
        console.error("Program logs:", error.logs);
      }
      
      // Check if this is a network error
      if (error.message.includes("NetworkError") || error.message.includes("blockhash")) {
        console.log("💡 This appears to be a network connectivity issue with the RPC endpoint.");
        console.log("💡 Try running the test again in a few moments, or check Solana network status.");
        console.log("💡 Sometimes the RPC is temporarily overloaded - just retry the test.");
      }
      
      throw error;
    }
  });
}); 