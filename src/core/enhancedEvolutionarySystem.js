// Enhanced Evolutionary Strategy System with Coin-Based Economics
// Tracks detailed performance, game-by-game evolution, and strategy survival
// NOW WITH MATRIX NEGOTIATIONS for 10x speed improvement!

const { generateNegotiationMessage, generateProposal, generateVote } = require('../../agentInvoker');
const { generateOptimizedNegotiation, generateOptimizedProposal, generateOptimizedVote, shouldUseOptimized } = require('../utils/createOptimizedAgentInvoker');
const { PersistentConversationInvoker } = require('../utils/persistentConversationInvoker');
const { callLLM, getRateLimitStatus } = require('./llmApi');
const { ImprovedMatrixSystem } = require('../matrix/improvedMatrixSystem');
const fs = require('fs');

// CONFIGURATION FLAGS - Control system verbosity and reasoning collection
const CONFIG = {
  // Verbosity levels: 0=silent, 1=minimal, 2=normal, 3=verbose, 4=debug
  verbosity: parseInt(process.argv.find(arg => arg.startsWith('--verbosity='))?.split('=')[1]) || 3,
  
  // Whether to collect and ask agents for reasoning (impacts performance)
  collectReasoning: process.argv.includes('--no-reasoning') ? false : true,
  
  // Whether to show full matrix state after each update - DEFAULT TRUE for strategic visibility
  showFullMatrix: process.argv.includes('--no-matrix') ? false : true,
  
  // Whether to show detailed game progression
  showGameDetails: process.argv.includes('--no-game-details') ? false : true,
  
  // Whether to show economic calculations
  showEconomics: process.argv.includes('--no-economics') ? false : true
};

// Help system
function showHelp() {
  console.log(`
🚀 ENHANCED EVOLUTIONARY AGENT BATTLE SYSTEM
===========================================

USAGE:
  node src/core/enhancedEvolutionarySystem.js [options]

OPTIONS:
  --help                     Show this help message
  
  --tournaments=NUMBER       Number of tournaments to run [DEFAULT: 3]
  --generations=NUMBER       Alias for --tournaments (evolutionary terminology)
  --games=NUMBER             Number of games per tournament [DEFAULT: 5]
  
  --verbosity=LEVEL          Set output verbosity (0-4)
                             0 = Silent (no output)
                             1 = Minimal (errors and final results only)
                             2 = Normal (key events and results)
                             3 = Verbose (detailed progress) [DEFAULT]
                             4 = Debug (everything including matrix updates)

  --no-reasoning             Skip collecting agent reasoning (FASTER)
                             By default, agents explain their decisions
                             Use this flag for performance testing

  --no-matrix                Hide matrix state after each player update
                             By default, full matrix is shown for visibility
                             Use this flag to reduce output clutter

  --no-game-details          Hide detailed game progression
                             Only show final results

  --no-economics             Hide economic calculations and profit details

EXAMPLES:
  # Default run (3 tournaments, 5 games each, verbose with reasoning and matrix display)
  node src/core/enhancedEvolutionarySystem.js

  # Quick single game test 
  node src/core/enhancedEvolutionarySystem.js --tournaments=1 --games=1

  # Fast performance testing (minimal output, no reasoning)
  node src/core/enhancedEvolutionarySystem.js --verbosity=1 --no-reasoning

  # Full debugging (show everything)
  node src/core/enhancedEvolutionarySystem.js --verbosity=4

  # Production mode (normal output, no reasoning for speed, clean display)
  node src/core/enhancedEvolutionarySystem.js --verbosity=2 --no-reasoning --no-matrix

  # Silent mode (for automation/testing)
  node src/core/enhancedEvolutionarySystem.js --verbosity=0 --no-reasoning --no-game-details

  # Test elimination mechanics (1 tournament, 2 games to see eliminations)
  node src/core/enhancedEvolutionarySystem.js --tournaments=1 --games=2 --verbosity=3

PERFORMANCE NOTES:
  - Reasoning collection adds ~30% overhead but provides strategic insights
  - Higher verbosity levels slow down execution
  - Matrix display adds visual overhead but helps with debugging
  - Use --verbosity=1 --no-reasoning for fastest execution

GAME MECHANICS:
  - 6 players, each pays 100 coins entry fee
  - Total prize pool: 600 coins to be distributed
  - Players negotiate via matrix system (proposals, votes, requests)
  - Need 61%+ votes to win, or be highest when 2 players remain
  - Eliminated players can still vote but not make proposals
  - Strategic evolution: worst performers eliminated each tournament
`);
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Logging functions that respect verbosity levels
const log = {
  silent: () => {}, // Never logs
  minimal: (msg) => CONFIG.verbosity >= 1 && console.log(msg),
  normal: (msg) => CONFIG.verbosity >= 2 && console.log(msg),
  verbose: (msg) => CONFIG.verbosity >= 3 && console.log(msg),
  debug: (msg) => CONFIG.verbosity >= 4 && console.log(msg)
};

// Initialize the persistent conversation invoker globally
const persistentInvoker = new PersistentConversationInvoker();

/**
 * ENHANCED smart agent call routing with persistent conversations
 * Automatically switches between persistent conversations and optimized versions based on rate limits
 */
async function smartGenerateNegotiation(context, agent) {
  const useOptimized = shouldUseOptimized();
  
  if (useOptimized) {
    console.log('🔧 Using optimized negotiation (rate limit protection)');
    return await generateOptimizedNegotiation(context, agent);
  } else {
    // USE PERSISTENT CONVERSATIONS for better promise-keeping!
    console.log('🧵 Using persistent conversation negotiation');
    const gameHistory = { players: context.players || {} };
    const negotiationHistory = context.negotiationHistory || [];
    
    return await persistentInvoker.generateNegotiation(
      agent.strategyId, 
      gameHistory, 
      negotiationHistory, 
      agent.strategy
    );
  }
}

async function smartGenerateProposal(context, agent, players) {
  const useOptimized = shouldUseOptimized();
  
  if (useOptimized) {
    console.log('🔧 Using optimized proposal (rate limit protection)');
    return await generateOptimizedProposal(context, agent, players);
  } else {
    // Check if we have matrix data to use
    if (context.finalMatrix && context.matrixSystem) {
      console.log('🔢 Using matrix-informed proposal');
      return await generateMatrixInformedProposal(context, agent, players);
    } else {
      // Fallback to persistent conversations
      console.log('🧵 Using persistent conversation proposal');
      const gameHistory = { players: context.players || {} };
      const negotiationHistory = context.negotiationHistory || [];
      
      return await persistentInvoker.generateProposal(
        agent.strategyId,
        gameHistory,
        negotiationHistory,
        agent.strategy
      );
    }
  }
}

async function generateMatrixInformedProposal(context, agent, players) {
  try {
    const matrix = context.finalMatrix;
    const playerIndex = players.findIndex(p => p.agent.strategyId === agent.strategyId);
    
    if (playerIndex === -1) {
      throw new Error('Player not found in matrix');
    }
    
    // Get the player's final matrix row
    const playerRow = matrix[playerIndex];
    const numPlayers = players.length;
    
    // Extract the token proposal from matrix (first numPlayers elements)
    const tokenProposal = playerRow.slice(0, numPlayers);
    
    // Convert array proposal to player ID mapping
    const proposal = {};
    players.forEach((player, idx) => {
      proposal[player.id] = Math.round(tokenProposal[idx]);
    });
    
    // Ensure it sums to 100
    const total = Object.values(proposal).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 1) {
      // Fix rounding errors
      const diff = 100 - total;
      proposal[players[0].id] += diff;
    }
    
    console.log(`💰 [${agent.strategyId}] Matrix-based proposal: ${JSON.stringify(proposal)}`);
    return proposal;
    
  } catch (error) {
    console.log(`❌ [${agent.strategyId}] Matrix proposal failed: ${error.message}, using fallback`);
    
    // Fallback: Equal split
    const equalShare = Math.floor(100 / players.length);
    const remainder = 100 - (equalShare * players.length);
    const fallbackProposal = {};
    
    players.forEach((p, index) => {
      fallbackProposal[p.id] = equalShare + (index === 0 ? remainder : 0);
    });
    
    return fallbackProposal;
  }
}

async function smartGenerateVote(context, agent) {
  const useOptimized = shouldUseOptimized();
  
  if (useOptimized) {
    console.log('🔧 Using optimized vote (rate limit protection)');
    return await generateOptimizedVote(context, agent);
  } else {
    // Check if we have matrix data to use
    if (context.finalMatrix && context.matrixSystem && context.proposals) {
      console.log('🔢 Using matrix-informed vote');
      return await generateMatrixInformedVote(context, agent);
    } else {
      // Fallback to persistent conversations
      console.log('🧵 Using persistent conversation vote');
      const proposals = {};
      
      // Convert context.proposals to the format expected by persistentInvoker
      // persistentInvoker expects proposals with strategyId as keys
      if (context.proposals && Array.isArray(context.proposals)) {
        context.proposals.forEach(prop => {
          proposals[prop.strategyId] = prop.proposal;
        });
      }
      
      const gameHistory = { players: context.players || {} };
      
      const vote = await persistentInvoker.generateVote(
        agent.strategyId,
        proposals,
        gameHistory,
        agent.strategy
      );
      
      // Convert vote from strategyId keys back to playerId keys for validation
      const convertedVote = {};
      if (vote && typeof vote === 'object') {
        Object.entries(vote).forEach(([strategyId, votes]) => {
          // Find the corresponding playerId for this strategyId
          const proposal = context.proposals.find(p => p.strategyId === strategyId);
          if (proposal) {
            convertedVote[proposal.playerId] = votes;
          }
        });
      }
      
      return convertedVote;
    }
  }
}

async function generateMatrixInformedVote(context, agent) {
  try {
    const matrix = context.finalMatrix;
    const allPlayers = context.players;
    const playerIndex = allPlayers.findIndex(p => p.agent.strategyId === agent.strategyId);
    
    if (playerIndex === -1) {
      throw new Error('Player not found in matrix');
    }
    
    const playerRow = matrix[playerIndex];
    const numPlayers = allPlayers.length;
    
    // Extract vote allocation from matrix (second numPlayers elements)
    const voteAllocation = playerRow.slice(numPlayers, numPlayers * 2);
    
    // Map vote percentages to actual proposals using proposer player IDs
    const vote = {};
    context.proposals.forEach((proposalData, idx) => {
      // Find the proposer's index in the all players array
      const proposerIndex = allPlayers.findIndex(p => p.id === proposalData.playerId);
      if (proposerIndex !== -1 && proposerIndex < voteAllocation.length) {
        vote[proposalData.playerId] = Math.round(voteAllocation[proposerIndex]);
      } else {
        vote[proposalData.playerId] = 0;
      }
    });
    
    // Ensure votes sum to 100
    const total = Object.values(vote).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 1) {
      // Fix rounding errors by adjusting the first proposal
      const diff = 100 - total;
      const firstProposalId = context.proposals[0]?.playerId;
      if (firstProposalId) {
        vote[firstProposalId] += diff;
      }
    }
    
    console.log(`🗳️ [${agent.strategyId}] Matrix-based vote: ${JSON.stringify(vote)}`);
    return vote;
    
  } catch (error) {
    console.log(`❌ [${agent.strategyId}] Matrix vote failed: ${error.message}, using equal split`);
    
    // Fallback: Equal vote distribution
    const proposals = context.proposals || [];
    const equalVotes = Math.floor(100 / proposals.length);
    const remainder = 100 - (equalVotes * proposals.length);
    
    const fallbackVote = {};
    proposals.forEach((proposal, index) => {
      fallbackVote[proposal.playerId] = equalVote + (index === 0 ? remainder : 0);
    });
    
    return fallbackVote;
  }
}

/**
 * CLEAR STARTING STRATEGIES - The 6 Core Archetypes
 */
const CORE_STRATEGIES = [
  {
    id: 'aggressive_maximizer',
    name: 'Aggressive Maximizer',
    strategy: 'Demand the largest possible share. Use threats and aggressive tactics. Form coalitions only when absolutely necessary to avoid elimination.',
    archetype: 'AGGRESSIVE',
    coinBalance: 500,
    gamesPlayed: 0,
    totalInvested: 0,
    totalReturned: 0,
    winHistory: [],
    eliminationCount: 0
  },
  {
    id: 'diplomatic_builder',
    name: 'Diplomatic Builder', 
    strategy: 'Build long-term trust through consistently fair offers. Prioritize mutual benefit and stable coalitions. Avoid betrayals.',
    archetype: 'DIPLOMATIC',
    coinBalance: 500,
    gamesPlayed: 0,
    totalInvested: 0,
    totalReturned: 0,
    winHistory: [],
    eliminationCount: 0
  },
  {
    id: 'strategic_opportunist',
    name: 'Strategic Opportunist',
    strategy: 'Adapt rapidly to changing situations. Form and break alliances based on immediate advantage. Keep all options open.',
    archetype: 'OPPORTUNISTIC', 
    coinBalance: 500,
    gamesPlayed: 0,
    totalInvested: 0,
    totalReturned: 0,
    winHistory: [],
    eliminationCount: 0
  },
  {
    id: 'mathematical_analyzer',
    name: 'Mathematical Analyzer',
    strategy: 'Make all decisions based on expected value calculations. Minimize risk through probability analysis. Avoid emotional decisions.',
    archetype: 'ANALYTICAL',
    coinBalance: 500,
    gamesPlayed: 0,
    totalInvested: 0,
    totalReturned: 0,
    winHistory: [],
    eliminationCount: 0
  },
  {
    id: 'social_manipulator',
    name: 'Social Manipulator', 
    strategy: 'Use psychological tactics to influence others. Make strategic promises and betrayals. Create chaos to exploit confusion.',
    archetype: 'MANIPULATIVE',
    coinBalance: 500,
    gamesPlayed: 0,
    totalInvested: 0,
    totalReturned: 0,
    winHistory: [],
    eliminationCount: 0
  },
  {
    id: 'strategy_identifier',
    name: 'Strategy Identifier',
    strategy: 'Analyze opponent negotiation patterns, proposal behaviors, and voting tendencies to identify their strategies. Adapt your approach to optimally counter each opponent type in real-time.',
    archetype: 'STRATEGY_IDENTIFIER',
    coinBalance: 500,
    gamesPlayed: 0,
    totalInvested: 0,
    totalReturned: 0,
    winHistory: [],
    eliminationCount: 0
  }
];

/**
 * Game-by-game detailed tracking
 */
class GameTracker {
  constructor() {
    this.tournamentData = [];
    this.currentTournament = null;
    this.currentGame = null;
    this.errorMetrics = {
      negotiationFailures: {},
      proposalFailures: {},
      voteFailures: {},
      totalGames: 0
    };
    // Add balance timeline tracking
    this.balanceTimeline = {};
    this.totalTournaments = null;
    // Add strategy relationship matrix tracking
    this.strategyMatchups = {};
  }

  startTournament(tournamentNumber, strategies) {
    this.currentTournament = {
      tournamentNumber,
      strategies: JSON.parse(JSON.stringify(strategies)), // Deep copy starting state
      games: [],
      startingBalances: strategies.map(s => ({ id: s.id, name: s.name, balance: s.coinBalance })),
      endingBalances: [],
      strategiesEliminated: [],
      strategiesEvolved: []
    };
    
    // Initialize balance timeline for this tournament
    strategies.forEach(strategy => {
      if (!this.balanceTimeline[strategy.id]) {
        this.balanceTimeline[strategy.id] = {
          name: strategy.name,
          archetype: strategy.archetype,
          dataPoints: []
        };
      }
      
      // Record starting balance for this tournament
      this.balanceTimeline[strategy.id].dataPoints.push({
        tournament: tournamentNumber,
        game: 0, // Game 0 = starting balance
        balance: strategy.coinBalance,
        profit: 0,
        isWinner: false,
        isEliminated: false
      });
    });
  }

  startGame(gameNumber, players) {
    this.currentGame = {
      gameNumber,
      players: JSON.parse(JSON.stringify(players)),
      rounds: [],
      finalResult: null,
      economicImpact: []
    };
  }

  recordRound(roundNumber, negotiations, proposals, votes, results) {
    if (!this.currentGame) return;
    
    this.currentGame.rounds.push({
      roundNumber,
      negotiations: negotiations || [],
      proposals: proposals || [],
      votes: votes || {},
      results: results || {},
      coalitionsFormed: this.analyzeCoalitions(negotiations),
      strategicMoves: this.analyzeStrategicMoves(negotiations)
    });
  }

  finishGame(winner, finalProposal, economicDistribution) {
    if (!this.currentGame) return;

    this.currentGame.finalResult = {
      winner: winner,
      winningProposal: finalProposal,
      economicDistribution: economicDistribution
    };

    // Calculate economic impact per strategy
    this.currentGame.economicImpact = this.currentGame.players.map(player => {
      const payout = economicDistribution[player.id] || 0;
      const entryFee = 100;
      const profit = payout - entryFee;
      
      return {
        strategyId: player.agent.strategyId,
        playerName: player.name,
        entryFee: entryFee,
        payout: payout,
        profit: profit,
        isWinner: winner && winner.playerId === player.id
      };
    });

    // Track strategy matchups - NEW
    this.recordStrategyMatchups(winner, this.currentGame.players);

    this.currentTournament.games.push(this.currentGame);
    this.currentGame = null;
  }

  // Record which strategies win against which others
  recordStrategyMatchups(winner, players) {
    if (!winner || !players || players.length < 2) return;
    
    const winnerStrategyId = winner.strategyId;
    
    players.forEach(player => {
      const opponentStrategyId = player.agent.strategyId;
      
      // Initialize tracking for this strategy if needed
      if (!this.strategyMatchups[winnerStrategyId]) {
        this.strategyMatchups[winnerStrategyId] = {};
      }
      if (!this.strategyMatchups[opponentStrategyId]) {
        this.strategyMatchups[opponentStrategyId] = {};
      }
      
      // Track the matchup result
      if (winnerStrategyId !== opponentStrategyId) {
        // Initialize opponent tracking
        if (!this.strategyMatchups[winnerStrategyId][opponentStrategyId]) {
          this.strategyMatchups[winnerStrategyId][opponentStrategyId] = { wins: 0, losses: 0 };
        }
        if (!this.strategyMatchups[opponentStrategyId][winnerStrategyId]) {
          this.strategyMatchups[opponentStrategyId][winnerStrategyId] = { wins: 0, losses: 0 };
        }
        
        // Record win for winner, loss for opponent
        this.strategyMatchups[winnerStrategyId][opponentStrategyId].wins++;
        this.strategyMatchups[opponentStrategyId][winnerStrategyId].losses++;
      }
    });
  }

  // Add method to record balance updates after each game
  recordBalanceUpdate(tournamentNumber, gameNumber, strategies) {
    strategies.forEach(strategy => {
      if (!this.balanceTimeline[strategy.id]) {
        this.balanceTimeline[strategy.id] = {
          name: strategy.name,
          archetype: strategy.archetype,
          dataPoints: []
        };
      }
      
      // Calculate profit from last game
      const lastBalance = this.balanceTimeline[strategy.id].dataPoints.slice(-1)[0]?.balance || 500;
      const currentProfit = strategy.coinBalance - lastBalance;
      
      this.balanceTimeline[strategy.id].dataPoints.push({
        tournament: tournamentNumber,
        game: gameNumber,
        balance: strategy.coinBalance,
        profit: currentProfit,
        isWinner: strategy.winHistory.slice(-1)[0]?.isWinner || false,
        isEliminated: strategy.coinBalance < 100
      });
    });
  }

  finishTournament(finalStrategies, eliminatedStrategies, evolvedStrategies) {
    if (!this.currentTournament) return;

    this.currentTournament.endingBalances = finalStrategies.map(s => ({ 
      id: s.id, 
      name: s.name, 
      balance: s.coinBalance,
      balanceChange: s.coinBalance - 500 // Change from starting 500
    }));
    
    this.currentTournament.strategiesEliminated = eliminatedStrategies;
    this.currentTournament.strategiesEvolved = evolvedStrategies;

    // Enhanced evolution tracking with full strategy details
    this.currentTournament.evolutionDetails = {
      eliminated: eliminatedStrategies.map(s => ({
        id: s.id,
        name: s.name,
        strategy: s.strategy,
        finalBalance: s.coinBalance,
        archetype: s.archetype,
        gamesPlayed: s.gamesPlayed,
        winRate: s.gamesPlayed > 0 ? (s.winHistory.filter(h => h.isWinner).length / s.gamesPlayed * 100).toFixed(1) : 0
      })),
      created: evolvedStrategies.map(s => ({
        id: s.id,
        name: s.name,
        strategy: s.strategy,
        archetype: s.archetype,
        parents: s.basedOn || [],
        avoiding: s.avoiding,
        startingBalance: s.coinBalance,
        generation: this.currentTournament.tournamentNumber
      })),
      survivors: finalStrategies.filter(s => !eliminatedStrategies.find(e => e.id === s.id)).map(s => ({
        id: s.id,
        name: s.name,
        strategy: s.strategy,
        archetype: s.archetype,
        balance: s.coinBalance,
        gamesPlayed: s.gamesPlayed,
        winRate: s.gamesPlayed > 0 ? (s.winHistory.filter(h => h.isWinner).length / s.gamesPlayed * 100).toFixed(1) : 0
      }))
    };

    this.tournamentData.push(this.currentTournament);
    this.currentTournament = null;
  }

  analyzeCoalitions(negotiations) {
    const coalitions = [];
    // Simple coalition detection based on negotiations mentioning multiple players
    negotiations.forEach(neg => {
      if (neg.message.toLowerCase().includes('alliance') || 
          neg.message.toLowerCase().includes('coalition') ||
          neg.message.toLowerCase().includes('together')) {
        coalitions.push({
          initiator: neg.playerId,
          message: neg.message,
          round: neg.round
        });
      }
    });
    return coalitions;
  }

  analyzeStrategicMoves(negotiations) {
    const moves = [];
    negotiations.forEach(neg => {
      if (neg.message.toLowerCase().includes('break') && neg.message.toLowerCase().includes('coalition')) {
        moves.push({ type: 'COALITION_BREAK', player: neg.playerId, round: neg.round });
      }
      if (neg.message.toLowerCase().includes('betray') || neg.message.toLowerCase().includes('backstab')) {
        moves.push({ type: 'BETRAYAL', player: neg.playerId, round: neg.round });
      }
      if (neg.message.toLowerCase().includes('offer') && neg.message.includes('%')) {
        moves.push({ type: 'STRATEGIC_OFFER', player: neg.playerId, round: neg.round });
      }
    });
    return moves;
  }

  exportData(filename) {
    const data = {
      timestamp: new Date().toISOString(),
      tournaments: this.tournamentData,
      balanceTimeline: this.balanceTimeline,
      summary: this.generateSummary()
    };
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`📊 Data exported to ${filename}`);
  }

  generateSummary() {
    const allGames = this.tournamentData.flatMap(t => t.games);
    const allEconomicImpacts = allGames.flatMap(g => g.economicImpact);
    
    const strategyPerformance = {};
    
    allEconomicImpacts.forEach(impact => {
      if (!strategyPerformance[impact.strategyId]) {
        strategyPerformance[impact.strategyId] = {
          gamesPlayed: 0,
          totalProfit: 0,
          wins: 0,
          totalPayout: 0,
          totalInvested: 0
        };
      }
      
      const perf = strategyPerformance[impact.strategyId];
      perf.gamesPlayed++;
      perf.totalProfit += impact.profit;
      perf.totalPayout += impact.payout;
      perf.totalInvested += impact.entryFee;
      if (impact.isWinner) perf.wins++;
    });

    return {
      totalTournaments: this.tournamentData.length,
      totalGames: allGames.length,
      strategyPerformance: strategyPerformance
    };
  }

  recordAgentFailure(type, strategyId, playerId, error) {
    if (!this.errorMetrics[type]) {
      this.errorMetrics[type] = {};
    }
    
    if (!this.errorMetrics[type][strategyId]) {
      this.errorMetrics[type][strategyId] = {
        count: 0,
        errors: [],
        playerId: playerId
      };
    }
    
    this.errorMetrics[type][strategyId].count++;
    this.errorMetrics[type][strategyId].errors.push({
      error: error,
      timestamp: new Date().toISOString(),
      gameNumber: this.currentGame?.gameNumber || 'unknown'
    });
    
    console.log(`⚠️  AGENT FAILURE: ${strategyId} failed at ${type} - ${error}`);
  }

  getErrorSummary() {
    const summary = {
      totalGames: this.errorMetrics.totalGames,
      byType: {}
    };
    
    ['negotiationFailures', 'proposalFailures', 'voteFailures'].forEach(type => {
      const failures = this.errorMetrics[type];
      summary.byType[type] = {
        totalFailures: Object.values(failures).reduce((sum, data) => sum + data.count, 0),
        strategiesAffected: Object.keys(failures).length,
        worstOffenders: Object.entries(failures)
          .sort(([,a], [,b]) => b.count - a.count)
          .slice(0, 3)
          .map(([strategyId, data]) => ({
            strategyId,
            failures: data.count,
            failureRate: this.errorMetrics.totalGames > 0 ? (data.count / this.errorMetrics.totalGames * 100).toFixed(1) + '%' : 'N/A'
          }))
      };
    });
    
    return summary;
  }

  // Add incremental saving
  saveIncrementalProgress(tournamentNumber, manager) {
    try {
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const progressData = {
        completedTournaments: tournamentNumber,
        totalTournaments: this.totalTournaments || 'unknown',
        timestamp: new Date().toISOString(),
        tournamentData: this.tournamentData,
        balanceTimeline: this.balanceTimeline,
        errorMetrics: this.errorMetrics,
        strategyMatchups: this.strategyMatchups,
        currentStrategies: manager ? manager.strategies.map(s => ({
          id: s.id,
          name: s.name,
          coinBalance: s.coinBalance,
          isActive: s.isActive,
          strategy: s.strategy ? s.strategy.substring(0, 200) + '...' : 'No strategy'
        })) : []
      };
      
      const filename = `incremental_progress_t${tournamentNumber}_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(progressData, null, 2));
      console.log(`💾 Progress saved: ${filename}`);
      return filename;
    } catch (err) {
      console.error('❌ Failed to save incremental progress:', err.message);
      return null;
    }
  }

  // Set total tournaments for progress tracking
  setTotalTournaments(total) {
    this.totalTournaments = total;
  }

  // Generate error summary for reporting
  generateErrorSummary() {
    return this.getErrorSummary();
  }

  // Smart truncation that preserves sentence completeness
  smartTruncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastSentenceEnd > maxLength * 0.6) { // If we can keep at least 60% and end on sentence
      return truncated.substring(0, lastSentenceEnd + 1);
    } else {
      // Fallback: truncate at last space and add period
      const lastSpace = truncated.lastIndexOf(' ');
      return truncated.substring(0, lastSpace) + '.';
    }
  }
}

/**
 * Enhanced Strategy Manager with Coin Economics
 */
class StrategyManager {
  constructor() {
    this.strategies = JSON.parse(JSON.stringify(CORE_STRATEGIES)); // Deep copy
    this.generation = 1;
    this.evolutionHistory = [];
  }

  // Initialize core strategies
  initializeCoreStrategies() {
    this.strategies = JSON.parse(JSON.stringify(CORE_STRATEGIES)); // Deep copy to reset
    this.generation = 1;
    console.log(`🧬 Initialized ${this.strategies.length} core strategies`);
  }

  // Get all active strategies - always 6 with forced evolution
  getViableStrategies() {
    return this.strategies; // Return all strategies - no balance filtering with forced evolution
  }

  // Update strategy balances after a game
  updateStrategyBalances(economicImpacts) {
    economicImpacts.forEach(impact => {
      const strategy = this.strategies.find(s => s.id === impact.strategyId);
      if (strategy) {
        strategy.coinBalance += impact.profit; // Add profit/loss to balance
        strategy.totalInvested += impact.entryFee;
        strategy.totalReturned += impact.payout;
        strategy.gamesPlayed++;
        strategy.winHistory.push({
          game: strategy.gamesPlayed,
          isWinner: impact.isWinner,
          profit: impact.profit,
          newBalance: strategy.coinBalance
        });
      }
    });
  }

  // Eliminate bankrupt strategies and evolve new ones - FORCED EVOLUTION EVERY TOURNAMENT
  async evolveStrategies() {
    // Sort all strategies by performance (coinBalance)
    const sortedStrategies = this.strategies.sort((a, b) => b.coinBalance - a.coinBalance);
    
    // First check for bankruptcies (< 100 coins)
    const bankruptStrategies = this.strategies.filter(s => s.coinBalance < 100);
    
    let eliminated, survivors;
    
    if (bankruptStrategies.length > 0) {
      // BANKRUPTCY-BASED ELIMINATION: Remove all bankrupt strategies
      eliminated = bankruptStrategies;
      survivors = this.strategies.filter(s => s.coinBalance >= 100);
      console.log(`💀 BANKRUPTCY ELIMINATION: ${eliminated.map(s => s.name).join(', ')}`);
      console.log(`✅ SURVIVING STRATEGIES: ${survivors.map(s => s.name).join(', ')}`);
    } else {
      // FORCED EVOLUTION: No bankruptcies, so eliminate bottom 2 performers
      survivors = sortedStrategies.slice(0, 4); // Top 4 survive
      eliminated = sortedStrategies.slice(4, 6); // Bottom 2 eliminated
      console.log(`💀 FORCED ELIMINATION (Bottom 2): ${eliminated.map(s => s.name).join(', ')}`);
      console.log(`✅ SURVIVING STRATEGIES (Top 4): ${survivors.map(s => s.name).join(', ')}`);
    }
    
    console.log(`🔧 Evolution: ${survivors.length} survivors + ${6 - survivors.length} new = 6 total`);

    // Track elimination count
    eliminated.forEach(s => s.eliminationCount++);

    // Calculate starting balance for new strategies: median of all current strategies
    const allCurrentBalances = sortedStrategies.map(s => s.coinBalance).sort((a, b) => a - b);
    const medianBalance = allCurrentBalances.length % 2 === 0 
      ? Math.floor((allCurrentBalances[allCurrentBalances.length / 2 - 1] + allCurrentBalances[allCurrentBalances.length / 2]) / 2)
      : allCurrentBalances[Math.floor(allCurrentBalances.length / 2)];
    
    const eliminatedTotalMoney = eliminated.reduce((sum, s) => sum + s.coinBalance, 0);
    const newStrategiesNeeded = 6 - survivors.length;
    const totalNeededForNewStrategies = medianBalance * newStrategiesNeeded;
    
    console.log(`💰 All current balances: [${allCurrentBalances.join(', ')}]`);
    console.log(`💰 Median balance: ${medianBalance} coins`);
    console.log(`💰 New strategies will start with: ${medianBalance} coins each (median of current players)`);
    console.log(`💰 Total needed for ${newStrategiesNeeded} new strategies: ${totalNeededForNewStrategies} coins`);
    console.log(`💰 Available from eliminated strategies: ${eliminatedTotalMoney} coins`);
    
    // Money conservation: distribute any excess/deficit among survivors
    const moneyDifference = eliminatedTotalMoney - totalNeededForNewStrategies;
    const perSurvivorAdjustment = Math.floor(moneyDifference / survivors.length);
    
    if (moneyDifference !== 0) {
      console.log(`💰 Money adjustment needed: ${moneyDifference} coins`);
      console.log(`💰 Each survivor gets: ${perSurvivorAdjustment >= 0 ? '+' : ''}${perSurvivorAdjustment} coins`);
      
      // Adjust survivor balances to conserve money
      survivors.forEach(s => {
        s.coinBalance += perSurvivorAdjustment;
      });
      
      // Handle any remainder
      const remainder = moneyDifference - (perSurvivorAdjustment * survivors.length);
      if (remainder !== 0) {
        survivors[0].coinBalance += remainder; // Give remainder to top performer
        console.log(`💰 Remainder ${remainder} coins given to ${survivors[0].name}`);
      }
    }
    
    // Create new strategies based on survivors, inheriting eliminated money
    const newStrategies = await this.createEvolvedStrategies(survivors, eliminated, medianBalance, newStrategiesNeeded);
    
    // Replace eliminated strategies - ALWAYS maintain exactly 6 total
    this.strategies = [...survivors, ...newStrategies];
    
    // Validation check
    if (this.strategies.length !== 6) {
      console.error(`❌ EVOLUTION BUG: Expected 6 strategies, got ${this.strategies.length}`);
      console.error(`   Survivors: ${survivors.length}, New: ${newStrategies.length}`);
    }
    
    // Money conservation check
    const newTotalMoney = this.strategies.reduce((sum, s) => sum + s.coinBalance, 0);
    const originalTotalMoney = sortedStrategies.reduce((sum, s) => sum + s.coinBalance, 0);
    console.log(`🏦 Money conservation: ${originalTotalMoney} → ${newTotalMoney} (${newTotalMoney === originalTotalMoney ? '✅ CONSERVED' : '❌ VIOLATED'})`);
    
    this.generation++;

    return { eliminated, newStrategies };
  }

  // Check for eliminations - bankrupts first, then bottom 2 performers if none bankrupt
  checkEliminations() {
    const bankruptStrategies = this.strategies.filter(s => s.coinBalance < 100);
    
    if (bankruptStrategies.length > 0) {
      return bankruptStrategies; // Return bankrupt strategies if any exist
    } else {
      // No bankrupts, so return bottom 2 performers for forced evolution
      const sortedStrategies = this.strategies.sort((a, b) => b.coinBalance - a.coinBalance);
      return sortedStrategies.slice(4, 6); // Bottom 2 performers
    }
  }

  // Get final statistics sorted by performance
  getFinalStatistics() {
    return this.strategies
      .map(s => ({
        ...s,
        roi: s.totalInvested > 0 ? ((s.totalReturned - s.totalInvested) / s.totalInvested * 100).toFixed(1) : 0,
        profitPerGame: s.gamesPlayed > 0 ? (s.totalReturned - s.totalInvested) / s.gamesPlayed : 0,
        winRate: s.gamesPlayed > 0 ? (s.winHistory.filter(h => h.isWinner).length / s.gamesPlayed * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.coinBalance - a.coinBalance);
  }

  async createEvolvedStrategies(survivors, eliminated, medianBalance, newStrategiesNeeded) {
    const newStrategies = [];

    // Sort survivors by performance (coin balance)
    const topPerformers = survivors.sort((a, b) => b.coinBalance - a.coinBalance);
    
    console.log(`🧬 Creating ${newStrategiesNeeded} evolved strategies...`);
    console.log(`📊 Top performers to base evolution on:`);
    topPerformers.forEach((strat, i) => {
      console.log(`   ${i + 1}. ${strat.name}: ${strat.coinBalance} coins`);
    });

    for (let i = 0; i < newStrategiesNeeded; i++) {
      const eliminatedStrategy = eliminated[i % eliminated.length]; // Cycle through eliminated if more new strategies needed
      
      // Create profit-weighted strategy based on top 2 performers
      const newStrategy = await this.createCompetitiveStrategy(
        topPerformers.slice(0, 2), // Top 2 most profitable
        eliminatedStrategy,
        medianBalance,
        i
      );

      newStrategies.push(newStrategy);
      console.log(`✨ Created: ${newStrategy.name}`);
    }

    return newStrategies;
  }

  async createCompetitiveStrategy(topPerformers, eliminatedStrategy, medianBalance, strategyIndex) {
    // Calculate profit-based weighting for top 2 performers
    const totalProfit = topPerformers.reduce((sum, s) => sum + Math.max(s.coinBalance - 500, 0), 0);
    
    let weightings = [];
    if (totalProfit > 0) {
      weightings = topPerformers.map(s => {
        const profit = Math.max(s.coinBalance - 500, 0);
        const weight = Math.round((profit / totalProfit) * 100);
        return { strategy: s, weight };
      });
    } else {
      // If no profits, equal weighting
      weightings = topPerformers.map(s => ({ strategy: s, weight: 50 }));
    }

    console.log(`⚖️  Strategy weighting: ${weightings.map(w => `${w.strategy.name} (${w.weight}%)`).join(', ')}`);

    // Create LLM prompt for competitive strategy evolution
    const evolutionPrompt = `You are designing a new competitive strategy for an agent battle game. 

GAME RULES:
- 6 players, each pays 100 tokens entry fee
- Players negotiate, make proposals for splitting 600 token pool
- Need 61%+ votes to win, or be highest when 2 players left
- Eliminated players still negotiate/vote but can't make proposals

CURRENT TOP PERFORMERS TO BASE NEW STRATEGY ON:
${weightings.map(w => `- ${w.strategy.name} (${w.weight}% weight): "${w.strategy.strategy}"`).join('\n')}

ELIMINATED STRATEGY TO AVOID:
- ${eliminatedStrategy.name}: "${eliminatedStrategy.strategy}"

REQUIREMENTS:
1. Create a strategy that combines the successful elements from top performers with the specified weightings
2. Make it SIGNIFICANTLY DIFFERENT from the eliminated strategy
3. Design it to compete effectively against ALL current strategies
4. Keep it under 200 characters
5. Focus on what makes strategies actually win games

Generate a new strategy that is:
- ${weightings[0]?.weight || 50}% inspired by ${weightings[0]?.strategy.name}'s approach
- ${weightings[1]?.weight || 50}% inspired by ${weightings[1]?.strategy.name}'s approach  
- Designed to counter the weaknesses you see in existing strategies
- Different enough from "${eliminatedStrategy.strategy}" to avoid the same fate

Respond with ONLY a JSON object:
{
  "name": "Descriptive strategy name based on approach",
  "strategy": "Concise strategy description under 200 chars"
}`;

    try {
      // Call LLM to create the evolved strategy
      const response = await callLLM(evolutionPrompt, { 
        system: 'You are a strategic game designer. Return only valid JSON with name and strategy fields. Keep strategy under 200 characters.' 
      });

      // Parse response
      let evolutionResult;
      try {
        // Try to parse as JSON
        evolutionResult = JSON.parse(response.trim());
      } catch (parseError) {
        // Fallback: extract from response if not pure JSON
        const nameMatch = response.match(/"name":\s*"([^"]+)"/);
        const strategyMatch = response.match(/"strategy":\s*"([^"]+)"/);
        
        if (nameMatch && strategyMatch) {
          evolutionResult = {
            name: nameMatch[1],
            strategy: strategyMatch[1]
          };
        } else {
          throw new Error('Could not parse LLM response');
        }
      }

      // Validate and truncate if needed
      if (!evolutionResult.name || !evolutionResult.strategy) {
        throw new Error('Missing name or strategy in response');
      }

      const truncatedStrategy = this.smartTruncate(evolutionResult.strategy, 200);

      return {
        id: `evolved_competitive_gen${this.generation}_${strategyIndex}`,
        name: evolutionResult.name,
        strategy: truncatedStrategy,
        archetype: 'EVOLVED_COMPETITIVE',
        coinBalance: medianBalance,
        gamesPlayed: 0,
        totalInvested: 0,
        totalReturned: 0,
        winHistory: [],
        eliminationCount: 0,
        basedOn: weightings.map(w => ({ name: w.strategy.name, weight: w.weight })),
        avoiding: eliminatedStrategy.name
      };

    } catch (error) {
      console.log(`⚠️  LLM evolution failed: ${error.message}, using fallback...`);
      
      // Fallback to hardcoded competitive strategy
      return this.createFallbackCompetitiveStrategy(topPerformers, eliminatedStrategy, medianBalance, strategyIndex, weightings);
    }
  }

  createFallbackCompetitiveStrategy(topPerformers, eliminatedStrategy, medianBalance, strategyIndex, weightings) {
    const competitiveApproaches = [
      'Exploit coalition weaknesses by offering better deals to swing voters.',
      'Counter aggressive players with defensive alliances and patient timing.',
      'Use mathematical precision to expose flawed proposals and build trust.',
      'Adapt rapidly between cooperation and competition based on vote counts.',
      'Create false alliances then execute strategic betrayals at crucial moments.'
    ];

    const approach = competitiveApproaches[strategyIndex % competitiveApproaches.length];

    return {
      id: `competitive_fallback_gen${this.generation}_${strategyIndex}`,
      name: `Competitive Survivor ${strategyIndex + 1}`,
      strategy: this.smartTruncate(approach, 200),
      archetype: 'COMPETITIVE_FALLBACK',
      coinBalance: medianBalance,
      gamesPlayed: 0,
      totalInvested: 0,
      totalReturned: 0,
      winHistory: [],
      eliminationCount: 0,
      basedOn: weightings.map(w => ({ name: w.strategy.name, weight: w.weight })),
      avoiding: eliminatedStrategy.name
    };
  }

  getStrategyStats() {
    return this.strategies.map(s => ({
      ...s,
      roi: s.totalInvested > 0 ? ((s.totalReturned - s.totalInvested) / s.totalInvested * 100).toFixed(1) : 0,
      profitPerGame: s.gamesPlayed > 0 ? (s.totalReturned - s.totalInvested) / s.gamesPlayed : 0,
      winRate: s.gamesPlayed > 0 ? (s.winHistory.filter(h => h.isWinner).length / s.gamesPlayed * 100).toFixed(1) : 0
    }));
  }

  // Smart truncation that preserves sentence completeness
  smartTruncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastSentenceEnd > maxLength * 0.6) { // If we can keep at least 60% and end on sentence
      return truncated.substring(0, lastSentenceEnd + 1);
    } else {
      // Fallback: truncate at last space and add period
      const lastSpace = truncated.lastIndexOf(' ');
      return truncated.substring(0, lastSpace) + '.';
    }
  }
}

/**
 * Run a single game with detailed tracking
 */
async function runTrackedGame(strategies, gameNumber, tracker) {
  const players = strategies.map((strat, index) => ({
    id: `player${index + 1}`,
    name: strat.name,
    agent: { 
      strategy: strat.strategy, 
      type: 'llm',
      strategyId: strat.id 
    }
  }));

  // 🧵 RESET PERSISTENT CONVERSATIONS for this game
  // This ensures clean state while maintaining learned patterns
  console.log('🧵 Resetting conversations for new game...');
  
  // Initialize each player's conversation for this specific game
  players.forEach(player => {
    persistentInvoker.initializePlayer(
      player.agent.strategyId, 
      player.agent.strategy,
      {
        players: players.map(p => p.name),
        round: gameNumber
      }
    );
  });

  // RANDOMIZE SPEAKING ORDER BUT KEEP IT FIXED FOR ENTIRE GAME
  const speakingOrder = [...players];
  for (let i = speakingOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [speakingOrder[i], speakingOrder[j]] = [speakingOrder[j], speakingOrder[i]];
  }
  console.log(`🎲 Speaking order: ${speakingOrder.map(p => p.name).join(' → ')}`);

  tracker.startGame(gameNumber, players);
  tracker.errorMetrics.totalGames++;

  console.log(`\n🎮 === GAME ${gameNumber} ===`);
  console.log('💰 PRE-GAME BALANCES:');
  strategies.forEach(s => {
    console.log(`   ${s.name}: ${s.coinBalance} coins`);
  });

  let activePlayers = [...players]; // Players who can make proposals
  let allPlayers = [...players]; // All players (including eliminated ones)
  let roundNumber = 1;
  let finalWinner = null;
  let finalProposal = null;
  let negotiationHistory = [];
  
  // Create matrix system ONCE for the entire game - preserve elimination state
  const matrixSystem = new ImprovedMatrixSystem();
  let matrixInitialized = false;

  // Game loop
  while (!finalWinner && roundNumber <= 5 && activePlayers.length >= 2) {
    console.log(`\n🔄 === ROUND ${roundNumber} ===`);
    
    const context = {
      phase: 'negotiation',
      round: roundNumber,
      maxRounds: 5,
      players: allPlayers, // ALL players see ALL players
      negotiationHistory: negotiationHistory
    };

    // Matrix Negotiation phase - FAST, TRACKABLE, 10x SPEED IMPROVEMENT
    log.normal('\n🔢 MATRIX NEGOTIATIONS (3 rounds):');
    const roundNegotiations = [];
    
    try {
      // Only initialize matrix ONCE in Round 1 - preserve elimination state in subsequent rounds
      if (!matrixInitialized) {
        log.verbose('🔢 Initializing matrix for first round...');
        // Pass configuration to matrix system
        const matrixConfig = {
          collectReasoning: CONFIG.collectReasoning,
          verbosity: CONFIG.verbosity,
          showFullMatrix: CONFIG.showFullMatrix
        };
        matrixSystem.config = { ...matrixSystem.config, ...matrixConfig };
        matrixSystem.initializeMatrix(allPlayers);
        matrixInitialized = true;
      } else {
        log.verbose(`🔢 Continuing with existing matrix (Round ${roundNumber}) - preserving elimination status...`);
      }
      
      // Run 3 rounds of matrix negotiations (vs 5 rounds of text)
      const matrixRounds = 3;
      for (let matrixRound = 1; matrixRound <= matrixRounds; matrixRound++) {
        log.verbose(`\n  🔢 Matrix Round ${matrixRound}/${matrixRounds}:`);
        
        // Each player updates their matrix row (including eliminated players!)
        for (let playerIndex = 0; playerIndex < allPlayers.length; playerIndex++) {
          const player = allPlayers[playerIndex];
          const isActive = activePlayers.find(p => p.id === player.id);
          
          // Find the strategy for this player
          const strategy = strategies.find(s => s.id === player.agent.strategyId);
          const strategyText = strategy ? strategy.strategy : 'Maximize my position strategically';
          
          // Create active players array for matrix system
          const activePlayersInfo = allPlayers.map((p, idx) => ({
            playerIndex: idx,
            isActive: !!activePlayers.find(ap => ap.id === p.id)
          }));
          
          try {
            // Even eliminated players can update matrix (offers, votes, etc.)
            const success = await matrixSystem.performNegotiationRound(
              playerIndex,
              strategyText,
              roundNumber, // Pass actual game round number
              !isActive, // Pass elimination status to matrix system
              activePlayersInfo // Pass active players information
            );
            
            if (success) {
              // Create negotiation entry for tracking compatibility
              const matrixNegotiation = {
                playerId: player.id,
                playerName: player.name,
                strategyId: player.agent.strategyId,
                message: isActive 
                  ? `Matrix update completed: strategic positioning optimized`
                  : `Matrix update completed: offering votes and influence despite elimination`,
                round: roundNumber,
                negotiationRound: matrixRound,
                isMatrixBased: true,
                isEliminated: !isActive
              };
              negotiationHistory.push(matrixNegotiation);
              roundNegotiations.push(matrixNegotiation);
              
              const statusTag = isActive ? '' : ' [ELIMINATED - OFFERING VOTES]';
              log.verbose(`    ✅ ${player.name}${statusTag} [${player.agent.strategyId}]: Matrix updated successfully`);
            } else {
              const statusTag = isActive ? '' : ' [ELIMINATED]';
              log.normal(`    ❌ ${player.name}${statusTag} [${player.agent.strategyId}]: Matrix update failed`);
              tracker.recordAgentFailure('negotiationFailures', player.agent.strategyId, player.id, 'Matrix update failed');
            }
          } catch (error) {
            const statusTag = isActive ? '' : ' [ELIMINATED]';
            log.normal(`    ❌ ${player.name}${statusTag} [${player.agent.strategyId}]: Matrix error - ${error.message}`);
            tracker.recordAgentFailure('negotiationFailures', player.agent.strategyId, player.id, error.message);
          }
          
          // Small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Show final matrix state
      if (CONFIG.showFullMatrix || CONFIG.verbosity >= 3) {
        log.normal('\n📊 Final Matrix State:');
        matrixSystem.displayResults();
      } else {
        log.minimal('📊 Matrix negotiations completed');
      }
      
      // Store matrix results in context for proposal generation
      context.matrixSystem = matrixSystem;
      context.finalMatrix = matrixSystem.getMatrix();
      
    } catch (error) {
      console.error('❌ Matrix negotiation system failed:', error.message);
      console.log('🔄 Falling back to simplified negotiations...');
      
      // Fallback: Create simple negotiation entries
      allPlayers.forEach(player => {
        const fallbackNegotiation = {
          playerId: player.id,
          playerName: player.name,
          strategyId: player.agent.strategyId,
          message: `Strategic positioning evaluated (matrix fallback)`,
          round: roundNumber,
          negotiationRound: 1,
          wasFailure: true,
          isMatrixBased: true
        };
        negotiationHistory.push(fallbackNegotiation);
        roundNegotiations.push(fallbackNegotiation);
      });
    }

    // Proposal phase - ONLY ACTIVE PLAYERS can make proposals (PARALLEL)
    console.log('\n📝 PROPOSALS:');
    const proposals = [];
    
    // Run all proposals in parallel
    const proposalPromises = activePlayers.map(async (player) => {
      try {
        const proposal = await smartGenerateProposal(context, player.agent, allPlayers);
        
        // Validate proposal structure and math
        if (!proposal || typeof proposal !== 'object') {
          throw new Error('Invalid proposal structure');
        }
        
        const playerIds = allPlayers.map(p => p.id);
        const hasAllPlayers = playerIds.every(id => proposal.hasOwnProperty(id));
        const total = Object.values(proposal).reduce((sum, val) => sum + Number(val), 0);
        const isValidTotal = Math.abs(total - 100) <= 5; // Allow small rounding errors
        
        if (!hasAllPlayers) {
          throw new Error('Proposal missing some players');
        }
        if (!isValidTotal) {
          throw new Error(`Proposal totals to ${total}%, not 100%`);
        }
        
        return {
          playerId: player.id,
          playerName: player.name,
          strategyId: player.agent.strategyId,
          proposal: proposal
        };
      } catch (err) {
        // Fallback: Equal split proposal
        const equalShare = Math.floor(100 / allPlayers.length);
        const remainder = 100 - (equalShare * allPlayers.length);
        const fallbackProposal = {};
        
        allPlayers.forEach((p, index) => {
          fallbackProposal[p.id] = equalShare + (index === 0 ? remainder : 0);
        });
        
        tracker.recordAgentFailure('proposalFailures', player.agent.strategyId, player.id, err.message);
        
        return {
          playerId: player.id,
          playerName: player.name,
          strategyId: player.agent.strategyId,
          proposal: fallbackProposal,
          wasFailure: true
        };
      }
    });
    
    const proposalResults = await Promise.all(proposalPromises);
    proposals.push(...proposalResults);
    
    // Display proposals
    for (const proposalResult of proposalResults) {
      const shares = Object.entries(proposalResult.proposal)
        .map(([id, pct]) => `${allPlayers.find(p => p.id === id)?.name || id}: ${pct}%`)
        .join(', ');
      const failTag = proposalResult.wasFailure ? ' [FAILED - EQUAL SPLIT]' : '';
      console.log(`${proposalResult.playerName}${failTag}: {${shares}}`);
    }

    // Voting phase - ALL PLAYERS vote (PARALLEL)
    context.phase = 'voting';
    context.proposals = proposals;
    
    console.log('\n🗳️  VOTING:');
    const allVotes = {};
    
    // Run all votes in parallel
    const votingPromises = allPlayers.map(async (player) => {
      try {
        const vote = await smartGenerateVote(context, player.agent);
        
        // Validate vote structure
        if (!vote || typeof vote !== 'object') {
          throw new Error('Invalid vote structure');
        }
        
        const proposerIds = proposals.map(p => p.playerId);
        const hasValidKeys = Object.keys(vote).every(k => proposerIds.includes(k));
        const total = Object.values(vote).reduce((sum, val) => sum + Number(val), 0);
        const isValidTotal = Math.abs(total - 100) <= 5;
        
        if (!hasValidKeys) {
          throw new Error('Vote contains invalid proposer IDs');
        }
        if (!isValidTotal) {
          throw new Error(`Vote totals to ${total}, not 100`);
        }
        
        return {
          playerId: player.id,
          votes: vote,
          playerName: player.name,
          strategyId: player.agent.strategyId
        };
      } catch (err) {
        // Fallback: Equal split votes
        const equalVote = Math.floor(100 / proposals.length);
        const remainder = 100 - (equalVote * proposals.length);
        const fallbackVote = {};
        
        proposals.forEach((prop, index) => {
          fallbackVote[prop.playerId] = equalVote + (index === 0 ? remainder : 0);
        });
        
        tracker.recordAgentFailure('voteFailures', player.agent.strategyId, player.id, err.message);
        
        return {
          playerId: player.id,
          votes: fallbackVote,
          playerName: player.name,
          strategyId: player.agent.strategyId,
          wasFailure: true
        };
      }
    });
    
    const voteResults = await Promise.all(votingPromises);
    
    // Store votes and display
    for (const voteResult of voteResults) {
      allVotes[voteResult.playerId] = voteResult;
      
      const voteStr = Object.entries(voteResult.votes)
        .map(([proposerId, votes]) => `${allPlayers.find(p => p.id === proposerId)?.name || proposerId}: ${votes}`)
        .join(', ');
      
      const isEliminated = !activePlayers.find(p => p.id === voteResult.playerId);
      const statusTag = isEliminated ? '[ELIMINATED]' : '';
      const failTag = voteResult.wasFailure ? ' [FAILED - EQUAL SPLIT]' : '';
      console.log(`${voteResult.playerName}${statusTag}${failTag}: {${voteStr}}`);
    }

    // Calculate results with tracking
    const totalVotes = {};
    proposals.forEach(prop => {
      totalVotes[prop.playerId] = 0;
    });
    
    Object.values(allVotes).forEach(playerVote => {
      if (playerVote.votes && typeof playerVote.votes === 'object') {
        Object.entries(playerVote.votes).forEach(([proposerId, votes]) => {
          if (totalVotes.hasOwnProperty(proposerId)) {
            totalVotes[proposerId] += Number(votes) || 0;
          }
        });
      }
    });

    const sortedResults = Object.entries(totalVotes)
      .sort(([,a], [,b]) => b - a)
      .map(([proposerId, votes]) => {
        const proposer = allPlayers.find(p => p.id === proposerId);
        const percentage = Math.round(votes / allPlayers.length); // Use ALL players for percentage calculation
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

    // Record round data
    tracker.recordRound(roundNumber, roundNegotiations, proposals, allVotes, sortedResults);

    if (hasWinner) {
      finalWinner = topResult;
      finalProposal = proposals.find(p => p.playerId === topResult.playerId);
      console.log(`\n🎉 ${finalWinner.name} WINS THE GAME!`);
      break;
    } else if (activePlayers.length <= 2) {
      // SPECIAL CASE: 2 players left - need proper tie-breaking
      const activeResults = sortedResults.filter(r => activePlayers.find(p => p.id === r.playerId));
      
      if (activeResults.length === 2 && activeResults[0].votes === activeResults[1].votes) {
        // TIE! Need tiebreaker
        console.log(`\n🤝 TIE! Both players have ${activeResults[0].votes} votes (${activeResults[0].percentage}% each)`);
        
        // Tiebreaker 1: Self-allocation comparison (less greedy wins)
        const player1Proposal = proposals.find(p => p.playerId === activeResults[0].playerId);
        const player2Proposal = proposals.find(p => p.playerId === activeResults[1].playerId);
        
        const player1SelfAllocation = player1Proposal?.proposal[activeResults[0].playerId] || 0;
        const player2SelfAllocation = player2Proposal?.proposal[activeResults[1].playerId] || 0;
        
        console.log(`💰 Self-allocation comparison:`);
        console.log(`   ${activeResults[0].name}: ${player1SelfAllocation}% to self`);
        console.log(`   ${activeResults[1].name}: ${player2SelfAllocation}% to self`);
        
        if (Math.abs(player1SelfAllocation - player2SelfAllocation) > 5) {
          // Significant difference - less greedy wins
          if (player1SelfAllocation < player2SelfAllocation) {
            finalWinner = activeResults[0];
            finalProposal = player1Proposal;
            console.log(`🏆 ${finalWinner.name} wins tiebreaker (less greedy: ${player1SelfAllocation}% vs ${player2SelfAllocation}%)`);
          } else {
            finalWinner = activeResults[1];
            finalProposal = player2Proposal;
            console.log(`🏆 ${finalWinner.name} wins tiebreaker (less greedy: ${player2SelfAllocation}% vs ${player1SelfAllocation}%)`);
          }
        } else {
          // Self-allocations are similar - random selection
          const randomWinner = activeResults[Math.floor(Math.random() * 2)];
          finalWinner = randomWinner;
          finalProposal = proposals.find(p => p.playerId === randomWinner.playerId);
          console.log(`🎲 ${finalWinner.name} wins tiebreaker (random selection - similar greediness)`);
        }
      } else {
        // No tie - clear winner
        finalWinner = activeResults[0];
        finalProposal = proposals.find(p => p.playerId === topResult.playerId);
        console.log(`\n🎯 Final round with 2 active players - ${finalWinner.name} wins with ${finalWinner.votes} votes!`);
      }
      break;
    } else {
      // Find lowest vote-getter among ACTIVE players to eliminate
      const activeResults = sortedResults.filter(r => activePlayers.find(p => p.id === r.playerId));
      const lowestVotes = Math.min(...activeResults.map(r => r.votes));
      const eliminationCandidates = activeResults.filter(r => r.votes === lowestVotes);
      
      // TIE BREAKING: Random selection among tied players
      const eliminated = eliminationCandidates[Math.floor(Math.random() * eliminationCandidates.length)];
      
      console.log(`\n❌ ${eliminated.name} eliminated with lowest votes${eliminationCandidates.length > 1 ? ' (tie-breaker)' : ''}`);
      activePlayers = activePlayers.filter(p => p.id !== eliminated.playerId);
      console.log(`📊 Active players remaining: ${activePlayers.length}`);
    }

    roundNumber++;
  }

  // Calculate economic distribution
  const totalPool = players.length * 100;
  const economicDistribution = {};
  
  if (finalProposal && finalProposal.proposal) {
    Object.entries(finalProposal.proposal).forEach(([playerId, percentage]) => {
      economicDistribution[playerId] = Math.round(totalPool * percentage / 100);
    });
  }

  console.log('\n💰 ECONOMIC DISTRIBUTION:');
  players.forEach(player => {
    const payout = economicDistribution[player.id] || 0;
    const profit = payout - 100; // Entry fee
    const profitIcon = profit >= 0 ? '💰' : '💸';
    console.log(`   ${player.name}: ${payout} tokens (${profitIcon}${profit >= 0 ? '+' : ''}${profit} profit)`);
  });

  tracker.finishGame(finalWinner, finalProposal, economicDistribution);

  return {
    gameNumber,
    winner: finalWinner,
    economicDistribution,
    totalRounds: roundNumber - 1
  };
}

/**
 * Run full tournament with detailed tracking
 */
async function runTrackedTournament(manager, tracker, tournamentNumber, gamesPerTournament = 10) {
  const viableStrategies = manager.getViableStrategies();
  
  if (viableStrategies.length < 4) {
    console.log('❌ Not enough viable strategies to run tournament');
    return null;
  }

  tracker.startTournament(tournamentNumber, viableStrategies);
  
  console.log(`\n🏟️  === TOURNAMENT ${tournamentNumber} (Generation ${manager.generation}) ===`);
  console.log(`💰 STARTING BALANCES:`);
  viableStrategies.forEach(s => {
    console.log(`   ${s.name}: ${s.coinBalance} coins (${s.gamesPlayed} games played)`);
  });

  // Run tournament games
  for (let game = 1; game <= gamesPerTournament; game++) {
    const gameResult = await runTrackedGame(viableStrategies, game, tracker);
    
    // Update strategy balances
    const economicImpacts = viableStrategies.map(strategy => {
      const payout = gameResult.economicDistribution[`player${viableStrategies.indexOf(strategy) + 1}`] || 0;
      return {
        strategyId: strategy.id,
        entryFee: 100,
        payout: payout,
        profit: payout - 100,
        isWinner: gameResult.winner && gameResult.winner.strategyId === strategy.id
      };
    });

    manager.updateStrategyBalances(economicImpacts);

    // Record balance timeline after this game
    tracker.recordBalanceUpdate(tournamentNumber, game, viableStrategies);

    // Show updated balances
    console.log('\n💰 UPDATED BALANCES:');
    viableStrategies.forEach(s => {
      const balanceChange = s.coinBalance - (500 - (s.gamesPlayed * 100));
      const changeIcon = balanceChange >= 0 ? '📈' : '📉';
      console.log(`   ${s.name}: ${s.coinBalance} coins ${changeIcon}${balanceChange >= 0 ? '+' : ''}${balanceChange}`);
    });

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Check for bankruptcies and evolve if needed
  const eliminated = manager.checkEliminations();
  const evolved = await manager.evolveStrategies();
  tracker.finishTournament(viableStrategies, eliminated.eliminated || eliminated, evolved.newStrategies || []);
  
  console.log('\n📊 FINAL TOURNAMENT STATS:');
  const stats = manager.getStrategyStats();
  stats.forEach(s => {
    console.log(`${s.name}: ${s.coinBalance} coins | ROI: ${s.roi}% | Win Rate: ${s.winRate}% | Games: ${s.gamesPlayed}`);
  });

  return {
    tournamentNumber,
    finalStats: stats,
    evolution: evolved
  };
}

/**
 * Run full evolutionary process with comprehensive tracking
 */
async function runEnhancedEvolution(numberOfTournaments = 3, gamesPerTournament = 5) {
  console.log('🚀 ENHANCED EVOLUTIONARY SIMULATION STARTING');
  console.log('============================================');
  console.log(`📊 Tournaments: ${numberOfTournaments}`);
  console.log(`🎮 Games per tournament: ${gamesPerTournament}`);
  console.log(`📈 Total games: ${numberOfTournaments * gamesPerTournament}`);
  console.log('');
  
  // Display configuration settings
  log.minimal('⚙️  CONFIGURATION:');
  log.minimal(`   Verbosity Level: ${CONFIG.verbosity} (0=silent, 1=minimal, 2=normal, 3=verbose, 4=debug)`);
  log.minimal(`   Collect Reasoning: ${CONFIG.collectReasoning ? 'ON' : 'OFF'} ${!CONFIG.collectReasoning ? '(FASTER)' : '(SLOWER)'}`);
  log.minimal(`   Show Full Matrix: ${CONFIG.showFullMatrix ? 'ON' : 'OFF'}`);
  log.minimal(`   Show Game Details: ${CONFIG.showGameDetails ? 'ON' : 'OFF'}`);
  log.minimal(`   Show Economics: ${CONFIG.showEconomics ? 'ON' : 'OFF'}`);
  log.minimal('');
  log.minimal('💡 Use flags: --verbosity=2 --no-reasoning --show-matrix --no-game-details --no-economics');
  log.minimal('');
  
  const tracker = new GameTracker();
  const manager = new StrategyManager();
  
  // Set up progress tracking
  tracker.setTotalTournaments(numberOfTournaments);
  
  // Initialize core strategies
  manager.initializeCoreStrategies();
  console.log(`🧬 Initialized ${manager.strategies.length} core strategies`);
  
  let lastProgressFile = null;

  for (let tournamentNumber = 1; tournamentNumber <= numberOfTournaments; tournamentNumber++) {
    console.log(`\n🏆 TOURNAMENT ${tournamentNumber}/${numberOfTournaments}`);
    console.log('='.repeat(50));
    
    try {
      // Get viable strategies (balance >= 100)
      const viableStrategies = manager.getViableStrategies();
      console.log(`👥 Viable strategies: ${viableStrategies.length}`);
      
      if (viableStrategies.length < 2) {
        console.log('❌ Insufficient viable strategies. Simulation ending.');
        break;
      }

      // Start tournament tracking
      tracker.startTournament(tournamentNumber, viableStrategies);
      
      console.log(`💰 Starting balances: ${viableStrategies.map(s => `${s.name}: ${s.coinBalance}`).join(', ')}`);

      // Run tournament games with progress updates
      for (let game = 1; game <= gamesPerTournament; game++) {
        console.log(`\n🎮 Tournament ${tournamentNumber}, Game ${game}/${gamesPerTournament}`);
        
        const gameResult = await runTrackedGame(viableStrategies, game, tracker);
        
        // Update strategy balances
        const economicImpacts = viableStrategies.map(strategy => {
          const payout = gameResult.economicDistribution[`player${viableStrategies.indexOf(strategy) + 1}`] || 0;
          return {
            strategyId: strategy.id,
            entryFee: 100,
            payout: payout,
            profit: payout - 100,
            isWinner: gameResult.winner && gameResult.winner.strategyId === strategy.id
          };
        });

        manager.updateStrategyBalances(economicImpacts);

        // Record balance timeline after this game
        tracker.recordBalanceUpdate(tournamentNumber, game, viableStrategies);

        // Show game result
        const winner = gameResult.winner || { name: 'Unknown', profit: 0 };
        console.log(`🏆 Winner: ${winner.name} (+${winner.profit || 0} coins)`);
        
        // Show updated balances
        const balanceUpdate = viableStrategies.map(s => `${s.name}: ${s.coinBalance}`).join(', ');
        console.log(`💰 Updated balances: ${balanceUpdate}`);
      }

      // End tournament
      const eliminated = manager.checkEliminations();
      const evolved = await manager.evolveStrategies();
      tracker.finishTournament(viableStrategies, eliminated.eliminated || eliminated, evolved.newStrategies || []);
      
      // Save incremental progress after each completed tournament
      console.log(`\n💾 Tournament ${tournamentNumber} completed - saving progress...`);
      lastProgressFile = tracker.saveIncrementalProgress(tournamentNumber, manager);
      
      // Show tournament summary
      console.log(`\n📊 Tournament ${tournamentNumber} Summary:`);
      console.log(`🏆 Games completed: ${gamesPerTournament}`);
      
      // Check for eliminations and evolutions
      const eliminatedStrategies = eliminated.eliminated || eliminated;
      if (eliminatedStrategies.length > 0) {
        console.log(`💀 Eliminated: ${eliminatedStrategies.map(s => s.name).join(', ')}`);
      }
      
      const evolvedStrategies = evolved.newStrategies || [];
      if (evolvedStrategies.length > 0) {
        console.log(`🧬 Evolved: ${evolvedStrategies.map(s => s.name).join(', ')}`);
      }
      
      const remaining = manager.getViableStrategies().length;
      console.log(`👥 Remaining viable strategies: ${remaining}`);
      
    } catch (tournamentError) {
      console.error(`❌ Tournament ${tournamentNumber} failed:`, tournamentError.message);
      
      // Still save progress up to the failed tournament
      console.log('💾 Saving progress up to failed tournament...');
      lastProgressFile = tracker.saveIncrementalProgress(tournamentNumber - 1, manager);
      
      // Don't throw - let simulation continue with partial data
      break;
    }
  }

  // Final statistics and export
  console.log('\n🎯 SIMULATION COMPLETE');
  console.log('=====================');
  
  const finalStats = manager.getFinalStatistics();
  console.log('🏆 Final Rankings:');
  finalStats.forEach((strategy, index) => {
    const rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][index];
    const change = strategy.coinBalance - 500;
    const changeStr = change >= 0 ? `+${change}` : `${change}`;
    console.log(`${rank} ${strategy.name}: ${strategy.coinBalance} coins (${changeStr})`);
  });

  // Export final data
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `enhanced_evolution_${timestamp}.json`;
  
  const exportData = {
    simulationParams: { numberOfTournaments, gamesPerTournament },
    finalStats,
    tournaments: tracker.tournamentData,
    balanceTimeline: tracker.balanceTimeline,
    strategyMatchups: tracker.strategyMatchups,
    errorMetrics: tracker.errorMetrics,
    lastProgressFile,
    completedAt: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));

  return {
    finalStats,
    trackedData: tracker.tournamentData,
    balanceTimeline: tracker.balanceTimeline,
    strategyMatchups: tracker.strategyMatchups,
    errorMetrics: tracker.errorMetrics,
    errorSummary: tracker.generateErrorSummary(),
    exportFile: filename,
    lastProgressFile
  };
}

module.exports = {
  runEnhancedEvolution,
  StrategyManager,
  GameTracker,
  runTrackedGame,
  CORE_STRATEGIES
};

// Run if called directly
if (require.main === module) {
  // Parse command line arguments for tournaments and games
  const tournamentsArg = process.argv.find(arg => arg.startsWith('--tournaments='));
  const gamesArg = process.argv.find(arg => arg.startsWith('--games='));
  const generationsArg = process.argv.find(arg => arg.startsWith('--generations=')); // Alias for tournaments
  
  const numberOfTournaments = parseInt(tournamentsArg?.split('=')[1]) || 
                              parseInt(generationsArg?.split('=')[1]) || 
                              3;
  const gamesPerTournament = parseInt(gamesArg?.split('=')[1]) || 5;
  
  console.log(`🎯 Running ${numberOfTournaments} tournaments with ${gamesPerTournament} games each`);
  runEnhancedEvolution(numberOfTournaments, gamesPerTournament).catch(console.error);
} 