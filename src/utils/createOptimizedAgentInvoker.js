/**
 * Optimized Agent Invoker - Token-Efficient Version
 * Reduces prompt sizes by 60-80% while maintaining functionality
 */

const { callLLM, getRateLimitStatus } = require('../core/llmApi');

/**
 * Generate optimized history summary with recent messages + compact prior summary
 */
function generateOptimizedHistory(fullHistory, players, maxRecentMessages = null) {
  const numPlayers = players.length;
  const recentCount = maxRecentMessages || numPlayers;
  
  if (!fullHistory || fullHistory.length === 0) {
    return 'No messages yet';
  }
  
  // Get the last N messages
  const recentHistory = fullHistory.slice(-recentCount);
  const recentMessages = recentHistory
    .map(h => `${h.playerName}: ${h.message.substring(0, 80)}`)
    .join('\n');
  
  // Summarize everything before the recent messages
  const priorHistory = fullHistory.slice(0, -recentCount);
  let historySummary = '';
  
  if (priorHistory.length > 0) {
    // Group messages by player and create compact summaries
    const playerSummaries = {};
    players.forEach(p => playerSummaries[p.name] = []);
    
    priorHistory.forEach(h => {
      if (playerSummaries[h.playerName]) {
        playerSummaries[h.playerName].push(h.message);
      }
    });
    
    // Create ultra-compact summaries per player
    const summaryParts = [];
    for (const [playerName, messages] of Object.entries(playerSummaries)) {
      if (messages.length > 0) {
        const themes = extractNegotiationThemes(messages);
        if (themes.length > 0) {
          summaryParts.push(`${playerName}: ${themes.join(', ')}`);
        }
      }
    }
    
    if (summaryParts.length > 0) {
      historySummary = `PRIOR: ${summaryParts.join('; ')}`;
    }
  }
  
  // Combine summary and recent messages
  return [historySummary, recentMessages].filter(Boolean).join('\n\n');
}

/**
 * Generate optimized negotiation message with smart history management
 */
async function generateOptimizedNegotiation(context, agent) {
  const players = context.players || [];
  const myId = players.find(p => p.agent === agent)?.id || 'unknown';
  const round = context.round || 1;
  const maxRounds = context.maxRounds || 5;
  
  const historyText = generateOptimizedHistory(context.negotiationHistory, players);

  const prompt = `GAME: ${players.length} players split 600 tokens, need 61%+ votes to win.
ROUND: ${round}/${maxRounds}
YOUR STRATEGY: ${agent.strategy}

${historyText}

Write a SHORT negotiation message (max 100 chars) to advance your strategy.`;

  try {
    const response = await callLLM(prompt, { 
      system: 'You are playing a negotiation game. Write short, strategic messages.',
      max_tokens: 100,
      temperature: 0.8
    });
    
    return response.trim().substring(0, 200); // Hard limit
  } catch (err) {
    console.error('Optimized negotiation error:', err);
    return `I propose we work together strategically.`;
  }
}

/**
 * Extract key negotiation themes from messages to create compact summaries
 */
function extractNegotiationThemes(messages) {
  const themes = [];
  const allMessages = messages.join(' ').toLowerCase();
  
  // Coalition building
  if (allMessages.includes('alliance') || allMessages.includes('together') || 
      allMessages.includes('coalition') || allMessages.includes('work with')) {
    themes.push('coalition-building');
  }
  
  // Aggressive/demanding
  if (allMessages.includes('demand') || allMessages.includes('deserve') ||
      allMessages.includes('take') || allMessages.includes('mine')) {
    themes.push('aggressive');
  }
  
  // Offering deals
  if (allMessages.includes('offer') || allMessages.includes('give') ||
      allMessages.includes('split') || allMessages.includes('%')) {
    themes.push('deal-making');
  }
  
  // Trust/fairness
  if (allMessages.includes('fair') || allMessages.includes('trust') ||
      allMessages.includes('honest') || allMessages.includes('equal')) {
    themes.push('fairness');
  }
  
  // Threats/warnings
  if (allMessages.includes('or else') || allMessages.includes('warn') ||
      allMessages.includes('against') || allMessages.includes('betray')) {
    themes.push('threatening');
  }
  
  // Analysis/strategic
  if (allMessages.includes('analyze') || allMessages.includes('calculate') ||
      allMessages.includes('optimal') || allMessages.includes('strategy')) {
    themes.push('analytical');
  }
  
  // If no themes detected, use a generic summary
  if (themes.length === 0 && messages.length > 0) {
    themes.push('general-negotiation');
  }
  
  return themes.slice(0, 3); // Max 3 themes per player to keep it short
}

/**
 * Generate optimized proposal with minimal tokens and smart history
 */
async function generateOptimizedProposal(context, agent, players) {
  const myId = players.find(p => p.agent === agent)?.id || 'unknown';
  const playerIds = players.map(p => p.id);
  const strategyHint = agent.strategy.substring(0, 100); // Truncate strategy
  
  // Include brief negotiation context for proposals (last 2 messages per player)
  const negotiationContext = generateOptimizedHistory(context.negotiationHistory, players, players.length * 2);
  const contextPreview = negotiationContext.length > 200 
    ? negotiationContext.substring(0, 200) + '...' 
    : negotiationContext;

  const prompt = `SPLIT 100% among ${players.length} players. Your strategy: ${strategyHint}

Players: ${playerIds.join(', ')}
You are: ${myId}

CONTEXT: ${contextPreview}

Rules:
- Must total exactly 100%
- Need 61%+ votes to win
- Minimum ${Math.ceil(100/players.length)}% for yourself to break even

Return JSON only: {"${playerIds.join('": X, "')}": X}`;

  try {
    const response = await callLLM(prompt, { 
      system: 'Return valid JSON proposal that totals 100%. No other text.',
      max_tokens: 80,
      temperature: 0.3
    });

    // Parse and validate
    let proposal;
    try {
      const match = response.match(/\{[^}]+\}/);
      proposal = JSON.parse(match ? match[0] : response);
    } catch {
      // Fallback: equal split
      const equalShare = Math.floor(100 / players.length);
      proposal = {};
      playerIds.forEach((id, i) => {
        proposal[id] = equalShare + (i === 0 ? 100 - (equalShare * players.length) : 0);
      });
    }

    // Quick validation and normalization
    const sum = Object.values(proposal).reduce((a, b) => a + Number(b), 0);
    if (Math.abs(sum - 100) > 5) {
      // Normalize to 100
      const factor = 100 / sum;
      playerIds.forEach(id => {
        proposal[id] = Math.round((proposal[id] || 0) * factor);
      });
    }

    return proposal;
  } catch (err) {
    console.error('Optimized proposal error:', err);
    // Fallback equal split
    const equalShare = Math.floor(100 / players.length);
    const proposal = {};
    playerIds.forEach((id, i) => {
      proposal[id] = equalShare + (i === 0 ? 100 - (equalShare * players.length) : 0);
    });
    return proposal;
  }
}

/**
 * Generate optimized vote with minimal tokens and smart history
 */
async function generateOptimizedVote(context, agent) {
  const proposals = context.proposals || [];
  const players = context.players || [];
  const myId = players.find(p => p.agent === agent)?.id || 'unknown';
  
  // Analyze proposals quickly
  const analysis = proposals.map((p, i) => {
    const myShare = p.proposal[myId] || 0;
    const proposerShare = p.proposal[p.playerId] || 0;
    const fairness = myShare >= 100/players.length ? 'Good' : 'Bad';
    return `${i}: ${myShare}% for you, ${proposerShare}% for ${p.playerName} [${fairness}]`;
  }).join('\n');
  
  // Include very brief negotiation context (last 3 messages total)
  const negotiationContext = generateOptimizedHistory(context.negotiationHistory, players, 3);
  const contextPreview = negotiationContext.length > 150 
    ? negotiationContext.substring(0, 150) + '...' 
    : negotiationContext;

  const prompt = `VOTE: Split 100 votes among proposals based on your strategy.
YOUR STRATEGY: ${agent.strategy.substring(0, 100)}

CONTEXT: ${contextPreview}

PROPOSALS:
${analysis}

Return JSON: {"${proposals.map(p => p.playerId).join('": X, "')}": X} (total 100)`;

  try {
    const response = await callLLM(prompt, { 
      system: 'Return valid JSON vote allocation totaling 100. No other text.',
      max_tokens: 60,
      temperature: 0.4
    });

    // Parse vote
    let vote;
    try {
      const match = response.match(/\{[^}]+\}/);
      vote = JSON.parse(match ? match[0] : response);
    } catch {
      // Fallback: equal votes
      const equalVote = Math.floor(100 / proposals.length);
      vote = {};
      proposals.forEach((p, i) => {
        vote[p.playerId] = equalVote + (i === 0 ? 100 - (equalVote * proposals.length) : 0);
      });
    }

    return vote;
  } catch (err) {
    console.error('Optimized vote error:', err);
    // Fallback equal votes
    const equalVote = Math.floor(100 / proposals.length);
    const vote = {};
    proposals.forEach((p, i) => {
      vote[p.playerId] = equalVote + (i === 0 ? 100 - (equalVote * proposals.length) : 0);
    });
    return vote;
  }
}

/**
 * Switch between optimized and original based on rate limit status
 */
function shouldUseOptimized() {
  const status = getRateLimitStatus();
  return status.tokensThisMinute > 150000 || status.consecutiveRateLimits > 0;
}

module.exports = {
  generateOptimizedNegotiation,
  generateOptimizedProposal,
  generateOptimizedVote,
  generateOptimizedHistory,
  shouldUseOptimized
}; 