const { callLLM } = require('../core/llmApi');

async function debugMatrixResponses() {
    console.log('🔍 DEBUGGING MATRIX LLM RESPONSES');
    console.log('==================================');
    
    const prompt = `🔒 MATRIX OWNERSHIP & RULES for Strategic Analyzer:

🚨 YOU CAN ONLY MODIFY ROW 0 (YOUR ROW)
🚨 ANY ATTEMPT TO MODIFY OTHER ROWS WILL BE DETECTED AND LOGGED

MATRIX STRUCTURE (16 columns):
📊 PROPOSAL (cols 0-3): % each player gets (must sum to 100)
🗳️ VOTES (cols 4-7): % of your votes for each proposal (must sum to 100)  
🎁 OFFERS (cols 8-11): Votes you promise each player (0-100)
📝 REQUESTS (cols 12-15): Votes you want from each player (0-100)

PLAYERS:
0: Strategic Analyzer ← YOU
1: Diplomatic Builder
2: Aggressive Maximizer
3: Smart Opportunist

CURRENT MATRIX STATE:

ROW|PLAYER               |PROPOSAL%  |VOTES%   |OFFERS   |REQUESTS   |MODS
---------------------------------------------------------------------------
0  |Strategic Analyzer   |0,0,0,0    |0,0,0,0  |0,0,0,0  |0,0,0,0    |0
1  |Diplomatic Builder   |0,0,0,0    |0,0,0,0  |0,0,0,0  |0,0,0,0    |0
2  |Aggressive Maximizer |0,0,0,0    |0,0,0,0  |0,0,0,0  |0,0,0,0    |0
3  |Smart Opportunist    |0,0,0,0    |0,0,0,0  |0,0,0,0  |0,0,0,0    |0

ROUND 1 - UPDATE YOUR ROW (Row 0) ONLY

Your strategy: "Analyze patterns and make calculated decisions based on mathematical optimization"

🚨 CRITICAL RULES:
1. You can ONLY modify YOUR row (Row 0)
2. You MUST provide a strategic explanation
3. Minimum 17% self-allocation (break-even requirement)
4. All sections must be filled strategically

REQUIRED RESPONSE FORMAT:
{
  "explanation": "I analyzed the matrix and saw [what you observed]. I'm changing [what you're changing] because [strategic reasoning]. My goal is [strategic objective].",
  "matrixRow": [prop1,prop2,prop3,prop4,vote1,vote2,vote3,vote4,offer1,offer2,offer3,offer4,req1,req2,req3,req4]
}

EXAMPLES of good explanations:
- "I saw Player 2 offering me 30 votes but requesting 50 from me. I'm reducing my offer to them from 25 to 15 votes and increasing my self-allocation from 25% to 35% because they're being greedy."
- "Player 3 proposed giving me only 10% while taking 40% for themselves. I'm voting 0% for their proposal and offering alliance votes to Player 1 who gave me 25%."
- "The matrix shows Players 1&2 are forming an alliance (high mutual offers). I'm adapting by requesting more votes from Player 4 and reducing my proposal generosity."

Your strategic analysis and matrix update:`;

    console.log('📝 Sending prompt to LLM...\n');
    
    try {
        const response = await callLLM(prompt, {
            temperature: 0.3,
            max_tokens: 400,
            system: 'You are a strategic game player. You must provide both explanation and matrix data in the exact JSON format requested. Be precise with numbers that sum to 100.'
        });
        
        console.log('🤖 RAW LLM RESPONSE:');
        console.log('--------------------');
        console.log(response);
        console.log('\n');
        
        // Try to parse it
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.log('❌ No JSON found in response');
            return;
        }
        
        console.log('🔍 EXTRACTED JSON:');
        console.log('------------------');
        console.log(jsonMatch[0]);
        console.log('\n');
        
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('✅ PARSED SUCCESSFULLY:');
            console.log('----------------------');
            console.log('Explanation:', parsed.explanation);
            console.log('Matrix Row:', parsed.matrixRow);
            console.log('Matrix Length:', parsed.matrixRow ? parsed.matrixRow.length : 'undefined');
            
            if (parsed.matrixRow && Array.isArray(parsed.matrixRow)) {
                console.log('\n🧮 MATHEMATICAL VALIDATION:');
                console.log('---------------------------');
                
                // Check lengths and sums
                if (parsed.matrixRow.length === 16) {
                    const proposalSum = parsed.matrixRow.slice(0, 4).reduce((a, b) => a + b, 0);
                    const voteSum = parsed.matrixRow.slice(4, 8).reduce((a, b) => a + b, 0);
                    const selfAllocation = parsed.matrixRow[0];
                    
                    console.log(`Proposal section (0-3): ${parsed.matrixRow.slice(0, 4)} = ${proposalSum}`);
                    console.log(`Vote section (4-7): ${parsed.matrixRow.slice(4, 8)} = ${voteSum}`);
                    console.log(`Offer section (8-11): ${parsed.matrixRow.slice(8, 12)}`);
                    console.log(`Request section (12-15): ${parsed.matrixRow.slice(12, 16)}`);
                    console.log(`Self-allocation: ${selfAllocation}%`);
                    
                    console.log('\n🎯 VALIDATION RESULTS:');
                    console.log('---------------------');
                    console.log(`✅ Array length: ${parsed.matrixRow.length === 16 ? 'PASS' : 'FAIL'}`);
                    console.log(`✅ Proposal sum: ${Math.abs(proposalSum - 100) < 1 ? 'PASS' : 'FAIL'} (${proposalSum})`);
                    console.log(`✅ Vote sum: ${Math.abs(voteSum - 100) < 1 ? 'PASS' : 'FAIL'} (${voteSum})`);
                    console.log(`✅ Self-allocation: ${selfAllocation >= 17 ? 'PASS' : 'FAIL'} (≥17%)`);
                } else {
                    console.log(`❌ Wrong array length: ${parsed.matrixRow.length} (expected 16)`);
                }
            }
            
        } catch (parseError) {
            console.log('❌ JSON parsing failed:', parseError.message);
        }
        
    } catch (error) {
        console.error('❌ LLM call failed:', error.message);
    }
}

debugMatrixResponses().catch(console.error); 