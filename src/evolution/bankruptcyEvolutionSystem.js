/**
 * Continuous Evolution System - Runs continuous games with evolution on bankruptcy
 * No tournaments - just endless games where bankrupt strategies get replaced by evolved ones
 * Evolution is based on weighted combinations of profitable strategies
 */

const { ImprovedMatrixSystem } = require('../matrix/improvedMatrixSystem');
const { callLLM } = require('../core/llmApi');
const pool = require('../../database'); // Add database connection

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
    this.maxRounds = options.maxRounds || 100;
    this.maxNegotiationRounds = options.maxNegotiationRounds || 3;
    this.gameDelayMinutes = 5; // 5 minute delay for OpenAI rate limits
    this.interactionDelaySeconds = 3; // 3 second delay between interactions
    this.roundDelaySeconds = 10; // 10 second delay between negotiation rounds
    this.isWaitingForNextGame = false;
    this.nextGameTime = null;
    this.countdownTimer = null;
    
    // Game tracking
    this.totalGamesPlayed = 0;
    this.totalEvolutions = 0;
    
    // State persistence - save after EVERY game for better debugging
    this.saveProgressEveryGames = 1; // Save state after every game
    this.lastProgressFile = null;
    
    // Initialize but don't auto-start - let the API control startup
    this.initializeSystem(options);
  }

  async initializeSystem(options) {
    // Try to resume from previous state if available
    const shouldResume = options.resume !== false; // Resume by default
    if (shouldResume) {
      this.log('info', 'System', 'Attempting to resume from previous state...');
      try {
        await this.tryResumeFromPreviousState();
      } catch (error) {
        this.log('error', 'Resume', `Resume failed: ${error.message}, starting fresh`);
        await this.initializeInitialPopulation();
      }
    } else {
      this.log('info', 'System', 'Starting fresh (resume disabled)');
      await this.initializeInitialPopulation();
    }
    
    // Only auto-start if explicitly enabled
    if (options.autoStart !== false) {
      // Small delay to allow initialization
      setTimeout(() => {
        if (!this.isRunning) {
          this.log('info', 'System', 'Auto-starting continuous evolution...');
          this.start();
          this.runContinuousEvolution().catch(error => {
            this.log('error', 'AutoStart', `Auto-start failed: ${error.message}`);
          });
        }
      }, 3000); // 3 second delay
    }
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
        initialBalance: this.startingBalance, // Balance when born
        preGameBalance: this.startingBalance, // Balance before current game
        balanceHistory: [{ 
          game: 0, 
          balance: this.startingBalance, 
          change: 0, 
          reason: 'Initial spawn',
          timestamp: Date.now() 
        }],
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null,
        birthGame: 0,
        birthTimestamp: Date.now()
      },
      {
        id: 'aggressive-1',
        name: 'Aggressive Maximizer',
        archetype: 'Aggressive',
        strategy: 'Seeks to maximize personal gain, often at the expense of others',
        coinBalance: this.startingBalance,
        initialBalance: this.startingBalance,
        preGameBalance: this.startingBalance,
        balanceHistory: [{ 
          game: 0, 
          balance: this.startingBalance, 
          change: 0, 
          reason: 'Initial spawn',
          timestamp: Date.now() 
        }],
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null,
        birthGame: 0,
        birthTimestamp: Date.now()
      },
      {
        id: 'strategic-1',
        name: 'Strategic Opportunist',
        archetype: 'Strategic',
        strategy: 'Adapts strategy based on game state and other players\' behavior',
        coinBalance: this.startingBalance,
        initialBalance: this.startingBalance,
        preGameBalance: this.startingBalance,
        balanceHistory: [{ 
          game: 0, 
          balance: this.startingBalance, 
          change: 0, 
          reason: 'Initial spawn',
          timestamp: Date.now() 
        }],
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null,
        birthGame: 0,
        birthTimestamp: Date.now()
      },
      {
        id: 'analyzer-1',
        name: 'Pattern Analyzer',
        archetype: 'Analytical',
        strategy: 'Studies opponent patterns and exploits predictable behaviors',
        coinBalance: this.startingBalance,
        initialBalance: this.startingBalance,
        preGameBalance: this.startingBalance,
        balanceHistory: [{ 
          game: 0, 
          balance: this.startingBalance, 
          change: 0, 
          reason: 'Initial spawn',
          timestamp: Date.now() 
        }],
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null,
        birthGame: 0,
        birthTimestamp: Date.now()
      },
      {
        id: 'coalition-1',
        name: 'Coalition Builder',
        archetype: 'Coalition',
        strategy: 'Forms and breaks alliances strategically to control game outcomes',
        coinBalance: this.startingBalance,
        initialBalance: this.startingBalance,
        preGameBalance: this.startingBalance,
        balanceHistory: [{ 
          game: 0, 
          balance: this.startingBalance, 
          change: 0, 
          reason: 'Initial spawn',
          timestamp: Date.now() 
        }],
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null,
        birthGame: 0,
        birthTimestamp: Date.now()
      },
      {
        id: 'conservative-1',
        name: 'Risk Manager',
        archetype: 'Conservative',
        strategy: 'Prioritizes survival and consistent small gains over risky big wins',
        coinBalance: this.startingBalance,
        initialBalance: this.startingBalance,
        preGameBalance: this.startingBalance,
        balanceHistory: [{ 
          game: 0, 
          balance: this.startingBalance, 
          change: 0, 
          reason: 'Initial spawn',
          timestamp: Date.now() 
        }],
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null,
        birthGame: 0,
        birthTimestamp: Date.now()
      }
    ];

    this.strategies = initialStrategies;
    this.log('info', 'ContinuousEvolution', `Initialized population with ${this.strategies.length} strategies`);
  }

  async runContinuousEvolution() {
    if (!this.isRunning) {
      this.log('warning', 'System', 'Cannot start evolution - system not running');
      return;
    }

    this.log('info', 'System', 'Starting continuous evolution - no tournaments, just endless games with evolution on bankruptcy');

    // Broadcast initial strategies to frontend
    this.onUpdate({
      type: 'strategies_updated',
      strategies: this.strategies.map(s => ({
        ...s,
        balanceInfo: {
          current: s.coinBalance,
          initial: s.initialBalance,
          preGame: s.preGameBalance,
          totalChange: s.coinBalance - s.initialBalance,
          gameChange: s.coinBalance - s.preGameBalance,
          gamesPlayed: s.gamesPlayed,
          avgProfit: s.avgProfit || 0,
          totalProfit: s.totalProfit || 0,
          generationInfo: `Gen ${s.generationNumber}${s.birthGame > 0 ? ` (Born Game ${s.birthGame})` : ' (Original)'}`,
          recentBalanceHistory: (s.balanceHistory || []).slice(-5) // Last 5 balance changes
        }
      }))
    });

    let gameNumber = this.totalGamesPlayed; // Start from where we left off

    while (this.isRunning) {
      gameNumber++;
      this.totalGamesPlayed = gameNumber;
      
      this.log('info', 'GameLoop', `=== Starting Game ${gameNumber} ===`);
      
      // Filter out bankrupt strategies first
      const viableStrategies = this.strategies.filter(s => s.coinBalance >= this.entryFee);
      
      this.log('debug', 'GameLoop', `Viable strategies: ${viableStrategies.length}/${this.strategies.length}`);
      
      if (viableStrategies.length < 2) {
        this.log('warning', 'Evolution', 'Less than 2 viable strategies remaining - restarting with fresh population');
        await this.restartWithFreshPopulation();
        continue;
      }

      // Wait for rate limit delay between games (except first game)
      if (gameNumber > 1) {
        this.log('info', 'RateLimit', `About to wait ${this.gameDelayMinutes} minutes before game ${gameNumber}...`);
        await this.waitForNextGame();
        if (!this.isRunning) {
          this.log('warning', 'GameLoop', 'System stopped during wait period');
          break; // Check if stopped during wait
        }
        this.log('info', 'RateLimit', `Wait period completed, continuing with game ${gameNumber}`);
      }

      // Run a single game
      this.log('info', 'GameLoop', `Running game ${gameNumber} with ${viableStrategies.length} players`);
      const gameResult = await this.runSingleGame(gameNumber, viableStrategies);
      this.log('info', 'GameLoop', `Game ${gameNumber} completed - Winner: ${gameResult.winner?.name || 'None'}`);
      
      // Handle bankruptcies and evolution (combined)
      this.log('debug', 'GameLoop', 'Checking for bankruptcies and evolution...');
      await this.handleBankruptciesWithEvolution();
      
      // Save progress after EVERY game for debugging and persistence
      this.log('debug', 'GameLoop', `Saving progress after game ${gameNumber}...`);
      try {
        const saveResult = await this.saveProgressState();
        this.log('info', 'Persistence', `Game ${gameNumber} progress saved: ${saveResult || 'failed'}`);
      } catch (error) {
        this.log('error', 'Persistence', `Failed to save progress after game ${gameNumber}: ${error.message}`);
      }
      
      // Brief pause before next iteration
      this.log('debug', 'GameLoop', 'Brief pause before next game...');
      await this.sleep(2000);
      
      // Log current system state
      this.log('info', 'GameLoop', `System state: isRunning=${this.isRunning}, totalGamesPlayed=${this.totalGamesPlayed}, totalEvolutions=${this.totalEvolutions}`);
    }
    
    this.log('info', 'System', 'Continuous evolution loop ended');
  }

  async handleBankruptciesWithEvolution() {
    const bankruptStrategies = this.strategies.filter(s => s.coinBalance < this.entryFee);
    
    if (bankruptStrategies.length === 0) {
      // No bankruptcies, continue
      return;
    }

    this.log('info', 'Evolution', `${bankruptStrategies.length} strategies bankrupt - triggering evolution`);
    
    let evolutionsThisRound = 0; // Track evolutions in this round
    
    for (const bankruptStrategy of bankruptStrategies) {
      this.log('warning', 'Bankruptcy', `${bankruptStrategy.name} eliminated due to bankruptcy (${bankruptStrategy.coinBalance} coins)`);
      
      // Track elimination
      this.eliminatedStrategies.push({
        ...bankruptStrategy,
        eliminationReason: 'bankruptcy',
        eliminationTime: Date.now(),
        finalBalance: bankruptStrategy.coinBalance,
        gameNumber: this.totalGamesPlayed
      });

      this.onUpdate({
        type: 'strategy_eliminated',
        elimination: {
          strategyId: bankruptStrategy.id,
          strategyName: bankruptStrategy.name,
          reason: 'Bankruptcy - insufficient funds for entry fee',
          finalBalance: bankruptStrategy.coinBalance,
          gamesPlayed: bankruptStrategy.gamesPlayed,
          gameNumber: this.totalGamesPlayed,
          timestamp: Date.now()
        }
      });

      // Remove bankrupt strategy
      this.strategies = this.strategies.filter(s => s.id !== bankruptStrategy.id);
      
      // Create evolved replacement based on profitable strategies
      const evolvedReplacement = await this.createWeightedEvolvedStrategy(bankruptStrategy);
      
      if (evolvedReplacement) {
        this.strategies.push(evolvedReplacement);
        evolutionsThisRound++;
        
        this.log('info', 'Evolution', `${bankruptStrategy.name} → ${evolvedReplacement.name} (evolved replacement)`);
        
        // Track evolution in history
        this.evolutionHistory.push({
          gameNumber: this.totalGamesPlayed,
          eliminatedStrategy: bankruptStrategy,
          newStrategy: evolvedReplacement,
          reason: 'Bankruptcy replacement',
          timestamp: Date.now()
        });
        
        this.onUpdate({
          type: 'strategy_evolved',
          evolution: {
            eliminatedStrategy: bankruptStrategy,
            newStrategy: evolvedReplacement,
            reason: 'Bankruptcy replacement',
            parentStrategies: evolvedReplacement.parentIds,
            gameNumber: this.totalGamesPlayed,
            timestamp: Date.now()
          }
        });
      }
    }

    // Update total evolution counter
    this.totalEvolutions += evolutionsThisRound;

    // Ensure we still have exactly the right population size
    if (this.strategies.length !== this.populationSize) {
      this.log('warning', 'Evolution', `Population size mismatch: ${this.strategies.length} instead of ${this.populationSize}`);
    }

    // Broadcast updated strategies list
    this.onUpdate({
      type: 'strategies_updated',
      strategies: this.strategies.map(s => ({
        ...s,
        balanceInfo: {
          current: s.coinBalance,
          initial: s.initialBalance,
          preGame: s.preGameBalance,
          totalChange: s.coinBalance - s.initialBalance,
          gameChange: s.coinBalance - s.preGameBalance,
          gamesPlayed: s.gamesPlayed,
          avgProfit: s.avgProfit || 0,
          totalProfit: s.totalProfit || 0,
          generationInfo: `Gen ${s.generationNumber}${s.birthGame > 0 ? ` (Born Game ${s.birthGame})` : ' (Original)'}`,
          recentBalanceHistory: (s.balanceHistory || []).slice(-5) // Last 5 balance changes
        }
      }))
    });
    
    // Save progress after evolution events
    if (evolutionsThisRound > 0) {
      await this.saveProgressState();
    }
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
          initialBalance: this.startingBalance, // Balance when born
          preGameBalance: this.startingBalance, // Balance before current game
          balanceHistory: [{ 
            game: this.totalGamesPlayed, 
            balance: this.startingBalance, 
            change: 0, 
            reason: 'Evolved spawn',
            timestamp: Date.now() 
          }],
          gamesPlayed: 0,
          wins: 0,
          avgProfit: 0,
          totalProfit: 0,
          generationNumber: maxGeneration + 1,
          parentIds: weights.map(w => w.strategy.id),
          parentNames: weights.map(w => w.strategy.name),
          blendWeights: evolutionData.blendWeights || weights.map(w => w.weight),
          evolutionReasoning: evolutionData.evolutionReasoning || 'Profit-weighted hybrid strategy',
          birthGame: this.totalGamesPlayed,
          birthTimestamp: Date.now()
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
      initialBalance: this.startingBalance,
      preGameBalance: this.startingBalance,
      balanceHistory: [{ 
        game: this.totalGamesPlayed, 
        balance: this.startingBalance, 
        change: 0, 
        reason: 'Fallback evolved spawn',
        timestamp: Date.now() 
      }],
      gamesPlayed: 0,
      wins: 0,
      avgProfit: 0,
      totalProfit: 0,
      generationNumber: maxGeneration + 1,
      parentIds: weights.map(w => w.strategy.id),
      parentNames: weights.map(w => w.strategy.name),
      blendWeights: weights.map(w => w.weight),
      evolutionReasoning: `Fallback hybrid of ${topStrategy.name} (${(weights[0].weight * 100).toFixed(1)}%) and ${secondStrategy.name} (${((weights[1]?.weight || 0) * 100).toFixed(1)}%)`,
      birthGame: this.totalGamesPlayed,
      birthTimestamp: Date.now()
    };
  }

  async runSingleGame(gameNumber, participatingStrategies) {
    const gameData = {
      number: gameNumber,
      players: participatingStrategies.slice(0, 6), // Limit to 6 players per game
      startTime: Date.now()
    };

    // Record pre-game balances for all strategies
    this.strategies.forEach(strategy => {
      strategy.preGameBalance = strategy.coinBalance;
    });

    this.onUpdate({
      type: 'game_started',
      game: gameData
    });

    this.log('info', 'Game', `Starting game ${gameNumber} with players: ${gameData.players.map(p => p.name).join(', ')}`);

    // Deduct entry fees and track the change
    gameData.players.forEach(player => {
      const previousBalance = player.coinBalance;
      player.coinBalance -= this.entryFee;
      player.gamesPlayed++;
      
      // Record entry fee deduction in balance history
      this.addBalanceHistoryEntry(player, gameNumber, player.coinBalance, -this.entryFee, 'Entry fee deducted');
      
      this.log('debug', 'Balance', `${player.name}: ${previousBalance} → ${player.coinBalance} (-${this.entryFee} entry fee)`);
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

    // Distribute winnings and update statistics with detailed balance tracking
    if (gameResult.coinDistribution) {
      gameData.players.forEach((player, index) => {
        const winnings = gameResult.coinDistribution[index] || 0;
        const previousBalance = player.coinBalance;
        player.coinBalance += winnings;
        
        // Record winnings in balance history
        if (winnings > 0) {
          this.addBalanceHistoryEntry(player, gameNumber, player.coinBalance, winnings, 
            gameResult.winner?.id === player.id ? 'Game won' : 'Participation reward');
        }
        
        // Update profit statistics
        const profit = winnings - this.entryFee;
        player.totalProfit = (player.totalProfit || 0) + profit;
        
        if (player.gamesPlayed > 0) {
          player.avgProfit = player.totalProfit / player.gamesPlayed;
        }
        
        if (winnings > this.entryFee) {
          player.wins++;
        }
        
        this.log('info', 'Balance', `${player.name}: ${previousBalance} → ${player.coinBalance} (+${winnings} winnings, ${profit >= 0 ? '+' : ''}${profit} profit)`);
      });
    }

    this.log('info', 'Game', `Game ${gameNumber} completed. Winner: ${gameResult.winner?.name || 'None'}`);

    // Broadcast game completion with full results including balance changes
    this.onUpdate({
      type: 'game_completed',
      game: {
        number: gameNumber,
        players: gameData.players.map(p => ({ 
          id: p.id, 
          name: p.name,
          preGameBalance: p.preGameBalance,
          currentBalance: p.coinBalance,
          balanceChange: p.coinBalance - p.preGameBalance,
          totalProfit: p.totalProfit || 0,
          avgProfit: p.avgProfit || 0
        })),
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

  // Helper method to add balance history entries
  addBalanceHistoryEntry(strategy, gameNumber, newBalance, change, reason) {
    if (!strategy.balanceHistory) {
      strategy.balanceHistory = [];
    }
    
    strategy.balanceHistory.push({
      game: gameNumber,
      balance: newBalance,
      change: change,
      reason: reason,
      timestamp: Date.now()
    });
    
    // Keep only last 50 balance changes to prevent memory bloat
    if (strategy.balanceHistory.length > 50) {
      strategy.balanceHistory = strategy.balanceHistory.slice(-50);
    }
  }

  async simulateGameWithMatrix(matrixSystem, gameData) {
    // Setup players for matrix system
    const allPlayers = gameData.players.map((strategy, index) => ({
      id: strategy.id,
      name: strategy.name,
      strategy: strategy.strategy,
      agent: { strategyId: strategy.id }
    }));
    
    // Initialize matrix system with players
    matrixSystem.initializeMatrix(allPlayers);
    
    let activePlayers = [...allPlayers]; // Players who can make proposals
    let roundNumber = 1;
    let finalWinner = null;
    let finalProposal = null;
    let proposals = []; // Declare proposals outside the loop to maintain scope
    let allVotes = {}; // Declare allVotes outside the loop to maintain scope
    
    this.log('info', 'MatrixGame', `Starting matrix game with ${allPlayers.length} total players, ${activePlayers.length} active`);

    const context = {
      gameType: 'bankruptcyEvolution',
      matrixSystem: matrixSystem,
      allPlayers: allPlayers,
      activePlayers: activePlayers,
      gameNumber: gameData.number,
      phase: 'matrix_negotiation'
    };

    // Game loop - negotiate until winner emerges
    while (finalWinner === null && activePlayers.length > 0 && roundNumber <= this.maxRounds) {
      this.log('info', 'MatrixGame', `=== ROUND ${roundNumber} ===`);
      this.log('debug', 'MatrixGame', `Matrix negotiations starting (${this.maxNegotiationRounds} rounds)`);

      // Negotiation phase via matrix
      const matrixResultsPromise = matrixSystem.runNegotiation({
        players: allPlayers,
        eliminated: allPlayers.filter(p => !activePlayers.includes(p)),
        rounds: this.maxNegotiationRounds,
        gameContext: gameData
      });

      const matrixResults = await matrixResultsPromise;
      
      // Extract reasoning data after matrix
      const reasoning = this.extractReasoningData(matrixSystem);
      
      // Update context with matrix results
      context.finalMatrix = matrixResults.finalMatrix;
      context.matrixSystem = matrixSystem;
      context.reasoning = reasoning;

      // Capture logs
      const logs = context.logs || [];

      // Broadcast round data
      this.onUpdate({
        type: 'round_complete',
        data: {
          number: roundNumber,
          gameNumber: gameData.number,
          phase: 'matrix_complete',
          matrix: this.extractMatrixData(matrixSystem),
          reasoning: reasoning,
          activePlayers: activePlayers.length,
          logs: logs
        }
      });

      // Proposal phase - ONLY ACTIVE PLAYERS can make proposals
      this.log('debug', 'MatrixGame', 'Proposal phase starting');
      proposals = []; // Reset proposals for this round
      
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
      allVotes = {}; // Reset allVotes for this round (don't redeclare)
      
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
        const logs = Object.entries(reasoning).map(([playerId, reasoningText]) => {
          const player = allPlayers.find(p => p.id === playerId);
          return {
            level: 'info',
            source: 'AI_Reasoning',
            message: `${player?.name || playerId}: ${reasoningText}`,
            timestamp: Date.now()
          };
        });
        
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
    
    // Create proper equal distribution that totals exactly 100%
    const baseShare = Math.floor(100 / allPlayers.length);
    const remainder = 100 - (baseShare * allPlayers.length);
    const fallbackProposal = new Array(allPlayers.length).fill(baseShare);
    
    // Distribute remainder to first players to ensure exactly 100%
    for (let i = 0; i < remainder; i++) {
      fallbackProposal[i] += 1;
    }
    
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
    
    // Save final progress state
    const savedFile = await this.saveProgressState();
    if (savedFile) {
      this.log('info', 'System', `Final progress saved to: ${savedFile}`);
    }
    
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
        initialBalance: this.startingBalance,
        preGameBalance: this.startingBalance,
        balanceHistory: [{ 
          game: this.totalGamesPlayed, 
          balance: this.startingBalance, 
          change: 0, 
          reason: 'Fresh strategy spawn',
          timestamp: Date.now() 
        }],
        gamesPlayed: 0,
        wins: 0,
        avgProfit: 0,
        totalProfit: 0,
        generationNumber: 1,
        parentIds: null,
        birthGame: this.totalGamesPlayed,
        birthTimestamp: Date.now()
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
      initialBalance: this.startingBalance,
      preGameBalance: this.startingBalance,
      balanceHistory: [{ 
        game: this.totalGamesPlayed, 
        balance: this.startingBalance, 
        change: 0, 
        reason: 'Fresh strategy spawn',
        timestamp: Date.now() 
      }],
      gamesPlayed: 0,
      wins: 0,
      avgProfit: 0,
      totalProfit: 0,
      generationNumber: 1,
      parentIds: null,
      birthGame: this.totalGamesPlayed,
      birthTimestamp: Date.now()
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
${context.negotiationHistory?.slice(-6).map(n => `${n.playerName}: ${n.message}`).join('\n') || 'No recent negotiations'}

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
          const playerIndex = context.allPlayers.findIndex(p => p.id === player.id);
          if (playerIndex !== -1 && matrix[playerIndex]) {
            const votes = matrix[playerIndex].slice(context.allPlayers.length, context.allPlayers.length * 2);
            matrixInfo = `\nYour matrix voting weights: [${votes.map((v, i) => `${context.allPlayers[i].name}: ${v}`).join(', ')}]`;
          }
        } catch (err) {
          // Matrix info is optional
        }
      }

      const proposalSummary = proposals.map(p => {
        const shares = Object.entries(p.proposal)
          .map(([id, pct]) => `${context.allPlayers.find(pl => pl.id === id)?.name}: ${pct}%`)
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
${context.negotiationHistory?.slice(-4).map(n => `${n.playerName}: ${n.message}`).join('\n') || 'No recent negotiations'}

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

  async tryResumeFromPreviousState() {
    try {
      this.log('info', 'Resume', 'Searching for previous state in database...');
      const latestProgress = await this.findLatestProgressFromDB();
      if (latestProgress) {
        this.log('info', 'Resume', `Found previous state: evolution_state_${latestProgress.id} from ${latestProgress.created_at}`);
        const resumed = this.resumeFromProgressData(latestProgress);
        if (resumed) {
          this.log('info', 'Resume', `Successfully resumed from state ${latestProgress.id}`);
          this.log('info', 'Resume', `Continuing from game ${this.totalGamesPlayed + 1} with ${this.strategies.length} strategies`);
          return true;
        } else {
          this.log('warning', 'Resume', 'Failed to resume from progress data, will start fresh');
        }
      } else {
        this.log('info', 'Resume', 'No previous state found in database, will start fresh');
      }
    } catch (error) {
      this.log('error', 'Resume', `Resume failed: ${error.message}, will start fresh`);
    }
    
    // Fallback to fresh start
    this.log('info', 'Resume', 'Starting with fresh population');
    await this.initializeInitialPopulation();
    return false;
  }

  async findLatestProgressFromDB() {
    try {
      // Ensure the evolution_states table exists
      await this.ensureEvolutionStateTable();
      
      const result = await pool.query(`
        SELECT id, state_data, created_at 
        FROM evolution_states 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      this.log('error', 'Resume', `Database query failed: ${error.message}`);
      return null;
    }
  }

  async ensureEvolutionStateTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS evolution_states (
          id SERIAL PRIMARY KEY,
          state_data JSONB NOT NULL,
          total_games_played INTEGER DEFAULT 0,
          total_evolutions INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (error) {
      this.log('warning', 'Database', `Failed to create evolution_states table: ${error.message}`);
    }
  }

  resumeFromProgressData(progressRecord) {
    try {
      const progressData = progressRecord.state_data;
      
      // Validate the progress data
      if (!progressData.strategies || !Array.isArray(progressData.strategies) || progressData.strategies.length !== 6) {
        throw new Error(`Invalid progress data: expected 6 strategies, found ${progressData.strategies?.length || 0}`);
      }
      
      // Restore state
      this.strategies = progressData.strategies.map(s => ({
        ...s,
        gamesPlayed: s.gamesPlayed || 0,
        wins: s.wins || 0,
        avgProfit: s.avgProfit || 0,
        totalProfit: s.totalProfit || 0,
        generationNumber: s.generationNumber || 1,
        parentIds: s.parentIds || null,
        initialBalance: s.initialBalance || this.startingBalance,
        preGameBalance: s.preGameBalance || s.coinBalance,
        balanceHistory: s.balanceHistory || [],
        birthGame: s.birthGame || 0,
        birthTimestamp: s.birthTimestamp || Date.now()
      }));
      
      this.totalGamesPlayed = progressData.totalGamesPlayed || 0;
      this.totalEvolutions = progressData.totalEvolutions || 0;
      this.eliminatedStrategies = progressData.eliminatedStrategies || [];
      this.evolutionHistory = progressData.evolutionHistory || [];
      this.lastProgressId = progressRecord.id;
      
      this.log('info', 'Resume', `Restored state: ${this.strategies.length} strategies, ${this.totalGamesPlayed} games played, ${this.totalEvolutions} evolutions`);
      
      // Show current strategy standings
      this.log('info', 'Resume', 'Current strategy standings:');
      this.strategies.forEach((s, i) => {
        const rank = ['🥇', '🥈', '🥉', '📍', '🏅', '⭐'][i];
        const generation = s.generationNumber > 1 ? ` (Gen ${s.generationNumber})` : ' (Original)';
        this.log('info', 'Resume', `${rank} ${s.name}: ${s.coinBalance} coins${generation}`);
      });
      
      return true;
    } catch (error) {
      this.log('error', 'Resume', `Failed to resume from database record: ${error.message}`);
      return false;
    }
  }

  async saveProgressStateToDB() {
    try {
      // Ensure table exists
      await this.ensureEvolutionStateTable();
      
      const progressData = {
        timestamp: new Date().toISOString(),
        totalGamesPlayed: this.totalGamesPlayed,
        totalEvolutions: this.totalEvolutions,
        strategies: this.strategies.map(s => ({
          id: s.id,
          name: s.name,
          archetype: s.archetype,
          strategy: s.strategy,
          coinBalance: s.coinBalance,
          initialBalance: s.initialBalance,
          preGameBalance: s.preGameBalance,
          balanceHistory: s.balanceHistory || [],
          gamesPlayed: s.gamesPlayed,
          wins: s.wins,
          avgProfit: s.avgProfit,
          totalProfit: s.totalProfit,
          generationNumber: s.generationNumber,
          parentIds: s.parentIds,
          parentNames: s.parentNames,
          blendWeights: s.blendWeights,
          evolutionReasoning: s.evolutionReasoning,
          birthGame: s.birthGame,
          birthTimestamp: s.birthTimestamp
        })),
        eliminatedStrategies: this.eliminatedStrategies,
        evolutionHistory: this.evolutionHistory,
        systemParams: {
          entryFee: this.entryFee,
          startingBalance: this.startingBalance,
          populationSize: this.populationSize,
          gameDelayMinutes: this.gameDelayMinutes
        }
      };
      
      const result = await pool.query(`
        INSERT INTO evolution_states (state_data, total_games_played, total_evolutions)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [progressData, this.totalGamesPlayed, this.totalEvolutions]);
      
      this.lastProgressId = result.rows[0].id;
      
      this.log('info', 'Persistence', `Progress saved to database: evolution_state_${this.lastProgressId}`);
      return `evolution_state_${this.lastProgressId}`;
    } catch (error) {
      this.log('error', 'Persistence', `Failed to save progress to database: ${error.message}`);
      
      // Fallback to filesystem if database fails
      return this.saveProgressStateToFile();
    }
  }

  saveProgressStateToFile() {
    try {
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const progressData = {
        timestamp: new Date().toISOString(),
        totalGamesPlayed: this.totalGamesPlayed,
        totalEvolutions: this.totalEvolutions,
        strategies: this.strategies.map(s => ({
          id: s.id,
          name: s.name,
          archetype: s.archetype,
          strategy: s.strategy,
          coinBalance: s.coinBalance,
          initialBalance: s.initialBalance,
          preGameBalance: s.preGameBalance,
          balanceHistory: s.balanceHistory || [],
          gamesPlayed: s.gamesPlayed,
          wins: s.wins,
          avgProfit: s.avgProfit,
          totalProfit: s.totalProfit,
          generationNumber: s.generationNumber,
          parentIds: s.parentIds,
          parentNames: s.parentNames,
          blendWeights: s.blendWeights,
          evolutionReasoning: s.evolutionReasoning,
          birthGame: s.birthGame,
          birthTimestamp: s.birthTimestamp
        })),
        eliminatedStrategies: this.eliminatedStrategies,
        evolutionHistory: this.evolutionHistory,
        systemParams: {
          entryFee: this.entryFee,
          startingBalance: this.startingBalance,
          populationSize: this.populationSize,
          gameDelayMinutes: this.gameDelayMinutes
        }
      };
      
      const filename = `bankruptcy_progress_g${this.totalGamesPlayed}_${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(progressData, null, 2));
      this.lastProgressFile = filename;
      
      this.log('info', 'Persistence', `Progress saved to file (fallback): ${filename}`);
      return filename;
    } catch (error) {
      this.log('error', 'Persistence', `Failed to save progress to file: ${error.message}`);
      return null;
    }
  }

  async saveProgressState() {
    // Try database first, fallback to file
    return await this.saveProgressStateToDB();
  }
}

module.exports = { ContinuousEvolutionSystem };