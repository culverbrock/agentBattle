const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');

async function debugGameEconomics() {
  console.log('🔍 DEBUGGING GAME ECONOMICS');
  console.log('=' .repeat(30));
  
  // Track total money before and after
  let totalMoneyBefore = 6 * 500; // 6 strategies × 500 coins
  console.log(`💰 Starting total money: ${totalMoneyBefore} coins`);
  
  // Run 1 tournament with 3 games to test
  const result = await runEnhancedEvolution(1, 3);
  
  if (result && result.finalStats) {
    const finalBalances = result.finalStats.map(s => s.coinBalance);
    const totalMoneyAfter = finalBalances.reduce((sum, balance) => sum + balance, 0);
    
    console.log('\n🔍 DETAILED ECONOMICS ANALYSIS:');
    console.log(`💰 Starting total: ${totalMoneyBefore} coins`);
    console.log(`💰 Final total: ${totalMoneyAfter} coins`);
    console.log(`💰 Money change: ${totalMoneyAfter - totalMoneyBefore} coins`);
    
    // Analyze each strategy
    console.log('\n📊 Per-Strategy Analysis:');
    result.finalStats.forEach((s, i) => {
      const startingMoney = 500;
      const moneyChange = s.coinBalance - startingMoney;
      const totalGamesInvested = s.gamesPlayed * 100; // Entry fees
      const netProfit = s.totalReturned - s.totalInvested;
      
      console.log(`${s.name}:`);
      console.log(`  🎮 Games played: ${s.gamesPlayed}`);
      console.log(`  💵 Total invested: ${s.totalInvested} coins`);
      console.log(`  💰 Total returned: ${s.totalReturned} coins`);
      console.log(`  📈 Net profit: ${netProfit} coins`);
      console.log(`  🏦 Balance: ${startingMoney} → ${s.coinBalance} (${moneyChange >= 0 ? '+' : ''}${moneyChange})`);
      console.log(`  ⚖️  Expected invested: ${totalGamesInvested} (${s.totalInvested === totalGamesInvested ? '✅' : '❌'})`);
      console.log('');
    });
    
    // Check total profits
    const totalNetProfit = result.finalStats.reduce((sum, s) => {
      return sum + (s.totalReturned - s.totalInvested);
    }, 0);
    
    console.log(`📊 TOTAL NET PROFIT ACROSS ALL STRATEGIES: ${totalNetProfit} coins`);
    console.log(`⚖️  Expected total profit: 0 coins (zero-sum game)`);
    
    if (totalNetProfit !== 0) {
      console.log(`❌ ECONOMICS VIOLATION: ${totalNetProfit} coins created from nothing!`);
    } else {
      console.log(`✅ Economics valid: zero-sum maintained`);
    }
    
    // Check if everyone is profitable
    const profitableStrategies = result.finalStats.filter(s => (s.totalReturned - s.totalInvested) > 0);
    console.log(`\n📈 Profitable strategies: ${profitableStrategies.length}/${result.finalStats.length}`);
    
    if (profitableStrategies.length === result.finalStats.length) {
      console.log(`❌ IMPOSSIBLE: All strategies are profitable in zero-sum game!`);
    }
    
  } else {
    console.log('❌ Debug failed - no results returned');
  }
}

// Run the debug
if (require.main === module) {
  debugGameEconomics().catch(console.error);
}

module.exports = { debugGameEconomics }; 