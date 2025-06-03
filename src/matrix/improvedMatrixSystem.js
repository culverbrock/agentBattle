/**
 * Improved Matrix System - Enhanced prompts and validation for better success rates
 * Addresses the 50% matrix update failure rate from logged analysis
 * Updated: Unified vote sections and enhanced strategic reasoning
 * Added: Configurable reasoning collection and verbosity control
 */

const { callLLM } = require('../../src/core/llmApi');
const fs = require('fs');

class ImprovedMatrixSystem {
    constructor(config = {}) {
        this.negotiationMatrix = null;
        this.players = [];
        this.playerExplanations = [];
        this.violationLog = [];
        this.currentActivePlayers = []; // Track which players are active/eliminated
        this.strategicHistory = []; // Track strategic patterns over rounds
        
        // Create log file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFile = `improved_matrix_log_${timestamp}.json`;
        this.llmInteractions = [];
        
        // Configuration options
        this.config = {
            collectReasoning: config.collectReasoning !== false, // Default to true
            verbosity: config.verbosity || 3, // 0=silent, 1=minimal, 2=normal, 3=verbose, 4=debug
            showFullMatrix: config.showFullMatrix || false,
            customLogger: config.customLogger || null, // Custom logging function
            ...config
        };
        
        // Use custom logger if provided, otherwise use console.log
        const logFunction = this.config.customLogger || console.log;
        
        logFunction(`📝 LLM interactions will be logged to: ${this.logFile}`);
        
        // Logging functions that respect verbosity and use custom logger
        this.log = {
            silent: () => {},
            minimal: (msg) => this.config.verbosity >= 1 && logFunction(msg),
            normal: (msg) => this.config.verbosity >= 2 && logFunction(msg),
            verbose: (msg) => this.config.verbosity >= 3 && logFunction(msg),
            debug: (msg) => this.config.verbosity >= 4 && logFunction(msg)
        };
    }

    // Log LLM interaction
    logLLMInteraction(playerName, playerIndex, round, prompt, response, success, error = null, corrected = false) {
        const interaction = {
            timestamp: new Date().toISOString(),
            playerName,
            playerIndex,
            round,
            prompt,
            response,
            success,
            error,
            corrected,
            promptLength: prompt.length,
            responseLength: response ? response.length : 0
        };
        
        this.llmInteractions.push(interaction);
        fs.writeFileSync(this.logFile, JSON.stringify(this.llmInteractions, null, 2));
    }

    initializeMatrix(players) {
        this.players = players;
        const numPlayers = players.length;
        const matrixWidth = numPlayers * 3; // Changed from 4 to 3 sections
        
        this.negotiationMatrix = Array(numPlayers).fill(null).map((_, playerIndex) => ({
            playerId: players[playerIndex].id,
            playerName: players[playerIndex].name,
            data: Array(matrixWidth).fill(0),
            lastModified: null,
            modificationCount: 0
        }));
        
        this.playerExplanations = Array(numPlayers).fill(null).map(() => []);
        this.strategicHistory = Array(numPlayers).fill(null).map(() => []);
        
        this.log.normal(`🔢 Initialized ${numPlayers}x${matrixWidth} matrix with unified vote structure`);
        return this.negotiationMatrix;
    }

    async performNegotiationRound(playerIndex, strategy, roundNumber, isEliminated = false, activePlayers = null) {
        const numPlayers = this.players.length;
        const playerName = this.players[playerIndex].name;
        
        try {
            // Track which players are eliminated for vote allocation guidance
            this.currentActivePlayers = activePlayers || this.players.map((_, i) => ({ playerIndex: i, isActive: !isEliminated }));
            
            // Generate enhanced strategic prompt
            const prompt = this.generateEnhancedStrategicPrompt(playerIndex, strategy, roundNumber, isEliminated);
            
            // Get response from LLM
            const response = await callLLM(prompt, {
                temperature: 0.3, // Slightly higher for more strategic creativity
                max_tokens: 800,  // More tokens for detailed strategic reasoning
                system: 'You are a strategic negotiation expert. Analyze the current matrix state carefully and make optimal decisions. You MUST provide valid numbers that sum correctly and follow the exact JSON format.'
            });
            
            // Parse response
            const parsedResponse = this.parseResponse(response, numPlayers, playerIndex);
            
            if (!parsedResponse.success) {
                this.logLLMInteraction(playerName, playerIndex, roundNumber, prompt, response, false, parsedResponse.error);
                this.logViolation(playerIndex, 'PARSING_ERROR', parsedResponse.error, roundNumber);
                return false;
            }
            
            // Auto-correct mathematical errors
            const correctedRow = this.autoCorrectMath(parsedResponse.matrixRow, numPlayers, playerIndex, isEliminated);
            const wasCorrected = JSON.stringify(correctedRow) !== JSON.stringify(parsedResponse.matrixRow);
            const wasAutoFixed = parsedResponse.wasAutoFixed || false;
            
            // Validate corrected row
            const validation = this.validateMatrixRow(correctedRow, numPlayers, playerIndex, isEliminated);
            
            if (!validation.valid) {
                this.logLLMInteraction(playerName, playerIndex, roundNumber, prompt, response, false, validation.error, wasCorrected || wasAutoFixed);
                this.logViolation(playerIndex, 'INVALID_MATRIX_UNCORRECTABLE', validation.error, roundNumber);
                return false;
            }
            
            // Store strategic decision for future analysis
            this.strategicHistory[playerIndex].push({
                round: roundNumber,
                strategy: strategy,
                explanation: parsedResponse.explanation,
                matrixRow: correctedRow
            });
            
            const selfAllocation = correctedRow[playerIndex];
            const profit = (selfAllocation / 100) * (numPlayers * 100) - 100;
            const profitAmount = Math.round(profit);
            const profitStatus = profitAmount >= 0 ? 'PROFITABLE' : 'UNPROFITABLE';
            
            // Update matrix
            this.updatePlayerRow(playerIndex, correctedRow, parsedResponse.explanation, roundNumber);
            
            // Log successful interaction
            this.logLLMInteraction(playerName, playerIndex, roundNumber, prompt, response, true, null, wasCorrected || wasAutoFixed);
            
            if (wasAutoFixed && wasCorrected) {
                this.log.verbose(`[Player ${playerIndex + 1}] Array length auto-fixed AND matrix auto-corrected`);
            } else if (wasAutoFixed) {
                this.log.verbose(`[Player ${playerIndex + 1}] Array length auto-fixed`);
            } else if (wasCorrected) {
                this.log.verbose(`[Player ${playerIndex + 1}] Matrix auto-corrected`);
            } else {
                this.log.debug(`[Player ${playerIndex + 1}] Matrix updated successfully`);
            }
            
            // Show detailed reasoning only if collecting reasoning and verbosity is high enough
            if (this.config.collectReasoning && this.config.verbosity >= 3) {
                this.log.verbose(`[Player ${playerIndex + 1}] Self-allocation: ${selfAllocation}% = ${Math.round((selfAllocation / 100) * (numPlayers * 100))} coins (${profitAmount >= 0 ? '+' : ''}${profitAmount} profit) ${profitStatus}`);
                this.log.verbose(`[Player ${playerIndex + 1}] FULL REASONING: "${parsedResponse.explanation}"`);
            } else if (this.config.verbosity >= 2) {
                this.log.normal(`[Player ${playerIndex + 1}] Self-allocation: ${selfAllocation}% (${profitStatus})`);
            }
            
            // Show full matrix only if requested
            if (this.config.showFullMatrix && this.config.verbosity >= 2) {
                const logFunction = this.config.customLogger || console.log;
                logFunction(`=== MATRIX STATE AFTER PLAYER ${playerIndex + 1} UPDATE ===`);
                
                // Send each player's matrix state as a separate log message for better formatting
                this.negotiationMatrix.forEach((rowObj, idx) => {
                    const data = rowObj.data;
                    const numPlayers = this.players.length;
                    const proposal = data.slice(0, numPlayers);
                    const votes = data.slice(numPlayers, numPlayers * 2);
                    const requests = data.slice(numPlayers * 2, numPlayers * 3);
                    
                    const proposalSum = proposal.reduce((a, b) => a + b, 0);
                    const voteSum = votes.reduce((a, b) => a + b, 0);
                    
                    // Check if player is eliminated
                    const isEliminated = proposal.every(val => val === -1);
                    const statusLabel = isEliminated ? 'ELIMINATED' : 'ACTIVE';
                    
                    // Format displays
                    const proposalDisplay = isEliminated ? 
                        `[${proposal.join(',')}] ELIMINATED` :
                        `[${proposal.map(p => p.toFixed(1)).join(',')}%] (sum: ${proposalSum.toFixed(1)}%) ${Math.abs(proposalSum - 100) <= 3 ? 'VALID' : 'INVALID'}`;
                    
                    const requestDisplay = isEliminated ?
                        `[${requests.join(',')}] NO REQUESTS` :
                        `[${requests.map(r => r.toFixed(1)).join(',')}] votes`;
                    
                    logFunction(`Player ${idx + 1} (${rowObj.playerName}) - ${statusLabel}:`);
                    logFunction(`  Proposal: ${proposalDisplay}`);
                    logFunction(`  Votes: [${votes.map(v => v.toFixed(1)).join(',')}%] (sum: ${voteSum.toFixed(1)}%) ${Math.abs(voteSum - 100) <= 3 ? 'VALID' : 'INVALID'}`);
                    logFunction(`  Requests: ${requestDisplay}`);
                });
                
                logFunction('=== END MATRIX STATE ===');
            }
            
            return true;
            
        } catch (error) {
            this.logLLMInteraction(playerName, playerIndex, roundNumber, '', '', false, error.message);
            this.logViolation(playerIndex, 'SYSTEM_ERROR', error.message, roundNumber);
            this.log.normal(`[Player ${playerIndex + 1}] Matrix negotiation failed: ${error.message}`);
            return false;
        }
    }

    // Generate ENHANCED strategic prompt with evolution over rounds
    generateEnhancedStrategicPrompt(playerIndex, strategy, roundNumber, isEliminated = false) {
        const numPlayers = this.players.length;
        const currentMatrix = this.formatDetailedMatrixState();
        
        // Determine current phase
        const currentPhase = "NEGOTIATION";
        
        // Build elimination status info
        const eliminationStatus = isEliminated ? 
            `🚨 PLAYER STATUS: ELIMINATED
❌ You CANNOT make proposals or win the game
❌ You CANNOT request votes (your proposal is dead)
✅ You CAN still influence through voting for remaining active proposals
🎯 Focus: Choose which ACTIVE player's proposal gives you the best outcome` :
            `You are ACTIVE and can make proposals, make requests, and vote.`;
        
        // Format strategy insertion
        const strategySection = strategy ? `The person who brought you into this world gave you this advice: "${strategy}"` : '';
        
        // Build the clean, professional prompt
        return `IDENTITY:
You are a player who has been brought to this world to be successful at this game by making money over the long run by playing it multiple times and making more money than you paid on average. For this game you paid 100 coins to enter, and ${numPlayers - 1} other players entered, meaning the total pool available to be disbursed is ${numPlayers * 100} coins.

PURPOSE:
Your goal is to maximize your long-term profit across multiple games. You need to understand the game mechanics, analyze other players' strategies, and make optimal decisions.

GAME MECHANICS:
The game works like this: every player including you will negotiate and decide how you will split the total prize pool. In the negotiation stage, you must learn as much as you can and communicate your goals in the game by editing a matrix that contains info about how each agent you are competing against plans on splitting the prize pool.

GAME STRUCTURE:
- Multiple negotiation rounds where you can change your matrix position
- Learn from others' moves and adapt your strategy each round
- After negotiation, proposals are made and votes are cast
- Game continues until someone gets 61%+ votes OR all players eliminated except one

ELIMINATION MECHANICS - CRITICAL:
If NO proposal gets 61% of votes:
- The proposal with the FEWEST votes gets ELIMINATED
- That player can no longer make proposals but can still vote
- Game continues with remaining players until someone gets 61%+ votes
- Strategy: You can survive by NOT having the worst proposal, even if you don't win

🚨 CRITICAL ELIMINATION RULES:
IF YOU ARE ELIMINATED:
1. ❌ PROPOSAL SECTION: You MUST set ALL proposal values to -1 (your proposal is dead)
2. ❌ VOTE REQUEST SECTION: You MUST set ALL vote request values to -1 (can't request votes for dead proposal)
3. ✅ VOTING SECTION: You MUST allocate 100% of votes among ACTIVE players only (NOT yourself)
4. 🎯 VOTING STRATEGY: Choose which active player's proposal gives YOU the most coins
5. 💰 YOUR GOAL: Even eliminated, you still want to maximize your payout from whichever proposal wins

EXAMPLE - If eliminated in 6-player game:
❌ Proposal: [-1, -1, -1, -1, -1, -1] (dead proposal)
✅ Voting: [0, 30, 70, 0, 0, 0] (0% to yourself, vote for others based on what they offer YOU)
❌ Requests: [-1, -1, -1, -1, -1, -1] (can't request votes for dead proposal)

MATRIX STRUCTURE:
- First ${numPlayers} columns: How each agent plans to split the prize pool (must sum to 100%)
- Next ${numPlayers} columns: How each agent plans to vote (each agent gets 100 votes to split across proposals, must sum to 100)
- Next ${numPlayers} columns: Each agents request of the total votes from that player in that idx, if any..

You can read all other agents' plans by reading the matrix and make estimates about how you should behave optimally based on what they say in the matrix, for example, if player 1 is offering you a very large percentage of the prize pool, you could offer them a larger pct of your votes, if they requested something of you, you could consider meeting their request. You can only update your matrix 1 time per round of negotiation.

GAME PHASES & MATRIX SYSTEM:
🔄 PHASE 1 - MATRIX STRATEGY: You fill out the matrix with your COMPLETE strategy for this round
   - Your matrix response contains your proposal, votes, AND vote requests all in one
   - No additional decisions will be asked of you after submitting your matrix

🏃 PHASE 2 - AUTOMATIC EXECUTION: The system extracts and executes your strategy:
   - PROPOSAL EXTRACTION: Your proposal (positions 0-${numPlayers - 1}) becomes your actual game proposal
   - VOTING EXTRACTION: Your vote allocation (positions ${numPlayers}-${numPlayers * 2 - 1}) becomes your actual votes
   - VOTE REQUESTS: Your requests (positions ${numPlayers * 2}-${numPlayers * 3 - 1}) influence other players

⚡ KEY INSIGHT: Your matrix response IS your complete game strategy - think carefully!

WINNING CONDITION:
A proposal must receive at least 61% of votes to pass and end the game. If no proposal gets 61%, the proposal with the fewest votes gets eliminated (that player can no longer make proposals but can still vote). You can estimate how eah proposal will do based on summing the matrix vote columns.

CURRENT STATUS:
${eliminationStatus}
You are Player ${playerIndex + 1} in position ${playerIndex}.
${strategySection}

CURRENT PHASE: ${currentPhase} - Round ${roundNumber}

CURRENT MATRIX STATE:
${currentMatrix}

CRITICAL FINANCIAL CALCULATION:
You paid 100 coins to enter. To be profitable, you need more than 100 coins from the prize pool.
Break-even point: ${(100 / (numPlayers * 100) * 100).toFixed(1)}% of the prize pool
Your target to hit breakeven or make money this game: Position ${playerIndex} in any winning proposal should be > ${(100 / (numPlayers * 100) * 100).toFixed(1)}%

CURRENT SITUATION PROFIT ANALYSIS:
Analyze each existing proposal for YOUR profit/loss:
${this.negotiationMatrix ? this.negotiationMatrix.map((rowObj, idx) => {
    const data = rowObj.data;
    const proposal = data.slice(0, numPlayers);
    const playerAllocation = proposal[playerIndex];
    const coins = Math.round((playerAllocation / 100) * (numPlayers * 100));
    const profit = coins - 100;
    const status = profit >= 0 ? '✅ PROFITABLE' : '❌ LOSS';
    return `- ${rowObj.playerName}'s proposal gives you: ${playerAllocation.toFixed(1)}% = ${coins} coins = ${profit >= 0 ? '+' : ''}${profit} profit ${status}`;
}).join('\n') : 'No current proposals to analyze'}

FAIRNESS ANALYSIS GUIDE:
MATRIX INTERPRETATION:
- 0 values: Player hasn't made a decision yet OR is giving nothing to that player/proposal
- Negative values (-1): Player is eliminated and cannot make proposals/requests

COMPETITIVE STRATEGIC ANALYSIS:
This is ZERO-SUM COMPETITION - every coin another player gets is a coin you don't get. Your goal is maximizing YOUR long-term profit, not being "nice."

FAIR SPLIT: Each player gets ${(100/numPlayers).toFixed(1)}% (${Math.round((100/numPlayers) * (numPlayers * 100) / 100)} coins per player)
STRATEGIC CATEGORIES for self-allocation analysis:
- COOPERATIVE: ${(80/numPlayers).toFixed(1)}-${(120/numPlayers).toFixed(1)}% (${Math.round((80/numPlayers) * (numPlayers * 100) / 100)}-${Math.round((120/numPlayers) * (numPlayers * 100) / 100)} coins) - Close to fair split
- AGGRESSIVE: ${(150/numPlayers).toFixed(1)}-${(200/numPlayers).toFixed(1)}% (${Math.round((150/numPlayers) * (numPlayers * 100) / 100)}-${Math.round((200/numPlayers) * (numPlayers * 100) / 100)} coins) - Taking 1.5-2x fair share
- MAXIMALLY EXPLOITATIVE: >${(200/numPlayers).toFixed(1)}% (>${Math.round((200/numPlayers) * (numPlayers * 100) / 100)} coins) - Taking 2x+ fair share

VOTING LOGIC - THE KEY TO WINNING:
Your voting decision should be: "Which proposal gives ME the most coins?" 

CRITICAL CONSISTENCY RULE: Your ACTIONS must match your ANALYSIS!
- If you call a proposal "exploitative" → explain WHY you're still voting for it (or don't vote for it)
- If you call a proposal "fair" → explain how this benefits your strategy
- If you vote heavily for a proposal → explain what makes it attractive to you
- If you give zero votes to a proposal → explain why it's not viable

RATIONAL VOTING EXAMPLES:
Scenario 1: "Player 1's [100,0,0,0,0,0] is extremely exploitative and gives me nothing, so I allocate 0 votes to it."
Scenario 2: "Player 1's [100,0,0,0,0,0] is exploitative, but if it's the final 2 and the alternative gives me even less, I might vote for it as the lesser evil."
Scenario 3: "Player 2's [20,20,20,20,10,10] gives me a good return, so I allocate most of my votes there."

YOUR VOTE ALLOCATION MUST HAVE CLEAR STRATEGIC REASONING:
- Early rounds: You can vote to gather information, signal alliances, or test strategies
- Middle rounds: Vote based on profitability and likelihood to pass
- Final rounds: Vote for your best available option, even if it's not ideal
- Never vote "diplomatically" without explaining your diplomatic strategy

LOGICAL CONSISTENCY EXAMPLES:
✅ GOOD: "Player X is exploitative, so I give them 0 votes to signal this won't work"
✅ GOOD: "Player X is exploitative, but it's better than Player Y's worse offer, so I vote strategically"
❌ BAD: "Player X is exploitative" [then votes for them with no explanation]
❌ BAD: "I'll vote evenly for fairness" [without explaining how this helps YOU win]

Remember: Every vote should advance YOUR strategy - explain how!

RESPONSE FORMAT:
${this.config.collectReasoning ? `You must respond with a JSON object containing:
{
  "explanation": "Your strategic reasoning for this round's decisions (minimum 50 characters), including what you perceive the other players to be doing and how you are reacting to it.",
  "matrixRow": [${Array(numPlayers * 3).fill(0).map((_, i) => i < numPlayers ? `proposal_player_${i + 1}` : i < numPlayers * 2 ? `vote_player_${i - numPlayers + 1}` : `request_player_${i - numPlayers * 2 + 1}`).join(', ')}]
}` : `You must respond with a JSON object containing:
{
  "matrixRow": [${Array(numPlayers * 3).fill(0).map((_, i) => i < numPlayers ? `proposal_player_${i + 1}` : i < numPlayers * 2 ? `vote_player_${i - numPlayers + 1}` : `request_player_${i - numPlayers * 2 + 1}`).join(', ')}]
}`}

🚨 CRITICAL: This matrixRow array IS your complete game strategy. You will NOT be asked to make separate proposal or voting decisions. The system will extract your proposal from positions 0-${numPlayers - 1} and your votes from positions ${numPlayers}-${numPlayers * 2 - 1}. Think carefully!

The matrixRow array has ${numPlayers * 3} positions:
- Positions 0-${numPlayers - 1}: Your proposal for how to split the prize pool (must sum to 100%)
- Positions ${numPlayers}-${numPlayers * 2 - 1}: How you allocate your 100 votes across all proposals (must sum to 100%)
- Positions ${numPlayers * 2}-${numPlayers * 3 - 1}: How many votes you REQUEST from each player for YOUR proposal

CRITICAL VOTE REQUEST LOGIC:
📊 GAME MECHANICS: Getting a proposal to pass (61%+ votes) just ENDS the round and redistributes money - there's no "winner"
💰 REAL WINNING: Being profitable over many games by getting good allocations when proposals pass
🗳️ VOTE REQUESTS: Just signals asking "please vote for my proposal" - doesn't guarantee anything

STRATEGIC THINKING for vote requests:
1. **WANT YOUR PROPOSAL TO PASS**: Request ${Math.ceil(0.61 * numPlayers * 100)}+ total votes (61% of ${numPlayers * 100} available votes)
   - Example: [${Math.floor(100/numPlayers)},${Math.floor(100/numPlayers)},${Math.floor(100/numPlayers)},${Math.floor(100/numPlayers)},${Math.floor(100/numPlayers)},${Math.floor(100/numPlayers)}] = ${Math.floor(100/numPlayers) * numPlayers} votes
2. **PREFER SOMEONE ELSE'S PROPOSAL**: Request 0 votes for yourself + vote heavily for their better proposal
3. **BUILDING ALLIANCES**: Request moderate votes to signal interest without full commitment

KEY INSIGHT: Sometimes another player's proposal gives you MORE profit than your own!
- Your proposal: gives you 20% = ${Math.round(20 * numPlayers * 100 / 100)} coins
- Their proposal: gives you 25% = ${Math.round(25 * numPlayers * 100 / 100)} coins  
- SMART MOVE: Request 0 votes for yourself, vote for their proposal, profit more!

Remember: Vote requests are just communication - actual vote allocation determines what passes!

MANDATORY PROFIT CALCULATION:
Before making ANY decision, calculate your profit from each proposal:
- Current proposals and what each gives you in coins and profit/loss
- Your own proposal and what it gives you  
- NEVER vote for proposals that lose you money unless ALL options lose money

COALITION DYNAMICS:
- If Player A offers Player B a good deal, consider offering Player B a BETTER deal
- Look for 2v1 coalition opportunities where two players team up against the third
- Sometimes the best counter to a coalition is forming a different coalition
- Example: If Players 1&2 team up, Player 3 should try to break them apart with better offers

COALITION FORMATION EXAMPLES:
Scenario: Player 1 offers [45, 30, 25] and you want Player 2's support:
- Current: Player 2 gets 30% = ${Math.round(30 * numPlayers * 100 / 100)} coins
- Your counter-offer: [25, 45, 30] gives Player 2: 45% = ${Math.round(45 * numPlayers * 100 / 100)} coins 
- Result: Player 2 gains ${Math.round(45 * numPlayers * 100 / 100) - Math.round(30 * numPlayers * 100 / 100)} extra coins by joining YOU instead

Breaking coalitions: If Player A offers Player B a good deal, offer Player B an even BETTER deal to steal them away.

Defensive coalitions: If two players team up against you, try to split them by offering one of them a better deal than their current partnership.

DECISION CHECKLIST:
1. Calculate profit from each existing proposal: "Proposal X gives me Y% = Z coins = W profit/loss"
2. Can I form a profitable coalition with another player by offering them more than current proposals?
3. If someone else formed a coalition, can I break it with a counter-offer to their partner?
4. What vote allocation maximizes MY expected profit across all possible outcomes?

${isEliminated ? 'Since you are eliminated, set positions 0-' + (numPlayers - 1) + ' to -1.' : ''}

${isEliminated ? `🚨 ELIMINATED PLAYER INSTRUCTIONS:
Since you are ELIMINATED, your matrix response MUST be:
- Positions 0-${numPlayers - 1}: ALL set to -1 (your dead proposal)
- Positions ${numPlayers}-${numPlayers * 2 - 1}: Allocate 100 votes among ACTIVE players (0 votes to yourself at position ${playerIndex})
- Positions ${numPlayers * 2}-${numPlayers * 3 - 1}: ALL set to -1 (can't request votes for dead proposal)

CRITICAL: Give 0% of your votes to yourself (position ${playerIndex} in voting section) because your proposal is DEAD!
Vote only for active players based on which proposal gives YOU the most coins if it wins.` : ''}

Your position in arrays is index ${playerIndex}, so position ${playerIndex} represents YOUR allocation in any proposal or vote distribution.`;
    }

    // Auto-correct common mathematical errors (updated for 3-section format)
    autoCorrectMath(row, numPlayers, playerIndex, isEliminated = false) {
        const corrected = [...row];
        
        // Handle eliminated players - force proposal section to -1
        if (isEliminated) {
            this.log.verbose(`ELIMINATED PLAYER: Setting proposal section and vote request section to -1`);
            // Set proposal section to -1 (positions 0 to numPlayers-1)
            for (let i = 0; i < numPlayers; i++) {
                corrected[i] = -1;
            }
            // Set vote request section to -1 (positions numPlayers*2 to numPlayers*3-1)
            for (let i = numPlayers * 2; i < numPlayers * 3; i++) {
                corrected[i] = -1;
            }
            // Eliminated players can still vote (positions numPlayers to numPlayers*2-1), so don't modify vote allocation section
            return corrected;
        }
        
        // FORCE self-allocation to be profitable (≥17%) unless eliminated
        if (!isEliminated && corrected[playerIndex] < 17) {
            this.log.verbose(`FORCING PROFITABLE ALLOCATION: ${corrected[playerIndex]}% → 17% to prevent financial loss`);
            const deficit = 17 - corrected[playerIndex];
            corrected[playerIndex] = 17;
            
            // Redistribute the deficit from others proportionally
            const othersSum = corrected.slice(0, numPlayers).reduce((sum, val, idx) => 
                idx === playerIndex ? sum : sum + val, 0);
            
            if (othersSum > deficit) {
                for (let i = 0; i < numPlayers; i++) {
                    if (i !== playerIndex && corrected[i] > 0) {
                        const reduction = (corrected[i] / othersSum) * deficit;
                        corrected[i] = Math.max(0, corrected[i] - reduction);
                    }
                }
            }
        }
        
        // Fix proposal section if significantly off (only for non-eliminated)
        const proposalSum = corrected.slice(0, numPlayers).reduce((sum, val) => sum + val, 0);
        if (proposalSum > 0 && Math.abs(proposalSum - 100) > 5) {
            const factor = 100 / proposalSum;
            for (let i = 0; i < numPlayers; i++) {
                corrected[i] = Math.round(corrected[i] * factor);
            }
            const newSum = corrected.slice(0, numPlayers).reduce((sum, val) => sum + val, 0);
            corrected[0] += (100 - newSum);
        }
        
        // MUCH more aggressive vote correction
        const voteSum = corrected.slice(numPlayers, numPlayers * 2).reduce((sum, val) => sum + val, 0);
        if (voteSum > 0 && Math.abs(voteSum - 100) > 1) {
            const factor = 100 / voteSum;
            for (let i = numPlayers; i < numPlayers * 2; i++) {
                corrected[i] = Math.round(corrected[i] * factor);
            }
            const newVoteSum = corrected.slice(numPlayers, numPlayers * 2).reduce((sum, val) => sum + val, 0);
            const diff = 100 - newVoteSum;
            if (diff !== 0) {
                let maxVoteIndex = numPlayers;
                let maxVoteValue = corrected[numPlayers];
                for (let i = numPlayers + 1; i < numPlayers * 2; i++) {
                    if (corrected[i] > maxVoteValue) {
                        maxVoteValue = corrected[i];
                        maxVoteIndex = i;
                    }
                }
                corrected[maxVoteIndex] += diff;
                corrected[maxVoteIndex] = Math.min(100, corrected[maxVoteIndex]);
            }
        }
        
        // Clamp to valid range (but don't touch -1 values for eliminated players)
        for (let i = 0; i < corrected.length; i++) {
            if (corrected[i] !== -1) {
            corrected[i] = Math.max(0, Math.min(100, corrected[i]));
            }
        }
        
        return corrected;
    }

    formatDetailedMatrixState() {
        return this.negotiationMatrix.map((rowObj, idx) => {
            const data = rowObj.data;
            const numPlayers = this.players.length;
            const proposal = data.slice(0, numPlayers);
            const votes = data.slice(numPlayers, numPlayers * 2);
            const requests = data.slice(numPlayers * 2, numPlayers * 3);
            
            const proposalSum = proposal.reduce((a, b) => a + b, 0);
            const voteSum = votes.reduce((a, b) => a + b, 0);
            
            // Check if player is eliminated (all proposal values are -1)
            const isEliminated = proposal.every(val => val === -1);
            const statusLabel = isEliminated ? 'ELIMINATED' : 'ACTIVE';
            
            // Format proposal display
            const proposalDisplay = isEliminated ? 
                `[${proposal.join(',')}] ELIMINATED - NO PROPOSALS` :
                `[${proposal.map(p => p.toFixed(1)).join(',')}%] (sum: ${proposalSum.toFixed(1)}%) ${Math.abs(proposalSum - 100) <= 3 ? 'VALID' : 'INVALID'}`;
            
            // Format vote request display
            const requestDisplay = isEliminated ?
                `[${requests.join(',')}] ELIMINATED - NO REQUESTS` :
                `[${requests.map(r => r.toFixed(1)).join(',')}] votes`;
            
            return `Player ${idx + 1} (${rowObj.playerName}) - ${statusLabel}:
  Token Proposal: ${proposalDisplay}
  Vote Allocation: [${votes.map(v => v.toFixed(1)).join(',')}%] (sum: ${voteSum.toFixed(1)}%) ${Math.abs(voteSum - 100) <= 3 ? 'VALID' : 'INVALID'}
  Vote Requests: ${requestDisplay}`;
        }).join('\n');
    }

    formatPlayerCurrentRow(playerIndex) {
        if (!this.negotiationMatrix || !this.negotiationMatrix[playerIndex]) {
            return "No current row - this is your first update";
        }
        
        const rowObj = this.negotiationMatrix[playerIndex];
        const data = rowObj.data;
        const numPlayers = this.players.length;
        const proposal = data.slice(0, numPlayers);
        const votes = data.slice(numPlayers, numPlayers * 2);
        const requests = data.slice(numPlayers * 2, numPlayers * 3);
        
        const proposalSum = proposal.reduce((a, b) => a + b, 0);
        const voteSum = votes.reduce((a, b) => a + b, 0);
        const selfAllocation = proposal[playerIndex];
        
        return `YOUR CURRENT ROW:
💰 Token Proposal: [${proposal.join(',')}%] (sum: ${proposalSum}%) ${Math.abs(proposalSum - 100) <= 3 ? '✅' : '❌'}
🗳️ Vote Allocation: [${votes.join(',')}%] (sum: ${voteSum}%) ${Math.abs(voteSum - 100) <= 3 ? '✅' : '❌'}
📞 Vote Requests: [${requests.join(',')}] votes
💰 Your self-allocation: Array[${playerIndex}] = ${selfAllocation}% ${selfAllocation >= 17 ? '✅ PROFITABLE' : '❌ UNPROFITABLE'}
Array format: [${data.join(', ')}]`;
    }

    parseResponse(response, numPlayers, playerIndex) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { success: false, error: 'No JSON object found in response' };
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Check for required fields based on configuration
            if (!parsed.matrixRow) {
                return { success: false, error: 'Missing matrixRow field' };
            }
            
            if (this.config.collectReasoning && (!parsed.explanation || parsed.explanation.length < 10)) {
                return { success: false, error: 'Missing or too short explanation field' };
            }
            
            const expectedLength = numPlayers * 3;
            
            if (!Array.isArray(parsed.matrixRow)) {
                return { success: false, error: 'matrixRow must be an array' };
            }
            
            // Handle arrays that are close to correct length (auto-fix common LLM errors)
            let matrixRow = parsed.matrixRow.map(val => {
                const num = Number(val);
                return isNaN(num) ? 0 : num;
            });
            
            if (matrixRow.length === expectedLength - 1) {
                // LLM provided 17 instead of 18 - pad with 0
                this.log.verbose(`⚠️  Auto-fixing array length: got ${matrixRow.length}, expected ${expectedLength}, adding 0`);
                    matrixRow.push(0);
            } else if (matrixRow.length === expectedLength + 1) {
                // LLM provided 19 instead of 18 - trim last element
                this.log.verbose(`⚠️  Auto-fixing array length: got ${matrixRow.length}, expected ${expectedLength}, removing last element`);
                matrixRow = matrixRow.slice(0, expectedLength);
            } else if (matrixRow.length !== expectedLength) {
                return { 
                    success: false, 
                    error: `matrixRow must be array of ${expectedLength} numbers, got ${matrixRow.length}. Cannot auto-fix this difference.` 
                };
            }
            
            return {
                success: true,
                matrixRow, 
                explanation: this.config.collectReasoning ? parsed.explanation : 'No reasoning collected',
                wasAutoFixed: matrixRow.length !== parsed.matrixRow.length
            };
            
        } catch (error) {
            return { success: false, error: `JSON parsing failed: ${error.message}` };
        }
    }

    validateMatrixRow(row, numPlayers, playerIndex, isEliminated = false) {
        try {
            const TOLERANCE = 3;
            
            // Special handling for eliminated players
            if (isEliminated) {
                // Check that proposal section is all -1
                const proposalSection = row.slice(0, numPlayers);
                const allNegativeOneProposal = proposalSection.every(val => val === -1);
                if (!allNegativeOneProposal) {
                    return { valid: false, error: `Eliminated player must have -1 in all proposal positions, got: [${proposalSection.join(',')}]` };
                }
                
                // Check that vote request section is all -1
                const requestSection = row.slice(numPlayers * 2, numPlayers * 3);
                const allNegativeOneRequest = requestSection.every(val => val === -1);
                if (!allNegativeOneRequest) {
                    return { valid: false, error: `Eliminated player must have -1 in all vote request positions, got: [${requestSection.join(',')}]` };
                }
                
                // Validate voting section still needs to sum to 100
                const voteSection = row.slice(numPlayers, numPlayers * 2);
                const voteSum = voteSection.reduce((sum, val) => sum + val, 0);
                
                if (voteSum === 0) {
                    return { valid: false, error: `Eliminated player vote allocation cannot be all zeros - you must still allocate your 100% of votes` };
                }
                
                if (Math.abs(voteSum - 100) > TOLERANCE) {
                    return { valid: false, error: `Eliminated player vote allocation section sums to ${voteSum}%, not 100% (tolerance: ±${TOLERANCE}%)` };
                }
                
                // Additional validation: eliminated players should not vote for themselves
                const selfVote = voteSection[playerIndex];
                if (selfVote > 0) {
                    return { valid: false, error: `Eliminated player cannot vote for themselves (position ${playerIndex}). Your proposal is dead, allocate votes to active players only.` };
                }
                
                // Range validation for eliminated players
                for (let i = 0; i < row.length; i++) {
                    if (i < numPlayers || i >= numPlayers * 2) {
                        // Proposal section (0 to numPlayers-1) and request section (numPlayers*2 to numPlayers*3-1) must be -1
                        if (row[i] !== -1) {
                            return { valid: false, error: `Eliminated player position ${i} must be -1, got ${row[i]}` };
                        }
                    } else {
                        // Vote allocation section (numPlayers to numPlayers*2-1) should be 0-100
                        if (row[i] < 0 || row[i] > 100) {
                            return { valid: false, error: `Eliminated player vote value ${row[i]} at position ${i} out of range 0 to 100` };
                        }
                    }
                }
                
                return { valid: true };
            }
            
            // Validation for active players
            // Validate proposal section (token percentages)
            const proposalSum = row.slice(0, numPlayers).reduce((sum, val) => sum + val, 0);
            if (Math.abs(proposalSum - 100) > TOLERANCE) {
                return { valid: false, error: `Token proposal section sums to ${proposalSum}%, not 100% (tolerance: ±${TOLERANCE}%)` };
            }
            
            // Validate self-allocation (tokens)
            const selfAllocation = row[playerIndex];
            const minBreakEven = 10;
                if (selfAllocation < minBreakEven) {
                    return { 
                        valid: false, 
                        error: `Self token allocation ${selfAllocation}% is below minimum (need ≥${minBreakEven}%)` 
                    };
            }
            
            // Validate voting section (vote percentages)
            const voteSection = row.slice(numPlayers, numPlayers * 2);
            const voteSum = voteSection.reduce((sum, val) => sum + val, 0);
            
            if (voteSum === 0) {
                return { valid: false, error: `Vote allocation cannot be all zeros - you must allocate your 100% of votes` };
            }
            
            if (Math.abs(voteSum - 100) > TOLERANCE) {
                return { valid: false, error: `Vote allocation section sums to ${voteSum}%, not 100% (tolerance: ±${TOLERANCE}%)` };
            }
            
            // Range validation for active players
            for (let i = 0; i < row.length; i++) {
                if (row[i] < 0 || row[i] > 100) {
                    return { valid: false, error: `Value ${row[i]} at position ${i} out of range 0 to 100` };
                }
            }
            
            return { valid: true };
            
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    updatePlayerRow(playerIndex, newRowData, explanation, roundNumber) {
        if (playerIndex < 0 || playerIndex >= this.negotiationMatrix.length) {
            throw new Error(`Invalid player index: ${playerIndex}`);
        }
        
        const playerRow = this.negotiationMatrix[playerIndex];
        
        if (playerRow.playerId !== this.players[playerIndex].id) {
            throw new Error(`Player ${this.players[playerIndex].name} attempted to modify row belonging to ${playerRow.playerName}`);
        }
        
        playerRow.data = newRowData;
        playerRow.lastModified = new Date().toISOString();
        playerRow.modificationCount += 1;
        
        this.playerExplanations[playerIndex].push({
            round: roundNumber,
            explanation: explanation,
            timestamp: new Date().toISOString(),
            matrixSnapshot: [...newRowData]
        });
        
        this.log.normal(`🔒 [${playerRow.playerName}] Row ${playerIndex} updated (mod #${playerRow.modificationCount})`);
    }

    logViolation(playerIndex, violationType, details, roundNumber) {
        const violation = {
            playerIndex,
            playerName: this.players[playerIndex].name,
            violationType,
            details,
            roundNumber,
            timestamp: new Date().toISOString()
        };
        
        this.violationLog.push(violation);
        this.log.normal(`🚨 VIOLATION: ${violation.playerName} - ${violationType}: ${details}`);
    }

    getMatrix() {
        return this.negotiationMatrix.map(rowObj => rowObj.data);
    }

    displayResults() {
        this.log.normal('\n📊 ENHANCED MATRIX SYSTEM RESULTS');
        this.log.normal('=================================');
        
        // Show LLM interaction summary
        this.log.normal('\n📝 LLM INTERACTION SUMMARY:');
        this.log.normal(`Total LLM calls: ${this.llmInteractions.length}`);
        this.log.normal(`Log file: ${this.logFile}`);
        
        const successfulCalls = this.llmInteractions.filter(i => i.success).length;
        const correctedCalls = this.llmInteractions.filter(i => i.corrected).length;
        const failedCalls = this.llmInteractions.filter(i => !i.success).length;
        
        this.log.normal(`Successful calls: ${successfulCalls}`);
        this.log.normal(`Auto-corrected calls: ${correctedCalls}`);
        this.log.normal(`Failed calls: ${failedCalls}`);
        
        if (this.llmInteractions.length > 0) {
            const validInteractions = this.llmInteractions.filter(i => !i.corrected);
            if (validInteractions.length > 0) {
                const avgPromptLength = validInteractions.reduce((sum, i) => sum + i.promptLength, 0) / validInteractions.length;
                const avgResponseLength = validInteractions.reduce((sum, i) => sum + i.responseLength, 0) / validInteractions.length;
            this.log.normal(`Average prompt length: ${avgPromptLength.toFixed(0)} chars`);
            this.log.normal(`Average response length: ${avgResponseLength.toFixed(0)} chars`);
            }
        }
        
        // Show enhanced matrix state
        this.log.normal('\nENHANCED MATRIX STATE (3 sections):');
        this.negotiationMatrix.forEach((rowObj, idx) => {
            const data = rowObj.data;
            const numPlayers = this.players.length;
            const proposal = data.slice(0, numPlayers);
            const votes = data.slice(numPlayers, numPlayers * 2);
            const requests = data.slice(numPlayers * 2, numPlayers * 3);
            
            this.log.normal(`Row ${idx} (${rowObj.playerName}):`);
            this.log.normal(`  💰 Token Proposal: [${proposal.join(',')}%] (sum: ${proposal.reduce((a,b) => a+b, 0)}%)`);
            this.log.normal(`  🗳️ Vote Allocation: [${votes.join(',')}%] (sum: ${votes.reduce((a,b) => a+b, 0)}%)`);
            this.log.normal(`  📞 Vote Requests: [${requests.join(',')}] votes`);
            this.log.normal(`  🔧 Modifications: ${rowObj.modificationCount}`);
            this.log.normal('');
        });
        
        // Show strategic evolution
        this.log.normal('STRATEGIC EVOLUTION:');
        this.strategicHistory.forEach((history, playerIndex) => {
            const playerName = this.players[playerIndex].name;
            this.log.normal(`\n${playerName} Strategic Development:`);
            history.forEach(entry => {
                this.log.normal(`  Round ${entry.round}: "${entry.explanation.substring(0, 200)}..."`);
            });
        });
        
        // Show violations
        if (this.violationLog.length > 0) {
            this.log.normal('\nVIOLATIONS:');
            this.violationLog.forEach(v => {
                this.log.normal(`  ${v.playerName}: ${v.violationType} - ${v.details}`);
            });
        } else {
            this.log.normal('\n✅ NO VIOLATIONS DETECTED');
        }
        
        // Summary stats
        const totalMods = this.negotiationMatrix.reduce((sum, row) => sum + row.modificationCount, 0);
        const totalExplanations = this.playerExplanations.reduce((sum, exps) => sum + exps.length, 0);
        const totalViolations = this.violationLog.length;
        
        this.log.normal('\nSUMMARY:');
        this.log.normal(`Matrix format: 3-section unified (${this.players.length * 3} numbers per player)`);
        this.log.normal(`Matrix modifications: ${totalMods}`);
        this.log.normal(`Strategic explanations: ${totalExplanations}`);
        this.log.normal(`Violations: ${totalViolations}`);
        this.log.normal(`Auto-corrections: ${correctedCalls}`);
        this.log.normal(`LLM success rate: ${((successfulCalls / this.llmInteractions.filter(i => !i.corrected).length) * 100).toFixed(1)}%`);
        this.log.normal(`Matrix update success rate: ${((totalMods / (this.players.length * 2)) * 100).toFixed(1)}%`);
        
        return {
            matrix: this.getMatrix(),
            explanations: this.playerExplanations,
            strategicHistory: this.strategicHistory,
            violations: this.violationLog,
            llmInteractions: this.llmInteractions,
            logFile: this.logFile,
            totalMods,
            totalExplanations,
            totalViolations,
            correctedCalls,
            llmSuccessRate: (successfulCalls / this.llmInteractions.filter(i => !i.corrected).length) * 100
        };
    }

    printCurrentMatrixState() {
        this.log.normal(this.formatDetailedMatrixState());
    }
}

module.exports = { ImprovedMatrixSystem }; 