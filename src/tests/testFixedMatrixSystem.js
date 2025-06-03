/**
 * Test Fixed Enhanced Matrix System
 * Validates that simplified prompts achieve higher success rates
 */

const { FixedEnhancedMatrixSystem } = require('../matrix/fixedEnhancedMatrixSystem');

async function testFixedMatrixSystem() {
    console.log('🔧 TESTING FIXED ENHANCED MATRIX SYSTEM');
    console.log('=======================================');
    console.log('🎯 Testing simplified prompts for better LLM compliance\n');

    const fixedMatrix = new FixedEnhancedMatrixSystem();
    
    const players = [
        { id: 'player1', name: 'Strategic Analyzer' },
        { id: 'player2', name: 'Diplomatic Builder' },
        { id: 'player3', name: 'Aggressive Maximizer' },
        { id: 'player4', name: 'Smart Opportunist' }
    ];
    
    fixedMatrix.initializeMatrix(players);
    
    console.log('🎮 RUNNING 3 ROUNDS WITH SIMPLIFIED PROMPTS');
    console.log('===========================================');
    
    const strategies = [
        'Analyze patterns and make calculated decisions based on mathematical optimization',
        'Build alliances through fair proposals and generous vote trading',
        'Demand maximum share and use aggressive tactics to dominate',
        'Adapt strategy based on what others do and exploit opportunities'
    ];
    
    let totalAttempts = 0;
    let successfulUpdates = 0;
    
    // Run 3 rounds
    for (let round = 1; round <= 3; round++) {
        console.log(`\n🔄 ROUND ${round}`);
        console.log('-'.repeat(30));
        
        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
            totalAttempts++;
            const success = await fixedMatrix.performNegotiationRound(
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
            
            // Small delay between players
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // Display results
    const results = fixedMatrix.displayResults();
    
    // Calculate success metrics
    const successRate = (successfulUpdates / totalAttempts) * 100;
    const explanationRate = (results.totalExplanations / successfulUpdates) * 100;
    const violationRate = (results.totalViolations / totalAttempts) * 100;
    
    console.log('\n📈 PERFORMANCE COMPARISON');
    console.log('========================');
    console.log(`Total attempts: ${totalAttempts}`);
    console.log(`Successful updates: ${successfulUpdates}`);
    console.log(`Update success rate: ${successRate.toFixed(1)}%`);
    console.log(`Explanation coverage: ${explanationRate.toFixed(1)}%`);
    console.log(`Violation rate: ${violationRate.toFixed(1)}%`);
    
    // Compare with original system results
    console.log('\n🔍 COMPARISON WITH ORIGINAL SYSTEM:');
    console.log('Original system: 8.3% success rate, 1100% violation rate');
    console.log(`Fixed system: ${successRate.toFixed(1)}% success rate, ${violationRate.toFixed(1)}% violation rate`);
    
    if (successRate >= 75) {
        console.log('\n🎉 FIXED MATRIX SYSTEM VALIDATION PASSED!');
        console.log('   ✅ Simplified prompts dramatically improved success rate');
        console.log('   ✅ Mathematical constraints properly understood by LLM');
        console.log('   ✅ System ready for production use');
        return true;
    } else if (successRate >= 50) {
        console.log('\n🟡 FIXED MATRIX SYSTEM PARTIALLY IMPROVED');
        console.log('   ✅ Better than original but still needs refinement');
        return false;
    } else {
        console.log('\n❌ FIXED MATRIX SYSTEM STILL NEEDS WORK');
        console.log('   ❌ Success rate still too low for production');
        return false;
    }
}

// Run the test
testFixedMatrixSystem()
    .then(success => {
        if (success) {
            console.log('\n🚀 Fixed matrix system ready for integration with evolution!');
        } else {
            console.log('\n🔧 Further refinements needed');
        }
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error);
    });

module.exports = { testFixedMatrixSystem }; 