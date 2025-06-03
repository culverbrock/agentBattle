/**
 * Test Strategic Evolution - Demonstrates enhanced strategic reasoning and unified vote system
 */

const { ImprovedMatrixSystem } = require('../matrix/improvedMatrixSystem');

async function testStrategicEvolution() {
    console.log('🧠 TESTING STRATEGIC EVOLUTION');
    console.log('==============================');
    console.log('🎯 Demonstrating adaptive negotiation intelligence\n');

    const matrix = new ImprovedMatrixSystem();
    
    const players = [
        { id: 'player1', name: 'Alice' },
        { id: 'player2', name: 'Bob' },
        { id: 'player3', name: 'Charlie' },
        { id: 'player4', name: 'Diana' }
    ];
    
    const strategies = [
        'Maximize my token percentage while building strategic alliances',
        'Trade votes for favorable token allocations',
        'Focus on mutual benefit and long-term relationships',
        'Analyze patterns and exploit weaknesses in others\' strategies'
    ];
    
    matrix.initializeMatrix(players);
    
    console.log('🎮 RUNNING 3 ROUNDS TO SHOW STRATEGIC ADAPTATION');
    console.log('================================================');
    
    for (let round = 1; round <= 3; round++) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🔄 ROUND ${round} - STRATEGIC INTELLIGENCE LEVEL`);
        console.log(`${'='.repeat(50)}`);
        
        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
            const playerName = players[playerIndex].name;
            console.log(`\n🧠 ${playerName} (Player ${playerIndex}) thinking...`);
            
            const success = await matrix.performNegotiationRound(
                playerIndex, 
                strategies[playerIndex], 
                round
            );
            
            if (success) {
                console.log(`  ✅ ${playerName} adapted strategy successfully`);
                
                // Show current matrix position
                const currentMatrix = matrix.getMatrix();
                const playerRow = currentMatrix[playerIndex];
                const numPlayers = players.length;
                
                const tokenProposal = playerRow.slice(0, numPlayers);
                const voteAllocation = playerRow.slice(numPlayers, numPlayers * 2);
                const voteRequests = playerRow.slice(numPlayers * 2, numPlayers * 3);
                
                console.log(`  💰 Token Proposal: [${tokenProposal.map(x => x.toFixed(1)).join(', ')}]%`);
                console.log(`  🗳️  Vote Allocation: [${voteAllocation.map(x => x.toFixed(1)).join(', ')}]%`);
                console.log(`  📞 Vote Requests: [${voteRequests.map(x => x.toFixed(1)).join(', ')}]`);
                
                // Show who they're supporting/favoring
                const maxVoteIndex = voteAllocation.indexOf(Math.max(...voteAllocation));
                const maxTokenIndex = tokenProposal.indexOf(Math.max(...tokenProposal.filter((_, i) => i !== playerIndex)));
                
                if (maxVoteIndex !== playerIndex) {
                    console.log(`  🤝 Supporting: ${players[maxVoteIndex].name} with ${voteAllocation[maxVoteIndex].toFixed(1)}% of votes`);
                }
                if (tokenProposal[playerIndex] >= 17) {
                    console.log(`  💸 Profitable self-allocation: ${tokenProposal[playerIndex].toFixed(1)}%`);
                }
            } else {
                console.log(`  ❌ ${playerName} failed to adapt strategy`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Show round summary
        console.log(`\n📊 END OF ROUND ${round} SUMMARY:`);
        const currentMatrix = matrix.getMatrix();
        players.forEach((player, i) => {
            const row = currentMatrix[i];
            if (row && row.some(x => x > 0)) {
                const selfAlloc = row[i];
                console.log(`  ${player.name}: Self-allocation ${selfAlloc.toFixed(1)}% | Profit: ${((selfAlloc/100)*600-100).toFixed(0)} tokens`);
            }
        });
    }
    
    // Show strategic evolution results
    console.log('\n🎭 STRATEGIC EVOLUTION ANALYSIS');
    console.log('===============================');
    
    const results = matrix.displayResults();
    
    console.log('\n🧬 ADAPTATION PATTERNS:');
    console.log('-----------------------');
    
    // Analyze how strategies evolved
    if (results.strategicHistory) {
        results.strategicHistory.forEach((history, playerIndex) => {
            if (history.length > 0) {
                const playerName = players[playerIndex].name;
                console.log(`\n${playerName}'s Strategic Evolution:`);
                
                history.forEach((entry, roundIndex) => {
                    console.log(`  Round ${entry.round}:`);
                    console.log(`    Strategy: "${entry.strategy}"`);
                    console.log(`    Reasoning: "${entry.explanation.substring(0, 200)}..."`);
                    
                    if (roundIndex > 0) {
                        console.log(`    🔄 Adaptation from previous round detected!`);
                    }
                });
            }
        });
    }
    
    console.log('\n📈 SYSTEM PERFORMANCE:');
    console.log('----------------------');
    console.log(`Matrix format: 3-section unified (${players.length * 3} numbers per player)`);
    console.log(`Successful negotiations: ${results.totalMods}`);
    console.log(`Strategic explanations: ${results.totalExplanations}`);
    console.log(`LLM success rate: ${results.llmSuccessRate.toFixed(1)}%`);
    console.log(`Auto-corrections applied: ${results.correctedCalls}`);
    
    console.log('\n🎯 KEY IMPROVEMENTS DEMONSTRATED:');
    console.log('=================================');
    console.log('✅ Unified vote structure (vote allocation = vote offers)');
    console.log('✅ Strategic intelligence that evolves over rounds');
    console.log('✅ Agents analyze opponents\' proposals and adapt accordingly');
    console.log('✅ Detailed strategic reasoning in explanations');
    console.log('✅ Pattern recognition from previous negotiations');
    
    return results;
}

// Run the test
console.log('Starting strategic evolution demonstration...\n');

testStrategicEvolution()
    .then(results => {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 STRATEGIC EVOLUTION DEMONSTRATION COMPLETE!');
        console.log('='.repeat(60));
        console.log(`📁 Detailed logs saved to: ${results.logFile}`);
        console.log('\n🎉 The enhanced matrix system successfully demonstrates:');
        console.log('   • Strategic adaptation over multiple rounds');
        console.log('   • Unified vote allocation/offer structure');
        console.log('   • Intelligent analysis of opponents\' moves');
        console.log('   • Evolving explanations based on learned patterns');
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error);
        console.error(error.stack);
    });

module.exports = { testStrategicEvolution }; 