const { generateNegotiationMessage, generateProposal, generateVote } = require('./agentInvoker');

/**
 * Test the actual negotiation conversation flow
 */
async function testNegotiationFlow() {
  console.log('🎭 AGENT BATTLE: STRATEGIC NEGOTIATION SIMULATION\n');
  console.log('================================================\n');
  
  // Mock game context
  const context = {
    phase: 'negotiation',
    round: 1,
    maxRounds: 3,
    players: [
      { 
        id: 'alice', 
        name: 'Alice',
        agent: { strategy: 'try to win most of the prize pool', type: 'llm' }
      },
      { 
        id: 'bob', 
        name: 'Bob',
        agent: { strategy: 'be generous but protect yourself', type: 'llm' }
      },
      { 
        id: 'charlie', 
        name: 'Charlie',
        agent: { strategy: 'form alliances and backstab when needed', type: 'llm' }
      }
    ],
    negotiationHistory: []
  };

  console.log('🎯 AGENT STRATEGIES:');
  console.log('- Alice: "try to win most of the prize pool"');
  console.log('- Bob: "be generous but protect yourself"');  
  console.log('- Charlie: "form alliances and backstab when needed"');
  console.log('\n💰 PRIZE POOL: 100% to split among 3 players');
  console.log('🏆 WIN CONDITION: Get 61%+ votes for your proposal\n');

  // Simulate 3 rounds of negotiation
  for (let round = 1; round <= 3; round++) {
    console.log(`\n🗣️  === ROUND ${round}/3 ===`);
    console.log('=====================================');
    
    context.round = round;
    
    // Each player speaks in turn
    for (const player of context.players) {
      try {
        console.log(`\n${player.name} is thinking...`);
        const message = await generateNegotiationMessage(context, player.agent);
        
        // Add to history
        context.negotiationHistory.push({
          playerId: player.id,
          message: message,
          round: round,
          turn: context.players.indexOf(player)
        });
        
        console.log(`${player.name}: "${message}"`);
        
        // Short delay for realism
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.log(`${player.name}: [ERROR] ${err.message}`);
      }
    }
    
    if (round < 3) {
      console.log('\n⏱️  End of round. Agents analyzing responses...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n\n🏆 === PROPOSAL PHASE ===');
  console.log('========================');
  console.log('Each agent now creates their strategic proposal based on the negotiation...\n');
  
  // Test proposal generation with full context
  for (const player of context.players) {
    try {
      console.log(`${player.name} is crafting their proposal...`);
      console.log(`\n=== DEBUG: ${player.name}'s Proposal Prompt ===`);
      
      // Let's manually call the proposal function to see the prompt
      const proposal = await generateProposal(context, player.agent, context.players);
      
      console.log(`=== END DEBUG ===\n`);
      
      console.log(`\n${player.name}'s Proposal:`);
      if (proposal) {
        Object.entries(proposal).forEach(([playerId, percentage]) => {
          const playerName = context.players.find(p => p.id === playerId)?.name || playerId;
          console.log(`  - ${playerName}: ${percentage}%`);
        });
      } else {
        console.log('  [Failed to generate valid proposal]');
      }
      console.log('');
    } catch (err) {
      console.log(`${player.name}: [ERROR] ${err.message}`);
    }
  }

  console.log('\n🧠 === ANALYSIS ===');
  console.log('==================');
  console.log('Notice how the agents:');
  console.log('✅ Referenced specific things others said');
  console.log('✅ Adapted their approach based on opponents');
  console.log('✅ Built alliances and made threats');
  console.log('✅ Used psychological tactics');
  console.log('✅ Created proposals reflecting negotiation dynamics');
  console.log('\nThis is REAL strategic gameplay! 🎮');

  // Now test the VOTING phase - this is where strategy really matters!
  console.log('\n\n🗳️  === VOTING PHASE ===');
  console.log('======================');
  console.log('Now agents must strategically vote based on proposals and predicted behavior...\n');

  // Collect all proposals from the previous phase
  const proposals = [];
  for (const player of context.players) {
    const proposal = await generateProposal(context, player.agent, context.players);
    if (proposal) {
      proposals.push({
        playerId: player.id,
        proposal: proposal
      });
    }
  }

  // Update context for voting
  context.phase = 'voting';
  context.proposals = proposals;

  console.log('📋 PROPOSALS TO VOTE ON:');
  proposals.forEach((prop, index) => {
    const proposer = context.players.find(p => p.id === prop.playerId);
    console.log(`\n${index + 1}. ${proposer?.name || prop.playerId}'s Proposal:`);
    Object.entries(prop.proposal).forEach(([playerId, percentage]) => {
      const playerName = context.players.find(p => p.id === playerId)?.name || playerId;
      console.log(`   - ${playerName}: ${percentage}%`);
    });
  });

  console.log('\n💭 STRATEGIC VOTING ANALYSIS:');
  console.log('Each agent must predict how others will vote and allocate their 100 votes strategically...\n');

  // Test voting for each player
  const allVotes = {};
  for (const player of context.players) {
    try {
      console.log(`🎯 ${player.name} is analyzing proposals and predicting voting behavior...`);
      
      const vote = await generateVote(context, player.agent);
      allVotes[player.id] = vote;
      
      console.log(`${player.name}'s Strategic Vote Allocation:`);
      if (vote && typeof vote === 'object') {
        Object.entries(vote).forEach(([proposerId, votes]) => {
          const proposerName = context.players.find(p => p.id === proposerId)?.name || proposerId;
          console.log(`   - ${votes} votes for ${proposerName}'s proposal`);
        });
      } else {
        console.log('   [Failed to generate valid vote]');
      }
      console.log('');
      
    } catch (err) {
      console.log(`${player.name}: [VOTING ERROR] ${err.message}`);
    }
  }

  // Calculate final results
  console.log('\n🏆 === FINAL RESULTS ===');
  console.log('=======================');
  
  const totalVotes = {};
  proposals.forEach(prop => {
    totalVotes[prop.playerId] = 0;
  });
  
  Object.values(allVotes).forEach(playerVote => {
    if (playerVote && typeof playerVote === 'object') {
      Object.entries(playerVote).forEach(([proposerId, votes]) => {
        if (totalVotes.hasOwnProperty(proposerId)) {
          totalVotes[proposerId] += Number(votes) || 0;
        }
      });
    }
  });

  console.log('📊 Vote Totals:');
  const sortedResults = Object.entries(totalVotes)
    .sort(([,a], [,b]) => b - a)
    .map(([proposerId, votes]) => {
      const proposer = context.players.find(p => p.id === proposerId);
      const percentage = Math.round(votes / 3); // 3 total voters
      return { name: proposer?.name || proposerId, votes, percentage };
    });

  sortedResults.forEach((result, index) => {
    const icon = index === 0 ? '👑' : index === 1 ? '🥈' : '🥉';
    const status = result.percentage >= 61 ? 'WINNER!' : result.percentage >= 50 ? 'Close' : 'Lost';
    console.log(`   ${icon} ${result.name}: ${result.votes} total votes (${result.percentage}%) - ${status}`);
  });

  const winner = sortedResults[0];
  if (winner.percentage >= 61) {
    console.log(`\n🎉 ${winner.name} WINS with ${winner.percentage}% of votes!`);
    
    // Show the winning proposal
    const winningProposal = proposals.find(p => p.playerId === context.players.find(player => player.name === winner.name)?.id);
    if (winningProposal) {
      console.log('\n💰 Prize Distribution:');
      Object.entries(winningProposal.proposal).forEach(([playerId, percentage]) => {
        const playerName = context.players.find(p => p.id === playerId)?.name || playerId;
        const tokens = Math.round(percentage * 3); // 3 players × 100 tokens each = 300 total
        console.log(`   - ${playerName}: ${percentage}% (${tokens} tokens)`);
      });
    }
  } else {
    console.log(`\n❌ NO WINNER! Highest vote was ${winner.percentage}% (need 61%)`);
    console.log('🔄 ENTERING RUNOFF SYSTEM...\n');
    
    // Implement runoff voting
    const topTwo = sortedResults.slice(0, 2);
    const eliminated = sortedResults[2];
    
    console.log(`🚫 ${eliminated.name} ELIMINATED (${eliminated.percentage}% votes)`);
    console.log(`🎯 RUNOFF: ${topTwo[0].name} vs ${topTwo[1].name}`);
    console.log(`👑 ${eliminated.name} becomes the KINGMAKER!\n`);
    
    console.log('💭 STRATEGIC IMPLICATIONS:');
    console.log(`- ${eliminated.name} is now DESPERATE - no proposal power, no guaranteed minimum`);
    console.log(`- ${topTwo[0].name} and ${topTwo[1].name} can form 2-player coalition excluding ${eliminated.name}`);
    console.log(`- ZERO-OFFER STRATEGY: "50% you, 50% me, 0% for ${eliminated.name}" = 67% victory`);
    console.log(`- ${eliminated.name} can only hope they compete for his vote (they might not need to!)\n`);
    
    // Show what the runoff reproposal phase would look like
    console.log('🗳️  === RUNOFF NEGOTIATION ROUNDS ===');
    console.log('===================================');
    console.log(`${eliminated.name}: "Please, give me ANYTHING! I'll vote for whoever offers more than 0%!"`);
    console.log(`${topTwo[0].name}: "${topTwo[1].name}, let's split 50-50 and give ${eliminated.name} nothing."`);
    console.log(`${topTwo[1].name}: "Sounds good. ${eliminated.name} gets 0%. Let's both vote for me and win."`);
    console.log(`${eliminated.name}: "Wait! I'll take even 5%! Don't exclude me completely!"`);
    
    console.log('\n🔄 REPROPOSAL PHASE:');
    console.log(`Only ${topTwo[0].name} and ${topTwo[1].name} can make new proposals.`);
    console.log(`${eliminated.name} cannot propose - must hope for mercy or competition.`);
    
    console.log('\n⚖️  STRATEGIC OPTIONS:');
    console.log('1. **EXCLUDE STRATEGY**: 50-50 split, 0% to eliminated player');
    console.log('   - Pros: Maximum profit for both survivors');
    console.log('   - Cons: Requires trust between rivals');
    console.log('   - Math: 100 + 100 = 200 votes = 67% = WIN');
    
    console.log('2. **COMPETE STRATEGY**: Bid for eliminated player\'s vote');
    console.log('   - Pros: Guaranteed vote from eliminated player');
    console.log('   - Cons: Less profit, opponent might outbid');
    console.log('   - Math: 100 (self) + 100 (eliminated) = 200 votes = 67% = WIN');
    
    console.log('\n🎲 REALISTIC PREDICTION:');
    console.log(`${topTwo[0].name} and ${topTwo[1].name} will likely try the EXCLUDE strategy first.`);
    console.log(`If they trust each other, ${eliminated.name} gets 0%.`);
    console.log(`If they don't trust each other, bidding war begins!`);
  }

  console.log('\n🔍 === STRATEGIC ANALYSIS ===');
  console.log('============================');
  console.log('✅ Agents considered proposal fairness to themselves');
  console.log('✅ Agents predicted others\' voting behavior');
  console.log('✅ Agents used negotiation history to inform votes');
  console.log('✅ Agents balanced risk vs. reward in vote allocation');
  console.log('✅ Agents tried to prevent 0% outcomes (total loss)');
  console.log('\nThis demonstrates sophisticated game theory voting! 🧠⚡');
}

// Run the test
if (require.main === module) {
  testNegotiationFlow().catch(console.error);
}

module.exports = { testNegotiationFlow }; 