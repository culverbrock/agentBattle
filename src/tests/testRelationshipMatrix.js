const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { generateEvolutionReport } = require('../utils/evolutionReporter');

async function testRelationshipMatrix() {
  console.log('🧪 Testing Strategy Relationship Matrix Feature');
  console.log('===============================================');
  console.log('Running 2 tournaments × 5 games to test matchup tracking...');
  console.log('');
  
  try {
    const result = await runEnhancedEvolution(2, 5);
    
    console.log('\n📊 Strategy Matchups Data:');
    if (result.strategyMatchups && Object.keys(result.strategyMatchups).length > 0) {
      Object.entries(result.strategyMatchups).forEach(([strategy, opponents]) => {
        console.log(`\n${strategy}:`);
        Object.entries(opponents).forEach(([opponent, record]) => {
          console.log(`  vs ${opponent}: ${record.wins}W-${record.losses}L`);
        });
      });
    } else {
      console.log('No matchup data found.');
    }
    
    console.log('\n📈 Generating report with relationship matrix...');
    const reportFile = generateEvolutionReport(result);
    
    console.log(`\n✅ Test complete! Check ${reportFile} for the relationship matrix section.`);
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
  }
}

testRelationshipMatrix(); 