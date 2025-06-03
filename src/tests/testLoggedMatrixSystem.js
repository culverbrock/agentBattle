/**
 * Test Logged Matrix System - Captures and analyzes all LLM interactions
 */

const { LoggedMatrixSystem } = require('../matrix/loggedMatrixSystem');
const fs = require('fs');

async function testLoggedMatrixSystem() {
    console.log('📝 TESTING LOGGED MATRIX SYSTEM');
    console.log('===============================');
    console.log('🎯 Capturing all LLM prompts and responses for analysis\n');

    const loggedMatrix = new LoggedMatrixSystem();
    
    const players = [
        { id: 'player1', name: 'Token Strategist' },
        { id: 'player2', name: 'Vote Trader' },
        { id: 'player3', name: 'Alliance Builder' },
        { id: 'player4', name: 'Sharp Negotiator' }
    ];
    
    loggedMatrix.initializeMatrix(players);
    
    console.log('🎮 RUNNING 2 ROUNDS WITH COMPREHENSIVE LOGGING');
    console.log('==============================================');
    
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
            
            const success = await loggedMatrix.performNegotiationRound(
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
    
    // Display results and export logs
    const results = loggedMatrix.displayResults();
    const detailedLogFile = loggedMatrix.exportDetailedLogs();
    
    console.log('\n🔍 ANALYZING LLM INTERACTION PATTERNS');
    console.log('====================================');
    
    // Analyze prompt and response patterns
    if (results.llmInteractions.length > 0) {
        console.log('\n📊 PROMPT ANALYSIS:');
        
        // Show first successful prompt as example
        const firstSuccess = results.llmInteractions.find(i => i.success);
        if (firstSuccess) {
            console.log(`\n📝 EXAMPLE SUCCESSFUL PROMPT (${firstSuccess.playerName}):`);
            console.log('─'.repeat(80));
            console.log(firstSuccess.prompt.substring(0, 500) + '...\n');
            
            console.log(`📨 CORRESPONDING RESPONSE:`);
            console.log('─'.repeat(80));
            console.log(firstSuccess.response.substring(0, 300) + '...\n');
        }
        
        // Show first failed interaction if any
        const firstFailure = results.llmInteractions.find(i => !i.success);
        if (firstFailure) {
            console.log(`\n❌ EXAMPLE FAILED INTERACTION (${firstFailure.playerName}):`);
            console.log('─'.repeat(80));
            console.log(`Error: ${firstFailure.error}`);
            console.log(`Response: ${firstFailure.response?.substring(0, 200) || 'No response'}`);
        }
        
        // Show prompt statistics by player
        console.log('\n📈 STATISTICS BY PLAYER:');
        players.forEach((player, index) => {
            const playerInteractions = results.llmInteractions.filter(i => i.playerIndex === index);
            const successRate = playerInteractions.length > 0 ? 
                (playerInteractions.filter(i => i.success).length / playerInteractions.length * 100).toFixed(1) : 0;
            
            console.log(`${player.name}: ${playerInteractions.length} calls, ${successRate}% success`);
            
            // Show average prompt/response lengths
            if (playerInteractions.length > 0) {
                const avgPrompt = playerInteractions.reduce((sum, i) => sum + i.promptLength, 0) / playerInteractions.length;
                const avgResponse = playerInteractions.reduce((sum, i) => sum + i.responseLength, 0) / playerInteractions.length;
                console.log(`  Avg prompt: ${avgPrompt.toFixed(0)} chars, Avg response: ${avgResponse.toFixed(0)} chars`);
            }
        });
        
        // Show errors by type
        const errorTypes = {};
        results.llmInteractions.filter(i => !i.success).forEach(i => {
            const errorType = i.error?.split(':')[0] || 'Unknown';
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
        });
        
        if (Object.keys(errorTypes).length > 0) {
            console.log('\n🚨 ERROR BREAKDOWN:');
            Object.entries(errorTypes).forEach(([errorType, count]) => {
                console.log(`  ${errorType}: ${count} occurrences`);
            });
        }
    }
    
    // Calculate final metrics
    const successRate = (successfulUpdates / totalAttempts) * 100;
    const llmSuccessRate = results.llmSuccessRate;
    
    console.log('\n📈 FINAL PERFORMANCE METRICS');
    console.log('============================');
    console.log(`Total LLM calls: ${results.llmInteractions.length}`);
    console.log(`LLM success rate: ${llmSuccessRate.toFixed(1)}%`);
    console.log(`Matrix update success rate: ${successRate.toFixed(1)}%`);
    console.log(`Violations: ${results.totalViolations}`);
    console.log(`Log file: ${results.logFile}`);
    console.log(`Detailed log: ${detailedLogFile}`);
    
    // Read and display a sample of the log file
    console.log('\n📄 SAMPLE LOG FILE CONTENT:');
    console.log('===========================');
    try {
        const logContent = JSON.parse(fs.readFileSync(results.logFile, 'utf8'));
        if (logContent.length > 0) {
            const sample = logContent[0];
            console.log('First logged interaction:');
            console.log(`  Player: ${sample.playerName}`);
            console.log(`  Round: ${sample.round}`);
            console.log(`  Success: ${sample.success}`);
            console.log(`  Prompt length: ${sample.promptLength} chars`);
            console.log(`  Response length: ${sample.responseLength} chars`);
            if (sample.error) {
                console.log(`  Error: ${sample.error}`);
            }
        }
    } catch (error) {
        console.log(`Error reading log file: ${error.message}`);
    }
    
    if (successRate >= 75 && llmSuccessRate >= 75) {
        console.log('\n🎉 LOGGED MATRIX SYSTEM VALIDATION PASSED!');
        console.log('   ✅ High LLM success rate');
        console.log('   ✅ High matrix update success rate');
        console.log('   ✅ Comprehensive logging working');
        return true;
    } else {
        console.log('\n🟡 LOGGED SYSTEM NEEDS IMPROVEMENT');
        console.log(`   LLM Success: ${llmSuccessRate.toFixed(1)}% (target: ≥75%)`);
        console.log(`   Update Success: ${successRate.toFixed(1)}% (target: ≥75%)`);
        return false;
    }
}

async function analyzeLogFile(logFile) {
    console.log(`\n🔍 ANALYZING LOG FILE: ${logFile}`);
    console.log('═'.repeat(50));
    
    try {
        const logData = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        
        console.log(`Total interactions logged: ${logData.length}`);
        
        const successful = logData.filter(i => i.success);
        const failed = logData.filter(i => !i.success);
        
        console.log(`Successful: ${successful.length} (${(successful.length/logData.length*100).toFixed(1)}%)`);
        console.log(`Failed: ${failed.length} (${(failed.length/logData.length*100).toFixed(1)}%)`);
        
        if (successful.length > 0) {
            console.log('\n✅ SUCCESSFUL INTERACTION EXAMPLES:');
            successful.slice(0, 2).forEach((interaction, index) => {
                console.log(`\n${index + 1}. ${interaction.playerName} - Round ${interaction.round}`);
                console.log(`Prompt (${interaction.promptLength} chars):`);
                console.log(interaction.prompt.substring(0, 200) + '...');
                console.log(`Response (${interaction.responseLength} chars):`);
                console.log(interaction.response.substring(0, 200) + '...');
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ FAILED INTERACTION EXAMPLES:');
            failed.slice(0, 2).forEach((interaction, index) => {
                console.log(`\n${index + 1}. ${interaction.playerName} - Round ${interaction.round}`);
                console.log(`Error: ${interaction.error}`);
                console.log(`Response: ${interaction.response?.substring(0, 200) || 'No response'}`);
            });
        }
        
    } catch (error) {
        console.error(`Error analyzing log file: ${error.message}`);
    }
}

// Run the test
testLoggedMatrixSystem()
    .then(success => {
        if (success) {
            console.log('\n🚀 Logged matrix system ready for integration!');
        } else {
            console.log('\n🔧 System needs further optimization');
        }
        
        // List all log files created
        console.log('\n📁 LOG FILES CREATED:');
        const fs = require('fs');
        const files = fs.readdirSync('.').filter(f => f.includes('matrix_llm_log') || f.includes('detailed_matrix_log'));
        files.forEach(file => console.log(`  📄 ${file}`));
        
        if (files.length > 0) {
            console.log(`\n💡 To analyze a specific log file, you can examine: ${files[0]}`);
        }
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error);
    });

module.exports = { testLoggedMatrixSystem, analyzeLogFile }; 