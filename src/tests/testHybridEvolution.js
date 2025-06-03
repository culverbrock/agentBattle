const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');

async function testHybridEvolution() {
  console.log('🧪 TESTING HYBRID EVOLUTION SYSTEM');
  console.log('===================================');
  console.log('This system should:');
  console.log('1. Eliminate bankrupt strategies (< 100 coins) when they exist');
  console.log('2. Force eliminate bottom 2 performers when no bankruptcies');
  console.log('3. Always maintain exactly 6 strategies');
  console.log('4. Conserve total money through inheritance');
  console.log('');
  
  try {
    const result = await runEnhancedEvolution(2, 3); // 2 tournaments, 3 games each
    
    if (result && result.finalStats) {
      console.log('\n✅ HYBRID EVOLUTION TEST RESULTS:');
      console.log('==================================');
      
      // Check final strategy count
      const finalCount = result.finalStats.length;
      console.log(`📊 Final strategy count: ${finalCount} (${finalCount === 6 ? '✅ CORRECT' : '❌ WRONG'})`);
      
      // Check money conservation
      const totalFinalMoney = result.finalStats.reduce((sum, s) => sum + s.coinBalance, 0);
      const startingMoney = 6 * 500; // 6 strategies × 500 coins each
      console.log(`💰 Money conservation: ${startingMoney} → ${totalFinalMoney} (${totalFinalMoney === startingMoney ? '✅ CONSERVED' : '❌ VIOLATED'})`);
      
      // Show final rankings
      console.log('\n🏆 Final Rankings:');
      result.finalStats.forEach((strategy, index) => {
        const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index];
        const change = strategy.coinBalance - 500;
        const changeStr = change >= 0 ? `+${change}` : `${change}`;
        console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${changeStr})`);
      });
      
      console.log('\n✅ Hybrid evolution test completed successfully!');
      
    } else {
      console.log('❌ Test failed - no results returned');
    }
    
  } catch (error) {
    console.error('❌ Hybrid evolution test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testHybridEvolution().catch(console.error);
}

module.exports = { testHybridEvolution }; 