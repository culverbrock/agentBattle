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
        // Log to both debug level and broadcast directly for dashboard
        this.log('debug', 'MatrixSystem', message);
        
        // Also send as individual log for live dashboard display
        if (this.broadcaster) {
          this.broadcaster.broadcast({
            type: 'log',
            data: {
              level: 'debug',
              source: 'MatrixSystem',
              message: message,
              timestamp: Date.now()
            }
          });
        }
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

    return gameData;
  }

  async simulateGameWithMatrix(matrixSystem, gameData) {
    const players = gameData.players.map((strategy, index) => ({
      id: strategy.id,
      name: strategy.name,
      strategy: strategy.strategy
    }));

    matrixSystem.initializeMatrix(players);

    // Run matrix negotiation rounds with delays
    const maxRounds = 5;
    for (let round = 1; round <= maxRounds; round++) {
      this.log('debug', 'MatrixGame', `Round ${round} negotiation starting`);
      
      // Delay between rounds to pace AI interactions
      if (round > 1) {
        await this.sleep(this.roundDelaySeconds * 1000);
      }
      
      for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const success = await matrixSystem.performNegotiationRound(
          playerIndex,
          players[playerIndex].strategy,
          round
        );
        
        if (!success) {
          this.log('warning', 'MatrixGame', `Player ${playerIndex} failed negotiation in round ${round}`);
        }
        
        // Small delay between each player's turn to pace API calls
        await this.sleep(this.interactionDelaySeconds * 1000);
      }

      // Broadcast round update
      if (this.realTimeUpdates) {
        const reasoning = this.extractReasoningData(matrixSystem);
        const logs = [{
          level: 'info',
          source: 'MatrixGame',
          message: `Round ${round} completed`,
          timestamp: Date.now()
        }];
        
        // Add reasoning as individual log entries
        Object.entries(reasoning).forEach(([strategyId, reasoningText]) => {
          const player = players.find(p => p.id === strategyId);
          if (player && reasoningText) {
            logs.push({
              level: 'info',
              source: 'AI_Reasoning',
              message: `${player.name}: ${reasoningText}`,
              timestamp: Date.now()
            });
          }
        });
        
        this.onUpdate({
          type: 'round_update',
          data: {
            number: round,
            gameNumber: gameData.number,
            phase: 'negotiation',
            matrix: this.extractMatrixData(matrixSystem),
            reasoning: reasoning,
            logs: logs
          }
        });
      }
    }

    // Extract proposals and votes from final matrix state
    const finalMatrix = matrixSystem.getMatrix();
    const proposals = this.extractProposals(finalMatrix, players.length);
    const votes = this.extractVotes(finalMatrix, players.length);

    // Determine winner
    const winner = this.determineWinner(proposals, votes, players);
    const winningProposal = winner ? proposals[winner.playerIndex] : null;
    const coinDistribution = winningProposal ? 
      winningProposal.map(percentage => Math.round((percentage / 100) * (players.length * this.entryFee))) :
      new Array(players.length).fill(0);

    return {
      winner: winner,
      winningProposal: winningProposal,
      coinDistribution: coinDistribution,
      proposals: proposals,
      votes: votes
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
    return matrix.map(row => row.slice(numPlayers, numPlayers * 2));
  }

  determineWinner(proposals, votes, players) {
    const proposalVoteTotals = proposals.map((_, proposalIndex) => {
      return votes.reduce((total, voteRow) => total + (voteRow[proposalIndex] || 0), 0);
    });

    const winningProposalIndex = proposalVoteTotals.findIndex(total => total >= 61);
    
    if (winningProposalIndex !== -1) {
      return {
        playerIndex: winningProposalIndex,
        ...players[winningProposalIndex],
        voteTotal: proposalVoteTotals[winningProposalIndex]
      };
    }

    return null; // No winner - rare case
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
}

module.exports = { ContinuousEvolutionSystem }; 