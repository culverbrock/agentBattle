/**
 * Test Enhanced Negotiations - Vote Trading & Trust System
 * Demonstrates how concrete vote commitments would improve strategic depth
 */

const { EnhancedNegotiationSystem } = require('../core/enhancedNegotiationFramework');

async function testEnhancedNegotiationFlow() {
    console.log('🧪 TESTING ENHANCED NEGOTIATION SYSTEM');
    console.log('=====================================\n');

    const negotiationSystem = new EnhancedNegotiationSystem();
    
    // Simulate game state after Round 1
    const gameState = {
        players: ['Alice', 'Bob', 'Charlie', 'Diana'],
        previousVoting: [
            {
                'Alice': { 'Bob': 60, 'Charlie': 40, 'Diana': 0 },
                'Bob': { 'Alice': 30, 'Charlie': 70, 'Diana': 0 },
                'Charlie': { 'Alice': 0, 'Bob': 20, 'Diana': 80 },
                'Diana': { 'Alice': 50, 'Bob': 0, 'Charlie': 50 }
            }
        ],
        previousProposals: [
            {
                'Alice': { 'Alice': 40, 'Bob': 30, 'Charlie': 20, 'Diana': 10 },
                'Bob': { 'Alice': 25, 'Bob': 35, 'Charlie': 25, 'Diana': 15 },
                'Charlie': { 'Alice': 10, 'Bob': 15, 'Charlie': 45, 'Diana': 30 },
                'Diana': { 'Alice': 20, 'Bob': 20, 'Charlie': 30, 'Diana': 30 }
            }
        ]
    };

    console.log('📊 ROUND 2 NEGOTIATIONS WITH ENHANCED SYSTEM\n');

    // Generate enhanced negotiation for Alice
    console.log('👤 ALICE\'S ENHANCED NEGOTIATION:');
    console.log('================================');
    
    gameState.playerStrategy = "Mathematical analyzer focusing on optimal vote allocation";
    
    const alicePrompt = negotiationSystem.generateNegotiationPrompt('Alice', gameState, 2);
    console.log(alicePrompt);
    
    // Simulate Alice's strategic negotiation response
    const aliceMessage = `Bob: Last round you gave me only 30 votes despite promising 50+. I'll give you my full 100 votes if you allocate me 30%+ this round. Prove your trustworthiness.

Charlie: You honored our 40-vote agreement perfectly. I'll maintain our alliance: 80 votes for you if you give me 25%+. 

Diana: I'll split my votes strategically: 60 votes if you give me 20%, 40 votes if 15%, 0 votes if less than 15%. Your choice.`;

    console.log('\n🗣️ ALICE\'S NEGOTIATION MESSAGE:');
    console.log(aliceMessage);

    // Parse commitments from Alice's message
    const aliceCommitments = negotiationSystem.parseNegotiationForCommitments('Alice', aliceMessage);
    console.log('\n📝 EXTRACTED VOTE COMMITMENTS:');
    console.log(aliceCommitments);

    // Simulate Bob's response
    console.log('\n👤 BOB\'S RESPONSE:');
    console.log('==================');
    
    const bobMessage = `Alice: You're right, I broke our trust last round. I'll give you exactly 30% this round to rebuild credibility. Expecting your 100 votes as promised.

Charlie and Diana: Form a blocking coalition with me. I'll give Charlie 25% and Diana 20% if you both vote against Alice's proposal. We can split the 600 tokens three ways instead of giving Alice control.`;

    console.log(bobMessage);

    // Test Round 2 voting with commitments tracked
    console.log('\n🗳️ ROUND 2 VOTING RESULTS:');
    console.log('============================');

    const round2Proposals = {
        'Alice': { 'Alice': 35, 'Bob': 25, 'Charlie': 25, 'Diana': 15 },
        'Bob': { 'Alice': 30, 'Bob': 25, 'Charlie': 25, 'Diana': 20 },
        'Charlie': { 'Alice': 20, 'Bob': 30, 'Charlie': 30, 'Diana': 20 },
        'Diana': { 'Alice': 25, 'Bob': 15, 'Charlie': 35, 'Diana': 25 }
    };

    const round2Voting = {
        'Alice': { 'Bob': 100, 'Charlie': 0, 'Diana': 0 }, // Honored commitment to Bob
        'Bob': { 'Alice': 0, 'Charlie': 60, 'Diana': 40 }, // Formed blocking coalition
        'Charlie': { 'Alice': 0, 'Bob': 70, 'Diana': 30 }, // Joined Bob's coalition
        'Diana': { 'Alice': 20, 'Bob': 80, 'Charlie': 0 }  // Mostly joined Bob's coalition
    };

    // Evaluate commitment fulfillment
    negotiationSystem.evaluateCommitments(round2Voting, round2Proposals);

    console.log('📊 COMMITMENT ANALYSIS:');
    console.log('- Alice honored her commitment to Bob (100 votes for 30% allocation)');
    console.log('- Bob successfully formed blocking coalition despite lower individual allocation');
    console.log('- Trust scores updated based on promise-keeping behavior');

    console.log('\n🎯 STRATEGIC INSIGHTS:');
    console.log('======================');
    console.log('✅ Enhanced negotiations enabled:');
    console.log('   1. Explicit vote-for-allocation trades');
    console.log('   2. Trust accountability ("you broke promises last round")');
    console.log('   3. Complex coalition strategies (blocking coalitions)');
    console.log('   4. Conditional vote splitting based on allocation levels');
    console.log('   5. Historical pattern references for strategic decisions');

    console.log('\n💡 IMPROVEMENT OVER CURRENT SYSTEM:');
    console.log('====================================');
    console.log('BEFORE: "Counteroffer Strategic Disruptor for a 33% split" (meaningless)');
    console.log('AFTER:  "I\'ll give you 100 votes if you allocate me 25%+" (concrete, trackable)');
    
    console.log('\nThis system would make negotiations truly strategic rather than just flavor text! 🚀');
}

// Example of integrating with existing agentInvoker
function integrateWithCurrentSystem() {
    console.log('\n🔧 INTEGRATION WITH EXISTING SYSTEM:');
    console.log('====================================');
    
    const integrationExample = `
// In agentInvoker.js - Enhanced negotiation function
async function smartGenerateNegotiation(playerName, gameHistory, negotiationHistory, strategy) {
    const negotiationSystem = new EnhancedNegotiationSystem();
    
    // Build enhanced game state with voting/proposal history
    const enhancedGameState = {
        players: gameHistory.players,
        previousVoting: gameHistory.votingRounds,
        previousProposals: gameHistory.proposalRounds,
        playerStrategy: strategy
    };
    
    // Generate enhanced prompt with vote trading mechanics
    const enhancedPrompt = negotiationSystem.generateNegotiationPrompt(
        playerName, 
        enhancedGameState, 
        negotiationHistory.length + 1
    );
    
    // Get LLM response with concrete vote commitments
    const response = await callLLM(enhancedPrompt);
    
    // Parse and track commitments for trust scoring
    const commitments = negotiationSystem.parseNegotiationForCommitments(playerName, response);
    commitments.forEach(commitment => {
        negotiationSystem.recordVoteCommitment(
            playerName, 
            commitment.targetPlayer, 
            commitment.condition, 
            commitment.voteAmount
        );
    });
    
    return response;
}

// In voting phase - check commitments and update trust
async function smartGenerateVote(playerName, proposals, gameState, negotiationSystem) {
    const enhancedPrompt = negotiationSystem.generateVotingPrompt(playerName, proposals, gameState);
    const voteResponse = await callLLM(enhancedPrompt);
    
    // After all votes collected, evaluate commitment fulfillment
    negotiationSystem.evaluateCommitments(allVotes, proposals);
    
    return voteResponse;
}`;

    console.log(integrationExample);
}

if (require.main === module) {
    testEnhancedNegotiationFlow().then(() => {
        integrateWithCurrentSystem();
    }).catch(console.error);
}

module.exports = { testEnhancedNegotiationFlow }; 