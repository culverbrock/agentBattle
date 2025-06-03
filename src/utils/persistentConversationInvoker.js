/**
 * Persistent Conversation Agent Invoker
 * Each player maintains a single conversation thread across all game phases
 * for better identity persistence and promise-keeping
 */

const { callLLM } = require('../core/llmApi');

class PersistentConversationInvoker {
    constructor() {
        this.playerConversations = new Map();
        this.gameHistory = {
            votingRounds: [],
            proposalRounds: [],
            negotiationRounds: []
        };
    }

    // Initialize a persistent conversation for a player
    initializePlayer(playerName, strategy, gameContext = {}) {
        const { players = [], round = 1 } = gameContext;
        
        // Check if player already has a conversation
        const existingConversation = this.playerConversations.get(playerName);
        let conversationCount = 1;
        
        if (existingConversation) {
            // Count previous games by looking for game start markers
            conversationCount = existingConversation.filter(msg => 
                msg.role === 'system' || (msg.role === 'user' && msg.content.includes('NEW GAME'))
            ).length + 1;
        }
        
        // Start fresh conversation for this game but note experience
        this.playerConversations.set(playerName, [
            {
                role: 'system',
                content: `You are ${playerName} in a strategic negotiation game.

STRATEGY: ${strategy}

GAME RULES:
- 600 token pool, need 301+ votes to win
- Each player controls 100 votes
- Players: ${players.join(', ')}
- This is GAME ${round} for you${conversationCount > 1 ? ` (you've played ${conversationCount-1} games before)` : ''}

PERSONALITY: Stay true to your strategy and remember everything you say in THIS game. Honor your commitments when possible, but adapt to betrayals. ${conversationCount > 1 ? 'Use your experience from previous games to make better decisions.' : ''}`
            },
            {
                role: 'user', 
                content: `NEW GAME STARTING - Game ${round}

You're starting a fresh negotiation game. Remember your strategy and be consistent throughout this game.`
            }
        ]);
    }

    // Enhanced negotiation with persistent memory
    async generateNegotiation(playerName, gameHistory, negotiationHistory, strategy) {
        try {
            // Initialize if this is the first call for this player
            if (!this.playerConversations.has(playerName)) {
                this.initializePlayer(playerName, strategy, {
                    players: Object.keys(gameHistory.players || {}),
                    round: (negotiationHistory.length || 0) + 1
                });
            }

            const players = Object.keys(gameHistory.players || {});
            const otherPlayers = players.filter(p => p !== playerName);
            
            // Add negotiation prompt to conversation
            const negotiationMessage = {
                role: 'user',
                content: `ROUND ${(negotiationHistory.length || 0) + 1} NEGOTIATION PHASE

Make specific promises/demands to other players. Address each separately:

${otherPlayers.map(player => `${player}: [your specific offer/demand]`).join('\n')}

Be concrete with numbers: "I'll give you X votes if you give me Y%"
Remember: Others will see your promises and judge you on keeping them.`
            };

            this.playerConversations.get(playerName).push(negotiationMessage);
            
            const response = await this.continuePlayerConversation(playerName);
            
            console.log(`🗣️ [${playerName}] Persistent negotiation generated`);
            return response.trim();

        } catch (error) {
            console.error(`❌ Persistent negotiation failed for ${playerName}:`, error.message);
            return this.generateSimpleNegotiation(playerName, strategy);
        }
    }

    // Enhanced proposal generation with memory of negotiations
    async generateProposal(playerName, gameHistory, negotiationHistory, strategy) {
        try {
            if (!this.playerConversations.has(playerName)) {
                this.initializePlayer(playerName, strategy, {
                    players: Object.keys(gameHistory.players || {})
                });
            }

            const players = Object.keys(gameHistory.players || {});
            
            const proposalMessage = {
                role: 'user',
                content: `PROPOSAL PHASE

Based on your negotiations above, create your token allocation proposal.

CRITICAL: Remember what you promised! Others will judge your proposal based on your commitments.

Respond with JSON only: {"${players.join('": X, "')}"}: X}
Percentages must sum to exactly 100.

Your proposal:`
            };

            this.playerConversations.get(playerName).push(proposalMessage);
            
            const response = await this.continuePlayerConversation(playerName);
            return this.parseProposal(response, players);

        } catch (error) {
            console.error(`❌ Persistent proposal failed for ${playerName}:`, error.message);
            return this.generateFallbackProposal(Object.keys(gameHistory.players || {}));
        }
    }

    // Enhanced voting with full context memory
    async generateVote(playerName, proposals, gameHistory, strategy) {
        try {
            if (!this.playerConversations.has(playerName)) {
                this.initializePlayer(playerName, strategy, {
                    players: Object.keys(proposals)
                });
            }

            const players = Object.keys(proposals);
            
            // Show all proposals
            const proposalSummary = Object.entries(proposals)
                .map(([proposer, allocation]) => 
                    `${proposer}: Gives you ${allocation[playerName] || 0}%`)
                .join('\n');

            const votingMessage = {
                role: 'user',
                content: `VOTING PHASE

Review your negotiations above. Time to vote based on everything you've said and done.

PROPOSALS:
${proposalSummary}

CRITICAL QUESTIONS:
- Who honored your demands from negotiations?
- Do you need to honor your own promises?
- Who betrayed you vs who kept faith?

Distribute 100 votes: {"${players.join('": X, "')}"}: X}
Must sum to exactly 100.

Your votes:`
            };

            this.playerConversations.get(playerName).push(votingMessage);
            
            const response = await this.continuePlayerConversation(playerName);
            const parsedVote = this.parseVote(response, players);
            
            console.log(`🗳️ [${playerName}] Persistent voting completed`);
            return parsedVote;

        } catch (error) {
            console.error(`❌ Persistent voting failed for ${playerName}:`, error.message);
            return this.generateFallbackVote(Object.keys(proposals));
        }
    }

    // Continue a player's conversation thread
    async continuePlayerConversation(playerName) {
        const conversation = this.playerConversations.get(playerName);
        
        if (!conversation) {
            throw new Error(`No conversation found for ${playerName}`);
        }
        
        // Call LLM with full conversation history
        const response = await callLLM('', { 
            temperature: 0.7,
            max_tokens: 200,
            messages: conversation
        });
        
        // Add response to conversation history
        conversation.push({
            role: 'assistant', 
            content: response
        });
        
        return response;
    }

    // Get conversation history for debugging
    getConversationHistory(playerName) {
        return this.playerConversations.get(playerName) || [];
    }

    // Reset for new game while preserving learned patterns
    resetForNewGame() {
        // Keep conversation insights but start fresh
        this.gameHistory = {
            votingRounds: [],
            proposalRounds: [],
            negotiationRounds: []
        };
        
        // Don't clear conversations - let players remember across games
        // This could lead to interesting multi-game strategies
    }

    // Utility methods
    parseProposal(response, players) {
        try {
            const jsonMatch = response.match(/\{[^}]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const proposal = {};
                let total = 0;
                
                players.forEach(player => {
                    proposal[player] = parsed[player] || 0;
                    total += proposal[player];
                });
                
                // Normalize to 100
                if (total !== 100 && total > 0) {
                    const factor = 100 / total;
                    players.forEach(player => {
                        proposal[player] = Math.round(proposal[player] * factor);
                    });
                }
                
                return proposal;
            }
        } catch (error) {
            console.log(`⚠️ Proposal parsing failed: ${error.message}`);
        }
        
        return this.generateFallbackProposal(players);
    }

    parseVote(response, players) {
        try {
            const jsonMatch = response.match(/\{[^}]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const votes = {};
                let total = 0;
                
                players.forEach(player => {
                    votes[player] = parsed[player] || 0;
                    total += votes[player];
                });
                
                // Normalize to 100
                if (total !== 100 && total > 0) {
                    const factor = 100 / total;
                    players.forEach(player => {
                        votes[player] = Math.round(votes[player] * factor);
                    });
                }
                
                return votes;
            }
        } catch (error) {
            console.log(`⚠️ Vote parsing failed: ${error.message}`);
        }
        
        return this.generateFallbackVote(players);
    }

    // Fallback methods
    generateSimpleNegotiation(playerName, strategy) {
        return "Let's work together for mutual benefit with fair token distribution.";
    }

    generateFallbackProposal(players) {
        const proposal = {};
        const share = Math.floor(100 / players.length);
        let remaining = 100;
        
        players.forEach((player, index) => {
            if (index === players.length - 1) {
                proposal[player] = remaining;
            } else {
                proposal[player] = share;
                remaining -= share;
            }
        });
        
        return proposal;
    }

    generateFallbackVote(players) {
        const votes = {};
        const share = Math.floor(100 / players.length);
        let remaining = 100;
        
        players.forEach((player, index) => {
            if (index === players.length - 1) {
                votes[player] = remaining;
            } else {
                votes[player] = share;
                remaining -= share;
            }
        });
        
        return votes;
    }
}

module.exports = { PersistentConversationInvoker }; 