require('dotenv').config();

// llmApi.js
// Utility to call an LLM API with comprehensive rate limit handling
const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

// Rate limiting tracking
let rateLimitState = {
  requestsThisMinute: 0,
  tokensThisMinute: 0,
  lastResetTime: Date.now(),
  consecutiveRateLimits: 0
};

/**
 * Calculate approximate token count for a string (rough estimate)
 */
function estimateTokens(text) {
  // Very rough estimate: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

/**
 * Wait for a specified amount of time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reset rate limit counters if enough time has passed
 */
function resetRateLimitCountersIfNeeded() {
  const now = Date.now();
  const timeElapsed = now - rateLimitState.lastResetTime;
  
  // Reset every minute
  if (timeElapsed >= 60000) {
    rateLimitState.requestsThisMinute = 0;
    rateLimitState.tokensThisMinute = 0;
    rateLimitState.lastResetTime = now;
    rateLimitState.consecutiveRateLimits = 0;
  }
}

/**
 * Check if we should preemptively wait to avoid rate limits
 */
async function checkPreemptiveRateLimit(estimatedTokens) {
  resetRateLimitCountersIfNeeded();
  
  const tokenLimit = 190000; // Stay under 200k limit with buffer
  const requestLimit = 800;   // Conservative request limit
  
  // If we're close to limits, wait for next minute
  if (rateLimitState.tokensThisMinute + estimatedTokens > tokenLimit || 
      rateLimitState.requestsThisMinute > requestLimit) {
    
    const timeToWait = 60000 - (Date.now() - rateLimitState.lastResetTime);
    if (timeToWait > 0) {
      console.log(`⏳ Approaching rate limits, waiting ${Math.ceil(timeToWait/1000)}s for reset...`);
      await sleep(timeToWait + 1000); // Add 1s buffer
      resetRateLimitCountersIfNeeded();
    }
  }
  
  // If we've hit multiple consecutive rate limits, add extra delay
  if (rateLimitState.consecutiveRateLimits > 0) {
    const extraDelay = Math.min(rateLimitState.consecutiveRateLimits * 2000, 10000);
    console.log(`🐌 Rate limit cooldown: waiting ${extraDelay/1000}s...`);
    await sleep(extraDelay);
  }
}

/**
 * Handle rate limit response with exponential backoff
 */
async function handleRateLimit(error, attempt) {
  rateLimitState.consecutiveRateLimits++;
  
  let waitTime = 2000; // Base wait time: 2 seconds
  
  try {
    // Try to parse the rate limit response for exact wait time
    const errorBody = JSON.parse(error.message.split(' - ')[1]);
    if (errorBody.error && errorBody.error.message) {
      const match = errorBody.error.message.match(/Please try again in ([\d.]+)s/);
      if (match) {
        waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 1000; // Add 1s buffer
      }
    }
  } catch (parseError) {
    // If we can't parse, use exponential backoff
    waitTime = Math.min(waitTime * Math.pow(2, attempt), 60000); // Max 60s
  }
  
  console.log(`🚦 Rate limit hit (attempt ${attempt + 1}), waiting ${waitTime/1000}s...`);
  await sleep(waitTime);
}

/**
 * Call an LLM API with a prompt and return the response.
 * Includes comprehensive rate limit handling and retry logic.
 * @param {string} prompt - The prompt to send to the LLM
 * @param {object} [options] - Optional settings (model, temperature, etc.)
 * @returns {Promise<string>} The LLM's response
 */
async function callLLM(prompt, options = {}) {
  if (!OPENAI_API_KEY) {
    // Stub for dev/testing: return a valid JSON proposal for proposals
    if (prompt.includes('propose how to split the prize pool')) {
      return '{"p1": 50, "p2": 50}';
    }
    // For votes, return a valid vote split
    if (prompt.includes('100 votes to split')) {
      return '{"0": 50, "1": 50}';
    }
    // For negotiation, return a short message
    return 'Let\'s split evenly.';
  }

  const maxRetries = 5;
  let messages;
  let estimatedTokens;

  // Support for persistent conversation (messages array) or single prompt
  if (options.messages) {
    messages = options.messages;
    estimatedTokens = estimateTokens(JSON.stringify(messages));
  } else {
    const systemContent = options.system || 'You are a negotiation agent.';
    const fullPrompt = systemContent + '\n\n' + prompt;
    estimatedTokens = estimateTokens(fullPrompt);
    
    messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: prompt }
    ];
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if we should preemptively wait
      await checkPreemptiveRateLimit(estimatedTokens);

      const body = {
        model: options.model || 'gpt-3.5-turbo',
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 512
      };

      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      if (res.status === 429) {
        // Rate limit hit
        const errorText = await res.text();
        await handleRateLimit(new Error(`Rate limit - ${errorText}`), attempt);
        continue; // Retry
      }

      if (!res.ok) {
        const errorText = await res.text();
        
        // For other 4xx/5xx errors, don't retry immediately
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(`LLM API error: ${res.status} - ${errorText}`);
        }
        
        // For server errors, retry with backoff
        if (attempt < maxRetries - 1) {
          const waitTime = 1000 * Math.pow(2, attempt);
          console.log(`🔄 Server error (${res.status}), retrying in ${waitTime/1000}s...`);
          await sleep(waitTime);
          continue;
        }
        
        throw new Error(`LLM API error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      const response = data.choices?.[0]?.message?.content?.trim() || '';

      // Update rate limit tracking on success
      rateLimitState.requestsThisMinute++;
      rateLimitState.tokensThisMinute += estimatedTokens;
      rateLimitState.consecutiveRateLimits = Math.max(0, rateLimitState.consecutiveRateLimits - 1);

      return response;

    } catch (error) {
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        await handleRateLimit(error, attempt);
        continue; // Retry
      }
      
      // For other errors, retry with exponential backoff if we have retries left
      if (attempt < maxRetries - 1) {
        const waitTime = 1000 * Math.pow(2, attempt);
        console.log(`🔄 API error, retrying in ${waitTime/1000}s: ${error.message}`);
        await sleep(waitTime);
        continue; // Retry
      }

      // If all retries failed, throw the error
      throw error;
    }
  }

  throw new Error(`LLM API failed after ${maxRetries} attempts`);
}

/**
 * Get current rate limit status for monitoring
 */
function getRateLimitStatus() {
  resetRateLimitCountersIfNeeded();
  return {
    requestsThisMinute: rateLimitState.requestsThisMinute,
    tokensThisMinute: rateLimitState.tokensThisMinute,
    consecutiveRateLimits: rateLimitState.consecutiveRateLimits,
    minutesUntilReset: Math.max(0, Math.ceil((60000 - (Date.now() - rateLimitState.lastResetTime)) / 1000))
  };
}

module.exports = { callLLM, getRateLimitStatus }; 