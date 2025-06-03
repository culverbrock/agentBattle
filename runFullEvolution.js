/**
 * Run Full Matrix-Based Evolution
 * 3 tournaments × 7 games = 21 total games
 */

const { runEnhancedEvolution } = require('./src/core/enhancedEvolutionarySystem');

async function runFullEvolution() {
  console.log('🚀 STARTING FULL MATRIX-BASED EVOLUTION');
  console.log('=====================================');
  console.log('📊 3 tournaments × 7 games = 21 total games');
  console.log('⚡ Matrix negotiations (3 rounds vs 5 text rounds)');
  console.log('💰 Profit-focused strategy evolution');
  console.log('📈 Full tracking and resume capability');
  console.log('🔢 Starting with 6 core strategies...');
  console.log('');

  try {
    const results = await runEnhancedEvolution(3, 7);
    
    console.log('');
    console.log('🎉 EVOLUTION COMPLETE!');
    console.log('======================');
    console.log('📁 Export file:', results.exportFile);
    console.log('💾 Progress file:', results.lastProgressFile);
    
    console.log('');
    console.log('🏆 FINAL RANKINGS:');
    results.finalStats.forEach((strategy, index) => {
      const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index];
      const profit = strategy.coinBalance - 500;
      const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
      console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${profitStr} profit)`);
      console.log(`   ROI: ${strategy.roi}% | Win Rate: ${strategy.winRate}% | Games: ${strategy.gamesPlayed}`);
    });

    console.log('');
    console.log('📈 EVOLUTION STATISTICS:');
    console.log(`📊 Total games played: ${results.finalStats.reduce((sum, s) => sum + s.gamesPlayed, 0) / 6}`);
    console.log(`💰 Average final balance: ${Math.round(results.finalStats.reduce((sum, s) => sum + s.coinBalance, 0) / 6)} coins`);
    console.log(`🏆 Successful strategies: ${results.finalStats.filter(s => s.coinBalance > 500).length}/6`);
    
    if (results.errorSummary) {
      console.log('');
      console.log('⚠️  ERROR SUMMARY:');
      console.log(JSON.stringify(results.errorSummary, null, 2));
    }

  } catch (error) {
    console.error('');
    console.error('❌ EVOLUTION FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
}

// Run if called directly
if (require.main === module) {
  runFullEvolution().catch(console.error);
}

module.exports = { runFullEvolution }; 