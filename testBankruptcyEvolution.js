const { ContinuousEvolutionSystem } = require('./src/evolution/bankruptcyEvolutionSystem');

// Simple logger to see what's happening
function logger(logData) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  console.log(`[${timestamp}] ${logData.level.toUpperCase()} | ${logData.source} | ${logData.message}`);
}

// Simple update handler to see game progress
function updateHandler(update) {
  switch (update.type) {
    case 'game_started':
      console.log(`\n🎮 GAME ${update.game.number} STARTED`);
      console.log(`Players: ${update.game.players.map(p => p.name).join(', ')}`);
      break;
      
    case 'player_eliminated':
      console.log(`❌ ELIMINATION: ${update.data.eliminatedPlayer.name} (${update.data.votes} votes - ${update.data.votePercentage}%)`);
      break;
      
    case 'game_completed':
      console.log(`\n🏆 GAME ${update.game.number} COMPLETED`);
      console.log(`Winner: ${update.game.winner?.name || 'None'}`);
      if (update.game.finalProposal) {
        console.log(`Winning proposal: ${update.game.finalProposal.map((p, i) => `P${i}: ${p}%`).join(', ')}`);
      }
      if (update.game.coinDistribution) {
        console.log(`Coin distribution: ${update.game.coinDistribution.map((c, i) => `P${i}: ${c} coins`).join(', ')}`);
      }
      break;
      
    case 'strategy_eliminated':
      console.log(`\n💀 STRATEGY ELIMINATED: ${update.elimination.strategyName}`);
      console.log(`Reason: ${update.elimination.reason}`);
      console.log(`Final balance: ${update.elimination.finalBalance} coins`);
      break;
      
    case 'strategy_evolved':
      console.log(`\n🧬 STRATEGY EVOLVED`);
      console.log(`${update.evolution.eliminatedStrategy.name} → ${update.evolution.newStrategy.name}`);
      console.log(`New strategy: ${update.evolution.newStrategy.strategy}`);
      break;
  }
}

console.log('🚀 Starting Bankruptcy Evolution System Test...\n');

// Create the system with verbose logging
const evolutionSystem = new ContinuousEvolutionSystem({
  mode: 'continuous_evolution',
  realTimeUpdates: true,
  fullLogging: true,
  onUpdate: updateHandler,
  onLog: logger
});

// Let it run for a while, then stop
setTimeout(() => {
  console.log('\n🛑 Stopping evolution system...');
  evolutionSystem.stop();
  process.exit(0);
}, 300000); // Run for 5 minutes

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, stopping evolution system...');
  evolutionSystem.stop();
  process.exit(0);
}); 