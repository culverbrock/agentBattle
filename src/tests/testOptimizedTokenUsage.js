/**
 * Test Optimized Token Usage
 * Demonstrates the token savings from smart history management
 */

const { generateOptimizedHistory } = require('../utils/createOptimizedAgentInvoker');

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function createMockNegotiationHistory(rounds, playersPerRound) {
  const players = [
    { name: 'Alice', id: 'player1' },
    { name: 'Bob', id: 'player2' },
    { name: 'Charlie', id: 'player3' },
    { name: 'David', id: 'player4' },
    { name: 'Eve', id: 'player5' },
    { name: 'Frank', id: 'player6' }
  ].slice(0, playersPerRound);

  const messages = [];
  const messageTypes = [
    "I think we should form an alliance and split the tokens fairly among our coalition.",
    "I demand at least 30% because I have the strongest negotiation position here.",
    "Let's work together and create a proposal that benefits everyone equally.",
    "I'm willing to offer you 25% if you vote for my proposal in the final round.",
    "This is getting nowhere - someone needs to make a decisive move soon.",
    "I've been analyzing everyone's strategies and I think I know who to trust.",
    "Warning: if you betray our alliance, I'll make sure you get nothing.",
    "The fair thing to do is split everything equally - 16.67% each player.",
    "I'm the most trustworthy player here, you should all vote for my proposal.",
    "Coalition breaking detected - I'm switching my vote to the highest bidder."
  ];

  for (let round = 1; round <= rounds; round++) {
    for (let player of players) {
      for (let negRound = 1; negRound <= 5; negRound++) { // 5 negotiation rounds per game round
        const message = messageTypes[Math.floor(Math.random() * messageTypes.length)];
        messages.push({
          playerId: player.id,
          playerName: player.name,
          message: message,
          round: round,
          negotiationRound: negRound
        });
      }
    }
  }

  return { messages, players };
}

function testTokenSavings() {
  console.log('🧪 TESTING OPTIMIZED TOKEN USAGE');
  console.log('================================');
  console.log('');

  const scenarios = [
    { rounds: 1, players: 6, description: "Early game (1 round)" },
    { rounds: 3, players: 6, description: "Mid game (3 rounds)" },
    { rounds: 5, players: 6, description: "Full game (5 rounds)" }
  ];

  scenarios.forEach(scenario => {
    console.log(`📊 SCENARIO: ${scenario.description}`);
    console.log(`   Players: ${scenario.players}, Rounds: ${scenario.rounds}`);
    
    const { messages, players } = createMockNegotiationHistory(scenario.rounds, scenario.players);
    
    // Original approach: include ALL history
    const originalHistory = messages.map(m => `${m.playerName}: ${m.message}`).join('\n');
    const originalTokens = estimateTokens(originalHistory);
    
    // Old "optimized" approach: last 3 messages only
    const oldOptimized = messages.slice(-3).map(m => `${m.playerName}: ${m.message}`).join('\n');
    const oldOptimizedTokens = estimateTokens(oldOptimized);
    
    // NEW smart approach: last N messages + compact summary
    const smartOptimized = generateOptimizedHistory(messages, players);
    const smartOptimizedTokens = estimateTokens(smartOptimized);
    
    console.log(`   📈 Total messages: ${messages.length}`);
    console.log(`   🔤 Original tokens: ${originalTokens.toLocaleString()}`);
    console.log(`   🔤 Old optimized tokens: ${oldOptimizedTokens.toLocaleString()}`);
    console.log(`   🔤 NEW smart tokens: ${smartOptimizedTokens.toLocaleString()}`);
    
    const originalSavings = Math.round((1 - oldOptimizedTokens / originalTokens) * 100);
    const smartSavings = Math.round((1 - smartOptimizedTokens / originalTokens) * 100);
    const improvementOverOld = Math.round((oldOptimizedTokens - smartOptimizedTokens) / oldOptimizedTokens * 100);
    
    console.log(`   💰 Old approach saved: ${originalSavings}%`);
    console.log(`   💰 Smart approach saved: ${smartSavings}%`);
    console.log(`   🎯 Improvement over old: ${improvementOverOld > 0 ? '+' : ''}${improvementOverOld}%`);
    console.log('');
    
    if (scenario.rounds === 5) {
      console.log('📋 EXAMPLE SMART OPTIMIZED OUTPUT:');
      console.log('-----------------------------------');
      console.log(smartOptimized.substring(0, 500) + (smartOptimized.length > 500 ? '...' : ''));
      console.log('');
    }
  });
  
  // Game-level calculations
  console.log('🎮 FULL GAME TOKEN IMPACT');
  console.log('=========================');
  
  const gameRounds = 5;
  const players = 6;
  const { messages } = createMockNegotiationHistory(gameRounds, players);
  
  // Each round has 42 API calls (30 negotiations + 6 proposals + 6 votes)
  const apiCallsPerRound = (players * 5) + players + players; // negotiations + proposals + votes
  const totalApiCalls = gameRounds * apiCallsPerRound;
  
  const originalTokensPerCall = estimateTokens(messages.map(m => `${m.playerName}: ${m.message}`).join('\n'));
  const smartTokensPerCall = estimateTokens(generateOptimizedHistory(messages, 
    [
      { name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }, 
      { name: 'David' }, { name: 'Eve' }, { name: 'Frank' }
    ].slice(0, players)
  ));
  
  const originalTotalTokens = totalApiCalls * originalTokensPerCall;
  const smartTotalTokens = totalApiCalls * smartTokensPerCall;
  
  console.log(`📊 API calls per game: ${totalApiCalls}`);
  console.log(`🔤 Original tokens per game: ${originalTotalTokens.toLocaleString()}`);
  console.log(`🔤 Smart tokens per game: ${smartTotalTokens.toLocaleString()}`);
  console.log(`💰 Total savings per game: ${Math.round((1 - smartTotalTokens / originalTotalTokens) * 100)}%`);
  console.log('');
  
  const gamesWithin200k = Math.floor(200000 / smartTotalTokens);
  const originalGamesWithin200k = Math.floor(200000 / originalTotalTokens);
  
  console.log(`🎯 Games possible within 200k tokens:`);
  console.log(`   Original approach: ${originalGamesWithin200k} games`);
  console.log(`   Smart approach: ${gamesWithin200k} games`);
  console.log(`   Improvement: ${gamesWithin200k - originalGamesWithin200k}x more games possible!`);
}

// Export the test function for use in other modules
if (require.main === module) {
  testTokenSavings();
}

module.exports = { testTokenSavings, createMockNegotiationHistory, estimateTokens }; 