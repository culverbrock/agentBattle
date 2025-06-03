const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { generateEvolutionReport, generateProgressReport } = require('../utils/evolutionReporter');
const { exec } = require('child_process');
const fs = require('fs');

async function runCompleteEvolution(numberOfTournaments = 5, gamesPerTournament = 10) {
  console.log('🧬 COMPLETE EVOLUTIONARY SIMULATION WITH VISUALIZATION');
  console.log('======================================================');
  console.log(`📊 ${numberOfTournaments} tournaments × ${gamesPerTournament} games = ${numberOfTournaments * gamesPerTournament} total games`);
  console.log('💾 Full tracking: evolution + balance timeline + strategy matrix');
  console.log('📊 Auto-generates: reports + balance charts + strategy matrix visualizations');
  console.log('');
  
  let result = null;
  let reportFile = null;
  
  try {
    console.log('🚀 Starting enhanced evolution simulation...');
    const startTime = Date.now();
    
    result = await runEnhancedEvolution(numberOfTournaments, gamesPerTournament);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n✅ Evolution simulation completed in ${duration} seconds!`);
    
    // Generate comprehensive report
    console.log('\n📊 Generating evolution report...');
    reportFile = generateEvolutionReport(result);
    console.log(`📄 Report generated: ${reportFile}`);
    
  } catch (err) {
    console.error('\n❌ SIMULATION ERROR - ATTEMPTING RECOVERY');
    console.error('=========================================');
    console.error('Error:', err.message);
    
    // Try to recover from progress file
    try {
      const files = fs.readdirSync('.');
      const progressFiles = files
        .filter(f => f.startsWith('incremental_progress_') && f.endsWith('.json'))
        .sort();
        
      if (progressFiles.length > 0) {
        const lastProgressFile = progressFiles[progressFiles.length - 1];
        console.log(`📁 Recovering from: ${lastProgressFile}`);
        
        const progressData = JSON.parse(fs.readFileSync(lastProgressFile, 'utf8'));
        console.log(`📊 Recovered ${progressData.completedTournaments} completed tournaments`);
        
        reportFile = generateProgressReport(lastProgressFile);
        
        result = {
          finalStats: progressData.currentStrategies || [],
          trackedData: progressData.tournamentData || [],
          balanceTimeline: progressData.balanceTimeline || {},
          strategyMatchups: progressData.strategyMatchups || {},
          errorMetrics: progressData.errorMetrics || {},
          isPartialResult: true
        };
      } else {
        console.log('❌ No recovery possible - no progress files found');
        return;
      }
    } catch (recoverErr) {
      console.error('❌ Recovery failed:', recoverErr.message);
      return;
    }
  }
  
  if (!result) {
    console.error('❌ No results to visualize');
    return;
  }
  
  // Generate all visualizations
  console.log('\n🎨 Generating comprehensive visualizations...');
  
  // 1. Generate balance timeline chart
  console.log('📈 Creating balance timeline chart...');
  await executeVisualization('python3 visualize_balance_timeline.py', 'Balance timeline chart');
  
  // 2. Generate strategy matrix visualizations
  console.log('🎯 Creating strategy relationship matrix visualizations...');
  await executeVisualization('python3 visualize_strategy_matrix.py', 'Strategy matrix visualizations');
  
  // Show final summary
  console.log('\n🎯 COMPLETE EVOLUTION RESULTS');
  console.log('==============================');
  
  if (result.finalStats && result.finalStats.length > 0) {
    console.log('\n🏆 Final Strategy Rankings (by Balance):');
    result.finalStats.forEach((strategy, index) => {
      const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index];
      const change = strategy.coinBalance - 500;
      const changeStr = change >= 0 ? `+${change}` : `${change}`;
      const winRate = strategy.gamesPlayed > 0 ? 
        (strategy.winHistory.filter(h => h.isWinner).length / strategy.gamesPlayed * 100).toFixed(1) : 0;
      console.log(`${rank} ${strategy.name}`);
      console.log(`   💰 Balance: ${strategy.coinBalance} coins (${changeStr})`);
      console.log(`   🏆 Win Rate: ${winRate}% (${strategy.winHistory.filter(h => h.isWinner).length}/${strategy.gamesPlayed} games)`);
      console.log(`   🎯 ROI: ${strategy.roi}%`);
      console.log('');
    });
  }
  
  // Show generated files
  console.log('📁 Generated Files:');
  console.log('==================');
  console.log(`📄 Evolution Report: ${reportFile || 'Failed to generate'}`);
  
  const files = fs.readdirSync('.');
  
  // Balance timeline files
  const balanceFiles = files.filter(f => f.includes('balance_timeline') && f.endsWith('.png'));
  if (balanceFiles.length > 0) {
    console.log(`📊 Balance Chart: ${balanceFiles[balanceFiles.length - 1]}`);
  }
  
  // Strategy matrix files
  const matrixFiles = files.filter(f => f.startsWith('strategy_') && f.endsWith('.png'));
  if (matrixFiles.length > 0) {
    console.log('🎯 Strategy Matrix Visualizations:');
    matrixFiles.forEach(file => {
      const description = getFileDescription(file);
      console.log(`   - ${file} (${description})`);
    });
  }
  
  // CSV timeline data
  const csvFiles = files.filter(f => f.includes('balance_timeline') && f.endsWith('.csv'));
  if (csvFiles.length > 0) {
    console.log(`📊 Balance Data: ${csvFiles[csvFiles.length - 1]}`);
  }
  
  console.log('\n🎉 Complete evolution simulation with visualizations finished!');
  console.log('🔍 Analysis:');
  console.log('   - Check the evolution report for detailed insights');
  console.log('   - View balance charts to see economic progression');
  console.log('   - Examine strategy matrices to understand matchup dynamics');
  console.log('   - Use network graph to identify strategic relationships');
  
  if (result.isPartialResult) {
    console.log('\n⚠️  Note: Results are partial due to simulation error');
    console.log('💾 All completed data has been preserved and analyzed');
  }
  
  return {
    result,
    reportFile,
    isComplete: !result.isPartialResult
  };
}

async function executeVisualization(command, description) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ ${description} failed:`, error.message);
        if (stderr) console.error('Error details:', stderr);
      } else {
        console.log(`✅ ${description} generated successfully`);
        if (stdout.trim()) console.log(stdout.trim());
      }
      resolve();
    });
  });
}

function getFileDescription(filename) {
  if (filename.includes('heatmap')) return 'Win rate heatmap';
  if (filename.includes('counts')) return 'Win-loss counts matrix';
  if (filename.includes('dominance')) return 'Strategy dominance scores';
  if (filename.includes('network')) return 'Strategic relationship network';
  return 'Visualization';
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Promise Rejection:');
  console.error('Reason:', reason);
  process.exit(1);
});

// Export function and run if called directly
module.exports = { runCompleteEvolution };

if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const tournaments = parseInt(args[0]) || 3;
  const gamesPerTournament = parseInt(args[1]) || 5;
  
  runCompleteEvolution(tournaments, gamesPerTournament);
} 