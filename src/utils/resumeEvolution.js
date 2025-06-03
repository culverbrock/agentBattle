const { runEnhancedEvolution, StrategyManager, GameTracker, runTrackedGame } = require('../core/enhancedEvolutionarySystem');
const fs = require('fs');
const path = require('path');

/**
 * Resume evolution from a saved progress file
 */
async function resumeEvolution(progressFile, additionalTournaments = 1, gamesPerTournament = 5) {
  console.log('🔄 RESUMING EVOLUTION FROM SAVED STATE');
  console.log('=' .repeat(50));
  console.log(`📁 Loading state from: ${progressFile}`);
  console.log(`🎯 Running ${additionalTournaments} additional tournaments`);
  console.log('');

  // Load the progress data
  let progressData;
  try {
    const rawData = fs.readFileSync(progressFile, 'utf8');
    progressData = JSON.parse(rawData);
  } catch (error) {
    console.error('❌ Failed to load progress file:', error.message);
    return null;
  }

  // Extract previous state
  const completedTournaments = progressData.completedTournaments || 0;
  const currentStrategies = progressData.currentStrategies || [];
  const previousTournaments = progressData.tournamentData || [];
  const balanceTimeline = progressData.balanceTimeline || {};
  const strategyMatchups = progressData.strategyMatchups || {};
  const errorMetrics = progressData.errorMetrics || {};

  console.log(`✅ Loaded state:`);
  console.log(`   🏆 Completed tournaments: ${completedTournaments}`);
  console.log(`   👥 Active strategies: ${currentStrategies.length}`);
  console.log(`   📊 Previous games: ~${completedTournaments * gamesPerTournament}`);
  console.log('');

  // Validate we have 6 strategies
  if (currentStrategies.length !== 6) {
    console.error(`❌ Invalid state: Expected 6 strategies, found ${currentStrategies.length}`);
    return null;
  }

  // Show current strategy standings
  console.log('💰 CURRENT STRATEGY STANDINGS:');
  currentStrategies.forEach((s, i) => {
    const rank = ['🥇', '🥈', '🥉', '📍', '🏅', '⭐'][i];
    const generation = s.id && s.id.includes('gen') ? ` (Gen ${s.id.match(/gen(\d+)/)?.[1] || '?'})` : ' (Original)';
    console.log(`${rank} ${s.name}: ${s.coinBalance} coins${generation}`);
  });

  // Recreate the strategy manager and tracker with previous state
  const manager = new StrategyManager();
  const tracker = new GameTracker();

  // Restore strategy manager state
  manager.strategies = currentStrategies.map(s => ({
    ...s,
    winHistory: s.winHistory || [],
    eliminationCount: s.eliminationCount || 0
  }));
  manager.generation = Math.max(...currentStrategies
    .filter(s => s.id && s.id.includes('gen'))
    .map(s => parseInt(s.id.match(/gen(\d+)/)?.[1] || '1')), 1);

  console.log(`🧬 Resuming from generation: ${manager.generation}`);

  // Restore tracker state
  tracker.tournamentData = previousTournaments;
  tracker.balanceTimeline = balanceTimeline;
  tracker.strategyMatchups = strategyMatchups;
  tracker.errorMetrics = errorMetrics;
  tracker.setTotalTournaments(completedTournaments + additionalTournaments);

  console.log('\n🚀 CONTINUING EVOLUTION...');
  console.log('=' .repeat(30));

  let lastProgressFile = progressFile;

  // Run additional tournaments
  for (let tournamentNumber = completedTournaments + 1; tournamentNumber <= completedTournaments + additionalTournaments; tournamentNumber++) {
    console.log(`\n🏆 TOURNAMENT ${tournamentNumber} (Continuing from ${completedTournaments})`);
    console.log('='.repeat(50));
    
    try {
      // Get active strategies
      const activeStrategies = manager.getViableStrategies();
      console.log(`👥 Active strategies: ${activeStrategies.length}`);
      
      if (activeStrategies.length !== 6) {
        console.error(`❌ State corruption: Expected 6 strategies, got ${activeStrategies.length}`);
        break;
      }

      // Start tournament tracking
      tracker.startTournament(tournamentNumber, activeStrategies);
      
      console.log(`💰 Starting balances: ${activeStrategies.map(s => `${s.name}: ${s.coinBalance}`).join(', ')}`);

      // Run tournament games
      for (let game = 1; game <= gamesPerTournament; game++) {
        console.log(`\n🎮 Tournament ${tournamentNumber}, Game ${game}/${gamesPerTournament}`);
        
        const gameResult = await runTrackedGame(activeStrategies, game, tracker);
        
        // Update strategy balances
        const economicImpacts = activeStrategies.map(strategy => {
          const payout = gameResult.economicDistribution[`player${activeStrategies.indexOf(strategy) + 1}`] || 0;
          return {
            strategyId: strategy.id,
            entryFee: 100,
            payout: payout,
            profit: payout - 100,
            isWinner: gameResult.winner && gameResult.winner.strategyId === strategy.id
          };
        });

        manager.updateStrategyBalances(economicImpacts);
        tracker.recordBalanceUpdate(tournamentNumber, game, activeStrategies);

        // Show game result
        const winner = gameResult.winner || { name: 'Unknown', profit: 0 };
        console.log(`🏆 Winner: ${winner.name}`);
        
        // Show updated balances
        const balanceUpdate = activeStrategies.map(s => `${s.name}: ${s.coinBalance}`).join(', ');
        console.log(`💰 Updated: ${balanceUpdate}`);
      }

      // Evolution after tournament
      const evolved = await manager.evolveStrategies();
      tracker.finishTournament(activeStrategies, evolved.eliminated || [], evolved.newStrategies || []);
      
      // Save incremental progress
      console.log(`\n💾 Tournament ${tournamentNumber} completed - saving progress...`);
      lastProgressFile = tracker.saveIncrementalProgress(tournamentNumber, manager);
      
      // Show tournament summary
      console.log(`\n📊 Tournament ${tournamentNumber} Summary:`);
      console.log(`🏆 Games completed: ${gamesPerTournament}`);
      
      const eliminatedStrategies = evolved.eliminated || [];
      if (eliminatedStrategies.length > 0) {
        console.log(`💀 Eliminated: ${eliminatedStrategies.map(s => s.name).join(', ')}`);
      }
      
      const evolvedStrategies = evolved.newStrategies || [];
      if (evolvedStrategies.length > 0) {
        console.log(`🧬 Evolved: ${evolvedStrategies.map(s => s.name).join(', ')}`);
      }
      
      const remaining = manager.getViableStrategies().length;
      console.log(`👥 Remaining active strategies: ${remaining}`);
      
    } catch (tournamentError) {
      console.error(`❌ Tournament ${tournamentNumber} failed:`, tournamentError.message);
      console.log('💾 Saving progress up to failed tournament...');
      lastProgressFile = tracker.saveIncrementalProgress(tournamentNumber - 1, manager);
      break;
    }
  }

  // Generate final results
  console.log('\n🎯 RESUMED SIMULATION COMPLETE');
  console.log('=' .repeat(35));
  
  const finalStats = manager.getFinalStatistics();
  console.log('🏆 Final Rankings:');
  finalStats.forEach((strategy, index) => {
    const rank = ['🥇', '🥈', '🥉', '📍', '🏅', '⭐'][index];
    const change = strategy.coinBalance - 500;
    const changeStr = change >= 0 ? `+${change}` : `${change}`;
    const archetype = strategy.archetype || '';
    const generation = archetype.includes('EVOLVED') ? '(Gen 1)' : 
                      archetype.includes('HYBRID') ? '(Gen 2)' : '(Original)';
    console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${changeStr}) ${generation}`);
  });

  // Export final data
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `resumed_evolution_${timestamp}.json`;
  
  const exportData = {
    resumedFrom: progressFile,
    completedTournaments: completedTournaments + additionalTournaments,
    simulationParams: { additionalTournaments, gamesPerTournament },
    finalStats,
    tournaments: tracker.tournamentData,
    balanceTimeline: tracker.balanceTimeline,
    strategyMatchups: tracker.strategyMatchups,
    errorMetrics: tracker.errorMetrics,
    lastProgressFile,
    completedAt: new Date().toISOString()
  };

  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));

  console.log('\n🎉 EVOLUTION COMPLETED SUCCESSFULLY!');
  console.log(`📁 Results saved to: ${filename}`);
  console.log(`💾 Progress file: ${lastProgressFile}`);
  console.log('\n💡 To continue evolution, run:');
  console.log(`   node evolve.js ${additionalTournaments} resume`);

  return {
    finalStats,
    trackedData: tracker.tournamentData,
    balanceTimeline: tracker.balanceTimeline,
    strategyMatchups: tracker.strategyMatchups,
    errorMetrics: tracker.errorMetrics,
    errorSummary: tracker.generateErrorSummary(),
    exportFile: filename,
    lastProgressFile
  };
}

/**
 * Find the latest progress file
 */
function findLatestProgressFile() {
  const files = fs.readdirSync('.')
    .filter(f => f.startsWith('incremental_progress_') && f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(f);
      return { name: f, time: stat.mtime };
    })
    .sort((a, b) => b.time - a.time);
  
  return files.length > 0 ? files[0].name : null;
}

/**
 * Simple runner that can start fresh or resume
 */
async function runEvolution(tournaments = 1, gamesPerTournament = 5, resume = false) {
  if (resume) {
    const latestFile = findLatestProgressFile();
    if (latestFile) {
      console.log(`🔄 Resuming from latest progress file: ${latestFile}`);
      return await resumeEvolution(latestFile, tournaments, gamesPerTournament);
    } else {
      console.log('❌ No progress files found, starting fresh...');
      return await runEnhancedEvolution(tournaments, gamesPerTournament);
    }
  } else {
    console.log('🆕 Starting fresh evolution...');
    return await runEnhancedEvolution(tournaments, gamesPerTournament);
  }
}

module.exports = {
  resumeEvolution,
  findLatestProgressFile,
  runEvolution
};

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const tournaments = parseInt(args[0]) || 1;
  const gamesPerTournament = parseInt(args[1]) || 5;
  const resume = args[2] === 'resume';
  
  console.log(`Running with: ${tournaments} tournaments, ${gamesPerTournament} games each, resume: ${resume}`);
  
  runEvolution(tournaments, gamesPerTournament, resume).catch(console.error);
} 