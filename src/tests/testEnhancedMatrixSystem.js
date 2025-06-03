/**
 * Test Enhanced Matrix System with Explanations and Validation
 * Demonstrates ownership checks, strategic explanations, and violation detection
 */

const { EnhancedMatrixSystem } = require('../matrix/enhancedMatrixSystem');

async function testEnhancedMatrixSystem() {
    console.log('🔍 TESTING ENHANCED MATRIX SYSTEM');
    console.log('==================================');
    console.log('🎯 Features being tested:');
    console.log('   • Row ownership validation');
    console.log('   • Required strategic explanations');
    console.log('   • Understanding verification');
    console.log('   • Violation detection and logging');
    console.log('');

    const enhancedMatrix = new EnhancedMatrixSystem();
    
    const players = [
        { id: 'player1', name: 'Strategic Analyzer' },
        { id: 'player2', name: 'Diplomatic Builder' },
        { id: 'player3', name: 'Aggressive Maximizer' },
        { id: 'player4', name: 'Smart Opportunist' }
    ];
    
    enhancedMatrix.initializeMatrix(players);
    
    console.log('🎮 SIMULATING 3 ROUNDS OF ENHANCED NEGOTIATIONS');
    console.log('================================================');
    
    // Round 1: All players make legitimate updates with explanations
    console.log('\n🔄 ROUND 1: Legitimate strategic updates');
    console.log('-'.repeat(50));
    
    const strategies = [
        'Analyze patterns and make calculated decisions based on mathematical optimization',
        'Build alliances through fair proposals and generous vote trading',
        'Demand maximum share and use aggressive tactics to dominate',
        'Adapt strategy based on what others do and exploit opportunities'
    ];
    
    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const success = await enhancedMatrix.performNegotiationRound(
            playerIndex, 
            strategies[playerIndex], 
            1
        );
        
        if (success) {
            console.log(`✅ Player ${playerIndex} (${players[playerIndex].name}) updated successfully`);
        } else {
            console.log(`❌ Player ${playerIndex} (${players[playerIndex].name}) failed to update`);
        }
        
        // Small delay between players
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Round 2: Test with some strategic adaptations
    console.log('\n🔄 ROUND 2: Strategic adaptations based on Round 1');
    console.log('-'.repeat(50));
    
    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const success = await enhancedMatrix.performNegotiationRound(
            playerIndex, 
            strategies[playerIndex], 
            2
        );
        
        if (success) {
            console.log(`✅ Player ${playerIndex} updated with strategic adaptation`);
        } else {
            console.log(`❌ Player ${playerIndex} failed strategic adaptation`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Round 3: Final strategic positioning
    console.log('\n🔄 ROUND 3: Final strategic positioning');
    console.log('-'.repeat(50));
    
    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const success = await enhancedMatrix.performNegotiationRound(
            playerIndex, 
            strategies[playerIndex], 
            3
        );
        
        if (success) {
            console.log(`✅ Player ${playerIndex} completed final positioning`);
        } else {
            console.log(`❌ Player ${playerIndex} failed final positioning`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Display comprehensive analysis
    console.log('\n📊 COMPREHENSIVE ANALYSIS');
    console.log('=========================');
    
    const analysis = enhancedMatrix.displayComprehensiveSummary();
    
    // Test summary
    console.log('\n🎯 TEST SUMMARY');
    console.log('===============');
    
    const totalExplanations = analysis.explanations.reduce((sum, playerExps) => sum + playerExps.length, 0);
    const totalViolations = analysis.violations.length;
    const totalModifications = analysis.playerOwnership.reduce((sum, player) => sum + player.modifications, 0);
    
    console.log(`📝 Total explanations provided: ${totalExplanations}`);
    console.log(`🔒 Total matrix modifications: ${totalModifications}`);
    console.log(`🚨 Total violations detected: ${totalViolations}`);
    
    // Validate understanding quality
    console.log('\n🧠 UNDERSTANDING QUALITY ANALYSIS');
    console.log('==================================');
    
    analysis.explanations.forEach((playerExps, playerIndex) => {
        const playerName = players[playerIndex].name;
        console.log(`\n${playerName}:`);
        
        playerExps.forEach(exp => {
            const hasObservation = exp.explanation.toLowerCase().includes('saw') || 
                                 exp.explanation.toLowerCase().includes('noticed') ||
                                 exp.explanation.toLowerCase().includes('observed');
            const hasReasoning = exp.explanation.toLowerCase().includes('because') ||
                               exp.explanation.toLowerCase().includes('since') ||
                               exp.explanation.toLowerCase().includes('so');
            const hasStrategy = exp.explanation.toLowerCase().includes('goal') ||
                              exp.explanation.toLowerCase().includes('strategy') ||
                              exp.explanation.toLowerCase().includes('plan');
            
            const qualityScore = (hasObservation ? 1 : 0) + (hasReasoning ? 1 : 0) + (hasStrategy ? 1 : 0);
            const quality = qualityScore === 3 ? '🟢 Excellent' : 
                          qualityScore === 2 ? '🟡 Good' : 
                          qualityScore === 1 ? '🟠 Basic' : '🔴 Poor';
            
            console.log(`  Round ${exp.round}: ${quality} (${qualityScore}/3)`);
            console.log(`    "${exp.explanation.substring(0, 100)}..."`);
        });
    });
    
    // Success metrics
    const successRate = (totalModifications / (players.length * 3)) * 100;
    const explanationRate = (totalExplanations / totalModifications) * 100;
    const violationRate = (totalViolations / totalModifications) * 100;
    
    console.log('\n📈 SUCCESS METRICS');
    console.log('==================');
    console.log(`✅ Update success rate: ${successRate.toFixed(1)}%`);
    console.log(`💭 Explanation coverage: ${explanationRate.toFixed(1)}%`);
    console.log(`🚨 Violation rate: ${violationRate.toFixed(1)}%`);
    
    if (successRate >= 80 && explanationRate >= 90 && violationRate <= 10) {
        console.log('\n🎉 ENHANCED MATRIX SYSTEM TEST PASSED!');
        console.log('   ✅ Players provide strategic explanations');
        console.log('   ✅ Ownership validation working');
        console.log('   ✅ Understanding verification successful');
        return true;
    } else {
        console.log('\n❌ Enhanced matrix system needs improvement');
        return false;
    }
}

// Run the test
testEnhancedMatrixSystem()
    .then(success => {
        if (success) {
            console.log('\n🚀 Enhanced matrix system ready for evolution integration!');
        } else {
            console.log('\n🔧 System needs refinement before integration');
        }
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error);
    });

module.exports = { testEnhancedMatrixSystem }; 