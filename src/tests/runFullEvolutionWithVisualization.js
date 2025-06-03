#!/usr/bin/env node
/**
 * Run Full Evolution with Automatic Visualization
 * Runs enhanced evolutionary simulation and generates comprehensive charts
 */

const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { exec } = require('child_process');
const path = require('path');

async function runFullEvolutionWithVisualization(numberOfTournaments = 5, gamesPerTournament = 8) {
  console.log('🚀 STARTING FULL EVOLUTION WITH VISUALIZATION');
  console.log('='.repeat(60));
  console.log(`📊 Tournaments: ${numberOfTournaments}`);
  console.log(`🎮 Games per tournament: ${gamesPerTournament}`);
  console.log(`📈 Total games: ${numberOfTournaments * gamesPerTournament}`);
  console.log('');

  try {
    // Step 1: Run the evolution simulation
    console.log('🧬 Step 1: Running evolution simulation...');
    const evolutionResult = await runEnhancedEvolution(numberOfTournaments, gamesPerTournament);
    
    const exportFile = evolutionResult.exportFile;
    console.log(`✅ Evolution complete! Data saved to: ${exportFile}`);

    // Show final rankings
    console.log('\n🏆 FINAL RANKINGS:');
    evolutionResult.finalStats.slice(0, 6).forEach((strategy, index) => {
      const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index];
      const profit = strategy.coinBalance - 500;
      const profitStr = profit >= 0 ? `+${profit}` : `${profit}`;
      const profitIcon = profit >= 0 ? '💰' : '💸';
      console.log(`   ${rank} ${strategy.name}: ${strategy.coinBalance} coins (${profitIcon}${profitStr})`);
    });

    // Step 2: Generate visualizations
    console.log('\n📊 Step 2: Generating evolution visualization charts...');
    
    const visualizationPromise = new Promise((resolve, reject) => {
      const pythonCommand = `python3 visualize_evolution_tree.py "${exportFile}"`;
      
      exec(pythonCommand, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Visualization generation failed:', error.message);
          reject(error);
          return;
        }
        
        if (stderr && !stderr.includes('UserWarning')) {
          console.error('⚠️  Visualization warnings:', stderr);
        }
        
        console.log(stdout);
        resolve();
      });
    });

    await visualizationPromise;

    // Step 3: Show summary
    console.log('\n🎉 COMPLETE EVOLUTION ANALYSIS FINISHED!');
    console.log('='.repeat(60));
    console.log('📁 Generated files:');
    console.log(`   • ${exportFile} (Raw evolution data)`);
    console.log(`   • balance_evolution_with_tree_*.png (Balance over time)`);
    console.log(`   • strategy_evolution_tree_*.png (Strategy family tree)`);
    console.log(`   • strategy_details_table_*.png (Complete strategy details)`);
    console.log('');
    console.log('💡 Open the PNG files to see:');
    console.log('   📈 How coin balances evolved over time');
    console.log('   🧬 Which strategies evolved from which parents');
    console.log('   📋 Complete details of all strategies and their lineage');
    console.log('');

    // Show evolution insights
    const totalEvolved = Object.values(evolutionResult.finalStats).filter(s => s.archetype.includes('EVOLVED')).length;
    const totalCore = evolutionResult.finalStats.length - totalEvolved;
    
    console.log('🔬 EVOLUTION INSIGHTS:');
    console.log(`   💎 Core strategies remaining: ${totalCore}`);
    console.log(`   🌱 Evolved strategies created: ${totalEvolved}`);
    console.log(`   🏆 Simulation winner: ${evolutionResult.finalStats[0].name}`);
    console.log(`   💰 Highest profit: +${evolutionResult.finalStats[0].coinBalance - 500} coins`);
    
    return {
      evolutionResult,
      exportFile,
      success: true
    };

  } catch (error) {
    console.error('❌ Evolution simulation failed:', error.message);
    console.error('');
    console.log('💡 Troubleshooting tips:');
    console.log('   • Check if you hit API rate limits');
    console.log('   • Try reducing tournaments or games per tournament');
    console.log('   • Make sure Python dependencies are installed');
    
    return {
      error: error.message,
      success: false
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const numberOfTournaments = parseInt(args[0]) || 5;
  const gamesPerTournament = parseInt(args[1]) || 8;
  
  console.log(`🎯 Running evolution: ${numberOfTournaments} tournaments × ${gamesPerTournament} games each`);
  console.log('');
  
  runFullEvolutionWithVisualization(numberOfTournaments, gamesPerTournament)
    .then(result => {
      if (result.success) {
        console.log('🎊 All done! Check the generated PNG files for the complete evolution story!');
        process.exit(0);
      } else {
        console.error('💥 Evolution failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { runFullEvolutionWithVisualization }; 