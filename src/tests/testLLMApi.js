const { callLLM } = require('../core/llmApi');

async function testLLM() {
  try {
    const prompt = 'You are an agent in a negotiation game. Your strategy: "Try to maximize my share, but avoid being eliminated." Game state: {"phase":"negotiation","round":1}'.replace(/\n/g, ' ');
    const response = await callLLM(prompt, { system: 'You are a negotiation agent.' });
    console.log('LLM API response:', response);
  } catch (err) {
    console.error('LLM API error:', err);
  }
}

testLLM(); 