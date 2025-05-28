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
    // Format negotiation history for LLM
    const history = (context.negotiationHistory || [])
      .map(entry => {
        // Try to get agent name from context.players
        const player = (context.players || []).find(p => p.id === entry.playerId);
        const agentName = player ? (player.name || player.id) : entry.playerId;
        return `${agentName} (${entry.playerId}): ${entry.message}`;
      })
      .join('\n');
    // Add word limit and urgency instruction
    const prompt = `You are an agent in a negotiation game. Your strategy: "${agent.strategy || ''}". Respond in 20 words or fewer. If you exceed 20 words, your message will be cut off.\nYou will only have 5 turns to speak before proposals are voted on. Use your time wisely.\nNegotiation history so far:\n${history}\nGame state: ${JSON.stringify(context)}. What is your negotiation message to the other agents?`;
    let response = await callLLM(prompt, { system: 'You are a negotiation agent.' });
    // Truncate to 20 words if needed
    const words = response.split(/\s+/);
    if (words.length > 20) {
      response = words.slice(0, 20).join(' ');
    }
    return response;
  } catch (err) {
    console.error('LLM negotiation error:', err);
    return '[ERROR] Agent failed to generate negotiation message.';
  }
}

/**
 * Generate a proposal for a player/agent.
 * @param {object} context
 * @param {object} agent
 * @param {array} players
 * @returns {string|object} The proposal
 */
async function generateProposal(context, agent, players) {
  // Always use LLM for proposals, using negotiation history and context
  try {
    const history = (context.negotiationHistory || [])
      .map(entry => {
        const player = (context.players || []).find(p => p.id === entry.playerId);
        const agentName = player ? (player.name || player.id) : entry.playerId;
        return `${agentName} (${entry.playerId}): ${entry.message}`;
      })
      .join('\n');
    const agentIds = (players || context.players || []).map(p => p.id);
    const formatExample = '{"agentId1": 50, "agentId2": 50}';
    const prompt = `You are an agent in a negotiation game. Your strategy: "${agent.strategy || ''}".\nNegotiation history so far:\n${history}\nGame state: ${JSON.stringify(context)}.\nNow, propose how to split the prize pool among all agents.\nRespond ONLY with a JSON object where each key is an agent's ID and each value is the percentage of the prize they should get.\nAll agent IDs: ${agentIds.join(', ')}\nThe percentages must sum to 100.\nIf your proposal does not get at least 61% of the votes, it will not pass and you will have to renegotiate.\nExample format: ${formatExample}`;
    let response = await callLLM(prompt, { system: 'You are a negotiation agent.' });
    console.log('[generateProposal] Raw LLM response:', response);
    // Try to parse JSON from response
    let proposal;
    try {
      proposal = JSON.parse(response);
    } catch {
      // Try to extract JSON substring if LLM added extra text
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        try { proposal = JSON.parse(match[0]); } catch {}
      }
    }
    console.log('[generateProposal] Parsed proposal:', proposal);
    return proposal;
  } catch (err) {
    console.error('LLM proposal error:', err);
    return null;
  }
}

/**
 * Generate a vote for a player/agent.
 * @param {object} context
 * @param {object} agent
 * @returns {object} The vote (e.g., { proposalIndex: 0 })
 */
async function generateVote(context, agent) {
  const proposals = context.proposals || [];
  const proposerIds = proposals.map(p => p.playerId);
  switch (agent.type) {
    case 'llm': {
      // Format proposals for LLM
      const proposalList = proposals.map((p, i) => `Proposer: ${p.playerId}, Proposal: ${JSON.stringify(p.proposal)}`).join('\n');
      const history = (context.negotiationHistory || [])
        .map(entry => {
          const player = (context.players || []).find(p => p.id === entry.playerId);
          const agentName = player ? (player.name || player.id) : entry.playerId;
          return `${agentName} (${entry.playerId}): ${entry.message}`;
        })
        .join('\n');
      const prompt = `You are an agent in a negotiation game. Your strategy: "${agent.strategy || ''}".\n\nThere are several proposals for splitting the prize pool. Each proposal is made by a proposer.\n\nProposals:\n${proposalList}\n\nNegotiation history so far:\n${history}\n\nYou have 100 votes to split among the proposals as you see fit. Respond ONLY with a JSON object where each key is the proposerId and each value is the number of votes you assign to that proposal. The total must sum to 100.\n\nExample: {"p1": 60, "p2": 40}`;
      const response = await callLLM(prompt, { system: 'You are a negotiation agent.' });
      console.log('[generateVote] Raw LLM response:', response);
      try {
        const parsed = JSON.parse(response);
        // Validate keys and sum
        const keys = Object.keys(parsed);
        const validKeys = keys.every(k => proposerIds.includes(k));
        const sum = Object.values(parsed).reduce((a, b) => a + Number(b), 0);
        if (validKeys && sum === 100) {
          console.log('[generateVote] Parsed and validated vote:', parsed);
          return parsed;
        } else {
          console.error('[generateVote] Invalid vote keys or sum:', parsed, 'Expected proposerIds:', proposerIds, 'Sum:', sum);
        }
      } catch (err) {
        console.error('[generateVote] Failed to parse or validate LLM vote response:', err, response);
      }
      // Fallback: all votes to own proposal if present, else split evenly
      const selfId = agent.id || (context.players?.find(p => p.agent === agent)?.id);
      if (selfId && proposerIds.includes(selfId)) {
        return { [selfId]: 100 };
      } else if (proposerIds.length > 0) {
        // Split evenly
        const even = Math.floor(100 / proposerIds.length);
        const votes = {};
        let remainder = 100;
        proposerIds.forEach((pid, idx) => {
          if (idx === proposerIds.length - 1) {
            votes[pid] = remainder;
          } else {
            votes[pid] = even;
            remainder -= even;
          }
        });
        return votes;
      } else {
        return {};
      }
    }
    case 'random': {
      // Randomly split 100 votes among proposerIds
      let remaining = 100;
      const votes = {};
      for (let i = 0; i < proposerIds.length; i++) {
        if (i === proposerIds.length - 1) {
          votes[proposerIds[i]] = remaining;
        } else {
          const v = Math.floor(Math.random() * (remaining + 1));
          votes[proposerIds[i]] = v;
          remaining -= v;
        }
      }
      return votes;
    }
    case 'greedy': {
      // All votes to own proposal if present, else first
      const selfId = agent.id || (context.players?.find(p => p.agent === agent)?.id);
      if (selfId && proposerIds.includes(selfId)) {
        return { [selfId]: 100 };
      } else if (proposerIds.length > 0) {
        return { [proposerIds[0]]: 100 };
      } else {
        return {};
      }
    }
    case 'default':
    default: {
      // All votes to own proposal if present, else first
      const selfId = agent.id || (context.players?.find(p => p.agent === agent)?.id);
      if (selfId && proposerIds.includes(selfId)) {
        return { [selfId]: 100 };
      } else if (proposerIds.length > 0) {
        return { [proposerIds[0]]: 100 };
      } else {
        return {};
      }
    }
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