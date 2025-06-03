/**
 * Enhanced Agent Invoker with Vote Trading & Trust Tracking
 * Integrates concrete negotiation commitments with existing evolution system
 */

const { callLLM } = require('./llmApi');
const { EnhancedNegotiationSystem } = require('./enhancedNegotiationFramework');

class EnhancedAgentInvoker {
    constructor() {
        this.negotiationSystem = new EnhancedNegotiationSystem();
        this.gameHistory = {
            votingRounds: [],
            proposalRounds: [],
            negotiationRounds: []
        };
    }

    // Enhanced negotiation with explicit vote trading
    async generateNegotiation(playerName, gameHistory, negotiationHistory, strategy) {
        try {
            // Build enhanced game state with historical data
            const enhancedGameState = {
                players: Object.keys(gameHistory.players || {}),
                previousVoting: this.gameHistory.votingRounds,
                previousProposals: this.gameHistory.proposalRounds,
                playerStrategy: strategy
            };

            // Generate enhanced prompt with vote trading mechanics
            const enhancedPrompt = this.negotiationSystem.generateNegotiationPrompt(
                playerName, 
                enhancedGameState, 
                negotiationHistory.length + 1
            );

            console.log(`🗣️ [${playerName}] Enhanced negotiation prompt generated`);
            
            // Get LLM response with concrete vote commitments
            const response = await callLLM(enhancedPrompt, { 
                temperature: 0.8,
                max_tokens: 200 
            });

            // Parse and track commitments for trust scoring
            const commitments = this.negotiationSystem.parseNegotiationForCommitments(playerName, response);
            
            // Record vote commitments made during negotiation
            commitments.forEach(commitment => {
                this.negotiationSystem.recordVoteCommitment(
                    playerName, 
                    commitment.targetPlayer || 'unknown', 
                    commitment.condition || `${commitment.type} commitment`,
                    commitment.offeredVotes || 0
                );
                
                // Store the full commitment details for voting prompt
                const key = `${playerName}->${commitment.targetPlayer || 'unknown'}`;
                this.negotiationSystem.voteCommitments.set(key, {
                    type: commitment.type,
                    condition: commitment.condition,
                    offeredVotes: commitment.offeredVotes,
                    requiredAllocation: commitment.requiredAllocation,
                    round: this.negotiationSystem.getCurrentRound(),
                    fulfilled: null
                });
            });

            console.log(`💬 [${playerName}] Made ${commitments.length} explicit vote commitments`);
            
            return response.trim();

        } catch (error) {
            console.error(`❌ Enhanced negotiation failed for ${playerName}:`, error.message);
            
            // Fallback to simple negotiation
            return this.generateSimpleNegotiation(playerName, strategy);
        }
    }

    // Enhanced proposal generation with negotiation context
    async generateProposal(playerName, gameHistory, negotiationHistory, strategy) {
        try {
            const commitments = this.negotiationSystem.getCommitmentsToPlayer(playerName);
            const players = Object.keys(gameHistory.players || {});
            
            const prompt = `
🏛️ PROPOSAL GENERATION - Honor Negotiations

🎯 PLAYER: ${playerName}
📊 STRATEGY: ${strategy}

🤝 COMMITMENTS RECEIVED FROM NEGOTIATIONS:
${commitments.length > 0 ? 
    commitments.map(c => `- ${c.player}: ${c.description}`).join('\n') : 
    'No explicit commitments received'
}

🏦 ECONOMIC REALITY:
- Total pool: 600 tokens
- Players: ${players.join(', ')}
- You need majority votes (301+) to win

💡 PROPOSAL STRATEGY:
- Honor vote commitments where beneficial
- Balance immediate gains vs long-term trust
- Consider coalition mathematics
- Account for negotiation promises made

Generate a proposal allocation (percentages must sum to 100):
${players.map(p => `"${p}": X`).join(', ')}

Response format: {"player1": X, "player2": Y, ...}`;

            const response = await callLLM(prompt, { 
                temperature: 0.7,
                max_tokens: 150 
            });

            return this.parseProposal(response, players);

        } catch (error) {
            console.error(`❌ Enhanced proposal failed for ${playerName}:`, error.message);
            return this.generateFallbackProposal(Object.keys(gameHistory.players || {}));
        }
    }

    // Enhanced voting with commitment tracking
    async generateVote(playerName, proposals, gameHistory, strategy) {
        try {
            const enhancedPrompt = this.negotiationSystem.generateVotingPrompt(
                playerName, 
                proposals, 
                { strategy, gameHistory }
            );

            console.log(`🗳️ [${playerName}] Voting with commitment tracking`);
            
            const response = await callLLM(enhancedPrompt, { 
                temperature: 0.6,
                max_tokens: 100 
            });

            const parsedVote = this.parseVote(response, Object.keys(proposals));
            
            // Store vote for later commitment evaluation
            if (!this.currentRoundVotes) {
                this.currentRoundVotes = {};
            }
            this.currentRoundVotes[playerName] = parsedVote;
            
            return parsedVote;

        } catch (error) {
            console.error(`❌ Enhanced voting failed for ${playerName}:`, error.message);
            return this.generateFallbackVote(Object.keys(proposals));
        }
    }

    // Evaluate commitments after voting round completes
    evaluateRoundCommitments(proposals) {
        if (this.currentRoundVotes && Object.keys(this.currentRoundVotes).length > 0) {
            console.log('⚖️ Evaluating vote commitments and updating trust scores...');
            
            this.negotiationSystem.evaluateCommitments(this.currentRoundVotes, proposals);
            
            // Store round data for historical analysis
            this.gameHistory.votingRounds.push(this.currentRoundVotes);
            this.gameHistory.proposalRounds.push(proposals);
            
            // Reset for next round
            this.currentRoundVotes = {};
        }
    }

    // Fallback methods for error cases
    generateSimpleNegotiation(playerName, strategy) {
        const simpleMessages = [
            "Let's form a strategic alliance for mutual benefit.",
            "I propose we work together to maximize our shared returns.",
            "Consider my proposal - I offer fair terms for cooperation.",
            "Building trust through consistent fair dealing is my priority."
        ];
        
        return simpleMessages[Math.floor(Math.random() * simpleMessages.length)];
    }

    generateFallbackProposal(players) {
        const proposal = {};
        const baseShare = Math.floor(100 / players.length);
        let remaining = 100;
        
        players.forEach((player, index) => {
            if (index === players.length - 1) {
                proposal[player] = remaining;
            } else {
                proposal[player] = baseShare;
                remaining -= baseShare;
            }
        });
        
        return proposal;
    }

    generateFallbackVote(players) {
        const votes = {};
        const voteShare = Math.floor(100 / players.length);
        let remaining = 100;
        
        players.forEach((player, index) => {
            if (index === players.length - 1) {
                votes[player] = remaining;
            } else {
                votes[player] = voteShare;
                remaining -= voteShare;
            }
        });
        
        return votes;
    }

    // Utility methods
    parseProposal(response, players) {
        try {
            const cleaned = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            
            // Ensure all players are included and sum to 100
            const proposal = {};
            let total = 0;
            
            players.forEach(player => {
                proposal[player] = parsed[player] || 0;
                total += proposal[player];
            });
            
            // Normalize to 100 if needed
            if (total !== 100) {
                const factor = 100 / total;
                players.forEach(player => {
                    proposal[player] = Math.round(proposal[player] * factor);
                });
            }
            
            return proposal;
            
        } catch (error) {
            console.log(`⚠️ Proposal parsing failed, using fallback`);
            return this.generateFallbackProposal(players);
        }
    }

    parseVote(response, players) {
        console.log(`🔍 [DEBUG] Parsing vote response: "${response.substring(0, 200)}..."`);
        
        try {
            // Try multiple parsing strategies
            let jsonMatch = null;
            
            // Strategy 1: Look for JSON object in response
            const jsonPattern = /\{[^}]*\}/;
            const match = response.match(jsonPattern);
            if (match) {
                jsonMatch = match[0];
            } else {
                // Strategy 2: Clean the response and try to parse
                jsonMatch = response.replace(/```json|```|Your vote allocation:|Vote allocation:/g, '').trim();
            }
            
            console.log(`🔍 [DEBUG] Extracted JSON: "${jsonMatch}"`);
            
            const parsed = JSON.parse(jsonMatch);
            console.log(`🔍 [DEBUG] Parsed object:`, parsed);
            
            // Strategy 3: Flexible player name matching
            const votes = {};
            let total = 0;
            
            players.forEach(player => {
                // Try exact match first
                let voteAmount = parsed[player];
                
                // If no exact match, try partial matching
                if (voteAmount === undefined) {
                    const possibleKeys = Object.keys(parsed).filter(key => 
                        key.toLowerCase().includes(player.toLowerCase()) || 
                        player.toLowerCase().includes(key.toLowerCase())
                    );
                    
                    if (possibleKeys.length > 0) {
                        voteAmount = parsed[possibleKeys[0]];
                        console.log(`🔍 [DEBUG] Matched "${player}" to "${possibleKeys[0]}": ${voteAmount}`);
                    }
                }
                
                votes[player] = voteAmount || 0;
                total += votes[player];
            });
            
            console.log(`🔍 [DEBUG] Before normalization:`, votes, `Total: ${total}`);
            
            // Normalize to 100 if needed
            if (total !== 100 && total > 0) {
                const factor = 100 / total;
                players.forEach(player => {
                    votes[player] = Math.round(votes[player] * factor);
                });
                console.log(`🔍 [DEBUG] After normalization:`, votes);
            }
            
            // ENFORCEMENT: Apply promise-breaking penalties
            const penalizedVotes = this.enforcePromisePenalties(votes, players);
            
            // Final validation
            const finalTotal = Object.values(penalizedVotes).reduce((sum, v) => sum + v, 0);
            if (finalTotal <= 100) {
                console.log(`✅ [DEBUG] Vote parsing successful (after penalties):`, penalizedVotes);
                return penalizedVotes;
            } else {
                throw new Error(`Vote total ${finalTotal} > 100 after penalties`);
            }
            
        } catch (error) {
            console.log(`⚠️ Vote parsing failed: ${error.message}`);
            console.log(`⚠️ Original response: "${response}"`);
            console.log(`⚠️ Players expected: [${players.join(', ')}]`);
            return this.generateFallbackVote(players);
        }
    }

    // Enforce promise-breaking penalties
    enforcePromisePenalties(votes, players) {
        // Count how many promises each player broke
        const penalties = this.calculatePromisePenalties();
        
        // Apply penalties by reducing vote power
        const penalizedVotes = { ...votes };
        let totalPenalty = 0;
        
        players.forEach(player => {
            const penalty = penalties[player] || 0;
            if (penalty > 0) {
                const reduction = Math.min(penalty * 10, 50); // Max 50% reduction
                const oldVotes = penalizedVotes[player];
                penalizedVotes[player] = Math.max(0, oldVotes - reduction);
                totalPenalty += (oldVotes - penalizedVotes[player]);
                console.log(`⚡ [PENALTY] ${player}: ${penalty} broken promises = -${reduction} votes (${oldVotes} → ${penalizedVotes[player]})`);
            }
        });
        
        // Redistribute penalty votes to promise-keepers
        if (totalPenalty > 0) {
            const honorableVoters = players.filter(p => (penalties[p] || 0) === 0);
            if (honorableVoters.length > 0) {
                const bonus = Math.floor(totalPenalty / honorableVoters.length);
                honorableVoters.forEach(player => {
                    penalizedVotes[player] += bonus;
                    console.log(`🏆 [BONUS] ${player}: +${bonus} votes for keeping promises`);
                });
            }
        }
        
        return penalizedVotes;
    }

    // Calculate promise penalties for each player
    calculatePromisePenalties() {
        const penalties = {};
        
        // Access the negotiation system's commitment tracking
        this.negotiationSystem.voteCommitments.forEach((commitment, key) => {
            const [fromPlayer, toPlayer] = key.split('->');
            
            // Check if this commitment was broken
            if (commitment.fulfilled === false) {
                penalties[fromPlayer] = (penalties[fromPlayer] || 0) + 1;
            }
        });
        
        return penalties;
    }

    // Get trust analytics for reporting
    getTrustAnalytics() {
        return {
            commitmentsFulfilled: this.negotiationSystem.voteCommitments.size,
            trustScores: Object.fromEntries(this.negotiationSystem.trustScores),
            gameHistory: this.gameHistory
        };
    }

    // Reset for new game
    resetForNewGame() {
        this.negotiationSystem = new EnhancedNegotiationSystem();
        this.gameHistory = {
            votingRounds: [],
            proposalRounds: [],
            negotiationRounds: []
        };
        this.currentRoundVotes = {};
    }
}

module.exports = { EnhancedAgentInvoker }; 