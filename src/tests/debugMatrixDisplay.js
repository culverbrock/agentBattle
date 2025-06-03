/**
 * Debug Matrix Display - Show complete matrix with clear interpretation
 */

async function debugMatrixDisplay() {
    console.log('🔍 MATRIX INTERPRETATION DEBUG');
    console.log('==============================');
    
    // Example matrix from the test run (reconstructed)
    const players = [
        { name: 'Aggressive Maximizer' },
        { name: 'Diplomatic Builder' },
        { name: 'Strategic Opportunist' },
        { name: 'Mathematical Analyzer' }
    ];
    
    // Reconstructed complete matrix (filling in missing values)
    const matrix = [
        [90, 5, 3, 2,    80, 15, 5, 0,    20, 10, 10, 5,    90, 60, 40, 20],  // Aggressive Maximizer
        [30, 30, 30, 10, 25, 25, 25, 25,  20, 20, 20, 15,   25, 25, 25, 20],  // Diplomatic Builder  
        [40, 30, 20, 10, 50, 40, 10, 0,   60, 30, 10, 0,    50, 30, 20, 10],  // Strategic Opportunist
        [40, 20, 20, 20, 35, 30, 20, 15,  40, 20, 20, 0,    40, 30, 20, 0]    // Mathematical Analyzer
    ];
    
    players.forEach((player, playerIndex) => {
        const row = matrix[playerIndex];
        console.log(`\n🎯 ${player.name.toUpperCase()} (Row ${playerIndex}):`);
        console.log('=' + '='.repeat(player.name.length + 15));
        
        // Proposal section
        const proposals = row.slice(0, 4);
        console.log('📊 PROPOSAL (what % each player should get):');
        proposals.forEach((pct, i) => {
            console.log(`   ${players[i].name}: ${pct}%`);
        });
        console.log(`   Total: ${proposals.reduce((sum, val) => sum + val, 0)}%`);
        
        // Vote allocation section  
        const votes = row.slice(4, 8);
        console.log('\n🗳️ VOTE ALLOCATION (how they distribute their 100 votes):');
        votes.forEach((pct, i) => {
            console.log(`   Vote for ${players[i].name}'s proposal: ${pct}%`);
        });
        console.log(`   Total: ${votes.reduce((sum, val) => sum + val, 0)}%`);
        
        // Offers section
        const offers = row.slice(8, 12);
        console.log('\n🎁 OFFERS (votes they promise to give):');
        offers.forEach((votes, i) => {
            if (votes > 0) {
                console.log(`   Promise ${votes} votes to ${players[i].name}`);
            }
        });
        
        // Requests section
        const requests = row.slice(12, 16);
        console.log('\n📝 REQUESTS (votes they want from others):');
        requests.forEach((votes, i) => {
            if (votes > 0) {
                console.log(`   Want ${votes} votes from ${players[i].name}`);
            }
        });
    });
    
    // Strategic analysis
    console.log('\n🧠 STRATEGIC ANALYSIS:');
    console.log('======================');
    
    console.log('\n🎯 Why Mathematical Analyzer votes for others\' proposals:');
    console.log('   • Aggressive Maximizer proposed: 2% for Mathematical Analyzer');
    console.log('   • Mathematical Analyzer proposed: 20% for themselves');
    console.log('   • BUT if Aggressive Maximizer wins, Math Analyzer gets 2% of 600 = 12 tokens');
    console.log('   • If Math Analyzer wins, they get 20% of 600 = 120 tokens');
    console.log('   • So they vote strategically based on LIKELIHOOD of winning!');
    
    console.log('\n💡 Key Insights:');
    console.log('   • PROPOSALS = "What I suggest if I win"');
    console.log('   • VOTES = "Who I think will actually win and gives me most benefit"');
    console.log('   • OFFERS = "Votes I promise to others (to get their support)"');
    console.log('   • REQUESTS = "Votes I want from others (to help me win)"');
    
    console.log('\n🎲 Example Promise-Keeping Check:');
    console.log('   Aggressive Maximizer OFFERED 10 votes to Diplomatic Builder');
    console.log('   Aggressive Maximizer actually VOTED 15% for Diplomatic Builder');
    console.log('   15% of 100 votes = 15 votes > 10 promised votes = ✅ PROMISE KEPT');
}

// Run debug
debugMatrixDisplay().catch(console.error);

module.exports = { debugMatrixDisplay }; 