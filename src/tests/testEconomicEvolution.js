// Test enhanced evolutionary system with runoff and economic scoring
const { runSingleGame, runChampionEvolution } = require('./evolutionaryStrategies');

async function testChampionVariations() {
  console.log('🧪 Testing Champion Strategy Variations');
  console.log('=======================================');
  console.log('✅ Top 2 performers + refined variations');
  console.log('✅ Runoff elimination + economic scoring');
  console.log('✅ Focused evolution on winners\n');
  
  try {
    console.log('🚀 Running focused champion evolution...\n');
    const result = await runChampionEvolution(1); // Just 1 generation for testing
    
    console.log('\n✅ CHAMPION TEST COMPLETE!');
    console.log('===========================');
    console.log(`🏆 Ultimate Winner: ${result.champion.name}`);
    console.log(`💰 Profit: ${result.champion.totalProfit >= 0 ? '+' : ''}${result.champion.totalProfit} tokens`);
    console.log(`📈 ROI: ${result.champion.roi.toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Champion test failed:', error);
  }
}

async function testBasicSystem() {
  console.log('🧪 Testing Basic Evolution System');
  console.log('=================================');
  console.log('✅ Runoff elimination until 61% threshold');
  console.log('✅ Economic scoring (profit/loss tracking)');
  console.log('✅ Dynamic minimum percentages\n');
  
  // Use just 3 strategies for faster testing
  const { initialStrategies } = require('./evolutionaryStrategies');
  const testStrategies = initialStrategies.slice(0, 3);
  
  console.log('🎯 Testing with strategies:');
  testStrategies.forEach(s => console.log(`   - ${s.name}: ${s.strategy.substring(0, 60)}...`));
  
  try {
    const result = await runSingleGame(testStrategies, 1);
    
    console.log('\n✅ BASIC TEST RESULTS:');
    console.log('======================');
    console.log(`🎮 Game completed in ${result.rounds} round(s)`);
    console.log(`🏆 Winner: ${result.winner?.name || 'None'}`);
    console.log(`💰 Economic results:`);
    
    result.economicResults.forEach(econ => {
      const profitIcon = econ.profit >= 0 ? '💰' : '💸';
      console.log(`   ${econ.name}: ${econ.payout} tokens (${profitIcon}${econ.profit >= 0 ? '+' : ''}${econ.profit} profit)`);
    });
    
    if (result.hasWinner) {
      console.log('\n🎉 Success! Runoff system achieved 61%+ winner');
    } else {
      console.log('\n⚠️  No clear winner - may need more rounds');
    }
    
  } catch (error) {
    console.error('❌ Basic test failed:', error);
  }
}

if (require.main === module) {
  // Run champion variations test
  testChampionVariations().catch(console.error);
} 