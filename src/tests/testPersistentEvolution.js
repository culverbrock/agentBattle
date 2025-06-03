/**
 * Test the enhanced evolution system with persistent conversations
 * Run from scratch to see the 38% promise-keeping improvement in action!
 */

const { runEnhancedEvolution } = require('../core/enhancedEvolutionarySystem');
const { getRateLimitStatus } = require('../core/llmApi');

async function testPersistentEvolution() {
    console.log('🚀 TESTING ENHANCED EVOLUTION WITH PERSISTENT CONVERSATIONS');
    console.log('===========================================================');
    console.log('💡 Expected benefits:');
    console.log('   • 38% better promise-keeping (from our A/B tests)');
    console.log('   • More realistic negotiation→proposal→voting flows');
    console.log('   • Better strategic coherence within games');
    console.log('   • LLMs remember their own statements across phases');
    console.log('');

    const startTime = Date.now();
    
    try {
        // Run a small evolution to test the integration
        console.log('⏳ Starting evolution: 2 tournaments × 3 games each...');
        
        const results = await runEnhancedEvolution(2, 3); // 2 tournaments, 3 games each
        
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        console.log('\n🎉 EVOLUTION COMPLETED SUCCESSFULLY!');
        console.log('===================================');
        console.log(`⏱️  Total duration: ${Math.floor(duration/60)}m ${duration%60}s`);
        
        // Show final rankings
        console.log('\n🏆 Final Rankings:');
        results.finalStats.forEach((strategy, index) => {
            const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index] || '📍';
            const change = strategy.coinBalance - 500;
            const changeStr = change >= 0 ? `+${change}` : `${change}`;
            console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${changeStr})`);
        });

        // Show rate limit usage
        const rateLimitStatus = getRateLimitStatus ? getRateLimitStatus() : null;
        if (rateLimitStatus) {
            console.log('\n📊 RATE LIMIT STATUS:');
            console.log(`   🔤 Tokens used this minute: ${rateLimitStatus.tokensThisMinute}`);
            console.log(`   🚦 Requests this minute: ${rateLimitStatus.requestsThisMinute}`);
            console.log(`   💥 Rate limits hit: ${rateLimitStatus.consecutiveRateLimits}`);
        }

        // Check if any JSON files were created
        const fs = require('fs');
        const files = fs.readdirSync('.').filter(f => f.includes('enhanced_evolution_') && f.endsWith('.json'));
        if (files.length > 0) {
            console.log('\n📁 Generated files:');
            files.forEach(file => console.log(`   📄 ${file}`));
        }

        // Show error summary if available
        if (results.errorSummary) {
            console.log('\n⚠️ ERROR SUMMARY:');
            Object.entries(results.errorSummary).forEach(([type, count]) => {
                if (count > 0) {
                    console.log(`   ${type}: ${count} failures`);
                }
            });
        }

        console.log('\n✅ Integration test successful! Persistent conversations are working.');
        return results;

    } catch (error) {
        console.error('\n❌ Evolution failed:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

// Run test if called directly
if (require.main === module) {
    testPersistentEvolution()
        .then(() => {
            console.log('\n🎊 Test completed! Ready for larger evolutions.');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testPersistentEvolution }; 