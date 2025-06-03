const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { generateEvolutionReport } = require('../utils/evolutionReporter');

async function runLongEvolution() {
  console.log('🧬 LONG EVOLUTIONARY SIMULATION');
  console.log('================================');
  console.log('📊 5 tournaments × 10 games = 50 total games');
  console.log('💰 No balance resets - economic pressure builds!');
  console.log('⚡ Bankruptcies → Eliminations → Evolution');
  console.log('');
  
  try {
    const result = await runEnhancedEvolution(5, 10);
    
    console.log('\n📊 Generating comprehensive evolution report...');
    const reportFile = generateEvolutionReport(result);
    
    console.log('\n🎯 EVOLUTION COMPLETE!');
    console.log('========================');
    console.log(`📈 Report: ${reportFile}`);
    console.log(`💾 Data: ${result.exportFile}`);
    
    // Quick evolution summary
    if (result.trackedData && result.trackedData.length > 0) {
      let totalEvolutions = 0;
      result.trackedData.forEach(tournament => {
        if (tournament.strategiesEvolved) {
          totalEvolutions += tournament.strategiesEvolved.length;
        }
      });
      console.log(`🧬 Total evolutions observed: ${totalEvolutions}`);
    }
    
    // Show final evolved strategy lineup
    console.log('\n🧬 FINAL EVOLVED LINEUP:');
    console.log('========================');
    result.finalStats.forEach((strategy, index) => {
      const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index];
      const change = strategy.coinBalance - 500;
      const changeIcon = change >= 0 ? '📈' : '📉';
      console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${changeIcon}${change >= 0 ? '+' : ''}${change})`);
    });
    
  } catch (err) {
    console.error('❌ Simulation failed:', err.message);
    console.error(err.stack);
  }
}

runLongEvolution(); 