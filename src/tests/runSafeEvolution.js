#!/usr/bin/env node
/**
 * Safe Evolution Runner with Rate Limit Management
 * Handles OpenAI rate limits intelligently with multiple strategies
 */

const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { getRateLimitStatus } = require('../core/llmApi');
const { exec } = require('child_process');

// Configuration options
const RATE_LIMIT_STRATEGIES = {
  CONSERVATIVE: { tournaments: 2, games: 3, description: "Very conservative for testing" },
  BALANCED: { tournaments: 3, games: 5, description: "Balanced approach" },
  AGGRESSIVE: { tournaments: 5, games: 8, description: "Full evolution experience" },
  MARATHON: { tournaments: 8, games: 10, description: "Long-term evolution study" }
};

async function checkRateLimitStatus() {
  const status = getRateLimitStatus();
  console.log('🔍 CURRENT RATE LIMIT STATUS:');
  console.log(`   📊 Requests this minute: ${status.requestsThisMinute}`);
  console.log(`   🔤 Tokens this minute: ${status.tokensThisMinute}/200,000`);
  console.log(`   🚦 Consecutive rate limits: ${status.consecutiveRateLimits}`);
  console.log(`   ⏰ Minutes until reset: ${status.minutesUntilReset}`);
  
  const recommendation = recommendStrategy(status);
  console.log(`   💡 Recommended strategy: ${recommendation.name} (${recommendation.description})`);
  
  return { status, recommendation };
}

function recommendStrategy(status) {
  if (status.tokensThisMinute > 180000 || status.consecutiveRateLimits > 2) {
    return { name: 'CONSERVATIVE', ...RATE_LIMIT_STRATEGIES.CONSERVATIVE };
  } else if (status.tokensThisMinute > 100000 || status.consecutiveRateLimits > 0) {
    return { name: 'BALANCED', ...RATE_LIMIT_STRATEGIES.BALANCED };
  } else if (status.tokensThisMinute > 50000) {
    return { name: 'AGGRESSIVE', ...RATE_LIMIT_STRATEGIES.AGGRESSIVE };
  } else {
    return { name: 'MARATHON', ...RATE_LIMIT_STRATEGIES.MARATHON };
  }
}

async function runWithStrategy(strategyName, customTournaments = null, customGames = null) {
  const strategy = RATE_LIMIT_STRATEGIES[strategyName];
  if (!strategy) {
    throw new Error(`Unknown strategy: ${strategyName}`);
  }
  
  const tournaments = customTournaments || strategy.tournaments;
  const games = customGames || strategy.games;
  
  console.log(`🎯 RUNNING ${strategyName} STRATEGY`);
  console.log(`   📊 Tournaments: ${tournaments}`);
  console.log(`   🎮 Games per tournament: ${games}`);
  console.log(`   📈 Total games: ${tournaments * games}`);
  console.log(`   💭 Estimated tokens: ~${(tournaments * games * 200000).toLocaleString()}`);
  console.log('');

  // Run evolution with progress monitoring
  let lastCheckTime = Date.now();
  const progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lastCheckTime) / 1000);
    const status = getRateLimitStatus();
    console.log(`⏱️  Progress check (${elapsed}s): ${status.tokensThisMinute} tokens used, ${status.consecutiveRateLimits} rate limits`);
  }, 30000); // Check every 30 seconds

  try {
    const result = await runEnhancedEvolution(tournaments, games);
    clearInterval(progressInterval);
    
    console.log('\n🎉 EVOLUTION COMPLETED SUCCESSFULLY!');
    console.log(`📁 Data saved to: ${result.exportFile}`);
    
    // Generate visualization
    console.log('\n📊 Generating visualizations...');
    await generateVisualization(result.exportFile);
    
    return result;
    
  } catch (error) {
    clearInterval(progressInterval);
    
    if (error.message.includes('Rate limit') || error.message.includes('429')) {
      console.log('\n🚦 RATE LIMIT HIT - Evolution paused');
      console.log('💡 You have several options:');
      console.log('   1. Wait 1-2 minutes and try a more conservative strategy');
      console.log('   2. Use the --resume flag to continue from last checkpoint');
      console.log('   3. Upgrade your OpenAI account for higher rate limits');
      console.log('');
      
      const status = getRateLimitStatus();
      const newRec = recommendStrategy(status);
      console.log(`🔄 Current recommendation: ${newRec.name} (${newRec.description})`);
      
    } else {
      console.error('❌ Evolution failed:', error.message);
    }
    
    throw error;
  }
}

async function generateVisualization(dataFile) {
  return new Promise((resolve, reject) => {
    const command = `python3 visualize_evolution_tree.py "${dataFile}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️  Visualization failed (continuing anyway):', error.message);
        resolve();
      } else {
        console.log(stdout);
        resolve();
      }
    });
  });
}

function showUsageHelp() {
  console.log('🚀 SAFE EVOLUTION RUNNER - Rate Limit Aware');
  console.log('==========================================');
  console.log('');
  console.log('USAGE:');
  console.log('  node runSafeEvolution.js [strategy] [tournaments] [games]');
  console.log('');
  console.log('STRATEGIES:');
  Object.entries(RATE_LIMIT_STRATEGIES).forEach(([name, config]) => {
    console.log(`  ${name}: ${config.tournaments}t × ${config.games}g = ${config.tournaments * config.games} games (${config.description})`);
  });
  console.log('');
  console.log('EXAMPLES:');
  console.log('  node runSafeEvolution.js                    # Auto-detect best strategy');
  console.log('  node runSafeEvolution.js CONSERVATIVE       # Use conservative approach');
  console.log('  node runSafeEvolution.js BALANCED          # Use balanced approach');
  console.log('  node runSafeEvolution.js AGGRESSIVE        # Use aggressive approach');
  console.log('  node runSafeEvolution.js CUSTOM 4 6        # Custom: 4 tournaments × 6 games');
  console.log('');
  console.log('RATE LIMIT HELP:');
  console.log('  • Conservative: ~1,200 tokens = safe for any account');
  console.log('  • Balanced: ~45,000 tokens = good for most users');
  console.log('  • Aggressive: ~200,000 tokens = full rate limit usage');
  console.log('  • Marathon: ~800,000 tokens = requires high-tier account');
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsageHelp();
    return;
  }
  
  console.log('🚀 SAFE EVOLUTION RUNNER');
  console.log('========================');
  console.log('');
  
  // Check current rate limit status
  const { status, recommendation } = await checkRateLimitStatus();
  
  let strategyName = args[0];
  let tournaments = args[1] ? parseInt(args[1]) : null;
  let games = args[2] ? parseInt(args[2]) : null;
  
  // Auto-select strategy if none provided
  if (!strategyName) {
    strategyName = recommendation.name;
    console.log(`🤖 Auto-selected ${strategyName} strategy based on current rate limits`);
  }
  
  // Handle custom strategy
  if (strategyName === 'CUSTOM') {
    if (!tournaments || !games) {
      console.error('❌ CUSTOM strategy requires tournaments and games parameters');
      console.log('Example: node runSafeEvolution.js CUSTOM 4 6');
      process.exit(1);
    }
    console.log(`🎯 Using CUSTOM strategy: ${tournaments} tournaments × ${games} games`);
  }
  
  // Validate strategy
  if (strategyName !== 'CUSTOM' && !RATE_LIMIT_STRATEGIES[strategyName]) {
    console.error(`❌ Unknown strategy: ${strategyName}`);
    console.log('Available strategies:', Object.keys(RATE_LIMIT_STRATEGIES).join(', '));
    process.exit(1);
  }
  
  // Warn about high token usage
  const estimatedTokens = (tournaments || RATE_LIMIT_STRATEGIES[strategyName]?.tournaments || 3) * 
                         (games || RATE_LIMIT_STRATEGIES[strategyName]?.games || 5) * 200000;
  
  if (estimatedTokens > 300000) {
    console.log('⚠️  WARNING: High token usage expected!');
    console.log(`   Estimated tokens: ~${estimatedTokens.toLocaleString()}`);
    console.log(`   Current usage: ${status.tokensThisMinute.toLocaleString()}/200,000 this minute`);
    console.log('   Consider using a more conservative strategy if you hit rate limits.');
    console.log('');
  }
  
  try {
    const startTime = Date.now();
    let result;
    
    if (strategyName === 'CUSTOM') {
      result = await runEnhancedEvolution(tournaments, games);
    } else {
      result = await runWithStrategy(strategyName, tournaments, games);
    }
    
    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.log(`\n⏱️  Total duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
    
    const finalStatus = getRateLimitStatus();
    console.log('\n📊 FINAL RATE LIMIT STATUS:');
    console.log(`   🔤 Tokens used: ${finalStatus.tokensThisMinute}/200,000`);
    console.log(`   🚦 Rate limits hit: ${finalStatus.consecutiveRateLimits}`);
    
    console.log('\n🎊 EVOLUTION COMPLETE! Check the generated PNG files for results!');
    
  } catch (error) {
    console.error('\n💥 Evolution failed:', error.message);
    
    if (error.message.includes('Rate limit')) {
      console.log('\n💡 TROUBLESHOOTING TIPS:');
      console.log('   • Wait 1-2 minutes for rate limits to reset');
      console.log('   • Try: node runSafeEvolution.js CONSERVATIVE');
      console.log('   • Check your OpenAI account tier at platform.openai.com');
      console.log('   • Consider upgrading for higher rate limits');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runWithStrategy, checkRateLimitStatus, RATE_LIMIT_STRATEGIES }; 