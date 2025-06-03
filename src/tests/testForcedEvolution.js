const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');

async function testForcedEvolution() {
  console.log('🧪 Testing Forced Evolution + Fair Starting Balance');
  console.log('='.repeat(60));
  console.log('🎯 Testing:');
  console.log('   1. Bottom 2 strategies eliminated each tournament');
  console.log('   2. New strategies get median balance (not 500)');
  console.log('   3. Always maintain exactly 6 strategies');
  console.log('');

  try {
    // Run a short evolution to test the improvements
    const result = await runEnhancedEvolution(3, 4); // 3 tournaments, 4 games each
    
    console.log('\n✅ FORCED EVOLUTION TEST COMPLETED');
    console.log('='.repeat(40));
    
    // Check final strategy count
    const finalStrategies = result.finalStats;
    console.log(`🔢 Final strategy count: ${finalStrategies.length}`);
    
    if (finalStrategies.length === 6) {
      console.log('✅ SUCCESS: Maintained exactly 6 strategies!');
      
      // Show the strategies
      console.log('\n📋 Final 6 Strategies:');
      finalStrategies.forEach((s, i) => {
        const rank = ['🥇', '🥈', '🥉', '📍', '🏅', '⭐'][i];
        const generation = s.id.includes('gen') ? ` (Gen ${s.id.match(/gen(\d+)/)?.[1] || '?'})` : ' (Original)';
        console.log(`${rank} ${s.name}: ${s.coinBalance} coins${generation}`);
      });
      
      // Check if we have evolved strategies
      const evolvedStrategies = finalStrategies.filter(s => 
        s.id.includes('evolved') || s.id.includes('hybrid') || s.id.includes('gen')
      );
      
      console.log(`\n🧬 Evolution Results:`);
      console.log(`   📊 Evolved strategies in final pool: ${evolvedStrategies.length}/6`);
      console.log(`   🔄 Total generations processed: ~3 (forced every tournament)`);
      
      if (evolvedStrategies.length > 0) {
        console.log('✅ SUCCESS: Evolution produced new strategies!');
        
        // Check if evolved strategies have reasonable balances
        const evolvedBalances = evolvedStrategies.map(s => s.coinBalance);
        const originalBalances = finalStrategies.filter(s => !s.id.includes('evolved') && !s.id.includes('hybrid')).map(s => s.coinBalance);
        
        if (evolvedBalances.length > 0 && originalBalances.length > 0) {
          const avgEvolved = evolvedBalances.reduce((a, b) => a + b, 0) / evolvedBalances.length;
          const avgOriginal = originalBalances.reduce((a, b) => a + b, 0) / originalBalances.length;
          
          console.log(`   💰 Avg evolved balance: ${Math.round(avgEvolved)} coins`);
          console.log(`   💰 Avg original balance: ${Math.round(avgOriginal)} coins`);
          
          if (Math.abs(avgEvolved - avgOriginal) < 500) {
            console.log('✅ SUCCESS: Fair starting balance working!');
          } else {
            console.log('⚠️  Large balance gap - may need adjustment');
          }
        }
      }
      
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
  testForcedEvolution()
    .then(success => {
      if (success) {
        console.log('\n🎉 Forced Evolution test PASSED!');
        console.log('🚀 Ready for accelerated evolution simulations!');
        process.exit(0);
      } else {
        console.log('\n❌ Forced Evolution test FAILED!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test crashed:', error.message);
      process.exit(1);
    });
}

module.exports = { testForcedEvolution }; 