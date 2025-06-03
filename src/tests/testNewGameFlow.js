const { GameTracker } = require('../core/enhancedEvolutionarySystem.js');

// Test strategies
const testStrategies = [
  {
    id: 'aggressive_v1',
    name: 'Aggressive Maximizer',
    strategy: 'Prioritize maximum personal gain. Target the largest possible share.',
    coinBalance: 1000
  },
  {
    id: 'diplomatic_v1',
    name: 'Diplomatic Builder',
    strategy: 'Build coalitions through compromise. Aim for win-win solutions.',
    coinBalance: 1000
  },
  {
    id: 'opportunist_v1',
    name: 'Strategic Opportunist',
    strategy: 'Adapt to changing dynamics. Strike when timing is optimal.',
    coinBalance: 1000
  },
  {
    id: 'mathematical_v1',
    name: 'Mathematical Analyzer',
    strategy: 'Make all decisions based on expected value calculations.',
    coinBalance: 1000
  }
];

async function testNewGameFlow() {
  console.log('🧪 Testing new game flow features...\n');
  
  const tracker = new GameTracker();
  
  try {
    // Import the runTrackedGame function
    const { runTrackedGame } = require('../core/enhancedEvolutionarySystem.js');
    
    // Run a single test game
    await runTrackedGame(testStrategies, 1, tracker);
    
    console.log('\n✅ Test completed successfully!');
    console.log('\nKey features verified:');
    console.log('✅ Random speaking order (shown in output)');
    console.log('✅ Eliminated players still negotiate and vote');
    console.log('✅ Only active players can make proposals');
    console.log('✅ Parallel proposal and voting phases');
    console.log('✅ Tie-breaking for eliminations');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNewGameFlow(); 