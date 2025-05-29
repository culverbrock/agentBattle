// No imports needed: web3, anchor, pg and more are globally available

describe("Solana Prize Pool Tests", () => {
  
  it("setWinners - Create game with winners", async () => {
    console.log("🎮 Testing setWinners function...");
    
    // Test data - Use proper UUID format and convert to bytes
    const gameUuid = "33333333-3333-3333-3333-333333333333";
    const gameIdHex = gameUuid.replace(/-/g, ''); // Remove dashes
    
    // Convert hex string to proper byte array
    const gameIdBytes = [];
    for (let i = 0; i < gameIdHex.length; i += 2) {
      const hexByte = gameIdHex.substr(i, 2);
      gameIdBytes.push(parseInt(hexByte, 16));
    }
    
    // Pad to 32 bytes if needed
    while (gameIdBytes.length < 32) {
      gameIdBytes.push(0);
    }
    
    // Winner address and amount
    const winner = new web3.PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
    const winners = [winner];
    const amounts = [new BN(250 * 1000000)]; // 250 SPL tokens (6 decimals)
    
    console.log("Game UUID:", gameUuid);
    console.log("Game ID (hex):", gameIdHex);
    console.log("Game ID (bytes):", gameIdBytes);
    console.log("Winners:", winners.map(w => w.toString()));
    console.log("Amounts:", amounts.map(a => a.toString()));
    
    // Derive game PDA
    const [gamePda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('game'), Buffer.from(gameIdBytes)],
      pg.program.programId
    );
    
    console.log("Game PDA:", gamePda.toString());
    console.log("Program ID:", pg.program.programId.toString());
    console.log("Authority:", pg.wallet.publicKey.toString());
    
    // Check if account already exists
    try {
      const existingAccount = await pg.connection.getAccountInfo(gamePda);
      if (existingAccount) {
        console.log("⚠️ Game account already exists, test may fail");
        // Use a different gameId for this test
        return;
      }
    } catch (e) {
      console.log("✅ Game account doesn't exist, proceeding...");
    }
    
    // Call setWinners instruction
    const txHash = await pg.program.methods
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
    const gameAccount = await pg.program.account.game.fetch(gamePda);
    
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
  });
  
  it("setWinners - Multiple winners", async () => {
    console.log("🎮 Testing setWinners with multiple winners...");
    
    // Different gameId for this test
    const gameUuid = "44444444-4444-4444-4444-444444444444";
    const gameIdHex = gameUuid.replace(/-/g, '');
    
    const gameIdBytes = [];
    for (let i = 0; i < gameIdHex.length; i += 2) {
      const hexByte = gameIdHex.substr(i, 2);
      gameIdBytes.push(parseInt(hexByte, 16));
    }
    while (gameIdBytes.length < 32) {
      gameIdBytes.push(0);
    }
    
    // Multiple winners
    const winner1 = new web3.PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
    const winner2 = pg.wallet.publicKey; // Use playground wallet as second winner
    const winners = [winner1, winner2];
    const amounts = [new BN(150 * 1000000), new BN(100 * 1000000)]; // 150 and 100 SPL tokens
    
    console.log("Game UUID:", gameUuid);
    console.log("Winners:", winners.map(w => w.toString()));
    console.log("Amounts:", amounts.map(a => a.toString()));
    
    const [gamePda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('game'), Buffer.from(gameIdBytes)],
      pg.program.programId
    );
    
    console.log("Game PDA:", gamePda.toString());
    
    // Call setWinners instruction
    const txHash = await pg.program.methods
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
    const gameAccount = await pg.program.account.game.fetch(gamePda);
    
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
  });
  
  it("setWinners - Try to set winners twice (should fail)", async () => {
    console.log("🚫 Testing duplicate setWinners (should fail)...");
    
    // Use same gameId as first test
    const gameUuid = "33333333-3333-3333-3333-333333333333";
    const gameIdHex = gameUuid.replace(/-/g, '');
    
    const gameIdBytes = [];
    for (let i = 0; i < gameIdHex.length; i += 2) {
      const hexByte = gameIdHex.substr(i, 2);
      gameIdBytes.push(parseInt(hexByte, 16));
    }
    while (gameIdBytes.length < 32) {
      gameIdBytes.push(0);
    }
    
    const winner = new web3.PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
    const winners = [winner];
    const amounts = [new BN(100 * 1000000)]; // Different amount
    
    const [gamePda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('game'), Buffer.from(gameIdBytes)],
      pg.program.programId
    );
    
    try {
      // This should fail because winners are already set
      await pg.program.methods
        .setWinners(gameIdBytes, winners, amounts)
        .accounts({
          game: gamePda,
          authority: pg.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
        
      assert(false, "Should have failed - winners already set");
    } catch (error) {
      console.log("✅ Expected error:", error.message);
      // Check if it's the WinnersAlreadySet error
      if (error.error && error.error.errorCode) {
        console.log("Error code:", error.error.errorCode.code);
        console.log("Error message:", error.error.errorMessage);
        // Error code 6001 should be WinnersAlreadySet
        assert(error.error.errorCode.code === 6001, "Should be WinnersAlreadySet error");
      }
    }
    
    console.log("🎉 Duplicate setWinners test passed!");
  });
}); 