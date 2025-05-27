// llmApi.js
// Utility to call an LLM API (e.g., OpenAI, Gemini)
const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

/**
 * Call an LLM API with a prompt and return the response.
 * @param {string} prompt - The prompt to send to the LLM
 * @param {object} [options] - Optional settings (model, temperature, etc.)
 * @returns {Promise<string>} The LLM's response
 */
async function callLLM(prompt, options = {}) {
  if (!OPENAI_API_KEY) {
    // Stub for dev/testing
    return '[LLM STUB] ' + prompt.slice(0, 80) + '...';
  }
  const body = {
    model: options.model || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: options.system || 'You are a negotiation agent.' },
      { role: 'user', content: prompt }
    ],
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 128
  };
  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errorText = await res.text();  // Log full body to catch error message
    throw new Error(`LLM API error: ${res.status} - ${errorText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = { callLLM }; 