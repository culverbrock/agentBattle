// Test fix for evolutionary system issues
const { runSingleGame, initialStrategies } = require('./evolutionaryStrategies');

async function testFixes() {
  console.log('🔧 Testing fixes for voting and proposal key issues...\n');
  
  // Use just 3 strategies for a quick test
  const testStrategies = initialStrategies.slice(0, 3);
  
  console.log('Testing strategies:');
  testStrategies.forEach(s => console.log(`- ${s.name}: ${s.strategy.substring(0, 60)}...`));
  
  try {
    const result = await runSingleGame(testStrategies, 1);
    
    console.log('\n✅ Test completed successfully!');
    console.log('Result:', {
      hasWinner: result.hasWinner,
      winner: result.winner?.name,
      results: result.results.map(r => ({ name: r.name, votes: r.votes, percentage: r.percentage }))
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testFixes().catch(console.error);
} 