const { callLLM } = require('../core/llmApi');

async function testMultipleMatrixGenerations() {
    console.log('🔍 TESTING MULTIPLE MATRIX GENERATIONS');
    console.log('=====================================');
    console.log('🎯 Goal: Understand consistency of LLM matrix generation\n');
    
    const basePrompt = `🔒 MATRIX OWNERSHIP & RULES for Strategic Player:

MATRIX STRUCTURE (16 columns):
📊 PROPOSAL (cols 0-3): % each player gets (MUST sum to 100)
🗳️ VOTES (cols 4-7): % of your votes for each proposal (MUST sum to 100)  
🎁 OFFERS (cols 8-11): Votes you promise each player (0-100)
📝 REQUESTS (cols 12-15): Votes you want from each player (0-100)

PLAYERS: 0: You, 1: Player1, 2: Player2, 3: Player3

🚨 CRITICAL MATH RULES:
- Proposal section MUST sum to exactly 100
- Vote section MUST sum to exactly 100  
- Your self-allocation (position 0) must be ≥17%

REQUIRED RESPONSE FORMAT:
{
  "explanation": "I analyzed the matrix and saw [observations]. I'm changing [changes] because [reasoning]. My goal is [objective].",
  "matrixRow": [prop1,prop2,prop3,prop4,vote1,vote2,vote3,vote4,offer1,offer2,offer3,offer4,req1,req2,req3,req4]
}

Your strategic analysis and matrix update:`;

    const strategies = [
        "Maximize my share while building alliances",
        "Be aggressive and demand high allocation", 
        "Build diplomatic relationships through fair offers",
        "Analyze mathematical patterns for optimal strategy",
        "Adapt opportunistically to other players' moves"
    ];
    
    let totalTests = 0;
    let passedTests = 0;
    const results = [];
    
    for (let i = 0; i < strategies.length; i++) {
        console.log(`\n🎮 TEST ${i + 1}/5: "${strategies[i]}"`);
        console.log('-'.repeat(50));
        
        const prompt = `${basePrompt}\n\nYour strategy: "${strategies[i]}"`;
        
        try {
            const response = await callLLM(prompt, {
                temperature: 0.5,
                max_tokens: 350,
                system: 'You are a strategic game player. Follow the exact JSON format. Be very careful that proposal and vote sections sum to exactly 100.'
            });
            
            console.log('🤖 Response length:', response.length);
            
            // Parse response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.log('❌ No JSON found');
                results.push({ test: i + 1, status: 'NO_JSON' });
                totalTests++;
                continue;
            }
            
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                
                if (!parsed.matrixRow || !Array.isArray(parsed.matrixRow)) {
                    console.log('❌ No valid matrixRow array');
                    results.push({ test: i + 1, status: 'NO_MATRIX_ARRAY' });
                    totalTests++;
                    continue;
                }
                
                // Validate
                const matrixRow = parsed.matrixRow;
                totalTests++;
                
                console.log(`🔢 Matrix row: [${matrixRow.join(',')}]`);
                console.log(`📏 Length: ${matrixRow.length} (expected 16)`);
                
                if (matrixRow.length !== 16) {
                    console.log('❌ Wrong length');
                    results.push({ 
                        test: i + 1, 
                        status: 'WRONG_LENGTH', 
                        length: matrixRow.length,
                        explanation: parsed.explanation?.substring(0, 100) 
                    });
                    continue;
                }
                
                const proposalSum = matrixRow.slice(0, 4).reduce((a, b) => a + b, 0);
                const voteSum = matrixRow.slice(4, 8).reduce((a, b) => a + b, 0);
                const selfAllocation = matrixRow[0];
                
                console.log(`📊 Proposal sum: ${proposalSum} (need 100)`);
                console.log(`🗳️ Vote sum: ${voteSum} (need 100)`);
                console.log(`🎯 Self-allocation: ${selfAllocation}% (need ≥17%)`);
                
                let status = 'PASS';
                const issues = [];
                
                if (Math.abs(proposalSum - 100) > 0.1) {
                    status = 'FAIL';
                    issues.push(`proposal_sum_${proposalSum}`);
                }
                
                if (Math.abs(voteSum - 100) > 0.1) {
                    status = 'FAIL';
                    issues.push(`vote_sum_${voteSum}`);
                }
                
                if (selfAllocation < 17) {
                    status = 'FAIL';
                    issues.push(`self_allocation_${selfAllocation}`);
                }
                
                console.log(`🎯 Result: ${status}`);
                
                if (status === 'PASS') {
                    console.log('✅ All validations passed!');
                    passedTests++;
                }
                
                results.push({
                    test: i + 1,
                    status: status,
                    issues: issues,
                    proposalSum: proposalSum,
                    voteSum: voteSum,
                    selfAllocation: selfAllocation,
                    explanation: parsed.explanation?.substring(0, 100)
                });
                
            } catch (parseError) {
                console.log('❌ JSON parsing failed:', parseError.message);
                results.push({ test: i + 1, status: 'PARSE_ERROR', error: parseError.message });
                totalTests++;
            }
            
        } catch (error) {
            console.log('❌ LLM call failed:', error.message);
            results.push({ test: i + 1, status: 'LLM_ERROR', error: error.message });
            totalTests++;
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n📊 SUMMARY OF RESULTS');
    console.log('=====================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed tests: ${passedTests}`);
    console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n📋 DETAILED RESULTS:');
    results.forEach(result => {
        console.log(`Test ${result.test}: ${result.status}${result.issues ? ` (${result.issues.join(', ')})` : ''}`);
        if (result.explanation) {
            console.log(`  └─ "${result.explanation}..."`);
        }
    });
    
    // Analysis
    const failures = results.filter(r => r.status !== 'PASS');
    if (failures.length > 0) {
        console.log('\n🔍 FAILURE ANALYSIS:');
        const failureTypes = {};
        failures.forEach(f => {
            if (f.issues) {
                f.issues.forEach(issue => {
                    failureTypes[issue] = (failureTypes[issue] || 0) + 1;
                });
            } else {
                failureTypes[f.status] = (failureTypes[f.status] || 0) + 1;
            }
        });
        
        Object.entries(failureTypes).forEach(([issue, count]) => {
            console.log(`  ${issue}: ${count} times`);
        });
    }
    
    return { totalTests, passedTests, successRate: (passedTests / totalTests) * 100, results };
}

testMultipleMatrixGenerations().catch(console.error); 