const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { generateEvolutionReport } = require('../utils/evolutionReporter');

async function runLongEvolutionDebug() {
  console.log('🧬 LONG EVOLUTIONARY SIMULATION - DEBUG MODE');
  console.log('============================================');
  console.log('📊 5 tournaments × 10 games = 50 total games');
  console.log('💰 No balance resets - economic pressure builds!');
  console.log('⚡ Bankruptcies → Eliminations → Evolution');
  console.log('');
  
  try {
    console.log('🚀 Starting simulation...');
    const startTime = Date.now();
    
    const result = await runEnhancedEvolution(5, 10);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n✅ Simulation completed in ${duration} seconds!`);
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

    // Generate balance chart
    console.log('\n📊 Generating balance timeline chart...');
    await generateBalanceChart(result);
    
  } catch (err) {
    console.error('\n❌ SIMULATION FAILED!');
    console.error('====================');
    console.error('Error message:', err.message);
    console.error('Stack trace:', err.stack);
    
    // Try to save any partial data
    if (err.partialData) {
      console.log('\n💾 Attempting to save partial data...');
      try {
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `partial_evolution_${timestamp}.json`;
        fs.writeFileSync(filename, JSON.stringify(err.partialData, null, 2));
        console.log(`📁 Partial data saved: ${filename}`);
      } catch (saveErr) {
        console.error('❌ Could not save partial data:', saveErr.message);
      }
    }
    
    process.exit(1);
  }
}

async function generateBalanceChart(result) {
  try {
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('python3 visualize_balance_timeline.py', (error, stdout, stderr) => {
        if (error) {
          console.error('Chart generation failed:', error.message);
          reject(error);
        } else {
          console.log('📊 Balance chart generated successfully!');
          resolve();
        }
      });
    });
  } catch (err) {
    console.error('❌ Could not generate chart:', err.message);
  }
}

// Handle unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

runLongEvolutionDebug(); 