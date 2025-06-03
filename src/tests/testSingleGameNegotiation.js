/**
 * Test Single Game Negotiation - See Enhanced System in Action
 * Runs 1 complete round with 6 evolved strategies to analyze negotiation quality
 */

const { EnhancedAgentInvoker } = require('../core/enhancedAgentInvoker');

class SingleGameNegotiationTester {
    constructor() {
        this.agentInvoker = new EnhancedAgentInvoker();
        
        // 6 most recent evolved strategies from the tournament
        this.strategies = {
            'Mathematical Analyzer': 'Make all decisions based on expected value calculations. Minimize risk through probability analysis. Seek stable equilibrium outcomes.',
            'Social Manipulator': 'Use psychological tactics to influence others. Make strategic promises and betrayals. Create chaos to benefit from confusion.',
            'Strategic Equilibrium Mastermind': 'Leverage mathematical calculations for stable proposals. Influence through strategic alliances. Adapt based on game dynamics.',
            'Aggressive Maximizer': 'Demand the largest possible share. Use threats and aggressive tactics. Form coalitions only when absolutely necessary.',
            'Strategic Harmony Architect': 'Balance mathematical analysis with social manipulation. Build stable alliances while maintaining strategic flexibility.',
            'Harmonious Negotiator': 'Combine analytical thinking with relationship building. Seek win-win outcomes through strategic cooperation.'
        };

        this.playerNames = Object.keys(this.strategies);
    }

    async runSingleRound() {
        console.log('🎮 SINGLE GAME NEGOTIATION TEST');
        console.log('================================');
        console.log(`👥 Players: ${this.playerNames.join(', ')}`);
        console.log('💰 Pool: 600 tokens | 🎯 Majority: 301+ votes\n');

        // Phase 1: Negotiations
        console.log('🗣️ PHASE 1: NEGOTIATIONS');
        console.log('========================');
        
        const negotiations = {};
        for (const player of this.playerNames) {
            console.log(`\n📢 ${player} negotiating...`);
            
            const gameHistory = { players: this.strategies };
            const negotiationHistory = [];
            const strategy = this.strategies[player];
            
            try {
                const negotiation = await this.agentInvoker.generateNegotiation(
                    player, gameHistory, negotiationHistory, strategy
                );
                
                negotiations[player] = negotiation;
                console.log(`💬 ${player}:`);
                console.log(`   "${negotiation}"`);
                
                // Show what commitments were extracted
                const commitments = this.agentInvoker.negotiationSystem.parseNegotiationForCommitments(player, negotiation);
                if (commitments.length > 0) {
                    console.log(`🎯 Extracted ${commitments.length} commitments:`);
                    commitments.forEach((c, i) => {
                        console.log(`   ${i+1}. ${c.type}: ${c.fromPlayer} → ${c.targetPlayer}`);
                        if (c.requiredAllocation) console.log(`      Seeking: ${c.requiredAllocation}%`);
                        if (c.offeredVotes) console.log(`      Offering: ${c.offeredVotes} votes`);
                    });
                }
                
            } catch (error) {
                console.log(`❌ ${player} negotiation failed: ${error.message}`);
                negotiations[player] = "Strategic alliance formation.";
            }
        }

        // Phase 2: Proposals  
        console.log('\n\n📝 PHASE 2: PROPOSALS');
        console.log('=====================');
        
        const proposals = {};
        for (const player of this.playerNames) {
            console.log(`\n💼 ${player} creating proposal...`);
            
            try {
                const gameHistory = { players: this.strategies };
                const negotiationHistory = [negotiations];
                const strategy = this.strategies[player];
                
                const proposal = await this.agentInvoker.generateProposal(
                    player, gameHistory, negotiationHistory, strategy
                );
                
                proposals[player] = proposal;
                
                // Display proposal in readable format
                console.log(`📋 ${player}'s Proposal:`);
                Object.entries(proposal).forEach(([recipient, percentage]) => {
                    const tokens = Math.round(percentage * 6);
                    console.log(`   ${recipient}: ${percentage}% (${tokens} tokens)`);
                });
                
            } catch (error) {
                console.log(`❌ ${player} proposal failed: ${error.message}`);
                proposals[player] = this.createEqualProposal();
            }
        }

        // Phase 3: Voting
        console.log('\n\n🗳️ PHASE 3: VOTING');
        console.log('==================');
        
        const votes = {};
        for (const player of this.playerNames) {
            console.log(`\n🗳️ ${player} voting...`);
            
            try {
                const gameHistory = { players: this.strategies };
                const strategy = this.strategies[player];
                
                const vote = await this.agentInvoker.generateVote(
                    player, proposals, gameHistory, strategy
                );
                
                votes[player] = vote;
                
                // Display vote in readable format
                console.log(`✅ ${player}'s Votes:`);
                Object.entries(vote).forEach(([recipient, voteCount]) => {
                    if (voteCount > 0) {
                        console.log(`   → ${recipient}: ${voteCount} votes`);
                    }
                });
                
            } catch (error) {
                console.log(`❌ ${player} voting failed: ${error.message}`);
                votes[player] = this.createEqualVote();
            }
        }

        // Phase 4: Results
        console.log('\n\n🏆 PHASE 4: RESULTS');
        console.log('===================');
        
        const voteTotals = this.calculateVoteTotals(votes);
        const winner = this.determineWinner(voteTotals);
        
        console.log('📊 Vote Totals:');
        Object.entries(voteTotals)
            .sort(([,a], [,b]) => b - a)
            .forEach(([player, total]) => {
                const percentage = Math.round((total / 600) * 100);
                const status = total >= 301 ? '🏆 WINNER' : total === 0 ? '💀 ELIMINATED' : '❌ LOST';
                console.log(`   ${player}: ${total} votes (${percentage}%) ${status}`);
            });

        if (winner) {
            console.log(`\n🎉 ${winner} WINS THE ROUND!`);
            console.log('💰 Token Distribution:');
            Object.entries(proposals[winner]).forEach(([player, percentage]) => {
                const tokens = Math.round(percentage * 6);
                const profit = tokens - 100; // Subtract entry fee
                const profitStatus = profit > 0 ? '💰' : profit < 0 ? '💸' : '⚖️';
                console.log(`   ${player}: ${tokens} tokens (${profitStatus}${profit > 0 ? '+' : ''}${profit})`);
            });
        }

        // Phase 5: Analysis
        console.log('\n\n📈 PHASE 5: NEGOTIATION ANALYSIS');
        console.log('================================');
        
        this.analyzeNegotiationQuality(negotiations, proposals, votes);
        
        // Evaluate commitments
        this.agentInvoker.evaluateRoundCommitments(proposals);
        const trustAnalytics = this.agentInvoker.getTrustAnalytics();
        
        console.log('\n⚖️ TRUST & COMMITMENT ANALYSIS:');
        console.log(`🤝 Total commitments made: ${trustAnalytics.commitmentsFulfilled}`);
        console.log(`📊 Trust relationships tracked: ${Object.keys(trustAnalytics.trustScores).length}`);
        
        // Detailed commitment fulfillment analysis
        this.analyzeCommitmentFulfillment(negotiations, votes, proposals);
    }

    calculateVoteTotals(votes) {
        const totals = {};
        this.playerNames.forEach(player => totals[player] = 0);
        
        Object.values(votes).forEach(voterAllocation => {
            Object.entries(voterAllocation).forEach(([recipient, voteCount]) => {
                totals[recipient] += voteCount;
            });
        });
        
        return totals;
    }

    determineWinner(voteTotals) {
        let maxVotes = 0;
        let winner = null;
        
        Object.entries(voteTotals).forEach(([player, votes]) => {
            if (votes > maxVotes) {
                maxVotes = votes;
                winner = player;
            }
        });
        
        return maxVotes >= 301 ? winner : null;
    }

    analyzeNegotiationQuality(negotiations, proposals, votes) {
        console.log('🔍 NEGOTIATION QUALITY ANALYSIS:');
        
        let totalCommitments = 0;
        let specificTargeting = 0;
        let voteTrading = 0;
        let coalitionSeeking = 0;
        
        Object.entries(negotiations).forEach(([player, negotiation]) => {
            const commitments = this.agentInvoker.negotiationSystem.parseNegotiationForCommitments(player, negotiation);
            totalCommitments += commitments.length;
            
            // Count specific targeting (mentions other player names)
            this.playerNames.forEach(otherPlayer => {
                if (otherPlayer !== player && negotiation.includes(otherPlayer)) {
                    specificTargeting++;
                }
            });
            
            // Count vote trading patterns
            if (negotiation.match(/(\d+)\s*(votes|%)/g)) {
                voteTrading++;
            }
            
            // Count coalition seeking
            if (negotiation.match(/(alliance|coalition|together|partnership)/i)) {
                coalitionSeeking++;
            }
        });
        
        console.log(`✅ Total explicit commitments: ${totalCommitments}`);
        console.log(`🎯 Players with specific targeting: ${specificTargeting}/${this.playerNames.length * (this.playerNames.length - 1)}`);
        console.log(`🤝 Players attempting vote trading: ${voteTrading}/${this.playerNames.length}`);
        console.log(`👥 Players seeking coalitions: ${coalitionSeeking}/${this.playerNames.length}`);
        
        // Quality score
        const maxPossibleCommitments = this.playerNames.length * (this.playerNames.length - 1);
        const qualityScore = Math.round((totalCommitments / maxPossibleCommitments) * 100);
        console.log(`📊 Negotiation Quality Score: ${qualityScore}%`);
    }

    createEqualProposal() {
        const proposal = {};
        const share = Math.floor(100 / this.playerNames.length);
        let remaining = 100;
        
        this.playerNames.forEach((player, index) => {
            if (index === this.playerNames.length - 1) {
                proposal[player] = remaining;
            } else {
                proposal[player] = share;
                remaining -= share;
            }
        });
        
        return proposal;
    }

    createEqualVote() {
        const vote = {};
        const share = Math.floor(100 / this.playerNames.length);
        let remaining = 100;
        
        this.playerNames.forEach((player, index) => {
            if (index === this.playerNames.length - 1) {
                vote[player] = remaining;
            } else {
                vote[player] = share;
                remaining -= share;
            }
        });
        
        return vote;
    }

    analyzeCommitmentFulfillment(negotiations, votes, proposals) {
        console.log('\n🔍 DETAILED COMMITMENT FULFILLMENT ANALYSIS:');
        console.log('==============================================');
        
        let totalCommitments = 0;
        let fulfilledCommitments = 0;
        let brokenCommitments = 0;
        
        Object.entries(negotiations).forEach(([player, negotiation]) => {
            const commitments = this.agentInvoker.negotiationSystem.parseNegotiationForCommitments(player, negotiation);
            
            if (commitments.length > 0) {
                console.log(`\n📋 ${player}'s Commitments vs Actions:`);
                
                commitments.forEach((commitment, i) => {
                    totalCommitments++;
                    
                    // Analyze if commitment was honored based on type
                    let honored = false;
                    let analysis = '';
                    
                    switch (commitment.type) {
                        case 'vote_offer':
                            // Check if they actually gave the votes they promised
                            const actualVotes = votes[player][commitment.targetPlayer] || 0;
                            const promisedVotes = commitment.offeredVotes || 0;
                            honored = actualVotes >= promisedVotes * 0.8; // 80% tolerance
                            analysis = `Promised ${promisedVotes} votes → Actually gave ${actualVotes} votes`;
                            break;
                            
                        case 'seeking_allocation':
                            // Check if they voted for someone who gave them what they asked for
                            const proposer = commitment.targetPlayer;
                            const receivedAllocation = proposals[proposer] ? proposals[proposer][player] || 0 : 0;
                            const votesGiven = votes[player][proposer] || 0;
                            honored = receivedAllocation >= commitment.requiredAllocation ? votesGiven > 0 : true;
                            analysis = `Sought ${commitment.requiredAllocation}% → Got ${receivedAllocation}% → Gave ${votesGiven} votes`;
                            break;
                            
                        case 'alliance_proposal':
                            // Check if they voted for their alleged ally
                            const allyVotes = votes[player][commitment.targetPlayer] || 0;
                            honored = allyVotes > 20; // Gave meaningful support
                            analysis = `Alliance with ${commitment.targetPlayer} → Gave ${allyVotes} votes`;
                            break;
                            
                        case 'threat':
                            // Threats are harder to evaluate, assume fulfilled if they voted against
                            const threatVotes = votes[player][commitment.targetPlayer] || 0;
                            honored = threatVotes === 0; // Actually carried out threat
                            analysis = `Threat against ${commitment.targetPlayer} → Gave ${threatVotes} votes`;
                            break;
                            
                        default:
                            analysis = `${commitment.type} - Unable to verify`;
                            honored = null;
                    }
                    
                    if (honored === true) {
                        fulfilledCommitments++;
                        console.log(`   ✅ ${i+1}. HONORED: ${analysis}`);
                    } else if (honored === false) {
                        brokenCommitments++;
                        console.log(`   ❌ ${i+1}. BROKEN: ${analysis}`);
                    } else {
                        console.log(`   ❓ ${i+1}. UNCLEAR: ${analysis}`);
                    }
                });
            }
        });
        
        console.log('\n📊 COMMITMENT SUMMARY:');
        console.log(`   Total commitments made: ${totalCommitments}`);
        console.log(`   ✅ Honored: ${fulfilledCommitments} (${Math.round(fulfilledCommitments/totalCommitments*100)}%)`);
        console.log(`   ❌ Broken: ${brokenCommitments} (${Math.round(brokenCommitments/totalCommitments*100)}%)`);
        console.log(`   ❓ Unclear: ${totalCommitments - fulfilledCommitments - brokenCommitments}`);
        
        // Identify biggest promise-breakers
        const promiseBreakers = {};
        Object.entries(negotiations).forEach(([player, negotiation]) => {
            const commitments = this.agentInvoker.negotiationSystem.parseNegotiationForCommitments(player, negotiation);
            const playerVotes = votes[player];
            
            let broken = 0;
            commitments.forEach(commitment => {
                if (commitment.type === 'vote_offer') {
                    const actualVotes = playerVotes[commitment.targetPlayer] || 0;
                    const promisedVotes = commitment.offeredVotes || 0;
                    if (actualVotes < promisedVotes * 0.8) broken++;
                }
                if (commitment.type === 'alliance_proposal') {
                    const allyVotes = playerVotes[commitment.targetPlayer] || 0;
                    if (allyVotes <= 20) broken++;
                }
            });
            
            if (broken > 0) {
                promiseBreakers[player] = broken;
            }
        });
        
        if (Object.keys(promiseBreakers).length > 0) {
            console.log('\n🏴‍☠️ BIGGEST PROMISE-BREAKERS:');
            Object.entries(promiseBreakers)
                .sort(([,a], [,b]) => b - a)
                .forEach(([player, brokenCount]) => {
                    console.log(`   ${player}: ${brokenCount} broken commitments`);
                });
        }
        
        // Show voting vs negotiation disconnect
        console.log('\n🎭 NEGOTIATION vs VOTING DISCONNECT:');
        Object.entries(votes).forEach(([player, voteDistribution]) => {
            const selfVotes = voteDistribution[player] || 0;
            if (selfVotes > 80) {
                console.log(`   ${player}: Made alliances but voted ${selfVotes}% for self (pure selfishness)`);
            }
        });
    }
}

async function runSingleGameTest() {
    console.log('🧪 TESTING ENHANCED NEGOTIATION SYSTEM');
    console.log('======================================\n');
    
    const tester = new SingleGameNegotiationTester();
    
    try {
        await tester.runSingleRound();
        console.log('\n✅ Single game test completed successfully!');
    } catch (error) {
        console.error('\n❌ Single game test failed:', error);
        console.error(error.stack);
    }
}

if (require.main === module) {
    runSingleGameTest();
}

module.exports = { SingleGameNegotiationTester }; 