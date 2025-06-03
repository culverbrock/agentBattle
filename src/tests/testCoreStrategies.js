/**
 * Test Core Strategies - Single game with 6 strategies using enhanced matrix system
 */

const { runTrackedGame, CORE_STRATEGIES } = require('../core/enhancedEvolutionarySystem');
const { GameTracker } = require('../core/enhancedEvolutionarySystem');

async function testCoreStrategiesGame() {
    console.log('🎯 TESTING 6 CORE STRATEGIES IN SINGLE GAME');
    console.log('===========================================');
    console.log('🧠 Using enhanced matrix system with strategic evolution\n');

    // Initialize the 6 core strategies
    const strategies = JSON.parse(JSON.stringify(CORE_STRATEGIES));
    
    console.log('👥 THE 6 CORE STRATEGIES:');
    strategies.forEach((strat, i) => {
        console.log(`${i + 1}. ${strat.name} (${strat.archetype})`);
        console.log(`   Strategy: "${strat.strategy}"`);
        console.log(`   Starting balance: ${strat.coinBalance} coins\n`);
    });

    const tracker = new GameTracker();
    tracker.startTournament(1, strategies);

    console.log('🎮 RUNNING SINGLE GAME WITH MATRIX NEGOTIATIONS');
    console.log('================================================\n');

    try {
        const gameResult = await runTrackedGame(strategies, 1, tracker);
        
        console.log('\n🏆 GAME RESULTS:');
        console.log('================');
        
        if (gameResult.winner) {
            console.log(`🥇 Winner: ${gameResult.winner.name} (${gameResult.winner.strategyId})`);
            console.log(`💰 Prize: ${gameResult.winner.payout} tokens (+${gameResult.winner.profit} profit)`);
        }
        
        console.log('\n💰 FINAL PAYOUTS:');
        Object.entries(gameResult.economicDistribution).forEach(([playerId, payout]) => {
            const profit = payout - 100;
            const profitStatus = profit >= 0 ? '✅ PROFIT' : '❌ LOSS';
            console.log(`  ${playerId}: ${payout} tokens (${profit >= 0 ? '+' : ''}${profit} profit) ${profitStatus}`);
        });
        
        console.log('\n🎭 STRATEGY PERFORMANCE ANALYSIS:');
        console.log('================================');
        
        strategies.forEach((strategy, index) => {
            const playerId = `player${index + 1}`;
            const payout = gameResult.economicDistribution[playerId] || 0;
            const profit = payout - 100;
            const isWinner = gameResult.winner && gameResult.winner.strategyId === strategy.id;
            
            console.log(`\n${strategy.name} (${strategy.archetype}):`);
            console.log(`  💰 Payout: ${payout} tokens`);
            console.log(`  📈 Profit: ${profit >= 0 ? '+' : ''}${profit} tokens`);
            console.log(`  🏆 Won game: ${isWinner ? 'YES' : 'NO'}`);
            console.log(`  🎯 Strategy: "${strategy.strategy}"`);
            
            // Show if they understood the economics (profitable = good)
            if (profit >= 0) {
                console.log(`  ✅ STRATEGIC SUCCESS: Understood game economics and secured profit`);
            } else {
                console.log(`  ❌ STRATEGIC FAILURE: Lost money, may not understand game properly`);
            }
        });
        
        console.log('\n🧠 STRATEGIC INTELLIGENCE CHECK:');
        console.log('===============================');
        
        const profitableStrategies = strategies.filter((strategy, index) => {
            const payout = gameResult.economicDistribution[`player${index + 1}`] || 0;
            return (payout - 100) >= 0;
        });
        
        const unprofitableStrategies = strategies.filter((strategy, index) => {
            const payout = gameResult.economicDistribution[`player${index + 1}`] || 0;
            return (payout - 100) < 0;
        });
        
        console.log(`✅ Strategies that understood the game: ${profitableStrategies.length}/6`);
        if (profitableStrategies.length > 0) {
            console.log(`   ${profitableStrategies.map(s => s.name).join(', ')}`);
        }
        
        console.log(`❌ Strategies that failed: ${unprofitableStrategies.length}/6`);
        if (unprofitableStrategies.length > 0) {
            console.log(`   ${unprofitableStrategies.map(s => s.name).join(', ')}`);
        }
        
        console.log('\n📊 GAME QUALITY ASSESSMENT:');
        console.log('===========================');
        
        const gameQuality = {
            strategicUnderstanding: (profitableStrategies.length / 6) * 100,
            hasWinner: !!gameResult.winner,
            economicallySound: Object.values(gameResult.economicDistribution).reduce((sum, val) => sum + val, 0) <= 600
        };
        
        console.log(`🎯 Strategic Understanding: ${gameQuality.strategicUnderstanding.toFixed(1)}% of agents profitable`);
        console.log(`🏆 Clear Winner: ${gameQuality.hasWinner ? 'YES' : 'NO'}`);
        console.log(`💰 Economic Soundness: ${gameQuality.economicallySound ? 'VALID' : 'INVALID'} (payouts <= 600)`);
        
        // Matrix system assessment
        if (gameResult.matrixResults) {
            console.log('\n🔢 MATRIX SYSTEM PERFORMANCE:');
            console.log('=============================');
            console.log(`📈 Matrix success rate: ${gameResult.matrixResults.llmSuccessRate.toFixed(1)}%`);
            console.log(`🔧 Auto-corrections: ${gameResult.matrixResults.correctedCalls}`);
            console.log(`⚠️  Violations: ${gameResult.matrixResults.totalViolations}`);
        }
        
        // Overall assessment
        const overallSuccess = gameQuality.strategicUnderstanding >= 70 && gameQuality.hasWinner && gameQuality.economicallySound;
        
        console.log('\n🎯 OVERALL ASSESSMENT:');
        console.log('======================');
        
        if (overallSuccess) {
            console.log('🎉 SUCCESS: Game shows clear strategic understanding and proper economics');
        } else {
            console.log('⚠️  NEEDS IMPROVEMENT: Some agents may not fully understand the game dynamics');
            
            if (gameQuality.strategicUnderstanding < 70) {
                console.log('   - Too many agents made unprofitable decisions');
            }
            if (!gameQuality.hasWinner) {
                console.log('   - No clear winner emerged');
            }
            if (!gameQuality.economicallySound) {
                console.log('   - Economic distribution is invalid');
            }
        }
        
        return gameResult;
        
    } catch (error) {
        console.error('❌ Game failed:', error.message);
        console.error(error.stack);
        return null;
    }
}

// Run the test
console.log('Starting core strategies test...\n');

testCoreStrategiesGame()
    .then(result => {
        if (result) {
            console.log('\n' + '='.repeat(60));
            console.log('🏁 CORE STRATEGIES TEST COMPLETE');
            console.log('='.repeat(60));
        }
    })
    .catch(error => {
        console.error('❌ Test crashed:', error);
    });

module.exports = { testCoreStrategiesGame }; 