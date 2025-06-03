// Run champion evolution with file output
const fs = require('fs');
const { runChampionEvolution } = require('./evolutionaryStrategies');

async function runWithOutput() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = `champion_evolution_${timestamp}.log`;
  
  console.log('🔬 CHAMPION STRATEGY EVOLUTION');
  console.log('==============================');
  console.log(`📝 Logging to: ${logFile}`);
  console.log('🚀 Starting evolution...\n');
  
  // Capture console output
  const originalLog = console.log;
  const logs = [];
  
  console.log = (...args) => {
    const message = args.join(' ');
    logs.push(message);
    originalLog(...args); // Still show in terminal
  };
  
  try {
    const result = await runChampionEvolution(1); // Just 1 generation
    
    // Write to file
    fs.writeFileSync(logFile, logs.join('\n'));
    
    console.log = originalLog; // Restore original
    console.log(`\n✅ Evolution complete! Results saved to: ${logFile}`);
    console.log(`🏆 Champion: ${result.champion.name}`);
    console.log(`💰 Profit: ${result.champion.totalProfit >= 0 ? '+' : ''}${result.champion.totalProfit} tokens`);
    console.log(`📈 ROI: ${result.champion.roi.toFixed(1)}%`);
    
    return result;
    
  } catch (error) {
    console.log = originalLog; // Restore original
    console.error('❌ Evolution failed:', error);
    
    // Still save partial logs
    if (logs.length > 0) {
      fs.writeFileSync(logFile, logs.join('\n') + '\n\nERROR: ' + error.message);
      console.log(`📝 Partial logs saved to: ${logFile}`);
    }
  }
}

if (require.main === module) {
  runWithOutput().catch(console.error);
}

module.exports = { runWithOutput }; 