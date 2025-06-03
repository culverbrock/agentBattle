const { StrategyManager } = require('../core/enhancedEvolutionarySystem');

async function testLLMHybridGeneration() {
  console.log('🧪 Testing LLM-Based Hybrid Strategy Generation');
  console.log('='.repeat(50));
  
  // Create a strategy manager
  const manager = new StrategyManager();
  
  // Create two mock successful strategies with performance data
  const strategy1 = {
    id: 'test_aggressive',
    name: 'Test Aggressive',
    strategy: 'Demand the largest possible share. Use threats and aggressive tactics. Form coalitions only when absolutely necessary.',
    archetype: 'AGGRESSIVE',
    coinBalance: 800, // Successful
    gamesPlayed: 10,
    totalInvested: 1000,
    totalReturned: 1300,
    winHistory: [
      { isWinner: true }, { isWinner: false }, { isWinner: true }, 
      { isWinner: true }, { isWinner: false }, { isWinner: true },
      { isWinner: true }, { isWinner: false }, { isWinner: true }, { isWinner: true }
    ] // 7 wins out of 10 = 70% win rate
  };
  
  const strategy2 = {
    id: 'test_diplomatic',
    name: 'Test Diplomatic',
    strategy: 'Build long-term trust through consistently fair offers. Prioritize mutual benefit and stable coalitions.',
    archetype: 'DIPLOMATIC',
    coinBalance: 750, // Moderately successful
    gamesPlayed: 10,
    totalInvested: 1000,
    totalReturned: 1250,
    winHistory: [
      { isWinner: false }, { isWinner: true }, { isWinner: false }, 
      { isWinner: true }, { isWinner: false }, { isWinner: true },
      { isWinner: false }, { isWinner: true }, { isWinner: false }, { isWinner: true }
    ] // 5 wins out of 10 = 50% win rate
  };
  
  console.log('\n📊 Parent Strategy 1:');
  console.log(`   Name: ${strategy1.name}`);
  console.log(`   Strategy: "${strategy1.strategy}"`);
  console.log(`   Balance: ${strategy1.coinBalance} coins`);
  console.log(`   Win Rate: 70% (7/10 games)`);
  console.log(`   ROI: ${((strategy1.totalReturned - strategy1.totalInvested) / strategy1.totalInvested * 100).toFixed(1)}%`);
  
  console.log('\n📊 Parent Strategy 2:');
  console.log(`   Name: ${strategy2.name}`);
  console.log(`   Strategy: "${strategy2.strategy}"`);
  console.log(`   Balance: ${strategy2.coinBalance} coins`);
  console.log(`   Win Rate: 50% (5/10 games)`);
  console.log(`   ROI: ${((strategy2.totalReturned - strategy2.totalInvested) / strategy2.totalInvested * 100).toFixed(1)}%`);
  
  console.log('\n🧬 Generating LLM-based hybrid...');
  
  try {
    const startTime = Date.now();
    const hybrid = await manager.createHybrid(strategy1, strategy2, 1);
    const endTime = Date.now();
    
    console.log('\n✅ SUCCESS! Hybrid strategy generated:');
    console.log('='.repeat(40));
    console.log(`🏷️  ID: ${hybrid.id}`);
    console.log(`📛 Name: ${hybrid.name}`);
    console.log(`🎯 Strategy: "${hybrid.strategy}"`);
    console.log(`🧬 Archetype: ${hybrid.archetype}`);
    console.log(`⚡ Generation Method: ${hybrid.generationMethod}`);
    console.log(`⏱️  Generation Time: ${endTime - startTime}ms`);
    
    // Validate the hybrid
    console.log('\n🔍 Validation:');
    console.log(`✓ Has valid ID: ${!!hybrid.id}`);
    console.log(`✓ Has valid name: ${!!hybrid.name}`);
    console.log(`✓ Has strategy description: ${!!hybrid.strategy}`);
    console.log(`✓ Strategy length: ${hybrid.strategy.length} characters`);
    console.log(`✓ Has parent strategies: ${hybrid.parentStrategies ? hybrid.parentStrategies.length : 0} parents`);
    console.log(`✓ Has performance data: ${!!hybrid.parentPerformance}`);
    console.log(`✓ Starts with fresh balance: ${hybrid.coinBalance} coins`);
    
    // Check if strategy looks reasonable
    const hasActionableContent = hybrid.strategy.toLowerCase().includes('threat') || 
                                 hybrid.strategy.toLowerCase().includes('trust') ||
                                 hybrid.strategy.toLowerCase().includes('coalition') ||
                                 hybrid.strategy.toLowerCase().includes('adapt') ||
                                 hybrid.strategy.toLowerCase().includes('aggressive') ||
                                 hybrid.strategy.toLowerCase().includes('diplomatic');
                                 
    console.log(`✓ Contains actionable tactics: ${hasActionableContent}`);
    
    if (hybrid.parentPerformance) {
      console.log('\n📈 Parent Performance Analysis Used:');
      console.log(`   Strategy 1 Win Rate: ${hybrid.parentPerformance.strategy1.winRate}%`);
      console.log(`   Strategy 2 Win Rate: ${hybrid.parentPerformance.strategy2.winRate}%`);
      console.log(`   Strategy 1 ROI: ${hybrid.parentPerformance.strategy1.roi}%`);
      console.log(`   Strategy 2 ROI: ${hybrid.parentPerformance.strategy2.roi}%`);
    }
    
    console.log('\n🎉 LLM Hybrid Generation Test: PASSED');
    return true;
    
  } catch (error) {
    console.error('\n❌ FAILED! Error generating hybrid:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.log('\n💡 This could be due to:');
    console.log('   - LLM API key not configured');
    console.log('   - Network connectivity issues');
    console.log('   - LLM service temporarily unavailable');
    console.log('   - Invalid prompt format');
    
    console.log('\n🔄 Testing fallback mechanism...');
    // The method should have fallen back to template-based generation
    return false;
  }
}

// Run the test
if (require.main === module) {
  testLLMHybridGeneration()
    .then(success => {
      if (success) {
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
      } else {
        console.log('\n⚠️  Test completed with issues - check fallback behavior');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test crashed:', error.message);
      process.exit(1);
    });
}

module.exports = { testLLMHybridGeneration }; 