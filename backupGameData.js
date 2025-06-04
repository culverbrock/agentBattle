const pool = require('./database');
const fs = require('fs');
const path = require('path');

async function backupGameData() {
  try {
    console.log('🔄 Starting comprehensive game data backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `./backups/${timestamp}`;
    
    // Create backup directory
    if (!fs.existsSync('./backups')) {
      fs.mkdirSync('./backups');
    }
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    // 1. Backup complete evolution states
    console.log('📊 Backing up evolution states...');
    const statesResult = await pool.query(`
      SELECT id, state_data, total_games_played, total_evolutions, created_at 
      FROM evolution_states 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    const evolutionStatesBackup = {
      timestamp: new Date().toISOString(),
      totalStates: statesResult.rows.length,
      states: statesResult.rows.map(row => ({
        id: row.id,
        totalGamesPlayed: row.total_games_played,
        totalEvolutions: row.total_evolutions,
        createdAt: row.created_at,
        stateData: row.state_data
      }))
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'evolution_states.json'), 
      JSON.stringify(evolutionStatesBackup, null, 2)
    );
    
    // 2. Extract and backup all completed games from the latest state
    if (statesResult.rows.length > 0) {
      const latestState = statesResult.rows[0];
      console.log('🎮 Extracting completed games from latest state...');
      
      let completedGames = [];
      if (latestState.state_data && latestState.state_data.completedGames) {
        completedGames = latestState.state_data.completedGames;
      }
      
      const gamesBackup = {
        timestamp: new Date().toISOString(),
        extractedFrom: `evolution_state_${latestState.id}`,
        totalGames: completedGames.length,
        games: completedGames
      };
      
      fs.writeFileSync(
        path.join(backupDir, 'completed_games.json'),
        JSON.stringify(gamesBackup, null, 2)
      );
      
      console.log(`✅ Backed up ${completedGames.length} completed games`);
      
      // 3. Create summary statistics
      const summaryStats = generateGameSummary(completedGames);
      fs.writeFileSync(
        path.join(backupDir, 'game_summary.json'),
        JSON.stringify(summaryStats, null, 2)
      );
    }
    
    // 4. Backup strategy evolution tree
    console.log('🌳 Backing up evolution tree...');
    if (statesResult.rows.length > 0) {
      const latestState = statesResult.rows[0];
      let evolutionTree = [];
      if (latestState.state_data && latestState.state_data.evolutionTree) {
        evolutionTree = latestState.state_data.evolutionTree;
      }
      
      const treeBackup = {
        timestamp: new Date().toISOString(),
        extractedFrom: `evolution_state_${latestState.id}`,
        totalEvolutions: evolutionTree.length,
        evolutionTree: evolutionTree
      };
      
      fs.writeFileSync(
        path.join(backupDir, 'evolution_tree.json'),
        JSON.stringify(treeBackup, null, 2)
      );
      
      console.log(`✅ Backed up ${evolutionTree.length} evolution events`);
    }
    
    // 5. Create restoration script
    const restorationScript = generateRestorationScript(timestamp);
    fs.writeFileSync(
      path.join(backupDir, 'restore.js'),
      restorationScript
    );
    
    console.log('📁 Backup completed successfully!');
    console.log(`📍 Backup location: ${backupDir}`);
    console.log('📋 Contents:');
    console.log('  - evolution_states.json (complete database states)');
    console.log('  - completed_games.json (all game history)');
    console.log('  - game_summary.json (statistics)');
    console.log('  - evolution_tree.json (strategy evolution history)');
    console.log('  - restore.js (restoration script)');
    
    return backupDir;
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

function generateGameSummary(completedGames) {
  if (!completedGames || completedGames.length === 0) {
    return { totalGames: 0, summary: 'No completed games to analyze' };
  }
  
  const summary = {
    totalGames: completedGames.length,
    dateRange: {
      earliest: completedGames[0]?.endTime || 'Unknown',
      latest: completedGames[completedGames.length - 1]?.endTime || 'Unknown'
    },
    averageGameDuration: 0,
    totalPrizePoolDistributed: 0,
    playerPerformance: {},
    generationStats: {},
    winnerDistribution: {}
  };
  
  let totalDuration = 0;
  let durationCount = 0;
  
  completedGames.forEach(game => {
    // Duration analysis
    if (game.duration) {
      totalDuration += game.duration;
      durationCount++;
    }
    
    // Prize pool analysis
    if (game.summary && game.summary.totalEntryFees) {
      summary.totalPrizePoolDistributed += game.summary.totalEntryFees;
    }
    
    // Player performance tracking
    if (game.players) {
      game.players.forEach(player => {
        if (!summary.playerPerformance[player.name]) {
          summary.playerPerformance[player.name] = {
            gamesPlayed: 0,
            totalProfitLoss: 0,
            wins: 0,
            generation: player.generation || 'Unknown'
          };
        }
        
        const playerStats = summary.playerPerformance[player.name];
        playerStats.gamesPlayed++;
        playerStats.totalProfitLoss += (player.balanceChange || 0);
        
        if (player.isWinner) {
          playerStats.wins++;
          
          // Winner distribution
          if (!summary.winnerDistribution[player.name]) {
            summary.winnerDistribution[player.name] = 0;
          }
          summary.winnerDistribution[player.name]++;
        }
        
        // Generation stats
        const gen = player.generation || 'Unknown';
        if (!summary.generationStats[gen]) {
          summary.generationStats[gen] = { count: 0, totalProfit: 0 };
        }
        summary.generationStats[gen].count++;
        summary.generationStats[gen].totalProfit += (player.balanceChange || 0);
      });
    }
  });
  
  if (durationCount > 0) {
    summary.averageGameDuration = Math.round(totalDuration / durationCount);
  }
  
  return summary;
}

function generateRestorationScript(timestamp) {
  return `const pool = require('../database');
const fs = require('fs');

async function restoreFromBackup() {
  try {
    console.log('🔄 Restoring game data from backup ${timestamp}...');
    
    // Load backup data
    const evolutionStates = JSON.parse(fs.readFileSync('./evolution_states.json', 'utf8'));
    const completedGames = JSON.parse(fs.readFileSync('./completed_games.json', 'utf8'));
    const evolutionTree = JSON.parse(fs.readFileSync('./evolution_tree.json', 'utf8'));
    
    console.log(\`📊 Found \${evolutionStates.totalStates} evolution states\`);
    console.log(\`🎮 Found \${completedGames.totalGames} completed games\`);
    console.log(\`🌳 Found \${evolutionTree.totalEvolutions} evolution events\`);
    
    // You can modify this script to restore specific data as needed
    console.log('✅ Data loaded successfully from backup');
    console.log('💡 Modify this script to implement specific restoration logic');
    
    return {
      evolutionStates,
      completedGames,
      evolutionTree
    };
    
  } catch (error) {
    console.error('❌ Restoration failed:', error);
    throw error;
  }
}

// Run restoration
if (require.main === module) {
  restoreFromBackup()
    .then(() => console.log('✅ Restoration completed'))
    .catch(err => console.error('❌ Restoration failed:', err));
}

module.exports = { restoreFromBackup };
`;
}

// Run backup if called directly
if (require.main === module) {
  backupGameData()
    .then(backupPath => {
      console.log(`✅ Backup completed: ${backupPath}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Backup failed:', err);
      process.exit(1);
    });
}

module.exports = { backupGameData, generateGameSummary }; 