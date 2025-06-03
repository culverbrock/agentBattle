/**
 * Continuous Evolution System - Runs continuous games with evolution on bankruptcy
 * No tournaments - just endless games where bankrupt strategies get replaced by evolved ones
 * Evolution is based on weighted combinations of profitable strategies
 */

const { ImprovedMatrixSystem } = require('../matrix/improvedMatrixSystem');
const { callLLM } = require('../core/llmApi');

class ContinuousEvolutionSystem {
  constructor(options = {}) {
    this.mode = options.mode || 'continuous_evolution';
    this.realTimeUpdates = options.realTimeUpdates !== false;
    this.fullLogging = options.fullLogging !== false;
    this.onUpdate = options.onUpdate || (() => {});
    this.onLog = options.onLog || (() => {});
    this.broadcaster = options.broadcaster;
    
    this.isRunning = false;
    this.strategies = [];
    this.eliminatedStrategies = [];
    this.evolutionHistory = [];
    
    // Strategy starting conditions
    this.entryFee = 100;
    this.startingBalance = 500; // Each strategy starts with 5 games worth of entry fees
    
    // Population parameters
    this.populationSize = 6; // Always maintain exactly 6 strategies
    
    // Rate limiting and timing
    this.gameDelayMinutes = 5; // 5 minute delay between games
    this.interactionDelaySeconds = 3; // 3 second delay between interactions
    this.roundDelaySeconds = 10; // 10 second delay between negotiation rounds
    this.isWaitingForNextGame = false;
    this.nextGameTime = null;
    this.countdownTimer = null;
    
    // Game tracking
    this.totalGamesPlayed = 0;
    this.totalEvolutions = 0;
    
    this.initializeInitialPopulation();
    
    // Auto-start the simulation for continuous evolution
    setTimeout(() => {
      this.start();
      this.runContinuousEvolution().catch(error => {
        this.log('error', 'AutoStart', `Auto-start failed: ${error.message}`);
      });
    }, 2000); // 2 second delay to allow initialization
  }

  async initializeInitialPopulation() {
    console.log('🧬 Initializing starting population for continuous evolution...');
    
    const initialStrategies = [
      {
        id: 'cooperative-1',
        name: 'Cooperative Negotiator',
        archetype: 'Cooperative',
        strategy: 'Focuses on fair distribution and building coalitions for mutual benefit',
        coinBalance: this.startingBalance,
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null
      },
      {
        id: 'aggressive-1',
        name: 'Aggressive Maximizer',
        archetype: 'Aggressive',
        strategy: 'Seeks to maximize personal gain, often at the expense of others',
        coinBalance: this.startingBalance,
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null
      },
      {
        id: 'strategic-1',
        name: 'Strategic Opportunist',
        archetype: 'Strategic',
        strategy: 'Adapts strategy based on game state and other players\' behavior',
        coinBalance: this.startingBalance,
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null
      },
      {
        id: 'analyzer-1',
        name: 'Pattern Analyzer',
        archetype: 'Analytical',
        strategy: 'Studies opponent patterns and exploits predictable behaviors',
        coinBalance: this.startingBalance,
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null
      },
      {
        id: 'coalition-1',
        name: 'Coalition Builder',
        archetype: 'Coalition',
        strategy: 'Forms and breaks alliances strategically to control game outcomes',
        coinBalance: this.startingBalance,
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null
      },
      {
        id: 'conservative-1',
        name: 'Risk Manager',
        archetype: 'Conservative',
        strategy: 'Prioritizes survival and consistent small gains over risky big wins',
        coinBalance: this.startingBalance,
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null
      }
    ];

    this.strategies = initialStrategies;
    this.log('info', 'ContinuousEvolution', `Initialized population with ${this.strategies.length} strategies`);
  }

  async runContinuousEvolution() {
    if (!this.isRunning) return;

    this.log('info', 'System', 'Starting continuous evolution - no tournaments, just endless games with evolution on bankruptcy');

    // Broadcast initial strategies to frontend
    this.onUpdate({
      type: 'strategies_updated',
      strategies: this.strategies
    });

    let gameNumber = 0;

    while (this.isRunning) {
      gameNumber++;
      this.totalGamesPlayed = gameNumber;
      
      // Filter out bankrupt strategies first
      const viableStrategies = this.strategies.filter(s => s.coinBalance >= this.entryFee);
      
      if (viableStrategies.length < 2) {
        this.log('warning', 'Evolution', 'Less than 2 viable strategies remaining - restarting with fresh population');
        await this.restartWithFreshPopulation();
        continue;
      }

      // Wait for rate limit delay between games (except first game)
      if (gameNumber > 1) {
        await this.waitForNextGame();
        if (!this.isRunning) break; // Check if stopped during wait
      }

      // Run a single game
      const gameResult = await this.runSingleGame(gameNumber, viableStrategies);
      
      // Handle bankruptcies and evolution (combined)
      await this.handleBankruptciesWithEvolution();
      
      // Brief pause before next iteration
      await this.sleep(2000);
    }
  }

  async handleBankruptciesWithEvolution() {
    const bankruptStrategies = this.strategies.filter(s => s.coinBalance < this.entryFee);
    
    if (bankruptStrategies.length === 0) {
      // No bankruptcies, continue
      return;
    }

    this.log('info', 'Evolution', `${bankruptStrategies.length} strategies bankrupt - triggering evolution`);
    
    for (const bankruptStrategy of bankruptStrategies) {
      this.log('warning', 'Bankruptcy', `${bankruptStrategy.name} eliminated due to bankruptcy (${bankruptStrategy.coinBalance} coins)`);
      
      // Track elimination
      this.eliminatedStrategies.push({
        ...bankruptStrategy,
        eliminationReason: 'bankruptcy',
        eliminationTime: Date.now(),
        finalBalance: bankruptStrategy.coinBalance
      });

      this.onUpdate({
        type: 'strategy_eliminated',
        elimination: {
          strategyId: bankruptStrategy.id,
          strategyName: bankruptStrategy.name,
          reason: 'Bankruptcy - insufficient funds for entry fee',
          finalBalance: bankruptStrategy.coinBalance,
          gamesPlayed: bankruptStrategy.gamesPlayed,
          timestamp: Date.now()
        }
      });

      // Remove bankrupt strategy
      this.strategies = this.strategies.filter(s => s.id !== bankruptStrategy.id);
      
      // Create evolved replacement based on profitable strategies
      const evolvedReplacement = await this.createWeightedEvolvedStrategy(bankruptStrategy);
      
      if (evolvedReplacement) {
        this.strategies.push(evolvedReplacement);
        this.totalEvolutions++;
        
        this.log('info', 'Evolution', `${bankruptStrategy.name} → ${evolvedReplacement.name} (evolved replacement)`);
        
        this.onUpdate({
          type: 'strategy_evolved',
          evolution: {
            eliminatedStrategy: bankruptStrategy,
            newStrategy: evolvedReplacement,
            reason: 'Bankruptcy replacement',
            parentStrategies: evolvedReplacement.parentIds,
            timestamp: Date.now()
          }
        });
      }
    }

    // Ensure we still have exactly the right population size
    if (this.strategies.length !== this.populationSize) {
      this.log('warning', 'Evolution', `Population size mismatch: ${this.strategies.length} instead of ${this.populationSize}`);
    }

    // Broadcast updated strategies list
    this.onUpdate({
      type: 'strategies_updated',
      strategies: this.strategies
    });
  }

  async createWeightedEvolvedStrategy(eliminatedStrategy) {
    // Find profitable strategies (positive avgProfit or totalProfit)
    const profitableStrategies = this.strategies.filter(s => 
      s.avgProfit > 0 || s.totalProfit > 0
    );
    
    if (profitableStrategies.length === 0) {
      this.log('warning', 'Evolution', 'No profitable strategies found - creating fresh strategy');
      return await this.createFreshStrategy();
    }

    // Calculate weights based on profit
    const totalProfit = profitableStrategies.reduce((sum, s) => 
      sum + Math.max(s.totalProfit, s.avgProfit * s.gamesPlayed, 0), 0
    );
    
    let weights = [];
    if (totalProfit > 0) {
      weights = profitableStrategies.map(s => {
        const profit = Math.max(s.totalProfit, s.avgProfit * s.gamesPlayed, 0);
        const weight = profit / totalProfit;
        return { strategy: s, weight, profit };
      });
    } else {
      // If no profits, equal weighting
      weights = profitableStrategies.map(s => ({ 
        strategy: s, 
        weight: 1 / profitableStrategies.length,
        profit: 0 
      }));
    }

    // Sort by weight (highest first)
    weights.sort((a, b) => b.weight - a.weight);

    this.log('debug', 'Evolution', `Profitable strategies for evolution:`);
    weights.forEach(w => {
      this.log('debug', 'Evolution', `  ${w.strategy.name}: ${(w.weight * 100).toFixed(1)}% (${w.profit.toFixed(1)} profit)`);
    });

    // Generate weighted blend prompt
    const blendPrompt = `Create a new strategy by combining these successful strategies based on their profitability:

PROFITABLE STRATEGIES TO BLEND:
${weights.map(w => 
  `${Math.round(w.weight * 100)}% - ${w.strategy.name}: "${w.strategy.strategy}" (${w.profit.toFixed(1)} total profit)`
).join('\n')}

ELIMINATED STRATEGY TO AVOID:
${eliminatedStrategy.name}: "${eliminatedStrategy.strategy}" (${eliminatedStrategy.totalProfit || 0} total profit)

TASK: Create a hybrid strategy that combines the most successful elements from each profitable strategy, 
weighted by their profitability. Focus on what made each strategy profitable and avoid the patterns 
that led to the eliminated strategy's bankruptcy.

REQUIREMENTS:
1. Combine strategies based on the specified profit weightings
2. Make it SIGNIFICANTLY DIFFERENT from the eliminated strategy
3. Keep strategy description under 200 characters
4. Focus on profitable behaviors and successful tactics

Respond with JSON:
{
  "name": "Hybrid strategy name reflecting the blend",
  "archetype": "Most appropriate category", 
  "strategy": "Detailed strategy combining the best profitable elements (under 200 chars)",
  "parentStrategies": [${weights.map(w => `"${w.strategy.name}"`).join(', ')}],
  "blendWeights": [${weights.map(w => w.weight.toFixed(2)).join(', ')}],
  "evolutionReasoning": "Why this combination should be more successful"
}`;

    try {
      const response = await callLLM(blendPrompt, {
        temperature: 0.7,
        max_tokens: 600,
        system: 'You are an expert in strategic evolution and game theory. Create beneficial hybrid strategies that combine successful elements. Return only valid JSON.'
      });

      const evolutionData = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');
      
      if (evolutionData.name && evolutionData.strategy) {
        const maxGeneration = Math.max(...weights.map(w => w.strategy.generationNumber || 1));
        
        return {
          id: `evolved-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: evolutionData.name,
          archetype: evolutionData.archetype || 'Hybrid',
          strategy: evolutionData.strategy,
          coinBalance: this.startingBalance, // Fresh start
          gamesPlayed: 0,
          wins: 0,
          avgProfit: 0,
          totalProfit: 0,
          generationNumber: maxGeneration + 1,
          parentIds: weights.map(w => w.strategy.id),
          parentNames: weights.map(w => w.strategy.name),
          blendWeights: evolutionData.blendWeights || weights.map(w => w.weight),
          evolutionReasoning: evolutionData.evolutionReasoning || 'Profit-weighted hybrid strategy'
        };
      } else {
        throw new Error('Invalid evolution data generated');
      }
    } catch (error) {
      this.log('warning', 'Evolution', `LLM-based evolution failed: ${error.message}, using fallback`);
      
      // Fallback to simpler weighted evolution
      return this.createFallbackWeightedStrategy(weights, eliminatedStrategy);
    }
  }

  createFallbackWeightedStrategy(weights, eliminatedStrategy) {
    // Simple fallback when LLM fails
    const topStrategy = weights[0].strategy;
    const secondStrategy = weights[1]?.strategy || weights[0].strategy;
    
    const hybridName = `${topStrategy.name.split(' ')[0]} ${secondStrategy.name.split(' ')[1] || 'Hybrid'}`;
    const hybridStrategy = `${topStrategy.strategy.substring(0, 100)}. Enhanced with ${secondStrategy.strategy.substring(0, 80)}.`;
    
    const maxGeneration = Math.max(...weights.map(w => w.strategy.generationNumber || 1));
    
    return {
      id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: hybridName,
      archetype: topStrategy.archetype,
      strategy: hybridStrategy.substring(0, 200),
      coinBalance: this.startingBalance,
      gamesPlayed: 0,
      wins: 0,
      avgProfit: 0,
      totalProfit: 0,
      generationNumber: maxGeneration + 1,
      parentIds: weights.map(w => w.strategy.id),
      parentNames: weights.map(w => w.strategy.name),
      blendWeights: weights.map(w => w.weight),
      evolutionReasoning: `Fallback hybrid of ${topStrategy.name} (${(weights[0].weight * 100).toFixed(1)}%) and ${secondStrategy.name} (${((weights[1]?.weight || 0) * 100).toFixed(1)}%)`
    };
  }

  async runSingleGame(gameNumber, participatingStrategies) {
    const gameData = {
      number: gameNumber,
      players: participatingStrategies.slice(0, 6), // Limit to 6 players per game
      startTime: Date.now()
    };

    this.onUpdate({
      type: 'game_started',
      game: gameData
    });

    this.log('info', 'Game', `Starting game ${gameNumber} with players: ${gameData.players.map(p => p.name).join(', ')}`);

    // Deduct entry fees
    gameData.players.forEach(player => {
      player.coinBalance -= this.entryFee;
      player.gamesPlayed++;
    });

    // Run the game using the matrix system
    const matrixSystem = new ImprovedMatrixSystem({
      collectReasoning: this.fullLogging,
      verbosity: this.fullLogging ? 3 : 1,
      showFullMatrix: true,
      customLogger: (message) => {
        // Send the raw console message directly - no formatting, just like terminal output
        if (this.broadcaster) {
          this.broadcaster.broadcast({
            type: 'log',
            data: {
              level: 'console',
              source: 'Matrix',
              message: message,
              timestamp: Date.now()
            }
          });
        }
        
        // Also output to console for local testing
        console.log(message);
      }
    });

    const gameResult = await this.simulateGameWithMatrix(matrixSystem, gameData);
    
    gameData.endTime = Date.now();
    gameData.winner = gameResult.winner;
    gameData.finalProposal = gameResult.winningProposal;
    gameData.coinDistribution = gameResult.coinDistribution;

    // Distribute winnings and update statistics
    if (gameResult.coinDistribution) {
      gameData.players.forEach((player, index) => {
        const winnings = gameResult.coinDistribution[index] || 0;
        player.coinBalance += winnings;
        
        // Update profit statistics
        const profit = winnings - this.entryFee;
        player.totalProfit = (player.totalProfit || 0) + profit;
        
        if (player.gamesPlayed > 0) {
          player.avgProfit = player.totalProfit / player.gamesPlayed;
        }
        
        if (winnings > this.entryFee) {
          player.wins++;
        }
      });
    }

    this.log('info', 'Game', `Game ${gameNumber} completed. Winner: ${gameResult.winner?.name || 'None'}`);

    // Broadcast game completion with full results
    this.onUpdate({
      type: 'game_completed',
      game: {
        number: gameNumber,
        players: gameData.players.map(p => ({ id: p.id, name: p.name })),
        winner: gameResult.winner,
        finalProposal: gameResult.winningProposal,
        coinDistribution: gameResult.coinDistribution,
        finalMatrix: this.extractMatrixData(matrixSystem),
        finalReasoning: this.extractReasoningData(matrixSystem),
        endTime: gameData.endTime,
        duration: gameData.endTime - gameData.startTime
      }
    });

    return gameData;
  }

  async simulateGameWithMatrix(matrixSystem, gameData) {
    const players = gameData.players.map((strategy, index) => ({
      id: strategy.id,
      name: strategy.name,
      strategy: strategy.strategy,
      agent: { strategyId: strategy.id }
    }));

    let activePlayers = [...players]; // Players who can make proposals
    let allPlayers = [...players]; // All players (including eliminated ones)
    let roundNumber = 1;
    let finalWinner = null;
    let finalProposal = null;
    let negotiationHistory = [];
    
    // Initialize matrix system ONCE for the entire game
    let matrixInitialized = false;

    // Game loop - continue until someone gets 61%+ votes or only one player remains
    while (!finalWinner && roundNumber <= 5 && activePlayers.length >= 2) {
      this.log('info', 'MatrixGame', `=== ROUND ${roundNumber} ===`);
      
      const context = {
        phase: 'negotiation',
        round: roundNumber,
        maxRounds: 5,
        players: allPlayers,
        negotiationHistory: negotiationHistory
      };

      // Matrix Negotiation phase
      this.log('debug', 'MatrixGame', 'Matrix negotiations starting (3 rounds)');
      const roundNegotiations = [];
      
      try {
        // Only initialize matrix ONCE in Round 1 - preserve elimination state in subsequent rounds
        if (!matrixInitialized) {
          matrixSystem.initializeMatrix(allPlayers);
          matrixInitialized = true;
        }
        
        // Run 3 rounds of matrix negotiations
        const matrixRounds = 3;
        for (let matrixRound = 1; matrixRound <= matrixRounds; matrixRound++) {
          
          // Each player updates their matrix row (including eliminated players!)
          for (let playerIndex = 0; playerIndex < allPlayers.length; playerIndex++) {
            const player = allPlayers[playerIndex];
            const isActive = activePlayers.find(p => p.id === player.id);
            
            // Find the strategy for this player
            const strategy = gameData.players.find(s => s.id === player.id);
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
                roundNumber,
                !isActive, // Pass elimination status to matrix system
                activePlayersInfo
              );
              
              if (success) {
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
                this.log('debug', 'MatrixGame', `${player.name}${statusTag}: Matrix updated successfully`);
              } else {
                const statusTag = isActive ? '' : ' [ELIMINATED]';
                this.log('warning', 'MatrixGame', `${player.name}${statusTag}: Matrix update failed`);
              }
            } catch (error) {
              const statusTag = isActive ? '' : ' [ELIMINATED]';
              this.log('warning', 'MatrixGame', `${player.name}${statusTag}: Matrix error - ${error.message}`);
            }
            
            // Small delay to prevent overwhelming the API
            await this.sleep(this.interactionDelaySeconds * 1000);
          }
          
          // Show matrix state after this matrix round
          this.log('info', 'MatrixGame', `\n📊 Matrix State After Round ${matrixRound}/${matrixRounds}:`);
          matrixSystem.displayResults();
        }
        
        // Store matrix results in context
        context.matrixSystem = matrixSystem;
        context.finalMatrix = matrixSystem.getMatrix();
        
      } catch (error) {
        this.log('error', 'MatrixGame', `Matrix negotiation system failed: ${error.message}`);
        
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

      // Proposal phase - ONLY ACTIVE PLAYERS can make proposals
      this.log('debug', 'MatrixGame', 'Proposal phase starting');
      const proposals = [];
      
      // Run all proposals in parallel
      const proposalPromises = activePlayers.map(async (player) => {
        try {
          const proposal = await this.generateProposal(context, player, allPlayers, gameData);
          
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
          
          this.log('warning', 'MatrixGame', `${player.name} proposal failed: ${err.message} - using equal split fallback`);
          
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
        this.log('info', 'MatrixGame', `${proposalResult.playerName}${failTag}: {${shares}}`);
      }

      // Voting phase - ALL PLAYERS vote (including eliminated ones)
      context.phase = 'voting';
      context.proposals = proposals;
      
      this.log('debug', 'MatrixGame', 'Voting phase starting');
      const allVotes = {};
      
      // Run all votes in parallel
      const votingPromises = allPlayers.map(async (player) => {
        try {
          const vote = await this.generateVote(context, player, proposals, gameData);
          
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
          
          this.log('warning', 'MatrixGame', `${player.name} vote failed: ${err.message} - using equal split fallback`);
          
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
        this.log('info', 'MatrixGame', `${voteResult.playerName}${statusTag}${failTag}: {${voteStr}}`);
      }

      // Calculate results
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

      this.log('info', 'MatrixGame', '🏆 ROUND RESULTS:');
      sortedResults.forEach((result, index) => {
        const icon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
        const status = hasWinner && index === 0 ? 'WINNER!' : 'Lost';
        this.log('info', 'MatrixGame', `   ${icon} ${result.name}: ${result.votes} votes (${result.percentage}%) - ${status}`);
      });

      if (hasWinner) {
        finalWinner = topResult;
        finalProposal = proposals.find(p => p.playerId === topResult.playerId);
        this.log('info', 'MatrixGame', `🎉 ${finalWinner.name} WINS THE GAME!`);
        break;
      } else if (activePlayers.length <= 2) {
        // SPECIAL CASE: 2 players left - need proper tie-breaking
        const activeResults = sortedResults.filter(r => activePlayers.find(p => p.id === r.playerId));
        
        if (activeResults.length === 2 && activeResults[0].votes === activeResults[1].votes) {
          // TIE! Need tiebreaker
          this.log('info', 'MatrixGame', `🤝 TIE! Both players have ${activeResults[0].votes} votes (${activeResults[0].percentage}% each)`);
          
          // Tiebreaker: Random selection
          const randomWinner = activeResults[Math.floor(Math.random() * 2)];
          finalWinner = randomWinner;
          finalProposal = proposals.find(p => p.playerId === randomWinner.playerId);
          this.log('info', 'MatrixGame', `🎲 ${finalWinner.name} wins tiebreaker (random selection)`);
        } else {
          // No tie - clear winner
          finalWinner = activeResults[0];
          finalProposal = proposals.find(p => p.playerId === topResult.playerId);
          this.log('info', 'MatrixGame', `🎯 Final round with 2 active players - ${finalWinner.name} wins with ${finalWinner.votes} votes!`);
        }
        break;
      } else {
        // Find lowest vote-getter among ACTIVE players to eliminate
        const activeResults = sortedResults.filter(r => activePlayers.find(p => p.id === r.playerId));
        const lowestVotes = Math.min(...activeResults.map(r => r.votes));
        const eliminationCandidates = activeResults.filter(r => r.votes === lowestVotes);
        
        // TIE BREAKING: Random selection among tied players
        const eliminated = eliminationCandidates[Math.floor(Math.random() * eliminationCandidates.length)];
        
        this.log('info', 'MatrixGame', `❌ ELIMINATION: ${eliminated.name} eliminated with ${eliminated.votes} votes (${Math.round((eliminated.votes / allPlayers.length) * 100)}%)${eliminationCandidates.length > 1 ? ' (tie-breaker)' : ''}`);
        activePlayers = activePlayers.filter(p => p.id !== eliminated.playerId);
        this.log('info', 'MatrixGame', `📊 Active players remaining: ${activePlayers.length}`);
        
        // Broadcast elimination
        if (this.realTimeUpdates) {
          this.onUpdate({
            type: 'player_eliminated',
            data: {
              gameNumber: gameData.number,
              gameRound: roundNumber,
              eliminatedPlayer: eliminated,
              reason: 'lowest_votes',
              votes: eliminated.votes,
              votePercentage: Math.round((eliminated.votes / allPlayers.length) * 100)
            }
          });
        }
      }
      
      // Broadcast round results
      if (this.realTimeUpdates) {
        const reasoning = this.extractReasoningData(matrixSystem);
        const logs = roundNegotiations.map(neg => ({
          level: 'info',
          source: 'AI_Reasoning',
          message: `${neg.playerName}: ${neg.message}`,
          timestamp: Date.now()
        }));
        
        this.onUpdate({
          type: 'round_update',
          data: {
            number: roundNumber,
            gameNumber: gameData.number,
            phase: 'voting_complete',
            matrix: this.extractMatrixData(matrixSystem),
            reasoning: reasoning,
            proposals: proposals,
            votes: allVotes,
            results: sortedResults,
            activePlayers: activePlayers.length,
            logs: logs
          }
        });
      }
      
      roundNumber++;
    }

    // Game ended - prepare results
    if (finalWinner && finalProposal) {
      const winner = allPlayers.find(p => p.id === finalWinner.playerId);
      const winningProposal = Object.values(finalProposal.proposal);
      const coinDistribution = winningProposal.map(percentage => 
        Math.round((percentage / 100) * (allPlayers.length * this.entryFee))
      );
      
      return {
        winner: winner,
        winningProposal: winningProposal,
        coinDistribution: coinDistribution,
        proposals: proposals,
        votes: allVotes,
        gameRounds: roundNumber - 1
      };
    }
    
    // No winner (shouldn't happen, but safety fallback)
    this.log('warning', 'MatrixGame', 'Game ended without clear winner - using fallback');
    const remainingPlayers = activePlayers.length > 0 ? activePlayers : allPlayers;
    const fallbackWinner = remainingPlayers[0];
    const fallbackProposal = new Array(allPlayers.length).fill(Math.floor(100 / allPlayers.length));
    const fallbackDistribution = fallbackProposal.map(percentage => 
      Math.round((percentage / 100) * (allPlayers.length * this.entryFee))
    );
    
    return {
      winner: fallbackWinner,
      winningProposal: fallbackProposal,
      coinDistribution: fallbackDistribution,
      proposals: [],
      votes: {},
      gameRounds: roundNumber - 1
    };
  }

  extractMatrixData(matrixSystem) {
    const matrix = matrixSystem.getMatrix();
    const numPlayers = matrix.length;
    const matrixData = {};
    const gamePlayers = matrixSystem.players; // Use the actual players from the matrix system

    matrix.forEach((row, playerIndex) => {
      if (gamePlayers[playerIndex]) {
        const proposal = row.slice(0, numPlayers);
        const votes = row.slice(numPlayers, numPlayers * 2);
        const requests = row.slice(numPlayers * 2, numPlayers * 3);

        matrixData[gamePlayers[playerIndex].id] = {
          proposal: proposal,
          votes: votes,
          requests: requests
        };
      }
    });

    return matrixData;
  }

  extractReasoningData(matrixSystem) {
    if (!this.fullLogging) {
      console.log('🔍 Reasoning extraction skipped - fullLogging is false');
      return {};
    }

    const reasoning = {};
    const gamePlayers = matrixSystem.players; // Use the actual players from the matrix system
    
    console.log('🔍 Extracting reasoning data:', {
      fullLogging: this.fullLogging,
      playersCount: gamePlayers?.length || 0,
      explanationsCount: matrixSystem.playerExplanations?.length || 0
    });
    
    matrixSystem.playerExplanations.forEach((explanations, playerIndex) => {
      if (explanations.length > 0 && gamePlayers[playerIndex]) {
        const latestExplanation = explanations[explanations.length - 1];
        reasoning[gamePlayers[playerIndex].id] = latestExplanation.explanation;
        console.log(`🔍 Added reasoning for ${gamePlayers[playerIndex].name}: ${latestExplanation.explanation.substring(0, 50)}...`);
      }
    });

    console.log('🔍 Final reasoning object keys:', Object.keys(reasoning));
    return reasoning;
  }

  extractProposals(matrix, numPlayers) {
    return matrix.map(row => row.slice(0, numPlayers));
  }

  extractVotes(matrix, numPlayers) {
    return matrix.map(row => row.data.slice(numPlayers, numPlayers * 2));
  }

  calculateVoteResults(proposals, votes, players) {
    const voteResults = {};
    
    // Initialize vote totals for each active player
    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
      if (!players[playerIndex].isEliminated) {
        voteResults[playerIndex] = 0;
      }
    }
    
    // Sum up votes each player receives from all voters
    for (let voterIndex = 0; voterIndex < votes.length; voterIndex++) {
      const voterVotes = votes[voterIndex]; // This voter's vote allocation
      
      for (let candidateIndex = 0; candidateIndex < voterVotes.length; candidateIndex++) {
        if (!players[candidateIndex].isEliminated && voterVotes[candidateIndex] > 0) {
          voteResults[candidateIndex] = (voteResults[candidateIndex] || 0) + voterVotes[candidateIndex];
        }
      }
    }
    
    return voteResults;
  }

  async waitForNextGame() {
    this.isWaitingForNextGame = true;
    this.nextGameTime = Date.now() + (this.gameDelayMinutes * 60 * 1000);
    
    this.log('info', 'RateLimit', `Waiting ${this.gameDelayMinutes} minutes before next game to respect OpenAI rate limits...`);
    
    this.onUpdate({
      type: 'game_delay_started',
      data: {
        delayMinutes: this.gameDelayMinutes,
        nextGameTime: this.nextGameTime,
        reason: 'OpenAI rate limit management'
      }
    });

    // Start countdown timer
    this.startCountdownTimer();
    
    // Wait for the delay period
    await this.sleep(this.gameDelayMinutes * 60 * 1000);
    
    this.isWaitingForNextGame = false;
    this.nextGameTime = null;
    this.stopCountdownTimer();
    
    this.onUpdate({
      type: 'game_delay_ended',
      data: {
        timestamp: Date.now()
      }
    });
  }

  startCountdownTimer() {
    this.stopCountdownTimer(); // Clear any existing timer
    
    this.countdownTimer = setInterval(() => {
      if (!this.nextGameTime || !this.isRunning) {
        this.stopCountdownTimer();
        return;
      }
      
      const timeRemaining = this.nextGameTime - Date.now();
      
      if (timeRemaining <= 0) {
        this.stopCountdownTimer();
        return;
      }
      
      const minutes = Math.floor(timeRemaining / 60000);
      const seconds = Math.floor((timeRemaining % 60000) / 1000);
      
      this.onUpdate({
        type: 'countdown_update',
        data: {
          timeRemaining: timeRemaining,
          minutes: minutes,
          seconds: seconds,
          formattedTime: `${minutes}:${seconds.toString().padStart(2, '0')}`
        }
      });
    }, 1000);
  }

  stopCountdownTimer() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  async restartWithFreshPopulation() {
    this.log('info', 'System', 'Restarting with fresh population due to total elimination');
    await this.initializeInitialPopulation();
    
    this.onUpdate({
      type: 'population_restart',
      data: {
        newPopulation: this.strategies,
        timestamp: Date.now()
      }
    });
  }

  async stop() {
    this.isRunning = false;
    this.stopCountdownTimer();
    this.log('info', 'System', 'Bankruptcy evolution system stopped');
  }

  start() {
    this.isRunning = true;
    this.log('info', 'System', 'Bankruptcy evolution system started');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(level, source, message) {
    if (this.onLog) {
      this.onLog({ level, source, message });
    }
    
    if (this.broadcaster) {
      this.broadcaster.broadcastLog(level, source, message);
    }
  }

  async createFreshStrategy() {
    try {
      const strategyData = await this.generateStrategy('fresh_spawn');
      return {
        id: this.generateUniqueId(),
        name: strategyData.name,
        archetype: strategyData.archetype,
        strategy: strategyData.strategy,
        coinBalance: this.startingBalance,
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null
      };
    } catch (error) {
      this.log('error', 'Evolution', `Failed to create fresh strategy: ${error.message}`);
      // Fallback to predefined strategy if LLM fails
      return this.createFallbackStrategy();
    }
  }

  createFallbackStrategy() {
    const strategyTemplates = [
      {
        name: 'Strategic Vote Trader',
        archetype: 'Strategic',
        strategy: 'Make explicit vote-for-allocation deals. Track trust and honor commitments when beneficial. Focus on coalition mathematics.'
      },
      {
        name: 'Trust Builder',
        archetype: 'Cooperative',
        strategy: 'Focus on consistent promise-keeping to build long-term alliances. Reference voting history and punish betrayers.'
      },
      {
        name: 'Coalition Breaker',
        archetype: 'Aggressive',
        strategy: 'Identify and disrupt opposing coalitions through targeted vote offers and strategic betrayals when profitable.'
      },
      {
        name: 'Mathematical Negotiator',
        archetype: 'Analytical',
        strategy: 'Use precise calculations in vote trading. Make conditional commitments based on probabilities and expected values.'
      },
      {
        name: 'Reputation Manager',
        archetype: 'Conservative',
        strategy: 'Carefully balance short-term gains vs long-term trust. Track all players promise-keeping patterns.'
      },
      {
        name: 'Aggressive Dealer',
        archetype: 'Aggressive',
        strategy: 'Make bold vote offers to secure large allocations. Use intimidation and leverage in negotiations.'
      }
    ];

    const template = strategyTemplates[Math.floor(Math.random() * strategyTemplates.length)];
    const variation = Math.floor(Math.random() * 1000);
    
    return {
      id: this.generateUniqueId(),
      name: `${template.name} ${variation}`,
      archetype: template.archetype,
      strategy: template.strategy,
      coinBalance: this.startingBalance,
      gamesPlayed: 0,
      wins: 0,
      avgProfit: 0,
      totalProfit: 0,
      generationNumber: 1,
      parentIds: null
    };
  }

  async generateStrategy(context = 'general') {
    try {
      const prompt = `You are an AI strategy generator for a negotiation game. Create a unique strategic approach.

CONTEXT: ${context === 'fresh_spawn' ? 'Creating a new agent to replace an eliminated one' : 'General strategy creation'}

GAME OVERVIEW:
- Players negotiate to split a prize pool
- Must get 61%+ votes to win
- Strategies compete over multiple games
- Successful strategies survive and evolve

STRATEGY REQUIREMENTS:
- Unique approach to negotiation
- Clear tactical philosophy
- Adaptable to different opponents
- Long-term perspective on profit

ARCHETYPE OPTIONS:
- Cooperative: Fair distribution, alliance building
- Aggressive: Maximizing personal gain
- Strategic: Adaptive based on game state
- Analytical: Pattern recognition and exploitation
- Coalition: Alliance formation and control
- Conservative: Risk management and survival
- Hybrid: Combination of approaches

Respond with JSON:
{
  "name": "Unique strategy name",
  "archetype": "Strategy category",
  "strategy": "Detailed strategic approach and tactics"
}`;

      const response = await callLLM(prompt, {
        temperature: 0.8,
        max_tokens: 400,
        system: 'You are an expert in game theory and strategic design. Create diverse and effective negotiation strategies.'
      });

      const strategyData = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');
      
      if (strategyData.name && strategyData.strategy) {
        return strategyData;
      } else {
        throw new Error('Invalid strategy data generated');
      }
    } catch (error) {
      this.log('error', 'Evolution', `Failed to generate strategy: ${error.message}`);
      throw error; // Re-throw to trigger fallback
    }
  }

  generateUniqueId() {
    return `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async generateProposal(context, player, allPlayers, gameData) {
    try {
      const strategy = gameData.players ? gameData.players.find(s => s.id === player.id) : null;
      const strategyText = strategy ? strategy.strategy : 'Maximize strategic positioning in negotiations';
      
      // Get matrix information for informed proposals
      let matrixInfo = '';
      if (context.matrixSystem) {
        try {
          const matrix = context.matrixSystem.getMatrix();
          const playerIndex = allPlayers.findIndex(p => p.id === player.id);
          if (playerIndex !== -1 && matrix[playerIndex]) {
            const proposals = matrix[playerIndex].slice(0, allPlayers.length);
            const votes = matrix[playerIndex].slice(allPlayers.length, allPlayers.length * 2);
            
            matrixInfo = `\nYour current matrix position:
- Your last proposals: [${proposals.map((p, i) => `${allPlayers[i].name}: ${p}%`).join(', ')}]
- Your voting weights: [${votes.map((v, i) => `${allPlayers[i].name}: ${v}`).join(', ')}]`;
          }
        } catch (err) {
          // Matrix info is optional
        }
      }

      const prompt = `You are ${player.name} in a negotiation game. Make a proposal for how to split 100% of the prize money.

STRATEGY: ${strategyText}

GAME CONTEXT:
- Round ${context.round}/${context.maxRounds}
- Players: ${allPlayers.map(p => p.name).join(', ')}
- You need 61%+ of votes to win
- Everyone can vote (including eliminated players)

${matrixInfo}

RECENT NEGOTIATIONS:
${context.negotiationHistory.slice(-6).map(n => `${n.playerName}: ${n.message}`).join('\n')}

Create a proposal that assigns percentages to all players (must total 100%).
Consider:
1. Your strategic advantage and negotiation position
2. Vote-trading opportunities with other players
3. Coalition building vs direct confrontation
4. Risk vs reward based on current round

Respond with JSON only:
{
  ${allPlayers.map(p => `"${p.id}": <percentage_for_${p.name.replace(/\s+/g, '_')}>`).join(',\n  ')}
}`;

      const response = await callLLM(prompt, {
        temperature: 0.7,
        max_tokens: 300,
        system: 'You are a strategic negotiator. Return only valid JSON with percentages that sum to 100.'
      });

      const proposalMatch = response.match(/\{[\s\S]*\}/);
      if (!proposalMatch) {
        throw new Error('No JSON found in response');
      }

      const proposal = JSON.parse(proposalMatch[0]);
      
      // Validate that all players are included and percentages are numbers
      for (const playerId of allPlayers.map(p => p.id)) {
        if (!(playerId in proposal)) {
          throw new Error(`Missing player ${playerId} in proposal`);
        }
        if (typeof proposal[playerId] !== 'number') {
          proposal[playerId] = Number(proposal[playerId]) || 0;
        }
      }

      return proposal;
    } catch (error) {
      this.log('warning', 'AI_Generation', `Proposal generation failed for ${player.name}: ${error.message}`);
      throw error; // Let the calling function handle fallback
    }
  }

  async generateVote(context, player, proposals, gameData) {
    try {
      const strategy = gameData.players ? gameData.players.find(s => s.id === player.id) : null;
      const strategyText = strategy ? strategy.strategy : 'Vote strategically to maximize outcomes';
      
      // Get matrix information for informed voting
      let matrixInfo = '';
      if (context.matrixSystem) {
        try {
          const matrix = context.matrixSystem.getMatrix();
          const playerIndex = context.players.findIndex(p => p.id === player.id);
          if (playerIndex !== -1 && matrix[playerIndex]) {
            const votes = matrix[playerIndex].slice(context.players.length, context.players.length * 2);
            matrixInfo = `\nYour matrix voting weights: [${votes.map((v, i) => `${context.players[i].name}: ${v}`).join(', ')}]`;
          }
        } catch (err) {
          // Matrix info is optional
        }
      }

      const proposalSummary = proposals.map(p => {
        const shares = Object.entries(p.proposal)
          .map(([id, pct]) => `${context.players.find(pl => pl.id === id)?.name}: ${pct}%`)
          .join(', ');
        return `${p.playerName}: {${shares}}`;
      }).join('\n');

      const prompt = `You are ${player.name} voting on proposals. Allocate 100 voting points among the proposals.

STRATEGY: ${strategyText}

VOTING CONTEXT:
- Round ${context.round}/${context.maxRounds}  
- A proposal needs 61%+ votes to win
- You can vote strategically, not just for highest personal allocation

${matrixInfo}

PROPOSALS TO VOTE ON:
${proposalSummary}

RECENT NEGOTIATIONS:
${context.negotiationHistory.slice(-4).map(n => `${n.playerName}: ${n.message}`).join('\n')}

Consider:
1. Which proposal gives you the best outcome
2. Strategic alliances and vote trading
3. Blocking threats vs supporting allies  
4. Your negotiation commitments and reputation

Allocate 100 points among proposals (can be 0 for any proposal):
{
  ${proposals.map(p => `"${p.playerId}": <points_for_${p.playerName.replace(/\s+/g, '_')}>`).join(',\n  ')}
}`;

      const response = await callLLM(prompt, {
        temperature: 0.7,
        max_tokens: 200,
        system: 'You are a strategic voter. Return only valid JSON with vote allocations that sum to 100.'
      });

      const voteMatch = response.match(/\{[\s\S]*\}/);
      if (!voteMatch) {
        throw new Error('No JSON found in response');
      }

      const vote = JSON.parse(voteMatch[0]);
      
      // Validate that all proposers are included and votes are numbers
      for (const proposal of proposals) {
        if (!(proposal.playerId in vote)) {
          throw new Error(`Missing proposer ${proposal.playerId} in vote`);
        }
        if (typeof vote[proposal.playerId] !== 'number') {
          vote[proposal.playerId] = Number(vote[proposal.playerId]) || 0;
        }
      }

      return vote;
    } catch (error) {
      this.log('warning', 'AI_Generation', `Vote generation failed for ${player.name}: ${error.message}`);
      throw error; // Let the calling function handle fallback
    }
  }
}

module.exports = { ContinuousEvolutionSystem }; 