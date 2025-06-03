require('dotenv').config();
const { callLLM } = require('../core/llmApi');

async function debugProposal() {
  console.log('🔍 Debugging Proposal Generation\n');
  
  const simplifiedPrompt = `You are creating a proposal in a game theory battle.

3 players: alice, bob, charlie
Each invested 100 tokens. Total pool: 300 tokens.
You need 35%+ to be profitable.
You need 2/3 votes to win.

STRATEGY: Give alice 60%, yourself (bob) 35%, charlie 5%
This guarantees alice votes for you + your own vote = victory!

Respond ONLY with JSON:
{"alice": 60, "bob": 35, "charlie": 5}

Your strategic proposal:`;

  console.log('📝 Sending simplified prompt...');
  const response = await callLLM(simplifiedPrompt, {
    system: 'You are a game theory expert. Create strategic proposals to guarantee victory.',
    max_tokens: 200
  });
  
  console.log('🤖 Raw LLM Response:');
  console.log(response);
  console.log('\n');
  
  try {
    const parsed = JSON.parse(response);
    console.log('✅ Parsed JSON:', parsed);
  } catch (err) {
    console.log('❌ Failed to parse JSON:', err.message);
    
    // Try to extract JSON
    const match = response.match(/\{.*?\}/);
    if (match) {
      console.log('🔍 Extracted JSON:', match[0]);
      try {
        const extracted = JSON.parse(match[0]);
        console.log('✅ Successfully parsed extracted JSON:', extracted);
      } catch (err2) {
        console.log('❌ Still failed to parse:', err2.message);
      }
    }
  }
}

debugProposal().catch(console.error); 