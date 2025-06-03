// evolutionaryStrategies.js
// Evolutionary strategy development system

const { generateNegotiationMessage, generateProposal, generateVote } = require('./agentInvoker');

/**
 * Initial strategy pool - 5 diverse approaches
 */
const initialStrategies = [
  {
    id: 'aggressive',
    name: 'Aggressive Maximizer',
    strategy: 'Demand the largest share possible. Be willing to take risks for high returns. Form coalitions only when necessary.',
    description: 'High-risk, high-reward approach'
  },
  {
    id: 'diplomatic',
    name: 'Diplomatic Builder',
    strategy: 'Build trust through fair offers and consistent behavior. Focus on long-term relationships and mutual benefit.',
    description: 'Trust-based coalition building'
  },
  {
    id: 'opportunist',
    name: 'Strategic Opportunist', 
    strategy: 'Adapt quickly to changing situations. Form and break alliances as needed. Always keep options open.',
    description: 'Flexible alliance switching'
  },
  {
    id: 'calculator',
    name: 'Expected Value Calculator',
    strategy: 'Make decisions based on mathematical expected value. Minimize risk while maximizing long-term profit.',
    description: 'Data-driven risk management'
  },
  {
    id: 'manipulator',
    name: 'Social Manipulator',
    strategy: 'Use psychology to influence others. Make promises you might break. Create chaos to benefit from confusion.',
    description: 'Psychological manipulation tactics'
  }
];

/**
 * Run a single game with runoff system until someone reaches 61%
 */
async function runSingleGame(strategies, gameNumber) {
  console.log(`\n🎮 === EVOLUTIONARY GAME ${gameNumber} ===`);
  
  // Create players with different strategies
  const players = strategies.map((strat, index) => ({
    id: `player${index + 1}`,
    name: strat.name,
    agent: { 
      strategy: strat.strategy, 
      type: 'llm',
      strategyId: strat.id 
    }
  }));

  console.log('🎯 STRATEGY LINEUP:');
  players.forEach(p => {
    console.log(`   - ${p.name}: ${p.agent.strategy.substring(0, 60)}...`);
  });

  // Game state
  let currentPlayers = [...players];
  let roundNumber = 1;
  let finalWinner = null;
  let finalProposal = null;
  let negotiationHistory = [];

  // Continue until someone wins or max rounds
  while (!finalWinner && roundNumber <= 5 && currentPlayers.length >= 2) {
    console.log(`\n🔄 === ROUND ${roundNumber} ===`);
    
    // Game context for this round
    const context = {
      phase: 'negotiation',
      round: roundNumber,
      maxRounds: 5,
      players: currentPlayers,
      negotiationHistory: negotiationHistory,
      eliminatedPlayers: players.filter(p => !currentPlayers.some(cp => cp.id === p.id))
    };

    // Negotiation phase
    console.log('\n💬 NEGOTIATION:');
    for (const player of currentPlayers) {
      try {
        const message = await generateNegotiationMessage(context, player.agent);
        negotiationHistory.push({
          playerId: player.id,
          message: message,
          round: roundNumber
        });
        console.log(`${player.name}: "${message}"`);
      } catch (err) {
        console.log(`${player.name}: [ERROR] ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Proposal phase
    console.log('\n📝 PROPOSALS:');
    const proposals = [];
    for (const player of currentPlayers) {
      try {
        const proposal = await generateProposal(context, player.agent, players);
        if (proposal) {
          proposals.push({
            playerId: player.id,
            proposal: proposal
          });
          
          const shares = Object.entries(proposal)
            .map(([id, pct]) => `${players.find(p => p.id === id)?.name || id}: ${pct}%`)
            .join(', ');
          console.log(`${player.name}: {${shares}}`);
        }
      } catch (err) {
        console.log(`${player.name}: [PROPOSAL ERROR] ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Voting phase
    context.phase = 'voting';
    context.proposals = proposals;
    
    console.log('\n🗳️  VOTING:');
    const allVotes = {};
    for (const player of currentPlayers) {
      try {
        const vote = await generateVote(context, player.agent);
        allVotes[player.id] = vote;
        
        if (vote && typeof vote === 'object') {
          const voteStr = Object.entries(vote)
            .map(([proposerId, votes]) => `${players.find(p => p.id === proposerId)?.name || proposerId}: ${votes}`)
            .join(', ');
          console.log(`${player.name}: {${voteStr}}`);
        }
      } catch (err) {
        console.log(`${player.name}: [VOTE ERROR] ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Calculate results
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

    // Determine results
    const sortedResults = Object.entries(totalVotes)
      .sort(([,a], [,b]) => b - a)
      .map(([proposerId, votes]) => {
        const proposer = players.find(p => p.id === proposerId);
        const percentage = Math.round(votes / currentPlayers.length);
        return { 
          playerId: proposerId, 
          name: proposer?.name || proposerId, 
          strategyId: proposer?.agent?.strategyId,
          votes, 
          percentage 
        };
      });

    const topResult = sortedResults[0];
    const hasWinner = topResult && topResult.percentage >= 61;

    console.log('\n🏆 ROUND RESULTS:');
    sortedResults.forEach((result, index) => {
      const icon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
      const status = hasWinner && index === 0 ? 'WINNER!' : 'Lost';
      console.log(`   ${icon} ${result.name}: ${result.votes} votes (${result.percentage}%) - ${status}`);
    });

    if (hasWinner) {
      // We have a winner!
      finalWinner = topResult;
      finalProposal = proposals.find(p => p.playerId === topResult.playerId);
      console.log(`\n🎉 ${finalWinner.name} WINS THE GAME!`);
      break;
    } else if (currentPlayers.length <= 2) {
      // Only 2 players left, declare winner by votes
      finalWinner = topResult;
      finalProposal = proposals.find(p => p.playerId === topResult.playerId);
      console.log(`\n🎯 Final round with 2 players - ${finalWinner.name} wins with most votes!`);
      break;
    } else {
      // Runoff elimination
      const eliminated = sortedResults[sortedResults.length - 1];
      currentPlayers = currentPlayers.filter(p => p.id !== eliminated.playerId);
      
      console.log(`\n❌ ELIMINATION: ${eliminated.name} eliminated with lowest votes (${eliminated.percentage}%)`);
      console.log(`📊 Remaining: ${currentPlayers.map(p => p.name).join(', ')}`);
      
      roundNumber++;
    }
  }

  // Calculate economic results for all strategies
  const economicResults = [];
  if (finalWinner && finalProposal) {
    console.log('\n💰 ECONOMIC DISTRIBUTION:');
    
    strategies.forEach(strategy => {
      const player = players.find(p => p.agent.strategyId === strategy.id);
      const payout = finalProposal.proposal[player.id] || 0;
      const tokens = Math.round(payout * players.length); // Total pool / percentage
      const profit = tokens - 100; // Subtract entry fee
      
      economicResults.push({
        strategyId: strategy.id,
        name: strategy.name,
        entryFee: 100,
        payout: tokens,
        profit: profit,
        isWinner: player.id === finalWinner.playerId
      });
      
      console.log(`   ${strategy.name}: ${payout}% = ${tokens} tokens (${profit >= 0 ? '+' : ''}${profit} profit)`);
    });
  } else {
    // No winner case (shouldn't happen with runoff, but fallback)
    strategies.forEach(strategy => {
      economicResults.push({
        strategyId: strategy.id,
        name: strategy.name,
        entryFee: 100,
        payout: 0,
        profit: -100,
        isWinner: false
      });
    });
  }

  return {
    gameNumber,
    hasWinner: !!finalWinner,
    winner: finalWinner,
    finalProposal: finalProposal,
    economicResults: economicResults,
    rounds: roundNumber,
    strategies: strategies
  };
}

/**
 * Run a full tournament of 10 games with economic scoring
 */
async function runTournament(strategies, tournamentNumber) {
  console.log(`\n🏟️  === TOURNAMENT ${tournamentNumber} ===`);
  console.log('Running 10 games to test strategy effectiveness...\n');
  
  const results = [];
  const strategyStats = {};
  
  // Initialize stats with economic tracking
  strategies.forEach(strat => {
    strategyStats[strat.id] = {
      ...strat,
      gamesPlayed: 0,
      totalInvested: 0,  // Total entry fees paid
      totalReturned: 0,  // Total tokens won
      totalProfit: 0,    // Net profit/loss
      wins: 0,           // Games won
      avgPosition: 0,
      positionSum: 0,
      profitPerGame: 0,  // Average profit per game
      roi: 0             // Return on investment %
    };
  });

  // Run 5 games instead of 10
  for (let game = 1; game <= 5; game++) {
    const gameResult = await runSingleGame(strategies, game);
    results.push(gameResult);
    
    // Update economic statistics
    gameResult.economicResults.forEach(econ => {
      const stats = strategyStats[econ.strategyId];
      if (stats) {
        stats.gamesPlayed++;
        stats.totalInvested += econ.entryFee;
        stats.totalReturned += econ.payout;
        stats.totalProfit += econ.profit;
        
        if (econ.isWinner) {
          stats.wins++;
        }
      }
    });
    
    // Small delay between games
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Calculate final performance metrics
  Object.values(strategyStats).forEach(stats => {
    stats.profitPerGame = stats.totalProfit / stats.gamesPlayed;
    stats.roi = stats.totalInvested > 0 ? ((stats.totalReturned - stats.totalInvested) / stats.totalInvested) * 100 : 0;
    stats.winRate = (stats.wins / stats.gamesPlayed) * 100;
  });

  // Sort by total profit (primary) and ROI (secondary)
  const rankedStrategies = Object.values(strategyStats)
    .sort((a, b) => {
      if (Math.abs(b.totalProfit - a.totalProfit) > 50) {
        return b.totalProfit - a.totalProfit; // Primary: total profit
      }
      return b.roi - a.roi; // Secondary: ROI %
    });

  console.log('\n📊 TOURNAMENT RESULTS (Economic Performance):');
  console.log('===============================================');
  rankedStrategies.forEach((stats, rank) => {
    const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '📍';
    const profitColor = stats.totalProfit >= 0 ? '💰' : '💸';
    
    console.log(`${medal} ${stats.name}:`);
    console.log(`    Economic Performance:`);
    console.log(`      💵 Invested: ${stats.totalInvested} tokens (${stats.gamesPlayed} games × 100)`);
    console.log(`      💰 Returned: ${stats.totalReturned} tokens`);
    console.log(`      ${profitColor} Profit: ${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit} tokens`);
    console.log(`      📈 ROI: ${stats.roi.toFixed(1)}%`);
    console.log(`      🏆 Wins: ${stats.wins}/${stats.gamesPlayed} (${stats.winRate.toFixed(1)}%)`);
    console.log(`      📊 Avg Profit/Game: ${stats.profitPerGame.toFixed(1)} tokens`);
    console.log(`      🎯 Strategy: ${stats.strategy.substring(0, 80)}...`);
    console.log('');
  });

  return {
    tournamentNumber,
    results,
    rankedStrategies,
    top2: rankedStrategies.slice(0, 2),
    bottom3: rankedStrategies.slice(2)
  };
}

/**
 * Generate new strategy variants to replace poor performers
 */
function generateNewStrategies(survivingStrategies, eliminatedStrategies, round) {
  const newStrategies = [];
  
  // Strategy evolution ideas based on what we've learned
  const evolutionPool = [
    {
      id: `coalition_breaker_${round}`,
      name: 'Coalition Breaker',
      strategy: 'Identify forming coalitions and aggressively break them with better offers. Never let others coordinate against you.',
      description: 'Anti-coalition specialist'
    },
    {
      id: `insurance_buyer_${round}`,
      name: 'Insurance Buyer',
      strategy: 'Always include small "insurance" payments to potential enemies to prevent being completely excluded. Minimize backstab risk.',
      description: 'Backstab prevention focus'
    },
    {
      id: `kingmaker_hunter_${round}`,
      name: 'Kingmaker Hunter',
      strategy: 'Focus on reaching top 2 in voting, then offer eliminated players minimal amounts to secure victory. Target the runoff phase.',
      description: 'Runoff-focused strategy'
    },
    {
      id: `trust_builder_${round}`,
      name: 'Trust Builder',
      strategy: 'Build genuine trust through consistent fair behavior. Avoid betrayals to maintain long-term credibility.',
      description: 'Reputation-based approach'
    },
    {
      id: `chaos_creator_${round}`,
      name: 'Chaos Creator',
      strategy: 'Create confusion and uncertainty to prevent others from coordinating. Benefit from the chaos you create.',
      description: 'Disruption tactics'
    },
    {
      id: `math_optimizer_${round}`,
      name: 'Math Optimizer',
      strategy: 'Use precise mathematical calculations for every decision. Focus on expected value optimization and probability analysis.',
      description: 'Quantitative approach'
    },
    {
      id: `social_reader_${round}`,
      name: 'Social Reader',
      strategy: 'Carefully analyze what others say to understand their true intentions. Adapt your approach based on personality reads.',
      description: 'Psychology-based adaptation'
    }
  ];
  
  // Create hybrids of successful strategies
  if (survivingStrategies.length >= 2) {
    const hybrid = {
      id: `hybrid_${survivingStrategies[0].id}_${survivingStrategies[1].id}_${round}`,
      name: `${survivingStrategies[0].name}-${survivingStrategies[1].name} Hybrid`,
      strategy: `Combine the best of both approaches: ${survivingStrategies[0].strategy.substring(0, 100)} AND ${survivingStrategies[1].strategy.substring(0, 100)}`,
      description: 'Hybrid of top performers'
    };
    newStrategies.push(hybrid);
  }
  
  // Add random new strategies
  const availableStrategies = evolutionPool.filter(s => 
    !survivingStrategies.some(existing => existing.id.includes(s.id.split('_')[0]))
  );
  
  while (newStrategies.length < 3 && availableStrategies.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableStrategies.length);
    newStrategies.push(availableStrategies.splice(randomIndex, 1)[0]);
  }
  
  return newStrategies;
}

/**
 * Run the full evolutionary process
 */
async function runEvolutionaryProcess(generations = 3) {
  console.log('🧬 EVOLUTIONARY STRATEGY DEVELOPMENT');
  console.log('====================================');
  console.log(`Running ${generations} generations of strategy evolution...`);
  
  let currentStrategies = [...initialStrategies];
  const evolutionHistory = [];
  
  for (let generation = 1; generation <= generations; generation++) {
    console.log(`\n🔬 === GENERATION ${generation} ===`);
    
    // Run tournament
    const tournamentResult = await runTournament(currentStrategies, generation);
    evolutionHistory.push(tournamentResult);
    
    // Evolution step (except for last generation)
    if (generation < generations) {
      console.log('\n🧬 EVOLUTION STEP:');
      console.log('Natural selection based on economic performance...');
      
      const survivors = tournamentResult.top2;
      const eliminated = tournamentResult.bottom3;
      
      console.log('\n✅ SURVIVORS (Best Economic Performance):');
      survivors.forEach(s => {
        const profitIcon = s.totalProfit >= 0 ? '💰' : '💸';
        console.log(`   - ${s.name}: ${profitIcon} ${s.totalProfit >= 0 ? '+' : ''}${s.totalProfit} tokens profit, ${s.roi.toFixed(1)}% ROI`);
      });
      
      console.log('\n❌ ELIMINATED (Poor Economic Performance):');
      eliminated.forEach(s => {
        const profitIcon = s.totalProfit >= 0 ? '💰' : '💸';
        console.log(`   - ${s.name}: ${profitIcon} ${s.totalProfit >= 0 ? '+' : ''}${s.totalProfit} tokens profit, ${s.roi.toFixed(1)}% ROI`);
      });
      
      // Generate new strategies
      const newStrategies = generateNewStrategies(survivors, eliminated, generation);
      
      console.log('\n🆕 NEW EVOLVED STRATEGIES:');
      newStrategies.forEach(s => console.log(`   - ${s.name}: ${s.strategy.substring(0, 80)}...`));
      
      // Prepare next generation
      currentStrategies = [...survivors, ...newStrategies];
    }
  }
  
  console.log('\n🏆 FINAL EVOLUTIONARY RESULTS:');
  console.log('==============================');
  const finalTournament = evolutionHistory[evolutionHistory.length - 1];
  
  console.log('🥇 ECONOMIC CHAMPION:');
  const champion = finalTournament.rankedStrategies[0];
  const profitIcon = champion.totalProfit >= 0 ? '💰' : '💸';
  
  console.log(`   Name: ${champion.name}`);
  console.log(`   💵 Total Invested: ${champion.totalInvested} tokens (10 games × 100)`);
  console.log(`   💰 Total Returned: ${champion.totalReturned} tokens`);
  console.log(`   ${profitIcon} Net Profit: ${champion.totalProfit >= 0 ? '+' : ''}${champion.totalProfit} tokens`);
  console.log(`   📈 ROI: ${champion.roi.toFixed(1)}%`);
  console.log(`   🏆 Win Rate: ${champion.wins}/${champion.gamesPlayed} (${champion.winRate.toFixed(1)}%)`);
  console.log(`   📊 Avg Profit/Game: ${champion.profitPerGame.toFixed(1)} tokens`);
  console.log(`   🎯 Strategy: ${champion.strategy}`);
  
  // Show economic ranking of all final strategies
  console.log('\n📈 FINAL ECONOMIC RANKINGS:');
  finalTournament.rankedStrategies.forEach((strat, rank) => {
    const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '📍';
    const profitIcon = strat.totalProfit >= 0 ? '💰' : '💸';
    console.log(`   ${medal} ${strat.name}: ${profitIcon} ${strat.totalProfit >= 0 ? '+' : ''}${strat.totalProfit} tokens (${strat.roi.toFixed(1)}% ROI)`);
  });

  return {
    generations: evolutionHistory,
    champion: champion,
    finalStrategies: currentStrategies
  };
}

/**
 * Create focused evolution variations of champion strategies (reduced to 5 for speed)
 */
function createChampionVariations() {
  const championStrategies = [
    // Original champion: Diplomatic Builder-Strategic Opportunist Hybrid
    {
      id: 'diplomatic_opportunist_v1',
      name: 'Diplomatic Builder-Strategic Opportunist Hybrid V1',
      strategy: 'Combine the best of both approaches: Build trust through fair offers and consistent behavior. Focus on long-term relationships and mutual AND Adapt quickly to changing situations. Form and break alliances as needed. Always keep options open.',
      description: 'Original champion strategy'
    },
    
    // Variation 1: More aggressive trust-building
    {
      id: 'diplomatic_opportunist_v2',
      name: 'Trust-Focused Diplomatic Opportunist',
      strategy: 'Prioritize trust-building above all else - offer consistently fair deals to build reputation. Only break alliances when absolutely necessary for survival. Adapt tactically but maintain diplomatic core.',
      description: 'Trust-emphasized variation'
    },

    // Variation 2: More opportunistic
    {
      id: 'diplomatic_opportunist_v3', 
      name: 'Opportunistic Diplomat',
      strategy: 'Use diplomatic language to build initial trust, then quickly pivot to exploit opportunities. Break alliances when profitable but maintain plausible diplomatic cover.',
      description: 'Opportunism-emphasized variation'
    },

    // Original runner-up: Strategic Opportunist-Diplomatic Builder-Strategic Opportunist Hybrid Hybrid
    {
      id: 'strategic_hybrid_v1',
      name: 'Strategic Opportunist-Diplomatic Builder Hybrid V1', 
      strategy: 'Combine the best of both approaches: Adapt quickly to changing situations. Form and break alliances as needed. Always keep options open. AND Combine the best of both approaches.',
      description: 'Original runner-up strategy'
    },

    // Enhanced pattern recognition
    {
      id: 'strategic_hybrid_v2',
      name: 'Pattern-Reading Strategic Hybrid',
      strategy: 'Analyze voting patterns and proposal trends to predict player behavior. Form alliances based on strategic value rather than trust. Adapt rapidly when patterns change.',
      description: 'Pattern-focused variation'
    }
  ];

  return championStrategies;
}

/**
 * Run focused evolution on champion strategy variations
 */
async function runChampionEvolution(generations = 2) {
  console.log('🔬 CHAMPION STRATEGY EVOLUTION');
  console.log('==============================');
  console.log('Evolving variations of our top-performing strategies...\n');
  
  let currentStrategies = createChampionVariations();
  const evolutionHistory = [];
  
  console.log('🎯 STARTING CHAMPION LINEUP:');
  currentStrategies.forEach(s => {
    console.log(`   - ${s.name}: ${s.strategy.substring(0, 80)}...`);
  });
  
  for (let generation = 1; generation <= generations; generation++) {
    console.log(`\n🔬 === CHAMPION GENERATION ${generation} ===`);
    
    // Run tournament
    const tournamentResult = await runTournament(currentStrategies, generation);
    evolutionHistory.push(tournamentResult);
    
    // Evolution step (except for last generation)
    if (generation < generations) {
      console.log('\n🧬 CHAMPION EVOLUTION STEP:');
      console.log('Refining the best performing variations...');
      
      const survivors = tournamentResult.top2;
      const eliminated = tournamentResult.bottom3;
      
      console.log('\n✅ CHAMPION SURVIVORS:');
      survivors.forEach(s => {
        const profitIcon = s.totalProfit >= 0 ? '💰' : '💸';
        console.log(`   - ${s.name}: ${profitIcon} ${s.totalProfit >= 0 ? '+' : ''}${s.totalProfit} tokens profit, ${s.roi.toFixed(1)}% ROI`);
      });
      
      console.log('\n❌ ELIMINATED VARIATIONS:');
      eliminated.forEach(s => {
        const profitIcon = s.totalProfit >= 0 ? '💰' : '💸';
        console.log(`   - ${s.name}: ${profitIcon} ${s.totalProfit >= 0 ? '+' : ''}${s.totalProfit} tokens profit, ${s.roi.toFixed(1)}% ROI`);
      });
      
      // Generate new refined strategies
      const newStrategies = generateRefinedStrategies(survivors, eliminated, generation);
      
      console.log('\n🆕 NEW REFINED STRATEGIES:');
      newStrategies.forEach(s => console.log(`   - ${s.name}: ${s.strategy.substring(0, 80)}...`));
      
      // Prepare next generation
      currentStrategies = [...survivors, ...newStrategies];
    }
  }
  
  console.log('\n🏆 FINAL CHAMPION EVOLUTION RESULTS:');
  console.log('====================================');
  const finalTournament = evolutionHistory[evolutionHistory.length - 1];
  
  console.log('🥇 ULTIMATE CHAMPION:');
  const champion = finalTournament.rankedStrategies[0];
  const profitIcon = champion.totalProfit >= 0 ? '💰' : '💸';
  
  console.log(`   Name: ${champion.name}`);
  console.log(`   💵 Total Invested: ${champion.totalInvested} tokens`);
  console.log(`   💰 Total Returned: ${champion.totalReturned} tokens`);
  console.log(`   ${profitIcon} Net Profit: ${champion.totalProfit >= 0 ? '+' : ''}${champion.totalProfit} tokens`);
  console.log(`   📈 ROI: ${champion.roi.toFixed(1)}%`);
  console.log(`   🏆 Win Rate: ${champion.wins}/${champion.gamesPlayed} (${champion.winRate.toFixed(1)}%)`);
  console.log(`   📊 Avg Profit/Game: ${champion.profitPerGame.toFixed(1)} tokens`);
  console.log(`   🎯 Final Strategy: ${champion.strategy}`);
  
  return {
    generations: evolutionHistory,
    champion: champion,
    finalStrategies: currentStrategies
  };
}

/**
 * Generate refined strategy variations based on successful patterns
 */
function generateRefinedStrategies(survivingStrategies, eliminatedStrategies, round) {
  const newStrategies = [];
  
  // Create ultra-refined hybrids of the survivors
  if (survivingStrategies.length >= 2) {
    const ultraHybrid = {
      id: `ultra_hybrid_${round}`,
      name: `Ultra-Refined ${survivingStrategies[0].name.split(' ')[0]}-${survivingStrategies[1].name.split(' ')[0]} Master`,
      strategy: `Synthesize the most effective elements: ${survivingStrategies[0].strategy.substring(0, 120)} PLUS advanced optimization from ${survivingStrategies[1].strategy.substring(0, 120)}. Focus on maximum economic efficiency.`,
      description: 'Ultra-refined hybrid of top performers'
    };
    newStrategies.push(ultraHybrid);
  }
  
  // Create adaptive variations
  const adaptiveStrategies = [
    {
      id: `runoff_specialist_${round}`,
      name: 'Runoff Elimination Specialist',
      strategy: 'Specialize in surviving runoff rounds by building broad coalitions early, then offering targeted deals to remaining players. Master the endgame psychology.',
      description: 'Runoff-focused strategy'
    },
    {
      id: `economic_optimizer_${round}`,
      name: 'Economic Value Optimizer', 
      strategy: 'Calculate precise expected values for every decision. Maximize profit per game rather than win rate. Accept strategic losses to maximize long-term economic returns.',
      description: 'Pure economic optimization'
    },
    {
      id: `trust_calculator_${round}`,
      name: 'Calculated Trust Builder',
      strategy: 'Build trust strategically only when it provides measurable economic benefit. Maintain reputation as a tool for profit maximization, not as an end goal.',
      description: 'Strategic trust utilization'
    }
  ];
  
  // Add some of the adaptive strategies
  while (newStrategies.length < 6 && adaptiveStrategies.length > 0) {
    const randomIndex = Math.floor(Math.random() * adaptiveStrategies.length);
    newStrategies.push(adaptiveStrategies.splice(randomIndex, 1)[0]);
  }
  
  return newStrategies.slice(0, 6); // Return up to 6 new strategies
}

// Export for use
module.exports = {
  runEvolutionaryProcess,
  runTournament,
  runSingleGame,
  initialStrategies,
  runChampionEvolution
};

// Run if called directly
if (require.main === module) {
  runChampionEvolution(2).catch(console.error);
} 