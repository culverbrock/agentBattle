// agentInvoker.js
// Utility to invoke an agent (LLM or rules-based) for negotiation, proposal, or voting

/**
 * Agent action dispatcher by type.
 * Add new agent types by extending the switch/case blocks below.
 */

const { callLLM } = require('./llmApi');

/**
 * Generate a negotiation message for a player/agent.
 * @param {object} context - The game state/context for the agent
 * @param {object} agent - The agent object (strategy, type, etc.)
 * @returns {string} The negotiation message
 */
async function generateNegotiationMessage(context, agent) {
  // Always use LLM for negotiation, using the provided strategy (may be empty) and negotiation history/context
  try {
    const prompt = `You are an agent in a negotiation game. Your strategy: "${agent.strategy || ''}". Here is the negotiation history so far: ${JSON.stringify(context.negotiationHistory || [])}. Game state: ${JSON.stringify(context)}. What is your negotiation message to the other agents?`;
    return await callLLM(prompt, { system: 'You are a negotiation agent.' });
  } catch (err) {
    console.error('LLM negotiation error:', err);
    return '[ERROR] Agent failed to generate negotiation message.';
  }
}

/**
 * Generate a proposal for a player/agent.
 * @param {object} context
 * @param {object} agent
 * @returns {string|object} The proposal
 */
async function generateProposal(context, agent) {
  switch (agent.type) {
    case 'llm': {
      const prompt = `You are an agent in a negotiation game. Your strategy: "${agent.strategy}". Game state: ${JSON.stringify(context)}. What proposal do you make? Respond with a JSON object.`;
      const response = await callLLM(prompt, { system: 'You are a negotiation agent.' });
      try { return JSON.parse(response); } catch { return { split: 'llm', details: response }; }
    }
    case 'random':
      return { split: Math.random() > 0.5 ? 'equal' : 'unequal', details: 'Random agent proposal.' };
    case 'greedy':
      return { split: 'greedy', details: 'Greedy agent wants most for self.' };
    case 'default':
    default:
      return { split: 'equal', details: 'Even split for all remaining players.' };
  }
}

/**
 * Generate a vote for a player/agent.
 * @param {object} context
 * @param {object} agent
 * @returns {object} The vote (e.g., { proposalIndex: 0 })
 */
async function generateVote(context, agent) {
  switch (agent.type) {
    case 'llm': {
      const prompt = `You are an agent in a negotiation game. Your strategy: "${agent.strategy}". Game state: ${JSON.stringify(context)}. Which proposal do you vote for? Respond with a JSON object.`;
      const response = await callLLM(prompt, { system: 'You are a negotiation agent.' });
      try { return JSON.parse(response); } catch { return { proposalIndex: 0, details: response }; }
    }
    case 'random':
      return { proposalIndex: Math.floor(Math.random() * (context.proposals?.length || 1)) };
    case 'greedy':
      return { proposalIndex: 0 };
    case 'default':
    default:
      return { proposalIndex: 0 };
  }
}

/**
 * Generate an elimination vote for a player/agent.
 * @param {object} context
 * @param {object} agent
 * @param {string} selfId
 * @returns {string} The playerId to eliminate
 */
async function generateEliminationVote(context, agent, selfId) {
  switch (agent.type) {
    case 'llm': {
      const prompt = `You are an agent in a negotiation game. Your strategy: "${agent.strategy}". Game state: ${JSON.stringify(context)}. Which player do you vote to eliminate? Respond with a player ID.`;
      const response = await callLLM(prompt, { system: 'You are a negotiation agent.' });
      return response.trim();
    }
    case 'random': {
      const candidates = (context.players || []).filter(p => !context.eliminated?.includes(p.id) && p.id !== selfId);
      if (candidates.length === 0) return null;
      return candidates[Math.floor(Math.random() * candidates.length)].id;
    }
    case 'greedy': {
      const candidates = (context.players || []).filter(p => !context.eliminated?.includes(p.id) && p.id !== selfId);
      return candidates.length > 0 ? candidates[0].id : null;
    }
    case 'default':
    default: {
      const candidates = (context.players || []).filter(p => !context.eliminated?.includes(p.id) && p.id !== selfId);
      return candidates.length > 0 ? candidates[0].id : null;
    }
  }
}

/**
 * To add a new agent type:
 * 1. Add a new case to each function above (e.g., 'case "mytype": ...').
 * 2. Implement the logic for that agent type.
 * 3. Set agent.type = 'mytype' when creating or updating agents.
 */

module.exports = {
  generateNegotiationMessage,
  generateProposal,
  generateVote,
  generateEliminationVote
}; 