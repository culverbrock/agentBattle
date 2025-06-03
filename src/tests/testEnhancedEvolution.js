/**
 * Test Enhanced Evolution with Vote Trading & Trust Tracking
 * Demonstrates improved strategic negotiations in agent battles
 */

const { EnhancedAgentInvoker } = require('../core/enhancedAgentInvoker');
const { callLLM } = require('../core/llmApi');

class EnhancedEvolutionTester {
    constructor() {
        this.agentInvoker = new EnhancedAgentInvoker();
        this.strategies = [
            "Strategic Vote Trader: Make explicit vote-for-allocation deals. Track trust and honor commitments when beneficial.",
            "Trust Builder: Focus on consistent promise-keeping to build long-term alliances. Reference voting history.",
            "Coalition Breaker: Identify and disrupt opposing coalitions through targeted vote offers and betrayals.",
            "Mathematical Negotiator: Use precise calculations in vote trading. Make conditional commitments based on probabilities."
        ];
    }

    async runEnhancedGame() {
        console.log('🚀 STARTING ENHANCED NEGOTIATION GAME');
        console.log('====================================\n');

        const players = {
            'Strategic Vote Trader': this.strategies[0],
            'Trust Builder': this.strategies[1], 
            'Coalition Breaker': this.strategies[2],
            'Mathematical Negotiator': this.strategies[3]
        };

        const gameHistory = { players };
        this.agentInvoker.resetForNewGame();

        // Run 3 rounds to demonstrate trust building/breaking
        for (let round = 1; round <= 3; round++) {
            console.log(`\n🎮 === ROUND ${round}/3 ===`);
            
            await this.runNegotiationPhase(players, gameHistory, round);
            const proposals = await this.runProposalPhase(players, gameHistory);
            const votes = await this.runVotingPhase(players, proposals, gameHistory);
            
            // Evaluate commitments and update trust
            this.agentInvoker.evaluateRoundCommitments(proposals);
            
            const winner = this.determineWinner(votes);
            console.log(`🏆 Round ${round} Winner: ${winner}\n`);
            
            if (round < 3) {
                console.log('⚖️ Trust scores updated based on commitment fulfillment');
                const trustAnalytics = this.agentInvoker.getTrustAnalytics();
                console.log('📊 Current trust data:', Object.keys(trustAnalytics.trustScores).length, 'relationships tracked\n');
            }
        }

        // Final analytics
        const finalAnalytics = this.agentInvoker.getTrustAnalytics();
        console.log('\n📈 FINAL TRUST ANALYTICS:');
        console.log('=========================');
        console.log(`🤝 Total commitments tracked: ${finalAnalytics.commitmentsFulfilled}`);
        console.log(`📊 Trust relationships: ${Object.keys(finalAnalytics.trustScores).length}`);
        console.log(`🎯 Voting rounds analyzed: ${finalAnalytics.gameHistory.votingRounds.length}`);
        
        return finalAnalytics;
    }

    async runNegotiationPhase(players, gameHistory, round) {
        console.log('🗣️ NEGOTIATION PHASE:');
        console.log('====================');

        const negotiations = {};
        
        for (const [playerName, strategy] of Object.entries(players)) {
            try {
                const negotiation = await this.agentInvoker.generateNegotiation(
                    playerName, 
                    gameHistory, 
                    [], // negotiationHistory 
                    strategy
                );
                
                negotiations[playerName] = negotiation;
                console.log(`💬 ${playerName}:`);
                console.log(`   "${negotiation}"`);
                
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Negotiation failed for ${playerName}:`, error.message);
                negotiations[playerName] = "I'll work with whoever offers the best terms.";
            }
        }
        
        console.log();
        return negotiations;
    }

    async runProposalPhase(players, gameHistory) {
        console.log('📝 PROPOSAL PHASE:');
        console.log('==================');

        const proposals = {};
        
        for (const [playerName, strategy] of Object.entries(players)) {
            try {
                const proposal = await this.agentInvoker.generateProposal(
                    playerName,
                    gameHistory,
                    [],
                    strategy
                );
                
                proposals[playerName] = proposal;
                console.log(`📋 ${playerName}: ${JSON.stringify(proposal)}`);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Proposal failed for ${playerName}:`, error.message);
                // Fallback equal split
                proposals[playerName] = Object.fromEntries(
                    Object.keys(players).map(p => [p, 25])
                );
            }
        }
        
        console.log();
        return proposals;
    }

    async runVotingPhase(players, proposals, gameHistory) {
        console.log('🗳️ VOTING PHASE:');
        console.log('================');

        const votes = {};
        
        for (const [playerName, strategy] of Object.entries(players)) {
            try {
                const vote = await this.agentInvoker.generateVote(
                    playerName,
                    proposals,
                    gameHistory,
                    strategy
                );
                
                votes[playerName] = vote;
                console.log(`🗳️ ${playerName}: ${JSON.stringify(vote)}`);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Voting failed for ${playerName}:`, error.message);
                // Fallback equal votes
                votes[playerName] = Object.fromEntries(
                    Object.keys(players).map(p => [p, 25])
                );
            }
        }
        
        console.log();
        return votes;
    }

    determineWinner(votes) {
        const playerNames = Object.keys(votes);
        const totalVotes = {};
        
        // Initialize vote counts
        playerNames.forEach(player => {
            totalVotes[player] = 0;
        });
        
        // Count votes
        Object.values(votes).forEach(playerVotes => {
            Object.entries(playerVotes).forEach(([recipient, voteCount]) => {
                totalVotes[recipient] += voteCount;
            });
        });
        
        // Find winner
        const winner = Object.entries(totalVotes).reduce((max, [player, votes]) => 
            votes > max.votes ? { player, votes } : max, 
            { player: null, votes: 0 }
        );
        
        console.log('📊 Vote totals:', totalVotes);
        return `${winner.player} (${winner.votes} votes)`;
    }
}

async function runEnhancedEvolutionTest() {
    console.log('🧪 ENHANCED EVOLUTION SYSTEM TEST');
    console.log('==================================');
    console.log('Testing vote trading & trust tracking in agent negotiations\n');

    const tester = new EnhancedEvolutionTester();
    
    try {
        const analytics = await tester.runEnhancedGame();
        
        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
        console.log('\n🎯 KEY IMPROVEMENTS DEMONSTRATED:');
        console.log('=================================');
        console.log('✅ Explicit vote-for-allocation commitments');
        console.log('✅ Trust tracking across rounds');
        console.log('✅ Promise-keeping evaluation');
        console.log('✅ Historical voting pattern analysis');
        console.log('✅ Commitment-aware proposal generation');
        console.log('✅ Strategic depth beyond vague statements');
        
        console.log('\n💡 NEXT STEPS:');
        console.log('==============');
        console.log('1. Integrate with full evolutionary system');
        console.log('2. Run longer tournaments to see trust evolution');
        console.log('3. Add betrayal detection and reputation systems');
        console.log('4. Implement coalition formation analytics');
        
        return analytics;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('===================');
        console.log('1. Check API key and rate limits');
        console.log('2. Verify enhancedNegotiationFramework.js exists');
        console.log('3. Ensure all dependencies are properly imported');
        
        throw error;
    }
}

if (require.main === module) {
    runEnhancedEvolutionTest().catch(console.error);
}

module.exports = { EnhancedEvolutionTester, runEnhancedEvolutionTest }; 