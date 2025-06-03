/**
 * Bankruptcy Evolution System - Runs continuous tournaments until strategies go bankrupt
 * Replaces the fixed tournament approach with natural selection based on financial survival
 */

const { ImprovedMatrixSystem } = require('../matrix/improvedMatrixSystem');
const { callLLM } = require('../core/llmApi');

class BankruptcyEvolutionSystem {
  constructor(options = {}) {
    this.mode = options.mode || 'bankruptcy_elimination';
    this.realTimeUpdates = options.realTimeUpdates !== false;
    this.fullLogging = options.fullLogging !== false;
    this.onUpdate = options.onUpdate || (() => {});
    this.onLog = options.onLog || (() => {});
    this.broadcaster = options.broadcaster;
    
    this.isRunning = false;
    this.currentTournament = null;
    this.strategies = [];
    this.eliminatedStrategies = [];
    this.evolutionHistory = [];
    
    // Strategy starting conditions
    this.entryFee = 100;
    this.startingBalance = 500; // Each strategy starts with 5 games worth of entry fees
    
    // Evolution parameters
    this.minPopulation = 6;
    this.maxPopulation = 12;
    this.evolutionPressure = 0.3; // Increased from 0.1 to 0.3 (30% chance to evolve when winning)
    
    // Rate limiting and timing
    this.gameDelayMinutes = 5; // 5 minute delay between games
    this.interactionDelaySeconds = 3; // 3 second delay between interactions
    this.roundDelaySeconds = 10; // 10 second delay between negotiation rounds
    this.isWaitingForNextGame = false;
    this.nextGameTime = null;
    this.countdownTimer = null;
    
    this.initializeInitialPopulation();
  }

  async initializeInitialPopulation() {
    console.log('🧬 Initializing starting population for bankruptcy evolution...');
    
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
        generationNumber: 1,
        parentId: null
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
        generationNumber: 1,
        parentId: null
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
        generationNumber: 1,
        parentId: null
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
        generationNumber: 1,
        parentId: null
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
        generationNumber: 1,
        parentId: null
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
        generationNumber: 1,
        parentId: null
      }
    ];

    this.strategies = initialStrategies;
    this.log('info', 'BankruptcyEvolution', `Initialized population with ${this.strategies.length} strategies`);
  }

  async runTournament() {
    if (!this.isRunning) return { allEliminated: false };

    this.currentTournament = {
      number: (this.currentTournament?.number || 0) + 1,
      startTime: Date.now(),
      participatingStrategies: this.strategies.filter(s => s.coinBalance >= this.entryFee)
    };

    this.onUpdate({
      type: 'tournament_started',
      tournament: this.currentTournament,
      strategies: this.strategies
    });

    this.log('info', 'Tournament', `Starting tournament ${this.currentTournament.number} with ${this.currentTournament.participatingStrategies.length} viable strategies`);

    // Check if we have enough strategies to play
    if (this.currentTournament.participatingStrategies.length < 2) {
      this.log('warning', 'Tournament', 'Not enough viable strategies to continue tournament');
      return { allEliminated: true };
    }

    // Run games until one strategy is clearly dominant or several go bankrupt
    let gameNumber = 0;
    const maxGamesPerTournament = 20;

    while (gameNumber < maxGamesPerTournament && this.isRunning) {
      gameNumber++;
      
      // Filter out bankrupt strategies
      const viableStrategies = this.strategies.filter(s => s.coinBalance >= this.entryFee);
      
      if (viableStrategies.length < 2) {
        this.log('warning', 'Tournament', 'Insufficient viable strategies remaining');
        break;
      }

      // Wait for rate limit delay between games (except first game)
      if (gameNumber > 1) {
        await this.waitForNextGame();
        if (!this.isRunning) break; // Check if stopped during wait
      }

      // Run a single game
      const gameResult = await this.runSingleGame(gameNumber, viableStrategies);
      
      // Handle bankruptcies
      await this.handleBankruptcies();
      
      // Check for evolution opportunities
      await this.checkForEvolution();
      
      // Brief pause before next iteration
      await this.sleep(2000);
    }

    this.currentTournament.endTime = Date.now();
    this.currentTournament.duration = this.currentTournament.endTime - this.currentTournament.startTime;

    this.log('info', 'Tournament', `Tournament ${this.currentTournament.number} completed in ${this.currentTournament.duration}ms`);

    return { 
      allEliminated: this.strategies.filter(s => s.coinBalance >= this.entryFee).length === 0,
      tournament: this.currentTournament
    };
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

  async runSingleGame(gameNumber, participatingStrategies) {
    const gameData = {
      number: gameNumber,
      tournamentNumber: this.currentTournament.number,
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
      customLogger: (message) => this.log('debug', 'MatrixSystem', message)
    });

    const gameResult = await this.simulateGameWithMatrix(matrixSystem, gameData);
    
    gameData.endTime = Date.now();
    gameData.winner = gameResult.winner;
    gameData.finalProposal = gameResult.winningProposal;
    gameData.coinDistribution = gameResult.coinDistribution;

    // Distribute winnings
    if (gameResult.coinDistribution) {
      gameData.players.forEach((player, index) => {
        const winnings = gameResult.coinDistribution[index] || 0;
        player.coinBalance += winnings;
        
        // Update statistics
        const profit = winnings - this.entryFee;
        if (player.avgProfit === 0) {
          player.avgProfit = profit;
        } else {
          player.avgProfit = (player.avgProfit * (player.gamesPlayed - 1) + profit) / player.gamesPlayed;
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
        this.onUpdate({
          type: 'round_update',
          round: {
            number: round,
            gameNumber: gameData.number,
            phase: 'negotiation',
            matrix: this.extractMatrixData(matrixSystem),
            reasoning: this.extractReasoningData(matrixSystem)
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

    matrix.forEach((row, playerIndex) => {
      const proposal = row.slice(0, numPlayers);
      const votes = row.slice(numPlayers, numPlayers * 2);
      const requests = row.slice(numPlayers * 2, numPlayers * 3);

      matrixData[this.strategies[playerIndex]?.id] = {
        proposal: proposal,
        votes: votes,
        requests: requests
      };
    });

    return matrixData;
  }

  extractReasoningData(matrixSystem) {
    if (!this.fullLogging) return {};

    const reasoning = {};
    matrixSystem.playerExplanations.forEach((explanations, playerIndex) => {
      if (explanations.length > 0) {
        const latestExplanation = explanations[explanations.length - 1];
        reasoning[this.strategies[playerIndex]?.id] = latestExplanation.explanation;
      }
    });

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

  async handleBankruptcies() {
    const bankruptStrategies = this.strategies.filter(s => s.coinBalance < this.entryFee);
    
    for (const strategy of bankruptStrategies) {
      this.log('warning', 'Bankruptcy', `Strategy ${strategy.name} eliminated due to bankruptcy (${strategy.coinBalance} coins)`);
      
      this.eliminatedStrategies.push({
        ...strategy,
        eliminationReason: 'bankruptcy',
        eliminationTime: Date.now(),
        finalBalance: strategy.coinBalance
      });

      this.onUpdate({
        type: 'strategy_eliminated',
        elimination: {
          strategyId: strategy.id,
          strategyName: strategy.name,
          reason: 'Bankruptcy - insufficient funds for entry fee',
          finalBalance: strategy.coinBalance,
          gamesPlayed: strategy.gamesPlayed,
          timestamp: Date.now()
        }
      });
    }

    // Remove bankrupt strategies
    this.strategies = this.strategies.filter(s => s.coinBalance >= this.entryFee);
    
    // Spawn new agents to replace eliminated ones
    const eliminatedCount = bankruptStrategies.length;
    if (eliminatedCount > 0) {
      this.log('info', 'Evolution', `Spawning ${eliminatedCount} new agents to replace eliminated strategies`);
      
      for (let i = 0; i < eliminatedCount; i++) {
        // Create a new strategy to replace the eliminated one
        const newStrategy = await this.createFreshStrategy();
        if (newStrategy) {
          this.strategies.push(newStrategy);
          this.log('info', 'Evolution', `New strategy spawned: ${newStrategy.name}`);
          
          // Broadcast the new strategy
          this.onUpdate({
            type: 'strategy_spawned',
            strategy: {
              id: newStrategy.id,
              name: newStrategy.name,
              archetype: newStrategy.archetype,
              coinBalance: newStrategy.coinBalance,
              reason: 'Replacement for bankruptcy elimination'
            }
          });
        }
      }
      
      // Broadcast updated strategies list
      this.onUpdate({
        type: 'strategies_updated',
        strategies: this.strategies
      });
    }
  }

  async checkForEvolution() {
    // Identify successful strategies (above average performance OR simply profitable)
    const avgBalance = this.strategies.reduce((sum, s) => sum + s.coinBalance, 0) / this.strategies.length;
    const successfulStrategies = this.strategies.filter(s => 
      (s.coinBalance > avgBalance || s.avgProfit > 0) && // Above average OR profitable
      s.gamesPlayed >= 2 && // Reduced from 3 to 2 games minimum
      Math.random() < this.evolutionPressure
    );

    this.log('debug', 'Evolution', `Checking evolution: ${successfulStrategies.length} potential parents found`);

    for (const parentStrategy of successfulStrategies) {
      if (this.strategies.length < this.maxPopulation) {
        const childStrategy = await this.evolveStrategy(parentStrategy);
        if (childStrategy) {
          this.strategies.push(childStrategy);
          
          this.onUpdate({
            type: 'strategy_evolved',
            evolution: {
              parentStrategy: parentStrategy,
              childStrategy: childStrategy,
              parentFitness: parentStrategy.avgProfit,
              mutationType: childStrategy.mutationType,
              reasoning: childStrategy.evolutionReasoning,
              timestamp: Date.now()
            }
          });

          this.log('info', 'Evolution', `${parentStrategy.name} evolved into ${childStrategy.name}`);
        }
      }
    }
  }

  async evolveStrategy(parentStrategy) {
    try {
      // Try LLM-based evolution first
      const evolutionPrompt = `You are an AI strategy evolution system. A successful strategy needs to evolve and adapt.

PARENT STRATEGY:
Name: ${parentStrategy.name}
Archetype: ${parentStrategy.archetype}
Current Strategy: ${parentStrategy.strategy}
Performance: ${parentStrategy.coinBalance} coins, ${parentStrategy.wins} wins in ${parentStrategy.gamesPlayed} games
Average Profit: ${parentStrategy.avgProfit.toFixed(2)} coins per game

EVOLUTION TASK:
Create an evolved version of this strategy that builds upon its success while introducing beneficial mutations.

EVOLUTION TYPES:
1. ENHANCEMENT - Improve existing strengths
2. ADAPTATION - Add new capabilities based on environment
3. SPECIALIZATION - Focus on specific successful tactics
4. HYBRIDIZATION - Combine with traits from other successful archetypes

Respond with JSON:
{
  "name": "New evolved strategy name",
  "archetype": "Strategy category (keep similar or evolve)",
  "strategy": "Detailed strategy description (build upon parent)",
  "mutationType": "Type of evolution applied",
  "evolutionReasoning": "Why this evolution should be successful"
}`;

      const response = await callLLM(evolutionPrompt, {
        temperature: 0.7,
        max_tokens: 500,
        system: 'You are an expert in strategic evolution and game theory. Create beneficial mutations that improve upon successful strategies.'
      });

      const evolutionData = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');
      
      if (evolutionData.name && evolutionData.strategy) {
        return {
          id: `evolved-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: evolutionData.name,
          archetype: evolutionData.archetype || parentStrategy.archetype,
          strategy: evolutionData.strategy,
          coinBalance: this.startingBalance,
          gamesPlayed: 0,
          wins: 0,
          avgProfit: 0,
          generationNumber: (parentStrategy.generationNumber || 1) + 1,
          parentId: parentStrategy.id,
          mutationType: evolutionData.mutationType,
          evolutionReasoning: evolutionData.evolutionReasoning
        };
      } else {
        throw new Error('Invalid evolution data generated');
      }
    } catch (error) {
      this.log('warning', 'Evolution', `LLM-based evolution failed for ${parentStrategy.name}: ${error.message}, using fallback`);
      
      // Fallback to simpler evolution if LLM fails
      return this.createSimpleEvolution(parentStrategy);
    }
  }

  createSimpleEvolution(parentStrategy) {
    // Simplified evolution as fallback when LLM fails
    const evolutionTypes = [
      'ENHANCEMENT', 'ADAPTATION', 'SPECIALIZATION', 'HYBRIDIZATION'
    ];
    
    const mutationType = evolutionTypes[Math.floor(Math.random() * evolutionTypes.length)];
    
    // Generate evolved name
    const evolutionSuffixes = [
      'Enhanced', 'Advanced', 'Evolved', 'Refined', 'Optimized', 'Prime', 'Elite', 'Modified'
    ];
    const suffix = evolutionSuffixes[Math.floor(Math.random() * evolutionSuffixes.length)];
    const newName = `${parentStrategy.name} ${suffix}`;
    
    // Generate evolved strategy based on parent
    let evolvedStrategy = parentStrategy.strategy;
    
    switch (mutationType) {
      case 'ENHANCEMENT':
        evolvedStrategy += ' Enhanced with improved mathematical precision and risk assessment.';
        break;
      case 'ADAPTATION':
        evolvedStrategy += ' Adapted with dynamic response patterns and environmental awareness.';
        break;
      case 'SPECIALIZATION':
        evolvedStrategy += ' Specialized for optimal coalition formation and vote trading efficiency.';
        break;
      case 'HYBRIDIZATION':
        evolvedStrategy += ' Hybridized with cross-archetype techniques for maximum flexibility.';
        break;
    }
    
    const evolutionReasoning = `${mutationType} evolution of successful ${parentStrategy.archetype} strategy. Parent had ${parentStrategy.avgProfit.toFixed(2)} average profit over ${parentStrategy.gamesPlayed} games.`;
    
    return {
      id: `evolved-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: newName,
      archetype: parentStrategy.archetype, // Keep same archetype but evolved
      strategy: evolvedStrategy,
      coinBalance: this.startingBalance,
      gamesPlayed: 0,
      wins: 0,
      avgProfit: 0,
      generationNumber: (parentStrategy.generationNumber || 1) + 1,
      parentId: parentStrategy.id,
      mutationType: mutationType,
      evolutionReasoning: evolutionReasoning
    };
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
        creationTime: Date.now(),
        parentId: null, // Fresh strategy, not evolved from another
        mutationCount: 0
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
      creationTime: Date.now(),
      parentId: null,
      mutationCount: 0
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

module.exports = { BankruptcyEvolutionSystem }; 