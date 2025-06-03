const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { generateEvolutionReport, generateProgressReport } = require('../utils/evolutionReporter');

async function runLongEvolutionSafe() {
  console.log('🧬 SAFE LONG EVOLUTIONARY SIMULATION');
  console.log('====================================');
  console.log('📊 5 tournaments × 10 games = 50 total games');
  console.log('💾 Incremental saving enabled - progress never lost!');
  console.log('⚡ If crashes occur, completed tournaments are preserved');
  console.log('');
  
  let result = null;
  let lastProgressFile = null;
  
  try {
    console.log('🚀 Starting simulation with full error handling...');
    const startTime = Date.now();
    
    result = await runEnhancedEvolution(5, 10);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n✅ Simulation completed successfully in ${duration} seconds!`);
    lastProgressFile = result.lastProgressFile;
    
  } catch (err) {
    console.error('\n❌ SIMULATION ENCOUNTERED ERROR');
    console.error('===============================');
    console.error('Error:', err.message);
    
    // Look for the most recent progress file
    const fs = require('fs');
    
    try {
      const files = fs.readdirSync('.');
      const progressFiles = files
        .filter(f => f.startsWith('incremental_progress_') && f.endsWith('.json'))
        .sort();
        
      if (progressFiles.length > 0) {
        lastProgressFile = progressFiles[progressFiles.length - 1];
        console.log(`📁 Found most recent progress file: ${lastProgressFile}`);
        
        // Load partial results
        const progressData = JSON.parse(fs.readFileSync(lastProgressFile, 'utf8'));
        console.log(`📊 Recovered data from ${progressData.completedTournaments} completed tournaments`);
        
        // Create a result-like object from progress data
        result = {
          finalStats: progressData.currentStrategies || [],
          trackedData: progressData.tournamentData || [],
          balanceTimeline: progressData.balanceTimeline || {},
          errorMetrics: progressData.errorMetrics || {},
          lastProgressFile: lastProgressFile,
          isPartialResult: true
        };
      } else {
        console.log('❌ No progress files found - simulation failed completely');
        return;
      }
    } catch (recoverErr) {
      console.error('❌ Could not recover from progress files:', recoverErr.message);
      return;
    }
  }
  
  // Generate reports from whatever data we have
  console.log('\n📊 Generating reports from available data...');
  
  if (result.isPartialResult && lastProgressFile) {
    // Generate report from progress file
    console.log('📈 Using progress file data for reporting...');
    const progressReportFile = generateProgressReport(lastProgressFile);
    console.log(`📄 Progress report: ${progressReportFile}`);
  } else {
    // Generate normal report
    console.log('📈 Generating complete evolution report...');
    const reportFile = generateEvolutionReport(result);
    console.log(`📄 Full report: ${reportFile}`);
  }
  
  // Show final summary
  console.log('\n🎯 RESULTS SUMMARY');
  console.log('==================');
  
  if (result.finalStats && result.finalStats.length > 0) {
    console.log('🏆 Final Strategy Rankings:');
    result.finalStats.forEach((strategy, index) => {
      const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index];
      const change = strategy.coinBalance - 500;
      const changeStr = change >= 0 ? `+${change}` : `${change}`;
      console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${changeStr})`);
    });
  }
  
  if (result.isPartialResult) {
    console.log('\n⚠️  This was a partial result due to simulation error');
    console.log('💾 All completed tournament data has been preserved');
    console.log('📊 Charts and analysis based on available data');
  }
  
  // Generate balance chart
  console.log('\n📊 Generating balance timeline visualization...');
  try {
    const { exec } = require('child_process');
    await new Promise((resolve) => {
      exec('python3 visualize_balance_timeline.py', (error, stdout, stderr) => {
        if (error) {
          console.error('Chart generation failed:', error.message);
        } else {
          console.log('📊 Balance timeline chart generated successfully!');
        }
        resolve();
      });
    });
  } catch (err) {
    console.error('❌ Could not generate timeline chart:', err.message);
  }
  
  console.log('\n✅ Safe evolution run complete!');
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Promise Rejection:');
  console.error('Reason:', reason);
  process.exit(1);
});

runLongEvolutionSafe(); 