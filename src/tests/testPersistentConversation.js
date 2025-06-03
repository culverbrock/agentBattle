/**
 * Test Persistent Conversation Approach
 * Each player maintains a single conversation thread across all phases
 * instead of separate API calls for each phase
 */

const { callLLM } = require('../core/llmApi');

class PersistentConversationGame {
    constructor() {
        this.playerConversations = new Map(); // Track conversation history for each player
    }

    async runPersistentGame() {
        console.log('🧵 TESTING PERSISTENT CONVERSATION THREADS');
        console.log('==========================================');

        const players = ['Alice', 'Bob', 'Charlie'];
        const strategies = {
            'Alice': 'Form strategic alliances and honor commitments',
            'Bob': 'Maximize personal gain through negotiation', 
            'Charlie': 'Balance cooperation with self-interest'
        };

        // Initialize conversation for each player
        for (const player of players) {
            this.playerConversations.set(player, [
                {
                    role: 'system',
                    content: `You are ${player}. Strategy: ${strategies[player]}. 
                             Remember everything you say and do throughout this game.
                             Players: ${players.join(', ')}
                             Goal: Win 600 token pool with majority votes (301+)`
                }
            ]);
        }

        // Phase 1: Negotiations (each player adds to their conversation)
        console.log('\n🗣️ PHASE 1: NEGOTIATIONS');
        console.log('=========================');
        
        const negotiations = {};
        for (const player of players) {
            const otherPlayers = players.filter(p => p !== player);
            
            // Add negotiation prompt to this player's conversation
            const negotiationMessage = {
                role: 'user',
                content: `NEGOTIATION PHASE: Make specific promises/demands to other players.
                
                Address each player separately:
                ${otherPlayers.map(p => `${p}: [your specific offer/demand]`).join('\n')}
                
                Be concrete: "I'll give you X votes if you give me Y%"`
            };
            
            this.playerConversations.get(player).push(negotiationMessage);
            
            // Get response within this conversation context
            const response = await this.continueConversation(player);
            negotiations[player] = response;
            
            console.log(`💬 ${player}: "${response}"`);
        }

        // Phase 2: Proposals (continue same conversations)
        console.log('\n📝 PHASE 2: PROPOSALS');
        console.log('=====================');
        
        const proposals = {};
        for (const player of players) {
            // Add proposal prompt to existing conversation
            const proposalMessage = {
                role: 'user',
                content: `PROPOSAL PHASE: Based on your negotiations above, create your allocation proposal.
                
                Remember what you promised! Honor your commitments.
                
                Respond with JSON: {"Alice": X, "Bob": Y, "Charlie": Z}
                Percentages must sum to 100.`
            };
            
            this.playerConversations.get(player).push(proposalMessage);
            
            const response = await this.continueConversation(player);
            proposals[player] = this.parseProposal(response, players);
            
            console.log(`📋 ${player}'s Proposal:`, proposals[player]);
        }

        // Phase 3: Voting (continue same conversations)
        console.log('\n🗳️ PHASE 3: VOTING');
        console.log('==================');
        
        const votes = {};
        for (const player of players) {
            // Show all proposals to this player
            const proposalSummary = Object.entries(proposals)
                .map(([proposer, allocation]) => 
                    `${proposer}: Gives you ${allocation[player] || 0}%`)
                .join('\n');
            
            // Add voting prompt to existing conversation  
            const votingMessage = {
                role: 'user',
                content: `VOTING PHASE: Time to vote based on everything above.
                
                PROPOSALS:
                ${proposalSummary}
                
                CRITICAL: Look back at your negotiations. Did others honor your demands? 
                Do you need to honor your promises?
                
                Distribute 100 votes: {"Alice": X, "Bob": Y, "Charlie": Z}`
            };
            
            this.playerConversations.get(player).push(votingMessage);
            
            const response = await this.continueConversation(player);
            votes[player] = this.parseVote(response, players);
            
            console.log(`🗳️ ${player}'s Votes:`, votes[player]);
        }

        // Analyze results
        this.analyzeResults(negotiations, proposals, votes, players);
    }

    async continueConversation(playerName) {
        const conversation = this.playerConversations.get(playerName);
        
        // Call LLM with full conversation history
        const response = await callLLM('', { 
            temperature: 0.7,
            messages: conversation  // Pass full conversation
        });
        
        // Add response to conversation history
        conversation.push({
            role: 'assistant', 
            content: response
        });
        
        return response;
    }

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
                    players.forEach(player => {
                        proposal[player] = Math.round((proposal[player] / total) * 100);
                    });
                }
                
                return proposal;
            }
        } catch (error) {
            console.log(`⚠️ Proposal parsing failed: ${error.message}`);
        }
        
        // Fallback
        const equal = Math.floor(100 / players.length);
        const proposal = {};
        players.forEach(player => proposal[player] = equal);
        return proposal;
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
                    players.forEach(player => {
                        votes[player] = Math.round((votes[player] / total) * 100);
                    });
                }
                
                return votes;
            }
        } catch (error) {
            console.log(`⚠️ Vote parsing failed: ${error.message}`);
        }
        
        // Fallback
        const equal = Math.floor(100 / players.length);
        const votes = {};
        players.forEach(player => votes[player] = equal);
        return votes;
    }

    analyzeResults(negotiations, proposals, votes, players) {
        console.log('\n📊 PERSISTENT CONVERSATION ANALYSIS');
        console.log('===================================');
        
        // Analyze promise keeping
        players.forEach(player => {
            console.log(`\n🔍 ${player}'s Consistency:`);
            console.log(`   Negotiation: "${negotiations[player].substring(0, 100)}..."`);
            
            const myProposal = proposals[player];
            const myVotes = votes[player];
            
            console.log(`   Proposal: ${JSON.stringify(myProposal)}`);
            console.log(`   Votes: ${JSON.stringify(myVotes)}`);
            
            // Simple consistency check
            const promisedAlliances = negotiations[player].toLowerCase().includes('alliance') || 
                                    negotiations[player].toLowerCase().includes('together');
            const votedForAllies = Object.values(myVotes).some(v => v > 40);
            
            console.log(`   Promised alliances: ${promisedAlliances}`);
            console.log(`   Voted for allies: ${votedForAllies}`);
            console.log(`   Consistency: ${promisedAlliances === votedForAllies ? '✅ CONSISTENT' : '❌ INCONSISTENT'}`);
        });

        // Calculate final results
        const voteTotals = {};
        players.forEach(player => voteTotals[player] = 0);
        
        Object.values(votes).forEach(voterAllocation => {
            Object.entries(voterAllocation).forEach(([recipient, voteCount]) => {
                voteTotals[recipient] += voteCount;
            });
        });

        console.log('\n🏆 FINAL RESULTS:');
        Object.entries(voteTotals)
            .sort(([,a], [,b]) => b - a)
            .forEach(([player, total]) => {
                const status = total >= 151 ? '🏆 WINNER' : '❌ LOST'; // Majority of 300 total votes
                console.log(`   ${player}: ${total} votes ${status}`);
            });
    }
}

// Run the test
async function runTest() {
    const game = new PersistentConversationGame();
    await game.runPersistentGame();
}

runTest().catch(console.error); 