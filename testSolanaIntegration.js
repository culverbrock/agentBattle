const { setSolanaWinners } = require('./solanaProgram');
require('dotenv').config();

async function testSolanaIntegration() {
  console.log('🧪 Testing Solana Integration');
  console.log('=============================');
  
  // Mock game data (similar to what would come from game state machine)
  const gameId = 'test-game-' + Date.now();
  const proposalDist = {
    '8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN': 100 // 100% to this wallet
  };
  const totalAmount = 250; // 250 SPL tokens
  
  console.log(`Game ID: ${gameId}`);
  console.log(`Winner distribution:`, proposalDist);
  console.log(`Total amount: ${totalAmount} SPL`);
  
  try {
    const result = await setSolanaWinners(gameId, proposalDist, totalAmount);
    
    console.log('\n✅ Success!');
    console.log(`Transaction: ${result.signature}`);
    console.log(`Game account: ${result.gameAccount}`);
    console.log(`Winners: ${result.winners}`);
    console.log(`Amounts: ${result.amounts}`);
    
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

// Only run if called directly (not when imported)
if (require.main === module) {
  testSolanaIntegration().catch(console.error);
}

module.exports = { testSolanaIntegration }; 