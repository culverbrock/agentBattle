/**
 * Test Bidirectional Negotiations - Seeking & Offering Patterns
 * Shows improved negotiation mechanics with realistic seeking behaviors
 */

const { EnhancedNegotiationSystem } = require('../core/enhancedNegotiationFramework');

function testBidirectionalParsing() {
    console.log('🧪 TESTING BIDIRECTIONAL NEGOTIATION PARSING');
    console.log('=============================================\n');

    const negotiationSystem = new EnhancedNegotiationSystem();
    
    // Test various bidirectional negotiation patterns
    const testNegotiations = [
        {
            player: "Alice",
            message: `Bob: I need 25% from your proposal. In return, I'll give you my full 100 votes
Charlie: Give me 30%+ and you get my 100 votes. Give me less than 20% and you get 0
Diana: You broke our deal last round. To rebuild trust, I need 20% minimum`
        },
        {
            player: "Bob", 
            message: `Alice: If you support my proposal with 80+ votes, I'll allocate you 25%
Everyone: I'm seeking a 3-way alliance. Who's willing to split 60% three ways?
Charlie: You've been trustworthy. I need 15% and you get my full support`
        }
    ];

    testNegotiations.forEach(({ player, message }, index) => {
        console.log(`📝 TEST ${index + 1}: ${player}'s Negotiation`);
        console.log(`MESSAGE: "${message}"`);
        
        const commitments = negotiationSystem.parseNegotiationForCommitments(player, message);
        
        console.log(`\n🎯 EXTRACTED COMMITMENTS (${commitments.length}):`);
        commitments.forEach((commitment, i) => {
            console.log(`  ${i + 1}. TYPE: ${commitment.type}`);
            console.log(`     FROM: ${commitment.fromPlayer} → TO: ${commitment.targetPlayer}`);
            
            switch (commitment.type) {
                case 'seeking_allocation':
                    console.log(`     SEEKING: ${commitment.requiredAllocation}% for ${commitment.offeredVotes} votes`);
                    break;
                case 'conditional_seeking':
                    console.log(`     CONDITION: ${commitment.requiredAllocation}%+ = ${commitment.offeredVotes} votes`);
                    break;
                case 'threat':
                    console.log(`     THREAT: Less than ${commitment.minAllocation}% = ${commitment.threat}`);
                    break;
                case 'reciprocal_support':
                    console.log(`     RECIPROCAL: ${commitment.requiredVotes}+ votes for ${commitment.offeredAllocation}% allocation`);
                    break;
                case 'coalition_seeking':
                    console.log(`     COALITION: ${commitment.description}`);
                    break;
                case 'trust_reference':
                    console.log(`     TRUST: ${commitment.description}`);
                    break;
            }
            console.log(`     CONDITION: "${commitment.condition}"\n`);
        });
        
        console.log('─'.repeat(60) + '\n');
    });
}

function demonstrateImprovement() {
    console.log('🔄 COMPARISON: OLD vs NEW NEGOTIATION STYLE');
    console.log('============================================\n');
    
    console.log('❌ OLD VAGUE STYLE:');
    console.log('"Counteroffer Strategic Disruptor for a 33% split"');
    console.log('   → Meaningless, no clear target or commitment\n');
    
    console.log('✅ NEW BIDIRECTIONAL STYLE:');
    console.log('"Strategic Disruptor: I need 25% from your proposal. In return, you get my 100 votes"');
    console.log('   → Clear target, specific requirement, concrete offer\n');
    
    console.log('"Aggressive Maximizer: Give me 30%+ and you get my support. Less than 20% and I vote against you"');
    console.log('   → Conditional commitment with consequences\n');
    
    console.log('"Everyone: Who wants to form a 3-way alliance against the current leader?"');
    console.log('   → Coalition seeking with strategic purpose\n');
    
    console.log('🎯 KEY IMPROVEMENTS:');
    console.log('================================');
    console.log('✅ Seeking-oriented: "I need X%" instead of just "I offer Y"');
    console.log('✅ Bidirectional: Clear exchange terms (X for Y)');
    console.log('✅ Targeted: Specific players addressed');
    console.log('✅ Conditional: Different outcomes based on actions');
    console.log('✅ Trust-aware: References to past behavior');
    console.log('✅ Coalition-focused: Strategic alliance building');
}

if (require.main === module) {
    testBidirectionalParsing();
    demonstrateImprovement();
}

module.exports = { testBidirectionalParsing }; 