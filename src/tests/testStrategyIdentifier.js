// Test Strategy Identifier functionality
const { generateNegotiationMessage, generateProposal } = require('./agentInvoker');

async function testStrategyIdentifier() {
  console.log('🔍 TESTING STRATEGY IDENTIFIER FUNCTIONALITY');
  console.log('===========================================\n');

  // Mock players with different strategic behaviors
  const players = [
    {
      id: 'player1',
      name: 'Strategy Identifier',
      agent: { 
        strategy: 'Analyze opponent negotiation patterns, proposal behaviors, and voting tendencies to identify their strategies. Adapt your approach to optimally counter each opponent type in real-time.',
        type: 'llm'
      }
    },
    {
      id: 'player2', 
      name: 'Aggressive Max',
      agent: {
        strategy: 'Demand the largest possible share. Use threats and aggressive tactics.',
        type: 'llm'
      }
    },
    {
      id: 'player3',
      name: 'Diplomatic Builder', 
      agent: {
        strategy: 'Build long-term trust through consistently fair offers. Prioritize mutual benefit.',
        type: 'llm'
      }
    }
  ];

  // Mock negotiation history showing different strategic behaviors
  const mockHistory = [
    {
      playerId: 'player2',
      playerName: 'Aggressive Max',
      message: 'I demand 60% - I deserve the most here. Anyone who disagrees will get nothing!',
      round: 1
    },
    {
      playerId: 'player3', 
      playerName: 'Diplomatic Builder',
      message: 'Let\'s be fair here. I propose we cooperate and trust each other for mutual benefit.',
      round: 1
    },
    {
      playerId: 'player2',
      playerName: 'Aggressive Max', 
      message: 'Threats work - if you don\'t vote for me, I\'ll make sure you get 0% next round.',
      round: 2
    },
    {
      playerId: 'player3',
      playerName: 'Diplomatic Builder',
      message: 'I believe in fair sharing - let\'s work together and build trust for the long term.',
      round: 2
    }
  ];

  const context = {
    phase: 'negotiation',
    round: 3,
    maxRounds: 5,
    players: players,
    negotiationHistory: mockHistory
  };

  try {
    console.log('📊 MOCK NEGOTIATION HISTORY:');
    mockHistory.forEach(entry => {
      console.log(`${entry.playerName}: "${entry.message}"`);
    });
    
    console.log('\n🧠 TESTING STRATEGY IDENTIFIER NEGOTIATION:');
    const strategyIdentifierAgent = players[0].agent;
    const negotiationMessage = await generateNegotiationMessage(context, strategyIdentifierAgent);
    
    console.log(`Strategy Identifier Response: "${negotiationMessage}"`);
    
    // Check if response contains strategy identification keywords
    const hasStrategyAnalysis = negotiationMessage.toLowerCase().includes('aggressive') || 
                              negotiationMessage.toLowerCase().includes('diplomatic') ||
                              negotiationMessage.toLowerCase().includes('pattern') ||
                              negotiationMessage.toLowerCase().includes('strategy');
    
    console.log(`✅ Contains strategy analysis: ${hasStrategyAnalysis}`);
    
    console.log('\n🧠 TESTING STRATEGY IDENTIFIER PROPOSAL:');
    const proposal = await generateProposal(context, strategyIdentifierAgent, players);
    
    console.log('Strategy Identifier Proposal:', proposal);
    
    // Validate proposal structure
    if (proposal && typeof proposal === 'object') {
      const playerIds = players.map(p => p.id);
      const hasAllPlayers = playerIds.every(id => proposal.hasOwnProperty(id));
      const total = Object.values(proposal).reduce((sum, val) => sum + Number(val), 0);
      const isValidTotal = Math.abs(total - 100) <= 2; // Allow small rounding errors
      
      console.log(`✅ Includes all players: ${hasAllPlayers}`);
      console.log(`✅ Totals to ~100%: ${isValidTotal} (actual: ${total}%)`);
      console.log(`✅ Strategy Identifier gets: ${proposal[players[0].id]}%`);
      
      return {
        success: true,
        negotiationValid: negotiationMessage && negotiationMessage.length > 0,
        proposalValid: hasAllPlayers && isValidTotal,
        hasStrategyAnalysis
      };
    } else {
      console.log('❌ Invalid proposal structure');
      return { success: false, error: 'Invalid proposal structure' };
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run test if called directly
if (require.main === module) {
  testStrategyIdentifier()
    .then(result => {
      console.log('\n📊 TEST RESULT:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test error:', error);
      process.exit(1);
    });
}

module.exports = { testStrategyIdentifier }; 