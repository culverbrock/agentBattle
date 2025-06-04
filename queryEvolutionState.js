const pool = require('./database');

async function queryEvolutionState(stateId = null) {
  try {
    console.log('🔍 Querying evolution state from database...');
    
    let query, params;
    if (stateId) {
      query = `SELECT id, state_data, total_games_played, total_evolutions, created_at 
               FROM evolution_states 
               WHERE id = $1`;
      params = [stateId];
    } else {
      query = `SELECT id, state_data, total_games_played, total_evolutions, created_at 
               FROM evolution_states 
               ORDER BY created_at DESC 
               LIMIT 1`;
      params = [];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      console.log('❌ No evolution state found');
      return null;
    }
    
    const stateRecord = result.rows[0];
    console.log(`✅ Found evolution state ${stateRecord.id} from ${stateRecord.created_at}`);
    console.log(`   Games Played: ${stateRecord.total_games_played}`);
    console.log(`   Evolutions: ${stateRecord.total_evolutions}`);
    
    const stateData = stateRecord.state_data;
    
    if (!stateData.strategies || !Array.isArray(stateData.strategies)) {
      console.log('❌ No strategies found in state data');
      return null;
    }
    
    console.log(`📊 Found ${stateData.strategies.length} strategies in state`);
    
    // Extract all balance history entries
    const allBalanceEntries = [];
    const gameStats = new Map(); // gameNumber -> { playerCount, totalEntries }
    
    stateData.strategies.forEach(strategy => {
      if (!strategy.balanceHistory || strategy.balanceHistory.length === 0) {
        console.log(`   ${strategy.name}: No balance history`);
        return;
      }
      
      console.log(`   ${strategy.name}: ${strategy.balanceHistory.length} balance entries`);
      
      strategy.balanceHistory.forEach(entry => {
        if (!entry.game || entry.game <= 0) return;
        
        allBalanceEntries.push({
          game: entry.game,
          strategyId: strategy.id,
          strategyName: strategy.name,
          balance: entry.balance,
          change: entry.change || 0,
          reason: entry.reason || 'Unknown',
          timestamp: entry.timestamp || Date.now()
        });
        
        // Track game stats
        if (!gameStats.has(entry.game)) {
          gameStats.set(entry.game, { playerCount: new Set(), totalEntries: 0 });
        }
        gameStats.get(entry.game).playerCount.add(strategy.id);
        gameStats.get(entry.game).totalEntries++;
      });
    });
    
    console.log(`\n📈 Total Balance Entries: ${allBalanceEntries.length}`);
    console.log(`🎮 Games Found: ${gameStats.size}`);
    
    // Show game breakdown
    const sortedGames = Array.from(gameStats.keys()).sort((a, b) => a - b);
    console.log('\n🎲 Game Breakdown:');
    sortedGames.forEach(gameNum => {
      const stats = gameStats.get(gameNum);
      console.log(`   Game ${gameNum}: ${stats.playerCount.size} players, ${stats.totalEntries} entries`);
    });
    
    // Sort all entries by game, then timestamp
    const sortedEntries = allBalanceEntries.sort((a, b) => {
      if (a.game !== b.game) return a.game - b.game;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
    
    console.log('\n💰 Sample Balance Timeline (First 10 entries):');
    sortedEntries.slice(0, 10).forEach(entry => {
      console.log(`   Game ${entry.game}: ${entry.strategyName} - ${entry.balance} coins (${entry.change >= 0 ? '+' : ''}${entry.change}) [${entry.reason}]`);
    });
    
    if (sortedEntries.length > 10) {
      console.log(`   ... and ${sortedEntries.length - 10} more entries`);
    }
    
    return {
      stateId: stateRecord.id,
      totalGames: stateRecord.total_games_played,
      totalEvolutions: stateRecord.total_evolutions,
      strategies: stateData.strategies,
      balanceTimeline: sortedEntries,
      gameStats: Array.from(gameStats.entries()).map(([game, stats]) => ({
        game,
        playerCount: stats.playerCount.size,
        totalEntries: stats.totalEntries
      }))
    };
    
  } catch (error) {
    console.error('❌ Error querying evolution state:', error);
    return null;
  }
}

// Run the query
async function main() {
  const stateId = process.argv[2] ? parseInt(process.argv[2]) : null;
  
  if (stateId) {
    console.log(`Querying specific evolution state: ${stateId}`);
  } else {
    console.log('Querying latest evolution state');
  }
  
  const data = await queryEvolutionState(stateId);
  
  if (data) {
    console.log('\n✅ Query completed successfully!');
    console.log(`📊 Balance Timeline: ${data.balanceTimeline.length} entries across ${data.gameStats.length} games`);
    
    // Save the balance timeline to a JSON file for inspection
    const fs = require('fs');
    const filename = `balance_timeline_state_${data.stateId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`💾 Complete data saved to: ${filename}`);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { queryEvolutionState }; 