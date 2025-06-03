#!/usr/bin/env node
/**
 * Simple Evolution Runner
 * 
 * Usage:
 *   node evolve.js 1          - Run 1 fresh tournament
 *   node evolve.js 3 7        - Run 3 tournaments with 7 games each (fresh)
 *   node evolve.js 2 resume   - Resume and run 2 more tournaments
 *   node evolve.js resume     - Resume and run 1 more tournament
 */

const { runEvolution, findLatestProgressFile } = require('./resumeEvolution');

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let tournaments = 1;
  let gamesPerTournament = 5;
  let resume = false;
  
  // Handle different argument patterns
  if (args.length === 0) {
    // Default: 1 tournament, 5 games, fresh
    tournaments = 1;
    gamesPerTournament = 5;
    resume = false;
  } else if (args.length === 1) {
    if (args[0] === 'resume') {
      // Resume with 1 tournament
      tournaments = 1;
      gamesPerTournament = 5;
      resume = true;
    } else {
      // Fresh with specified tournaments
      tournaments = parseInt(args[0]) || 1;
      gamesPerTournament = 5;
      resume = false;
    }
  } else if (args.length === 2) {
    if (args[1] === 'resume') {
      // Resume with specified tournaments
      tournaments = parseInt(args[0]) || 1;
      gamesPerTournament = 5;
      resume = true;
    } else {
      // Fresh with tournaments and games
      tournaments = parseInt(args[0]) || 1;
      gamesPerTournament = parseInt(args[1]) || 5;
      resume = false;
    }
  } else if (args.length === 3) {
    // All parameters specified
    tournaments = parseInt(args[0]) || 1;
    gamesPerTournament = parseInt(args[1]) || 5;
    resume = args[2] === 'resume';
  }

  // Show what we're about to do
  console.log('🎮 AGENT BATTLE EVOLUTION');
  console.log('=' .repeat(25));
  
  if (resume) {
    const latestFile = findLatestProgressFile();
    if (latestFile) {
      console.log(`🔄 Mode: RESUME from ${latestFile}`);
    } else {
      console.log('🆕 Mode: FRESH START (no progress files found)');
      resume = false;
    }
  } else {
    console.log('🆕 Mode: FRESH START');
  }
  
  console.log(`📊 Tournaments: ${tournaments}`);
  console.log(`🎯 Games per tournament: ${gamesPerTournament}`);
  console.log(`🎮 Total games: ~${tournaments * gamesPerTournament}`);
  console.log('');

  try {
    const result = await runEvolution(tournaments, gamesPerTournament, resume);
    
    if (result) {
      console.log('\n🎉 EVOLUTION COMPLETED SUCCESSFULLY!');
      console.log(`📁 Results saved to: ${result.exportFile}`);
      console.log(`💾 Progress file: ${result.lastProgressFile}`);
      console.log('');
      console.log('💡 To continue evolution, run:');
      console.log(`   node evolve.js ${tournaments} resume`);
    } else {
      console.log('\n❌ Evolution failed or was interrupted');
    }
    
  } catch (error) {
    console.error('\n💥 Evolution crashed:', error.message);
    process.exit(1);
  }
}

// Show usage if --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎮 AGENT BATTLE EVOLUTION RUNNER

Usage:
  node evolve.js                    - Run 1 tournament (5 games) fresh
  node evolve.js 3                  - Run 3 tournaments fresh  
  node evolve.js 3 7                - Run 3 tournaments with 7 games each (fresh)
  node evolve.js resume             - Resume and run 1 more tournament
  node evolve.js 5 resume           - Resume and run 5 more tournaments
  node evolve.js 2 6 resume         - Resume and run 2 tournaments with 6 games each

Examples:
  node evolve.js 1                  # Quick test: 1 tournament
  node evolve.js 10 5               # Long run: 10 tournaments, 5 games each  
  node evolve.js resume             # Continue from where you left off
  node evolve.js 5 resume           # Add 5 more tournaments to existing run

Features:
  🔄 Automatic resume capability
  💾 Progress saved after each tournament
  🧬 Forced evolution every tournament (bottom 2 eliminated)
  💰 Fair starting balance for new strategies
  📊 Complete visualization and reporting
`);
  process.exit(0);
}

main().catch(console.error); 