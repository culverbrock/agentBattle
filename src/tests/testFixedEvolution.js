const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');

async function testFixedEvolution() {
  console.log('🧪 Testing Fixed Evolution System');
  console.log('='.repeat(50));
  console.log('🎯 Objective: Verify we maintain exactly 6 strategies always');
  console.log('');

  try {
    // Run a short evolution to test the fix
    const result = await runEnhancedEvolution(2, 3); // 2 tournaments, 3 games each
    
    console.log('\n✅ EVOLUTION TEST COMPLETED');
    console.log('='.repeat(30));
    
    // Check final strategy count
    const finalStrategies = result.finalStats;
    console.log(`🔢 Final strategy count: ${finalStrategies.length}`);
    
    if (finalStrategies.length === 6) {
      console.log('🎉 SUCCESS: Maintained exactly 6 strategies!');
      
      // Show the strategies
      console.log('\n📋 Final 6 Strategies:');
      finalStrategies.forEach((s, i) => {
        const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][i];
        console.log(`${rank} ${s.name}: ${s.coinBalance} coins`);
      });
      
      return true;
    } else {
      console.log(`❌ FAILED: Expected 6 strategies, got ${finalStrategies.length}`);
      return false;
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testFixedEvolution()
    .then(success => {
      if (success) {
        console.log('\n🎉 Evolution fix test PASSED!');
        process.exit(0);
      } else {
        console.log('\n❌ Evolution fix test FAILED!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test crashed:', error.message);
      process.exit(1);
    });
}

module.exports = { testFixedEvolution }; 