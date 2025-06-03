/**
 * Comparison Test: Old vs New Approach
 * Tests separate API calls vs persistent conversations
 * to measure promise-keeping improvement
 */

const { EnhancedAgentInvoker } = require('../core/enhancedAgentInvoker');
const { PersistentConversationInvoker } = require('../utils/persistentConversationInvoker');

class ComparisonTester {
    constructor() {
        this.strategies = {
            'Alice': 'Form strategic alliances and honor commitments',
            'Bob': 'Maximize personal gain through negotiation',
            'Charlie': 'Balance cooperation with self-interest'
        };
        this.playerNames = Object.keys(this.strategies);
    }

    async runComparison() {
        console.log('⚔️ OLD VS NEW APPROACH COMPARISON');
        console.log('==================================');
        
        // Test 1: Old approach (separate API calls)
        console.log('\n🔄 TEST 1: OLD APPROACH (Separate API calls)');
        console.log('==============================================');
        const oldResults = await this.testOldApproach();
        
        // Test 2: New approach (persistent conversations)
        console.log('\n🧵 TEST 2: NEW APPROACH (Persistent conversations)');
        console.log('==================================================');
        const newResults = await this.testNewApproach();
        
        // Compare results
        this.compareResults(oldResults, newResults);
    }

    async testOldApproach() {
        const agentInvoker = new EnhancedAgentInvoker();
        
        // Phase 1: Negotiations
        const negotiations = {};
        for (const player of this.playerNames) {
            const gameHistory = { players: this.strategies };
            const negotiationHistory = [];
            const strategy = this.strategies[player];
            
            const negotiation = await agentInvoker.generateNegotiation(
                player, gameHistory, negotiationHistory, strategy
            );
            negotiations[player] = negotiation;
            console.log(`💬 ${player}: "${negotiation.substring(0, 100)}..."`);
        }

        // Phase 2: Proposals
        const proposals = {};
        for (const player of this.playerNames) {
            const gameHistory = { players: this.strategies };
            const negotiationHistory = [negotiations];
            const strategy = this.strategies[player];
            
            const proposal = await agentInvoker.generateProposal(
                player, gameHistory, negotiationHistory, strategy
            );
            proposals[player] = proposal;
            console.log(`📋 ${player}:`, proposal);
        }

        // Phase 3: Voting
        const votes = {};
        for (const player of this.playerNames) {
            const gameHistory = { players: this.strategies };
            const strategy = this.strategies[player];
            
            const vote = await agentInvoker.generateVote(
                player, proposals, gameHistory, strategy
            );
            votes[player] = vote;
            console.log(`🗳️ ${player}:`, vote);
        }

        return this.analyzeConsistency(negotiations, proposals, votes, 'OLD');
    }

    async testNewApproach() {
        const agentInvoker = new PersistentConversationInvoker();
        
        // Phase 1: Negotiations
        const negotiations = {};
        for (const player of this.playerNames) {
            const gameHistory = { players: this.strategies };
            const negotiationHistory = [];
            const strategy = this.strategies[player];
            
            const negotiation = await agentInvoker.generateNegotiation(
                player, gameHistory, negotiationHistory, strategy
            );
            negotiations[player] = negotiation;
            console.log(`💬 ${player}: "${negotiation.substring(0, 100)}..."`);
        }

        // Phase 2: Proposals (continues same conversations)
        const proposals = {};
        for (const player of this.playerNames) {
            const gameHistory = { players: this.strategies };
            const negotiationHistory = [negotiations];
            const strategy = this.strategies[player];
            
            const proposal = await agentInvoker.generateProposal(
                player, gameHistory, negotiationHistory, strategy
            );
            proposals[player] = proposal;
            console.log(`📋 ${player}:`, proposal);
        }

        // Phase 3: Voting (continues same conversations)
        const votes = {};
        for (const player of this.playerNames) {
            const gameHistory = { players: this.strategies };
            const strategy = this.strategies[player];
            
            const vote = await agentInvoker.generateVote(
                player, proposals, gameHistory, strategy
            );
            votes[player] = vote;
            console.log(`🗳️ ${player}:`, vote);
        }

        return this.analyzeConsistency(negotiations, proposals, votes, 'NEW');
    }

    analyzeConsistency(negotiations, proposals, votes, approach) {
        console.log(`\n📊 ${approach} APPROACH ANALYSIS:`);
        
        let totalPromises = 0;
        let promisesKept = 0;
        const playerAnalysis = {};

        this.playerNames.forEach(player => {
            const analysis = {
                negotiation: negotiations[player],
                proposal: proposals[player],
                votes: votes[player],
                consistency: this.evaluatePlayerConsistency(
                    negotiations[player], 
                    proposals[player], 
                    votes[player],
                    player,
                    proposals
                )
            };

            // Count promises made and kept
            const promisesMade = this.countPromises(negotiations[player]);
            const promisesHonored = this.countPromisesKept(
                negotiations[player], 
                votes[player], 
                proposals,
                player
            );

            totalPromises += promisesMade;
            promisesKept += promisesHonored;

            console.log(`🔍 ${player}:`);
            console.log(`   Promises made: ${promisesMade}`);
            console.log(`   Promises kept: ${promisesHonored}`);
            console.log(`   Consistency: ${analysis.consistency.score}%`);
            console.log(`   Reasoning: ${analysis.consistency.reasoning}`);

            playerAnalysis[player] = analysis;
        });

        const promiseKeepingRate = totalPromises > 0 ? Math.round((promisesKept / totalPromises) * 100) : 0;
        
        console.log(`\n📈 ${approach} SUMMARY:`);
        console.log(`   Total promises: ${totalPromises}`);
        console.log(`   Promises kept: ${promisesKept}`);
        console.log(`   Promise-keeping rate: ${promiseKeepingRate}%`);

        return {
            approach,
            totalPromises,
            promisesKept,
            promiseKeepingRate,
            playerAnalysis
        };
    }

    evaluatePlayerConsistency(negotiation, proposal, votes, playerName, allProposals) {
        let score = 0;
        let reasoning = '';

        // Check if they mentioned alliances and followed through
        const mentionedAlliance = negotiation.toLowerCase().includes('alliance') || 
                                 negotiation.toLowerCase().includes('together') ||
                                 negotiation.toLowerCase().includes('work');
        
        const votedForAllies = Object.values(votes).some(v => v > 40);
        
        if (mentionedAlliance && votedForAllies) {
            score += 50;
            reasoning += 'Honored alliance promises. ';
        } else if (mentionedAlliance && !votedForAllies) {
            reasoning += 'Broke alliance promises. ';
        }

        // Check if they honored specific vote commitments
        const promisedVotes = negotiation.match(/(\d+)\s*votes/gi) || [];
        if (promisedVotes.length > 0) {
            const highestVote = Math.max(...Object.values(votes));
            if (highestVote >= parseInt(promisedVotes[0]) * 0.7) { // 70% tolerance
                score += 30;
                reasoning += 'Roughly honored vote commitments. ';
            } else {
                reasoning += 'Failed to honor vote commitments. ';
            }
        }

        // Check if they responded appropriately to others' proposals
        const myAllocation = allProposals[playerName] ? allProposals[playerName][playerName] || 0 : 0;
        if (myAllocation > 0) {
            score += 20;
            reasoning += 'Made reasonable self-allocation. ';
        }

        return { score, reasoning: reasoning.trim() || 'No clear patterns detected.' };
    }

    countPromises(negotiation) {
        // Enhanced promise detection for both explicit and implicit commitments
        const promisePatterns = [
            /I'll give you \d+/gi,
            /I will allocate/gi,
            /I offer you \d+/gi,
            /I propose.*\d+/gi,
            /alliance/gi,
            /work together/gi,
            /support/gi,
            /deal/gi,
            /exchange/gi,
            /in return/gi
        ];

        return promisePatterns.reduce((count, pattern) => {
            const matches = negotiation.match(pattern);
            return count + (matches ? matches.length : 0);
        }, 0);
    }

    countPromisesKept(negotiation, votes, allProposals, playerName) {
        let kept = 0;

        // Check for alliance/cooperation promises
        const mentionedCooperation = negotiation.toLowerCase().includes('alliance') || 
                                   negotiation.toLowerCase().includes('work together') ||
                                   negotiation.toLowerCase().includes('deal') ||
                                   negotiation.toLowerCase().includes('offer');
        
        if (mentionedCooperation && Object.values(votes).some(v => v > 25)) {
            kept++;
        }

        // Check for specific vote or percentage promises
        const numberPromises = negotiation.match(/(\d+)\s*(votes|%)/gi);
        if (numberPromises && numberPromises.length > 0) {
            const highestVote = Math.max(...Object.values(votes));
            const promisedNumber = parseInt(numberPromises[0]);
            
            // More lenient check - if they gave significant votes to someone
            if (highestVote >= Math.min(promisedNumber * 0.5, 30)) {
                kept++;
            }
        }

        // Check if they responded positively to others who honored them
        const receivedFairTreatment = Object.values(allProposals).some(proposal => 
            (proposal[playerName] || 0) >= 25
        );
        
        if (receivedFairTreatment && Object.values(votes).some(v => v > 30)) {
            kept++;
        }

        return Math.min(kept, this.countPromises(negotiation)); // Can't keep more than you made
    }

    compareResults(oldResults, newResults) {
        console.log('\n🏆 FINAL COMPARISON');
        console.log('===================');
        
        console.log(`📊 Promise-keeping rates:`);
        console.log(`   Old approach: ${oldResults.promiseKeepingRate}%`);
        console.log(`   New approach: ${newResults.promiseKeepingRate}%`);
        
        const improvement = newResults.promiseKeepingRate - oldResults.promiseKeepingRate;
        console.log(`   Improvement: ${improvement > 0 ? '+' : ''}${improvement}%`);
        
        if (improvement > 20) {
            console.log(`\n🎉 MASSIVE IMPROVEMENT! Persistent conversations are ${improvement}% better!`);
        } else if (improvement > 10) {
            console.log(`\n✅ SIGNIFICANT IMPROVEMENT! Persistent conversations work better.`);
        } else if (improvement > 0) {
            console.log(`\n👍 MINOR IMPROVEMENT. Persistent conversations show promise.`);
        } else {
            console.log(`\n❌ NO IMPROVEMENT. Both approaches have similar results.`);
        }

        console.log(`\n🔍 Key insight: ${improvement > 0 ? 
            'LLMs maintain better identity consistency within continuous conversations.' :
            'Promise-keeping may require stronger structural incentives beyond memory.'}`);
    }
}

// Run the comparison
async function runComparison() {
    const tester = new ComparisonTester();
    await tester.runComparison();
}

runComparison().catch(console.error); 