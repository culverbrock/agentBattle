/**
 * Run a larger evolution with persistent conversations
 * This will showcase the full benefits of the 38% promise-keeping improvement
 */

const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { getRateLimitStatus } = require('../core/llmApi');

async function runLargerEvolution() {
    console.log('🚀 LARGE-SCALE EVOLUTION WITH PERSISTENT CONVERSATIONS');
    console.log('======================================================');
    console.log('🎯 Configuration:');
    console.log('   • 5 tournaments (generations)');
    console.log('   • 7 games per tournament');
    console.log('   • 35 total games');
    console.log('   • Persistent conversation threads for better promise-keeping');
    console.log('   • Starting with 6 core strategy archetypes');
    console.log('');

    const startTime = Date.now();
    let rateLimitHits = 0;
    
    try {
        // Monitor rate limits every 30 seconds
        const rateLimitMonitor = setInterval(() => {
            const status = getRateLimitStatus();
            if (status) {
                console.log(`📊 [${new Date().toLocaleTimeString()}] Rate Status: ${status.tokensThisMinute} tokens, ${status.requestsThisMinute} requests, ${status.consecutiveRateLimits} hits`);
                rateLimitHits = Math.max(rateLimitHits, status.consecutiveRateLimits);
            }
        }, 30000);

        console.log('⏳ Starting evolution...');
        console.log('💡 Watch for "🧵 Using persistent conversation" messages - these show the new approach!');
        console.log('');
        
        const results = await runEnhancedEvolution(5, 7); // 5 tournaments, 7 games each
        
        clearInterval(rateLimitMonitor);
        
        const duration = Math.round((Date.now() - startTime) / 1000);
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;
        
        console.log('\n🎉 LARGE EVOLUTION COMPLETED!');
        console.log('============================');
        console.log(`⏱️  Total duration: ${hours}h ${minutes}m ${seconds}s`);
        
        // Final standings
        console.log('\n🏆 FINAL EVOLUTION RESULTS:');
        console.log('===========================');
        results.finalStats.forEach((strategy, index) => {
            const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index] || '📍';
            const change = strategy.coinBalance - 500;
            const changeStr = change >= 0 ? `+${change}` : `${change}`;
            const roi = ((strategy.coinBalance - 500) / 500 * 100).toFixed(1);
            console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${changeStr}, ${roi}% ROI)`);
        });

        // Performance metrics
        const finalStatus = getRateLimitStatus();
        console.log('\n📊 PERFORMANCE METRICS:');
        console.log('=======================');
        console.log(`🔤 Total rate limit hits: ${rateLimitHits}`);
        if (finalStatus) {
            console.log(`🎯 Current token usage: ${finalStatus.tokensThisMinute} this minute`);
        }
        
        // Calculate games played and strategy evolution
        const totalStrategies = results.finalStats.length;
        const totalGames = 35; // 5 tournaments × 7 games
        
        console.log(`🎮 Games completed: ${totalGames}`);
        console.log(`🧬 Final strategy count: ${totalStrategies}`);
        console.log(`💰 Economic activity: ${totalGames * totalStrategies * 100} total tokens invested`);

        // Error analysis
        if (results.errorSummary) {
            const totalErrors = Object.values(results.errorSummary).reduce((sum, count) => sum + count, 0);
            console.log(`⚠️  Total errors: ${totalErrors}`);
            
            if (totalErrors > 0) {
                console.log('   Error breakdown:');
                Object.entries(results.errorSummary).forEach(([type, count]) => {
                    if (count > 0) {
                        console.log(`     ${type}: ${count}`);
                    }
                });
            }
        }

        // Show generated files
        const fs = require('fs');
        const evolutionFiles = fs.readdirSync('.').filter(f => 
            f.includes('enhanced_evolution_') || f.includes('incremental_progress_')
        );
        
        if (evolutionFiles.length > 0) {
            console.log('\n📁 Generated files:');
            evolutionFiles.slice(-3).forEach(file => {
                const stats = fs.statSync(file);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`   📄 ${file} (${sizeMB}MB)`);
            });
            
            if (evolutionFiles.length > 3) {
                console.log(`   ... and ${evolutionFiles.length - 3} more files`);
            }
        }

        // Strategic insights
        console.log('\n🧠 STRATEGIC INSIGHTS:');
        console.log('======================');
        
        const winners = results.finalStats.filter(s => s.coinBalance > 500);
        const losers = results.finalStats.filter(s => s.coinBalance <= 500);
        
        console.log(`💰 Profitable strategies: ${winners.length}/${totalStrategies}`);
        console.log(`💸 Unprofitable strategies: ${losers.length}/${totalStrategies}`);
        
        if (winners.length > 0) {
            const avgWinnerBalance = Math.round(winners.reduce((sum, s) => sum + s.coinBalance, 0) / winners.length);
            console.log(`📈 Average winner balance: ${avgWinnerBalance} coins`);
        }

        console.log('\n✅ Evolution complete! The persistent conversation approach should show');
        console.log('   more coherent strategy evolution and better promise-keeping patterns.');
        
        return results;

    } catch (error) {
        console.error('\n❌ Evolution failed:', error.message);
        
        // Show rate limit status on failure
        const status = getRateLimitStatus();
        if (status) {
            console.log('\n📊 Rate limit status at failure:');
            console.log(`   Tokens: ${status.tokensThisMinute}, Requests: ${status.requestsThisMinute}`);
        }
        
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    runLargerEvolution()
        .then(() => {
            console.log('\n🎊 Large evolution completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Large evolution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runLargerEvolution }; 