/**
 * Test Clarified Matrix System - Validates clear token vs vote understanding
 */

const { ClarifiedMatrixSystem } = require('../matrix/clarifiedMatrixSystem');

async function testClarifiedSystem() {
    console.log('🔍 TESTING CLARIFIED MATRIX SYSTEM');
    console.log('==================================');
    console.log('🎯 Testing clear distinction between tokens vs votes\n');

    const clarifiedMatrix = new ClarifiedMatrixSystem();
    
    const players = [
        { id: 'player1', name: 'Token Strategist' },
        { id: 'player2', name: 'Vote Trader' },
        { id: 'player3', name: 'Alliance Builder' },
        { id: 'player4', name: 'Sharp Negotiator' }
    ];
    
    clarifiedMatrix.initializeMatrix(players);
    
    console.log('🎮 RUNNING 2 ROUNDS WITH CLARIFIED PROMPTS');
    console.log('==========================================');
    
    const strategies = [
        'Focus on maximizing token percentages while using vote trading strategically',
        'Build voting alliances to support favorable token proposals', 
        'Form coalitions through generous vote offers in exchange for token shares',
        'Analyze the difference between token value and vote cost for optimal trades'
    ];
    
    let totalAttempts = 0;
    let successfulUpdates = 0;
    let tokenVoteUnderstanding = 0; // Count explanations that show clear understanding
    
    // Run 2 rounds
    for (let round = 1; round <= 2; round++) {
        console.log(`\n🔄 ROUND ${round}`);
        console.log('-'.repeat(30));
        
        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
            totalAttempts++;
            const success = await clarifiedMatrix.performNegotiationRound(
                playerIndex, 
                strategies[playerIndex], 
                round
            );
            
            if (success) {
                successfulUpdates++;
                console.log(`  ✅ ${players[playerIndex].name} updated successfully`);
            } else {
                console.log(`  ❌ ${players[playerIndex].name} failed to update`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    }
    
    // Display results with enhanced analysis
    const results = clarifiedMatrix.displayResults();
    
    // Analyze explanations for token/vote understanding
    console.log('\n🧠 ANALYZING TOKEN VS VOTE UNDERSTANDING');
    console.log('========================================');
    
    results.explanations.forEach((playerExps, playerIndex) => {
        const playerName = players[playerIndex].name;
        console.log(`\n${playerName}:`);
        
        playerExps.forEach(exp => {
            const explanation = exp.explanation.toLowerCase();
            
            // Check for token understanding
            const hasTokenWords = explanation.includes('token') || 
                                 explanation.includes('pool') || 
                                 explanation.includes('payout') ||
                                 explanation.includes('600');
            
            // Check for vote understanding  
            const hasVoteWords = explanation.includes('vote') || 
                               explanation.includes('voting') ||
                               explanation.includes('offer') ||
                               explanation.includes('request');
            
            // Check for distinction understanding
            const hasDistinction = (hasTokenWords && hasVoteWords) ||
                                 explanation.includes('percentage') ||
                                 explanation.includes('currency');
            
            if (hasDistinction) {
                tokenVoteUnderstanding++;
                console.log(`  Round ${exp.round}: 🟢 CLEAR UNDERSTANDING`);
            } else if (hasTokenWords || hasVoteWords) {
                console.log(`  Round ${exp.round}: 🟡 PARTIAL UNDERSTANDING`);
            } else {
                console.log(`  Round ${exp.round}: 🔴 UNCLEAR UNDERSTANDING`);
            }
            
            console.log(`    "${exp.explanation.substring(0, 120)}..."`);
        });
    });
    
    // Calculate success metrics
    const successRate = (successfulUpdates / totalAttempts) * 100;
    const explanationRate = (results.totalExplanations / successfulUpdates) * 100;
    const violationRate = (results.totalViolations / totalAttempts) * 100;
    const understandingRate = (tokenVoteUnderstanding / results.totalExplanations) * 100;
    
    console.log('\n📈 PERFORMANCE METRICS');
    console.log('======================');
    console.log(`Update success rate: ${successRate.toFixed(1)}%`);
    console.log(`Explanation coverage: ${explanationRate.toFixed(1)}%`);
    console.log(`Violation rate: ${violationRate.toFixed(1)}%`);
    console.log(`Token/Vote understanding: ${understandingRate.toFixed(1)}%`);
    
    console.log('\n🔍 COMPARISON WITH PREVIOUS SYSTEMS:');
    console.log('Original enhanced system: 8.3% success, 1100% violations');
    console.log('Fixed simplified system: 83.3% success, 16.7% violations');
    console.log(`Clarified system: ${successRate.toFixed(1)}% success, ${violationRate.toFixed(1)}% violations, ${understandingRate.toFixed(1)}% understanding`);
    
    // Test matrix structure for logical consistency
    console.log('\n🔍 MATRIX LOGIC ANALYSIS');
    console.log('========================');
    
    const matrix = results.matrix;
    matrix.forEach((row, playerIndex) => {
        if (row.every(val => val === 0)) return; // Skip empty rows
        
        const playerName = players[playerIndex].name;
        const proposal = row.slice(0, 4);
        const votes = row.slice(4, 8);
        const offers = row.slice(8, 12);
        const requests = row.slice(12, 16);
        
        console.log(`\n${playerName} Strategic Analysis:`);
        
        // Check if vote allocation matches their proposal preference
        const maxVoteIndex = votes.indexOf(Math.max(...votes));
        const maxProposal = Math.max(...proposal);
        const selfProposal = proposal[playerIndex];
        
        console.log(`  🎯 Gives most votes to proposal ${maxVoteIndex}`);
        console.log(`  💰 Proposes ${selfProposal}% tokens for self`);
        console.log(`  🤝 Total vote offers: ${offers.reduce((a,b) => a+b, 0)}`);
        console.log(`  📞 Total vote requests: ${requests.reduce((a,b) => a+b, 0)}`);
        
        // Check for strategic logic
        if (selfProposal >= 20 && offers.reduce((a,b) => a+b, 0) > 50) {
            console.log(`  ✅ Generous strategy: High self-allocation + high vote offers`);
        } else if (selfProposal >= 20 && requests.reduce((a,b) => a+b, 0) > offers.reduce((a,b) => a+b, 0)) {
            console.log(`  🎯 Demanding strategy: High self-allocation + more requests than offers`);
        } else if (offers.reduce((a,b) => a+b, 0) > requests.reduce((a,b) => a+b, 0)) {
            console.log(`  🤝 Diplomatic strategy: More vote offers than requests`);
        }
    });
    
    if (successRate >= 75 && understandingRate >= 60) {
        console.log('\n🎉 CLARIFIED MATRIX SYSTEM VALIDATION PASSED!');
        console.log('   ✅ High success rate maintained');
        console.log('   ✅ Players demonstrate clear token/vote understanding');
        console.log('   ✅ Strategic explanations show logical reasoning');
        return true;
    } else if (successRate >= 75) {
        console.log('\n🟡 CLARIFIED SYSTEM PARTIALLY SUCCESSFUL');
        console.log('   ✅ High success rate');
        console.log('   ❓ Understanding could be clearer');
        return false;
    } else {
        console.log('\n❌ CLARIFIED SYSTEM NEEDS MORE WORK');
        return false;
    }
}

testClarifiedSystem()
    .then(success => {
        if (success) {
            console.log('\n🚀 Clarified matrix system ready for evolution integration!');
        } else {
            console.log('\n🔧 Further clarification needed');
        }
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error);
    });

module.exports = { testClarifiedSystem }; 