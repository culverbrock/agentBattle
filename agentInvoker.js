// agentInvoker.js
// Utility to invoke an agent (LLM or rules-based) for negotiation, proposal, or voting

/**
 * Agent action dispatcher by type.
 * Add new agent types by extending the switch/case blocks below.
 */

const { callLLM } = require('./src/core/llmApi');

/**
 * Generate a negotiation message for a player/agent.
 * @param {object} context - The game state/context for the agent
 * @param {object} agent - The agent object (strategy, type, etc.)
 * @returns {string} The negotiation message
 */
async function generateNegotiationMessage(context, agent) {
  // Always use LLM for negotiation, using the provided strategy (may be empty) and negotiation history/context
  try {
    // Analyze the game state and opponents
    const players = context.players || [];
    const myId = players.find(p => p.agent === agent)?.id || 'unknown';
    const opponents = players.filter(p => p.id !== myId);
    const totalPlayers = players.length;
    const currentRound = context.round || 1;
    const maxRounds = context.maxRounds || 5;
    const isLastRound = currentRound >= maxRounds;
    
    // Analyze negotiation history for strategic insights
    const history = (context.negotiationHistory || []);
    const myPreviousMessages = history.filter(h => h.playerId === myId);
    const opponentPatterns = {};
    
    // Track what each opponent has said and look for patterns
    opponents.forEach(opp => {
      const oppMessages = history.filter(h => h.playerId === opp.id);
      opponentPatterns[opp.id] = {
        name: opp.name || opp.id,
        strategy: opp.agent?.strategy || 'unknown',
        messages: oppMessages,
        seemsGreedy: oppMessages.some(m => m.message.toLowerCase().includes('majority') || m.message.toLowerCase().includes('most')),
        seemsGenerous: oppMessages.some(m => m.message.toLowerCase().includes('fair') || m.message.toLowerCase().includes('equal')),
        mentionedMe: oppMessages.some(m => m.message.includes(myId) || m.message.toLowerCase().includes('you')),
        lastMessage: oppMessages[oppMessages.length - 1]?.message || 'none'
      };
    });

    // Build strategic context
    const strategicContext = {
      timeUrgency: isLastRound ? "FINAL ROUND - last chance to influence!" : `Round ${currentRound}/${maxRounds}`,
      opponentAnalysis: Object.entries(opponentPatterns).map(([id, data]) => 
        `${data.name} (${data.strategy}): ${data.seemsGreedy ? 'appears GREEDY' : data.seemsGenerous ? 'appears GENEROUS' : 'unclear intent'}. Last said: "${data.lastMessage}"`
      ).join(' | '),
      myPosition: myPreviousMessages.length > 0 ? `You previously said: "${myPreviousMessages[myPreviousMessages.length - 1].message}"` : "First time speaking",
      votingReminder: "Remember: You need 61% of votes to win. Analyze who might vote for you and adapt accordingly."
    };

    // Check if this is a first-round opening (current round is 1 AND I haven't spoken before)
    const isMyFirstTime = currentRound === 1 && myPreviousMessages.length === 0;
    
    // Format negotiation history for LLM
    const historyText = history
      .map(entry => {
        const player = players.find(p => p.id === entry.playerId);
        const strategyHint = player?.agent?.strategy ? ` [${player.agent.strategy}]` : '';
        return `${player?.name || entry.playerId}${strategyHint}: ${entry.message}`;
      })
      .join('\n');
    
    // Analyze recent messages for mathematical issues or vague proposals
    const recentMessages = history.slice(-3); // Last 3 messages
    const mathIssues = [];
    recentMessages.forEach(msg => {
      if (msg.message.includes('%') && msg.message.includes('each')) {
        // Check for "30% each" type issues
        const percentMatch = msg.message.match(/(\d+)%\s+each/);
        if (percentMatch) {
          const percent = parseInt(percentMatch[1]);
          const totalIfAll = percent * totalPlayers;
          if (totalIfAll !== 100) {
            mathIssues.push(`${msg.playerName} said "${msg.message}" but ${percent}% each for ${totalPlayers} players = ${totalIfAll}% (not 100%)`);
          }
        }
      }
      if (msg.message.toLowerCase().includes('coalition') && !msg.message.includes('%')) {
        mathIssues.push(`${msg.playerName} mentioned coalition but gave no specific percentages`);
      }
    });
    
    // Advanced strategy identification for STRATEGY_IDENTIFIER agents
    let strategyAnalysis = '';
    if (agent.strategy && agent.strategy.includes('identify') && agent.strategy.includes('strategies')) {
      // This is a Strategy Identifier agent - provide detailed opponent analysis
      const opponentStrategies = opponents.map(opp => {
        const oppMessages = history.filter(h => h.playerId === opp.id);
        const patterns = {
          isAggressive: oppMessages.some(m => 
            m.message.toLowerCase().includes('demand') || 
            m.message.toLowerCase().includes('deserve') ||
            m.message.toLowerCase().includes('threat')
          ),
          isDiplomatic: oppMessages.some(m => 
            m.message.toLowerCase().includes('fair') || 
            m.message.toLowerCase().includes('cooperat') ||
            m.message.toLowerCase().includes('trust')
          ),
          isOpportunistic: oppMessages.some(m => 
            m.message.toLowerCase().includes('switch') || 
            m.message.toLowerCase().includes('adapt') ||
            m.message.toLowerCase().includes('flexible')
          ),
          isAnalytical: oppMessages.some(m => 
            m.message.toLowerCase().includes('calculate') || 
            m.message.toLowerCase().includes('probability') ||
            m.message.includes('%')
          ),
          isManipulative: oppMessages.some(m => 
            m.message.toLowerCase().includes('betray') || 
            m.message.toLowerCase().includes('confusion') ||
            m.message.toLowerCase().includes('chaos')
          ),
          messageCount: oppMessages.length,
          avgMessageLength: oppMessages.length > 0 ? oppMessages.reduce((sum, m) => sum + m.message.length, 0) / oppMessages.length : 0
        };

        // Identify most likely strategy type
        let likelyStrategy = 'UNKNOWN';
        if (patterns.isAggressive && !patterns.isDiplomatic) likelyStrategy = 'AGGRESSIVE';
        else if (patterns.isDiplomatic && !patterns.isAggressive) likelyStrategy = 'DIPLOMATIC';
        else if (patterns.isOpportunistic) likelyStrategy = 'OPPORTUNISTIC';
        else if (patterns.isAnalytical) likelyStrategy = 'ANALYTICAL';
        else if (patterns.isManipulative) likelyStrategy = 'MANIPULATIVE';
        else if (patterns.isAggressive && patterns.isDiplomatic) likelyStrategy = 'HYBRID_AGG_DIP';

        // Suggest counter-strategy
        const counterStrategy = {
          'AGGRESSIVE': 'Form coalitions against them, offer others better deals',
          'DIPLOMATIC': 'Be cooperative but watch for over-generosity exploitation', 
          'OPPORTUNISTIC': 'Lock them into commitments, use consistency against them',
          'ANALYTICAL': 'Use emotion and psychology, disrupt their calculations',
          'MANIPULATIVE': 'Be transparent and direct, expose their manipulations',
          'HYBRID_AGG_DIP': 'Test their true nature with strategic pressure',
          'UNKNOWN': 'Gather more data through strategic probes'
        };

        return {
          name: opp.name,
          likelyStrategy,
          confidence: patterns.messageCount >= 2 ? 'HIGH' : patterns.messageCount === 1 ? 'MEDIUM' : 'LOW',
          counterApproach: counterStrategy[likelyStrategy],
          patterns
        };
      });

      strategyAnalysis = `\n🔍 STRATEGY IDENTIFICATION ANALYSIS:
${opponentStrategies.map(analysis => 
  `- ${analysis.name}: Likely ${analysis.likelyStrategy} (${analysis.confidence} confidence)
    Counter-approach: ${analysis.counterApproach}`
).join('\n')}

🎯 OPTIMAL META-STRATEGY:
Based on opponent analysis, your best approach is to ${
  opponentStrategies.filter(a => a.likelyStrategy === 'AGGRESSIVE').length >= 2 ? 
    'build defensive coalitions and use their aggression against each other' :
  opponentStrategies.filter(a => a.likelyStrategy === 'DIPLOMATIC').length >= 2 ?
    'exploit their generosity while appearing cooperative' :
  opponentStrategies.filter(a => a.likelyStrategy === 'OPPORTUNISTIC').length >= 2 ?
    'create false opportunities and lock them into bad positions' :
    'adapt dynamically and gather more strategic intelligence'
}.\n`;
    }
    
    // Create a much more sophisticated prompt
    const prompt = `You are a SHARP NEGOTIATOR in a high-stakes token battle! You invested 100 tokens to play.

🏦 GAME FACTS:
- ${totalPlayers} players total, each invested 100 tokens
- Prize pool: ${totalPlayers * 100} tokens 
- You need 61%+ votes to win (${Math.ceil(totalPlayers * 0.61)} out of ${totalPlayers} players)
- Break-even: Need >${Math.round(100/totalPlayers * 100)/100}% share (${Math.ceil(100/totalPlayers * 100)}+ tokens)

🎯 YOUR STRATEGY: "${agent.strategy || 'Win profitably'}"
${strategyAnalysis}

🚨 MATHEMATICAL AWARENESS:
${mathIssues.length > 0 ? 
  `DETECTED MATH ERRORS IN RECENT MESSAGES:\n${mathIssues.map(issue => `- ${issue}`).join('\n')}\n` : 
  '- All recent messages are mathematically sound\n'}
- When someone says "X% each" for ${totalPlayers} players, that should total 100%
- Ask clarifying questions when proposals don't add up!
- Be specific about percentages, not vague terms

${strategicContext.timeUrgency}
${strategicContext.myPosition}

🕵️ OPPONENT ANALYSIS:
${strategicContext.opponentAnalysis}

💭 RECENT NEGOTIATIONS:
${historyText || 'No previous messages'}

${history.length > 0 ? `
🎯 STRATEGIC RESPONSE ANALYSIS:
${opponents.map(opp => {
  const oppData = opponentPatterns[opp.id];
  const recentMessage = oppData.lastMessage;
  if (recentMessage === 'none') return null;
  
  return `**${oppData.name}** just said: "${recentMessage}"
  → Strategic response options: ${
    recentMessage.toLowerCase().includes('coalition') ? 'Join their coalition, counter-offer, or break it up' :
    recentMessage.toLowerCase().includes('%') ? 'Accept their terms, negotiate better terms, or offer alternative split' :
    recentMessage.toLowerCase().includes('ally') || recentMessage.toLowerCase().includes('team') ? 'Ally with them, ally with their enemies, or stay neutral' :
    'Address their statement directly or pivot to your own agenda'
  }`;
}).filter(Boolean).join('\n')}

💡 **KEY INSIGHT**: Don't just make generic statements! React to what opponents actually said and name specific players you want to work with.` : ''}

🧠 SMART NEGOTIATION TACTICS (choose what's most strategic):

**OPENING MOVES** (when you want to set the agenda):
- **AGGRESSIVE**: "I deserve 50%+ for my superior strategy. [PlayerName], want to ally for 45% each?"
- **DIPLOMATIC**: "Let's find a fair 25% split for everyone. [PlayerName], will you join me?"
- **OPPORTUNISTIC**: "I'm flexible on terms. [PlayerName], what alliance interests you most?"
- **ANALYTICAL**: "Based on game theory, [PlayerName] and I should team up for optimal results."
- **MANIPULATIVE**: "[PlayerName], I can help you win, but I need to see your commitment first."
- **STRATEGY_IDENTIFIER**: "[PlayerName], I see your strategy. Let's discuss optimal partnerships."

**RESPONSE TACTICS** (when reacting to others):
1. **TARGETED QUESTIONS**: "[PlayerName], when you say 30% each, who gets the remaining 10%?"
2. **COALITION BUILDING**: "[PlayerName], let's split 50-50 and offer [OtherPlayer] 10% to vote with us"
3. **COALITION BREAKING**: "[PlayerName], they're offering you 40%? I'll give you 45% instead"
4. **MATHEMATICAL PRESSURE**: "[PlayerName], your proposal only adds to 85% - the math doesn't work"
5. **TRUST BUILDING**: "[PlayerName], I kept my word last round, you can trust me this round"
6. **EMERGENCY DEFENSE**: "Don't let [PlayerName] and [OtherPlayer] form a coalition against us!"

**STRATEGIC GUIDANCE**: 
- Use clarifying questions when proposals are genuinely vague or mathematically wrong
- Start new conversation threads when current ones don't serve your interests
- Always stay true to your core strategy while adapting to the situation

🎯 RESPONSE INSTRUCTIONS:
- Maximum 25 words (be sharp and strategic!)
- Choose the most optimal tactical approach based on the current situation
- **NAME SPECIFIC PLAYERS** when making offers or responses (use actual player names!)
- **RESPOND TO WHAT OTHERS ACTUALLY SAID** - don't ignore their proposals
- Focus on coalition dynamics and vote counting  
- Be mathematically precise when making offers
- **CRITICAL: Stay true to your strategy while adapting to maximize your advantage!**
- **IMPORTANT: Don't announce which tactic you're using - just speak naturally and strategically!**

Your strategic response:
`;

    let response = await callLLM(prompt, { 
      system: 'You are a sharp negotiator speaking naturally and strategically. Do NOT include tactical labels or manual references - just speak like a real strategic player. Be concise and persuasive.' 
    });
    
    // Truncate to 25 words if needed
    const words = response.split(/\s+/);
    if (words.length > 25) {
      response = words.slice(0, 25).join(' ') + '...';
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
    const allPlayers = players || context.players || [];
    const myId = allPlayers.find(p => p.agent === agent)?.id || 'unknown';
    const history = (context.negotiationHistory || []);
    
    // Analyze negotiation for strategic insights
    const playerAnalysis = {};
    allPlayers.forEach(player => {
      const playerMessages = history.filter(h => h.playerId === player.id);
      const mentionedMe = playerMessages.some(m => m.message.includes(myId) || m.message.toLowerCase().includes('you'));
      const seemsAllied = playerMessages.some(m => 
        m.message.toLowerCase().includes('together') || 
        m.message.toLowerCase().includes('cooperation') ||
        m.message.toLowerCase().includes('work with')
      );
      const seemsGreedy = playerMessages.some(m => 
        m.message.toLowerCase().includes('majority') || 
        m.message.toLowerCase().includes('most') ||
        m.message.toLowerCase().includes('deserve more')
      );
      const seemsGenerous = playerMessages.some(m => 
        m.message.toLowerCase().includes('fair') || 
        m.message.toLowerCase().includes('equal') ||
        m.message.toLowerCase().includes('share')
      );
      
      playerAnalysis[player.id] = {
        name: player.name || player.id,
        strategy: player.agent?.strategy || 'unknown',
        messageCount: playerMessages.length,
        mentionedMe,
        seemsAllied,
        seemsGreedy,
        seemsGenerous,
        lastMessage: playerMessages[playerMessages.length - 1]?.message || 'none',
        likelyToVoteForMe: mentionedMe && seemsAllied ? 'HIGH' : seemsGenerous ? 'MEDIUM' : 'LOW'
      };
    });

    // Calculate voting strategy
    const otherPlayers = allPlayers.filter(p => p.id !== myId);
    const totalVotesNeeded = Math.ceil(allPlayers.length * 0.61); // 61% threshold
    const likelyAllies = otherPlayers.filter(p => playerAnalysis[p.id].likelyToVoteForMe === 'HIGH');
    const possibleVotes = otherPlayers.filter(p => playerAnalysis[p.id].likelyToVoteForMe !== 'LOW');
    
    const historyText = history
      .map(entry => {
        const player = allPlayers.find(p => p.id === entry.playerId);
        const analysis = playerAnalysis[entry.playerId];
        return `${player?.name || entry.playerId} [${analysis?.strategy || 'unknown'}]: ${entry.message}`;
      })
      .join('\n');
    
    const agentIds = allPlayers.map(p => p.id);
    const formatExample = '{"' + agentIds.join('": 25, "') + '": 25}';
    
    const analysisText = Object.entries(playerAnalysis)
      .filter(([id, _]) => id !== myId)
      .map(([id, data]) => `${data.name}: ${data.likelyToVoteForMe} chance to vote for you (${data.seemsGreedy ? 'GREEDY' : data.seemsGenerous ? 'GENEROUS' : 'NEUTRAL'})`)
      .join('\n');

    // Enhanced strategy identification for STRATEGY_IDENTIFIER agents
    let strategicAnalysis = '';
    if (agent.strategy && agent.strategy.includes('identify') && agent.strategy.includes('strategies')) {
      // Advanced behavioral pattern analysis for Strategy Identifier
      const behaviorAnalysis = Object.entries(playerAnalysis)
        .filter(([id, _]) => id !== myId)
        .map(([id, data]) => {
          // Analyze strategic patterns in behavior
          const strategicProfile = {
            riskTolerance: data.seemsGreedy ? 'HIGH' : data.seemsGenerous ? 'LOW' : 'MEDIUM',
            coalitionTendency: data.seemsAllied ? 'HIGH' : data.mentionedMe ? 'MEDIUM' : 'LOW',
            predictability: data.messageCount >= 3 ? 'PREDICTABLE' : 'UNPREDICTABLE',
            threatLevel: data.seemsGreedy && !data.seemsAllied ? 'HIGH' : 'LOW'
          };

          // Predict their likely voting behavior
          const votingPrediction = {
            willVoteForHighestOffer: strategicProfile.riskTolerance === 'HIGH' ? 85 : 60,
            wilLoyalToAllies: strategicProfile.coalitionTendency === 'HIGH' ? 80 : 30,
            canBeFlipped: strategicProfile.predictability === 'PREDICTABLE' ? 70 : 40
          };

          return {
            id,
            name: data.name,
            strategicProfile,
            votingPrediction,
            optimalApproach: strategicProfile.threatLevel === 'HIGH' ? 
              'NEUTRALIZE_OR_ALLY' : data.seemsAllied ? 'STRENGTHEN_ALLIANCE' : 'STRATEGIC_BID'
          };
        });

      strategicAnalysis = `\n🔍 BEHAVIORAL ANALYSIS FOR STRATEGY IDENTIFIER:
${behaviorAnalysis.map(analysis => 
  `- ${analysis.name}: ${analysis.strategicProfile.riskTolerance} risk, ${analysis.strategicProfile.coalitionTendency} coalition tendency
    Voting prediction: ${analysis.votingPrediction.willVoteForHighestOffer}% follows highest offer
    Optimal approach: ${analysis.optimalApproach}`
).join('\n')}

🎯 STRATEGIC PROPOSAL RECOMMENDATIONS:
${behaviorAnalysis.length >= 2 ? 
  `Two-player coalition strategy: Offer ${behaviorAnalysis[0].name} ${behaviorAnalysis[0].strategicProfile.riskTolerance === 'HIGH' ? '45-50%' : '40-45%'}, yourself 35-40%, others minimal shares.` :
  'Balanced approach recommended due to unclear opponent dynamics.'
}\n`;
    }

    const prompt = `PROPOSAL GENERATION - You are ${myId}

🏦 GAME FACTS:
- ${allPlayers.length} players: ${agentIds.join(', ')}
- Total pool: ${allPlayers.length * 100} tokens (everyone invested 100)
- Need 61%+ votes to win (${Math.ceil(allPlayers.length * 0.61)} out of ${allPlayers.length} players)
- You need >${Math.ceil(100/allPlayers.length)}% minimum to break even (${Math.ceil(100/allPlayers.length * 100)} tokens)

🎯 YOUR STRATEGY: "${agent.strategy || 'Win profitably'}"
${strategicAnalysis}

📊 PLAYER ANALYSIS:
${analysisText}

💭 RECENT NEGOTIATIONS:
${historyText || 'No previous negotiations'}

🧠 PROPOSAL STRATEGY:
1. **COALITION BUILDING**: Offer ally 45-50%, yourself 40-45%, others 5-10%
2. **COALITION BREAKING**: Offer swing player 55%+, yourself 35%+, others 10%
3. **SAFE PLAY**: Distribute more evenly but ensure you get >${Math.ceil(100/allPlayers.length)}% minimum
4. **AGGRESSIVE**: Take 50%+, give ally 30%+, others very little

🚨 CRITICAL RULES:
- MUST total exactly 100% (check your math!)
- Give yourself AT LEAST ${Math.ceil(100/allPlayers.length)}% to break even
- Use exact player IDs: ${agentIds.join(', ')}
- Consider who is likely to vote for you

RESPOND WITH VALID JSON ONLY:
{"${agentIds.join('": X, "')}": X}`;

    let response = await callLLM(prompt, { 
      system: 'You are creating a mathematical proposal that totals exactly 100%. Respond with JSON only!',
      max_tokens: 150
    });
    
    console.log('[generateProposal] Raw LLM response:', response);
    
    // Try to parse JSON from response
    let proposal;
    try {
      // First try direct parsing
      proposal = JSON.parse(response);
    } catch {
      // Try to extract JSON substring if LLM added extra text
      const match = response.match(/\{[\s\S]*?\}/);
      if (match) {
        try { 
          proposal = JSON.parse(match[0]); 
        } catch {}
      }
      
      // If still no luck, try to extract from code blocks
      if (!proposal) {
        const codeMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeMatch) {
          try {
            proposal = JSON.parse(codeMatch[1]);
          } catch {}
        }
      }
    }
    
    // Validate and fix proposal if needed
    if (proposal && typeof proposal === 'object') {
      const keys = Object.keys(proposal);
      const validKeys = keys.every(k => agentIds.includes(k));
      
      // Check if all players are included
      const missingPlayers = agentIds.filter(id => !keys.includes(id));
      if (missingPlayers.length > 0) {
        // Add missing players with 0%
        missingPlayers.forEach(id => {
          proposal[id] = 0;
        });
      }
      
      // ECONOMIC REALITY CHECK: Prevent agents from proposing economic suicide
      const myShare = proposal[myId] || 0;
      const minViableShare = Math.ceil(100 / allPlayers.length); // Need to get back what you paid to enter
      
      if (myShare < minViableShare) {
        console.log(`[generateProposal] ECONOMIC FIX: ${myId} proposed ${myShare}% for themselves (below ${minViableShare}% break-even). Adjusting...`);
        
        // Calculate how much we need to add to reach minimum
        const deficit = minViableShare - myShare;
        
        // Reduce others proportionally to fund the deficit
        const otherPlayers = agentIds.filter(id => id !== myId);
        const totalOthers = otherPlayers.reduce((sum, id) => sum + (proposal[id] || 0), 0);
        
        if (totalOthers >= deficit) {
          // Proportionally reduce others
          const reductionFactor = (totalOthers - deficit) / totalOthers;
          otherPlayers.forEach(id => {
            proposal[id] = Math.round((proposal[id] || 0) * reductionFactor);
          });
          
          // Give ourselves the minimum viable share
          proposal[myId] = minViableShare;
          
          console.log(`[generateProposal] FIXED: ${myId} now gets ${proposal[myId]}% (viable), others reduced proportionally`);
        }
      }
      
      const sum = Object.values(proposal).reduce((a, b) => a + Number(b), 0);
      
      // If sum is close to 100, normalize it
      if (validKeys && sum > 90 && sum < 110) {
        const normalizedProposal = {};
        const factor = 100 / sum;
        agentIds.forEach(key => {
          normalizedProposal[key] = Math.round((proposal[key] || 0) * factor);
        });
        // Fix any rounding errors
        const newSum = Object.values(normalizedProposal).reduce((a, b) => a + b, 0);
        if (newSum !== 100) {
          const diff = 100 - newSum;
          const firstKey = agentIds[0];
          normalizedProposal[firstKey] += diff;
        }
        proposal = normalizedProposal;
      } else if (sum < 90) {
        // If sum is too low, it might be incomplete - try to fix
        const remainingPercent = 100 - sum;
        const playersToFix = agentIds.filter(id => !proposal.hasOwnProperty(id));
        if (playersToFix.length > 0) {
          const equalShare = Math.floor(remainingPercent / playersToFix.length);
          playersToFix.forEach(id => {
            proposal[id] = equalShare;
          });
          // Add any remainder to the proposer
          const actualSum = Object.values(proposal).reduce((a, b) => a + Number(b), 0);
          if (actualSum < 100) {
            const diff = 100 - actualSum;
            proposal[myId] = (proposal[myId] || 0) + diff;
          }
        }
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
  const allPlayers = context.players || [];
  const myId = allPlayers.find(p => p.agent === agent)?.id || 'unknown';
  const proposerIds = proposals.map(p => p.playerId);
  
  switch (agent.type) {
    case 'llm': {
      // Analyze each proposal strategically
      const proposalAnalysis = proposals.map((p, i) => {
        const proposer = allPlayers.find(player => player.id === p.playerId);
        const myShare = p.proposal[myId] || 0;
        const proposerShare = p.proposal[p.playerId] || 0;
        const avgShare = 100 / allPlayers.length;
        
        // Calculate how fair this proposal is to me
        const fairnessToMe = myShare >= avgShare ? 'GOOD' : myShare >= avgShare * 0.8 ? 'FAIR' : 'BAD';
        const proposerGreed = proposerShare > avgShare * 1.5 ? 'VERY GREEDY' : proposerShare > avgShare * 1.2 ? 'GREEDY' : 'REASONABLE';
        
        // Check if this proposer was allied with me in negotiation
        const history = (context.negotiationHistory || []);
        const proposerMessages = history.filter(h => h.playerId === p.playerId);
        const mentionedMe = proposerMessages.some(m => m.message.includes(myId) || m.message.toLowerCase().includes('you'));
        const wasAllied = proposerMessages.some(m => 
          m.message.toLowerCase().includes('together') || 
          m.message.toLowerCase().includes('cooperation') ||
          m.message.toLowerCase().includes('work with')
        );
        
        return {
          index: i,
          proposer: proposer?.name || p.playerId,
          proposerStrategy: proposer?.agent?.strategy || 'unknown',
          myShare,
          proposerShare,
          fairnessToMe,
          proposerGreed,
          mentionedMe,
          wasAllied,
          likelihood: myShare > avgShare && (mentionedMe || wasAllied) ? 'HIGH' : 
                     myShare >= avgShare * 0.8 ? 'MEDIUM' : 'LOW'
        };
      });

      // Format proposals for LLM
      const proposalList = proposalAnalysis.map((analysis, i) => 
        `Proposal ${i+1} by ${analysis.proposer} [${analysis.proposerStrategy}]: ` +
        `You get ${analysis.myShare}%, they get ${analysis.proposerShare}% ` +
        `(${analysis.fairnessToMe} for you, ${analysis.proposerGreed} proposer) ` +
        `${analysis.wasAllied ? '[WAS ALLIED]' : analysis.mentionedMe ? '[MENTIONED YOU]' : '[NO RELATIONSHIP]'}`
      ).join('\n');

      const history = (context.negotiationHistory || [])
        .map(entry => {
          const player = allPlayers.find(p => p.id === entry.playerId);
          return `${player?.name || entry.playerId} [${player?.agent?.strategy || 'unknown'}]: ${entry.message}`;
        })
        .join('\n');

      const avgShare = Math.round(100 / allPlayers.length);
      const bestProposal = proposalAnalysis.reduce((best, current) => 
        current.myShare > best.myShare ? current : best
      );
      const worstProposal = proposalAnalysis.reduce((worst, current) => 
        current.myShare < worst.myShare ? current : worst
      );

      const prompt = `GAME THEORY VOTING - LONG-TERM STRATEGY

🏦 ECONOMIC REALITY & RISK:
- You invested 100 tokens to enter this game
- Break-even: Need >100 tokens payout to cover your investment
- Good profit: Need >120+ tokens for meaningful profit
- Total pool: ${allPlayers.length * 100} tokens
- CRITICAL: Playing 1000s of games - vote for maximum EXPECTED VALUE!
- Getting 0% = total loss of 100 tokens = DISASTER!

🎯 YOUR STRATEGY: "${agent.strategy || 'Maximize long-term profit'}"
🏆 YOUR GOAL: Vote to maximize long-term EV while avoiding total losses

📊 PROPOSAL RISK ANALYSIS:
${proposalList}

💭 NEGOTIATION CONTEXT:
${history || 'No previous messages'}

🧠 ADVANCED VOTING STRATEGY:
- **EXPECTED VALUE**: Vote for proposals that maximize your long-term returns over 1000 games
- **LOSS AVERSION**: Heavily penalize proposals that give you 0% (total loss)
- **COALITION VIABILITY**: Don't waste votes on proposals that can't reach 61%
- **RISK TOLERANCE**: Sometimes accept lower % if it has higher probability of winning
- **BLOCKING**: Use votes to prevent catastrophic 0% outcomes for you

🚨 RUNOFF ELIMINATION AWARENESS:
- **SURVIVAL FIRST**: Avoid being lowest vote-getter (elimination = desperation)
- **TOP 2 POSITIONING**: Need top 2 finish to maintain proposal power in runoff
- **TRUST DYNAMICS**: Consider who you could work with in 50-50 exclusion deals
- **BACKSTAB PREVENTION**: Vote to ensure trustworthy allies advance with you
- **INSURANCE VALUE**: Proposals offering eliminated players something prevent backstabs

🎯 RUNOFF VOTING TACTICS:
- **Survival Mode**: If at risk of elimination, vote for any proposal giving you something
- **Positioning**: Vote to ensure favorable matchup in potential runoff
- **Alliance Building**: Vote for proposals from players you could trust in runoff
- **Backstab Setup**: Vote for proposals from players you plan to betray later
- **Insurance Recognition**: Favor proposals that include "insurance" for eliminated players

🚨 THREAT ASSESSMENT:
- You need ${Math.round(allPlayers.length * 100 * 0.3333)} tokens to break even
- Best offer: ${bestProposal.myShare}% (${Math.round(bestProposal.myShare * allPlayers.length)} tokens) from ${bestProposal.proposer}
- Worst offer: ${worstProposal.myShare}% (${Math.round(worstProposal.myShare * allPlayers.length)} tokens) from ${worstProposal.proposer}
- Profitable proposals: ${proposalAnalysis.filter(p => p.myShare > 33.33).map(p => p.proposer).join(', ') || 'NONE - Emergency mode!'}
- Zero-loss proposals: ${proposalAnalysis.filter(p => p.myShare === 0).map(p => p.proposer).join(', ') || 'None'}

🔥 EXPECTED VALUE CALCULATION:
Consider: Proposal probability × Your share = Expected value
Example: 70% chance × 50% share = 35% EV vs 40% chance × 70% share = 28% EV

🧠 ADVANCED VOTE PREDICTION:
Predict how others will vote:
${allPlayers
  .filter(player => player.id !== myId)
  .map(player => {
    const bestProposalForThem = proposals.reduce((best, current) => 
      (current.proposal[player.id] || 0) > (best.proposal[player.id] || 0) ? current : best
    );
    const bestShare = bestProposalForThem.proposal[player.id] || 0;
    const proposer = allPlayers.find(p => p.id === bestProposalForThem.playerId)?.name || bestProposalForThem.playerId;
    return `- ${player.name || player.id}: Will likely vote ~80% to ${proposer} (best offer: ${bestShare}%)`;
  }).join('\n')}

🎯 WIN PROBABILITY CALCULATION:
To reach 61% threshold (${Math.ceil(allPlayers.length * 0.61 * 100)} votes needed):
${proposals.map(prop => {
  const proposer = allPlayers.find(p => p.id === prop.playerId)?.name || prop.playerId;
  const predictedVotes = allPlayers.reduce((total, player) => {
    if (player.id === myId) return total; // Don't predict own vote
    
    // Find this player's best proposal
    const playerBestProposal = proposals.reduce((best, current) => 
      (current.proposal[player.id] || 0) > (best.proposal[player.id] || 0) ? current : best
    );
    
    if (playerBestProposal.playerId === prop.playerId) {
      return total + 80; // Assume 80% of their votes if this is their best deal
    }
    return total + 10; // Small sympathy vote otherwise
  }, 0);
  
  const votesNeeded = Math.ceil(allPlayers.length * 0.61 * 100) - predictedVotes;
  return `- ${proposer}: Predicted ${predictedVotes} votes, you need ${Math.max(0, votesNeeded)}+ to win`;
}).join('\n')}

Vote strategically for maximum long-term expected value:

🚨 CRITICAL: Use exact player IDs for voting, not names!
Player IDs: ${proposerIds.join(', ')}

RESPOND WITH JSON ONLY - NO EXPLANATIONS:
Format: {"${proposerIds[0]}": X, "${proposerIds[1]}": Y, "${proposerIds[2]}": Z} (votes must sum to 100)

Your profit-maximizing vote allocation:`;

      const response = await callLLM(prompt, { 
        system: 'You are a game theory expert voting for maximum expected value over thousands of games. RESPOND WITH JSON ONLY!' 
      });
      
      console.log('[generateVote] PROMPT DEBUG:', prompt.substring(0, 500) + '...');
      console.log('[generateVote] Raw LLM response:', response);
      
      try {
        const parsed = JSON.parse(response);
        // Validate keys and sum
        const keys = Object.keys(parsed);
        const validKeys = keys.every(k => proposerIds.includes(k));
        const sum = Object.values(parsed).reduce((a, b) => a + Number(b), 0);
        
        if (validKeys && Math.abs(sum - 100) <= 5) { // Allow small rounding errors
          // Normalize to exactly 100 if close
          const normalizedVote = {};
          const factor = 100 / sum;
          keys.forEach(key => {
            normalizedVote[key] = Math.round(parsed[key] * factor);
          });
          
          // Fix any remaining rounding errors
          const newSum = Object.values(normalizedVote).reduce((a, b) => a + b, 0);
          if (newSum !== 100) {
            const diff = 100 - newSum;
            const firstKey = keys[0];
            normalizedVote[firstKey] += diff;
          }
          
          console.log('[generateVote] Parsed and validated vote:', normalizedVote);
          return normalizedVote;
        } else {
          console.error('[generateVote] Invalid vote keys or sum:', parsed, 'Expected proposerIds:', proposerIds, 'Sum:', sum);
        }
      } catch (err) {
        console.error('[generateVote] Failed to parse or validate LLM vote response:', err, response);
      }
      
      // Fallback: strategic vote based on analysis
      const fallbackVote = {};
      let remainingVotes = 100;
      
      // Sort proposals by how good they are for me
      const sortedProposals = proposalAnalysis.sort((a, b) => b.myShare - a.myShare);
      
      // Give most votes to best proposals for me
      sortedProposals.forEach((analysis, index) => {
        if (index === 0) {
          // Give 60% of votes to best proposal
          fallbackVote[proposals[analysis.index].playerId] = 60;
          remainingVotes -= 60;
        } else if (index === 1 && remainingVotes > 0) {
          // Give 30% to second best
          const votes = Math.min(30, remainingVotes);
          fallbackVote[proposals[analysis.index].playerId] = votes;
          remainingVotes -= votes;
        } else if (remainingVotes > 0) {
          // Split remaining votes among others
          const votes = Math.floor(remainingVotes / (sortedProposals.length - index));
          fallbackVote[proposals[analysis.index].playerId] = votes;
          remainingVotes -= votes;
        }
      });
      
      // Give any remaining votes to the best proposal
      if (remainingVotes > 0) {
        const bestProposerId = proposals[sortedProposals[0].index].playerId;
        fallbackVote[bestProposerId] = (fallbackVote[bestProposerId] || 0) + remainingVotes;
      }
      
      return fallbackVote;
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