const { StrategyManager } = require('../core/enhancedEvolutionarySystem');

async function testEvolutionSystem() {
  console.log('🧪 TESTING NEW PROFIT-WEIGHTED EVOLUTION SYSTEM');
  console.log('===============================================\n');
  
  const manager = new StrategyManager();
  
  // Simulate realistic post-tournament balances
  console.log('📊 SIMULATING POST-TOURNAMENT SCENARIO:');
  console.log('Setting up realistic strategy performance...\n');
  
  // Set different coin balances to simulate varied performance
  manager.strategies[0].coinBalance = 1000; // Top performer
  manager.strategies[1].coinBalance = 750;  // Second best
  manager.strategies[2].coinBalance = 500;  // Break-even
  manager.strategies[3].coinBalance = 400;  // Slight loss
  manager.strategies[4].coinBalance = 250;  // Poor performance
  manager.strategies[5].coinBalance = 100;  // Barely surviving
  
  // Add some game history for context
  manager.strategies.forEach((s, i) => {
    s.gamesPlayed = 10;
    s.totalInvested = 1000; // 10 games * 100 entry fee
    s.totalReturned = s.coinBalance + 500; // Starting balance was 500
  });
  
  console.log('💰 CURRENT STRATEGY PERFORMANCE:');
  manager.strategies.forEach((s, i) => {
    const profit = s.coinBalance - 500;
    const profitIcon = profit >= 0 ? '💰' : '💸';
    console.log(`   ${i + 1}. ${s.name}: ${s.coinBalance} coins (${profitIcon}${profit >= 0 ? '+' : ''}${profit})`);
  });
  
  console.log('\n🔄 TRIGGERING EVOLUTION...');
  console.log('Bottom 2 performers will be eliminated and replaced.\n');
  
  // Simulate evolution
  const sortedStrategies = [...manager.strategies].sort((a, b) => b.coinBalance - a.coinBalance);
  const survivors = sortedStrategies.slice(0, 4); // Top 4 survive
  const eliminated = sortedStrategies.slice(4, 6); // Bottom 2 eliminated
  
  console.log('💀 ELIMINATED STRATEGIES:');
  eliminated.forEach(s => {
    console.log(`   - ${s.name}: "${s.strategy}"`);
  });
  
  console.log('\n✅ SURVIVING STRATEGIES:');
  survivors.forEach(s => {
    console.log(`   - ${s.name}: ${s.coinBalance} coins`);
  });
  
  console.log('\n🧬 CREATING NEW EVOLVED STRATEGIES...\n');
  
  try {
    // Test the new evolution system
    const medianBalance = 500; // Simplified for testing
    const newStrategies = await manager.createEvolvedStrategies(survivors, eliminated, medianBalance, 2);
    
    console.log('\n🎉 EVOLUTION COMPLETE!');
    console.log('======================\n');
    
    console.log('✨ NEW EVOLVED STRATEGIES:');
    newStrategies.forEach((strategy, i) => {
      console.log(`\n${i + 1}. ${strategy.name}`);
      console.log(`   Strategy: "${strategy.strategy}"`);
      console.log(`   Based on: ${strategy.basedOn ? strategy.basedOn.map(b => `${b.name} (${b.weight}%)`).join(', ') : 'N/A'}`);
      console.log(`   Avoiding: ${strategy.avoiding}`);
      console.log(`   Length: ${strategy.strategy.length} characters`);
    });
    
    console.log('\n📈 EXPECTED COMPETITIVE ADVANTAGES:');
    console.log('- Strategies are based on proven profitable approaches');
    console.log('- Weighted by actual performance (coin balance)');
    console.log('- Designed to compete against current meta');
    console.log('- Explicitly avoid eliminated strategy patterns');
    
  } catch (error) {
    console.error('❌ Evolution test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testEvolutionSystem().catch(console.error);
}

module.exports = { testEvolutionSystem }; 