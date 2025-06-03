const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { generateEvolutionReport } = require('../utils/evolutionReporter');

async function testBalanceTracking() {
  console.log('🧪 Testing Enhanced Balance Tracking System...');
  
  try {
    // Run a quick 2 tournament test with 3 games each
    const result = await runEnhancedEvolution(2, 3);
    
    console.log('\n📊 Generating report with balance timeline...');
    const reportFile = generateEvolutionReport(result);
    
    console.log(`\n✅ Test complete! Report generated: ${reportFile}`);
    console.log('📈 Balance timeline data captured and visualized');
    
    // Show sample of balance timeline data
    if (result.trackedData && result.trackedData.length > 0) {
      console.log('\n🔍 Sample Balance Timeline Data:');
      
      // Look for balance timeline in the first tournament data
      let balanceTimeline = null;
      for (const tournamentData of result.trackedData) {
        if (tournamentData.balanceTimeline) {
          balanceTimeline = tournamentData.balanceTimeline;
          break;
        }
      }
      
      if (balanceTimeline) {
        Object.entries(balanceTimeline).slice(0, 3).forEach(([strategyId, data]) => {
          console.log(`${data.name}: ${data.dataPoints.length} data points tracked`);
          if (data.dataPoints.length > 0) {
            const start = data.dataPoints[0];
            const end = data.dataPoints[data.dataPoints.length-1];
            console.log(`  Start: ${start.balance} coins -> End: ${end.balance} coins (${end.balance - start.balance >= 0 ? '+' : ''}${end.balance - start.balance})`);
          }
        });
      } else {
        console.log('⚠️  No balance timeline found in tournament data');
      }
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
  }
}

testBalanceTracking(); 