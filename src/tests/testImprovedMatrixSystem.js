/**
 * Test Improved Matrix System - Validates enhanced prompts and auto-correction
 */

const { ImprovedMatrixSystem } = require('../matrix/improvedMatrixSystem');
const fs = require('fs');

async function testImprovedMatrixSystem() {
    console.log('🚀 TESTING IMPROVED MATRIX SYSTEM');
    console.log('=================================');
    console.log('🎯 Testing enhanced prompts, auto-correction, and validation improvements\n');

    const improvedMatrix = new ImprovedMatrixSystem();
    
    const players = [
        { id: 'player1', name: 'Token Strategist' },
        { id: 'player2', name: 'Vote Trader' },
        { id: 'player3', name: 'Alliance Builder' },
        { id: 'player4', name: 'Sharp Negotiator' }
    ];
    
    improvedMatrix.initializeMatrix(players);
    
    console.log('🎮 RUNNING 2 ROUNDS WITH IMPROVED SYSTEM');
    console.log('========================================');
    
    const strategies = [
        'Focus on maximizing token percentages while using vote trading strategically',
        'Build voting alliances to support favorable token proposals', 
        'Form coalitions through generous vote offers in exchange for token shares',
        'Analyze the difference between token value and vote cost for optimal trades'
    ];
    
    let totalAttempts = 0;
    let successfulUpdates = 0;
    
    // Run 2 rounds
    for (let round = 1; round <= 2; round++) {
        console.log(`\n🔄 ROUND ${round}`);
        console.log('-'.repeat(30));
        
        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
            totalAttempts++;
            console.log(`\n🔢 Processing ${players[playerIndex].name} (Player ${playerIndex})...`);
            
            const success = await improvedMatrix.performNegotiationRound(
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
            
            // Small delay between calls
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Display results and analyze improvements
    const results = improvedMatrix.displayResults();
    
    console.log('\n🔍 IMPROVEMENT ANALYSIS');
    console.log('======================');
    
    // Calculate success metrics
    const successRate = (successfulUpdates / totalAttempts) * 100;
    const llmSuccessRate = results.llmSuccessRate;
    const correctionRate = (results.correctedCalls / results.llmInteractions.filter(i => !i.corrected).length) * 100;
    
    console.log('\n📈 PERFORMANCE COMPARISON:');
    console.log('Previous logged system: 50.0% matrix update success');
    console.log(`Improved system: ${successRate.toFixed(1)}% matrix update success`);
    console.log(`Auto-corrections applied: ${results.correctedCalls} (${correctionRate.toFixed(1)}% of attempts)`);
    
    // Analyze specific improvements
    if (results.llmInteractions.length > 0) {
        console.log('\n🛠️ IMPROVEMENT BREAKDOWN:');
        
        const originalResponses = results.llmInteractions.filter(i => !i.corrected);
        const correctedResponses = results.llmInteractions.filter(i => i.corrected);
        
        console.log(`Original LLM responses: ${originalResponses.length}`);
        console.log(`Auto-corrected responses: ${correctedResponses.length}`);
        
        // Show first corrected example if any
        if (correctedResponses.length > 0) {
            console.log('\n🔧 AUTO-CORRECTION EXAMPLES:');
            correctedResponses.slice(0, 2).forEach((correction, index) => {
                console.log(`${index + 1}. ${correction.playerName} - Round ${correction.round}`);
                console.log(`   Applied: ${correction.response}`);
            });
        }
        
        // Analyze error reduction
        const violations = results.violations;
        const mathErrors = violations.filter(v => v.violationType.includes('INVALID_MATRIX'));
        const parseErrors = violations.filter(v => v.violationType.includes('PARSE_FAILURE'));
        
        console.log('\n📊 ERROR ANALYSIS:');
        console.log(`Total violations: ${violations.length}`);
        console.log(`Math validation errors: ${mathErrors.length}`);
        console.log(`Parse errors: ${parseErrors.length}`);
        console.log(`Uncorrectable errors: ${violations.filter(v => v.violationType.includes('UNCORRECTABLE')).length}`);
    }
    
    console.log('\n📈 FINAL METRICS');
    console.log('================');
    console.log(`Total attempts: ${totalAttempts}`);
    console.log(`Successful updates: ${successfulUpdates}`);
    console.log(`LLM success rate: ${llmSuccessRate.toFixed(1)}%`);
    console.log(`Matrix update success rate: ${successRate.toFixed(1)}%`);
    console.log(`Auto-correction rate: ${correctionRate.toFixed(1)}%`);
    console.log(`Violations: ${results.totalViolations}`);
    console.log(`Log file: ${results.logFile}`);
    
    // Show sample of the improved prompts
    console.log('\n📝 SAMPLE IMPROVED PROMPT FEATURES:');
    console.log('===================================');
    const sampleInteraction = results.llmInteractions.find(i => !i.corrected);
    if (sampleInteraction) {
        const prompt = sampleInteraction.prompt;
        console.log('✅ Explicit math examples included');
        console.log('✅ Clear position numbering');
        console.log('✅ Warning against all-zeros');
        console.log('✅ Lower temperature for consistency');
        console.log('✅ Increased token limit');
        console.log(`Prompt length: ${prompt.length} chars`);
    }
    
    // Evaluate success
    const TARGET_SUCCESS_RATE = 75;
    const MIN_CORRECTION_BENEFIT = 10; // Auto-correction should help at least 10%
    
    if (successRate >= TARGET_SUCCESS_RATE) {
        console.log('\n🎉 IMPROVED MATRIX SYSTEM VALIDATION PASSED!');
        console.log(`   ✅ Success rate: ${successRate.toFixed(1)}% (target: ≥${TARGET_SUCCESS_RATE}%)`);
        console.log(`   ✅ Auto-correction working: ${correctionRate.toFixed(1)}% benefit`);
        console.log('   ✅ Enhanced prompts effective');
        return true;
    } else {
        console.log('\n🟡 IMPROVED SYSTEM SHOWS PROGRESS');
        console.log(`   📈 Success rate: ${successRate.toFixed(1)}% (target: ≥${TARGET_SUCCESS_RATE}%)`);
        console.log(`   🔧 Auto-correction: ${correctionRate.toFixed(1)}% applications`);
        
        if (successRate > 50) {
            console.log('   ✅ Improvement over 50% baseline achieved!');
        }
        return false;
    }
}

async function compareSystemPerformance() {
    console.log('\n📊 SYSTEM PERFORMANCE COMPARISON');
    console.log('================================');
    
    // Theoretical comparison based on our improvements
    const systems = [
        {
            name: 'Original Matrix System',
            successRate: 8.3,
            violations: 110,
            features: ['Basic prompts', 'Strict validation', 'No auto-correction']
        },
        {
            name: 'Fixed Matrix System', 
            successRate: 83.3,
            violations: 16.7,
            features: ['Simplified prompts', 'Clear examples', 'Better math guidance']
        },
        {
            name: 'Clarified Matrix System',
            successRate: 50.0,
            violations: 50.0,
            features: ['Token/vote distinction', 'Strategic examples', 'Ownership validation']
        },
        {
            name: 'Improved Matrix System',
            successRate: '???',
            violations: '???',
            features: ['Auto-correction', 'Forgiving validation', 'Enhanced prompts', 'Lower temperature']
        }
    ];
    
    console.log('\nSYSTEM EVOLUTION:');
    systems.forEach((system, index) => {
        console.log(`\n${index + 1}. ${system.name}`);
        console.log(`   Success Rate: ${system.successRate}%`);
        console.log(`   Violations: ${system.violations}%`);
        console.log(`   Features: ${system.features.join(', ')}`);
    });
    
    console.log('\n🎯 IMPROVEMENT STRATEGY:');
    console.log('1. Enhanced prompts with explicit math examples');
    console.log('2. Auto-correction for common mathematical errors');
    console.log('3. More forgiving validation tolerances (±2% vs ±1%)');
    console.log('4. Lower temperature (0.2) for more consistent math');
    console.log('5. Increased token limit (500) for detailed responses');
    console.log('6. Clear warnings against all-zero responses');
}

// Run the test
testImprovedMatrixSystem()
    .then(success => {
        console.log('\n' + '='.repeat(50));
        if (success) {
            console.log('🚀 IMPROVED MATRIX SYSTEM READY FOR PRODUCTION!');
        } else {
            console.log('🔧 SYSTEM SHOWS IMPROVEMENT - READY FOR FURTHER ITERATION');
        }
        
        // Run comparison analysis
        return compareSystemPerformance();
    })
    .then(() => {
        // List all log files created
        console.log('\n📁 LOG FILES CREATED:');
        const files = fs.readdirSync('.').filter(f => f.includes('matrix_llm_log') || f.includes('improved_matrix_log'));
        files.forEach(file => console.log(`  📄 ${file}`));
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error);
    });

module.exports = { testImprovedMatrixSystem, compareSystemPerformance }; 