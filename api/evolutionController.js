/**
 * Evolution Controller - Manages the AI Strategy Evolution Observatory
 * Handles starting/stopping continuous evolution simulations with bankruptcy elimination
 */

const { BankruptcyEvolutionSystem } = require('../src/evolution/bankruptcyEvolutionSystem');
const { EvolutionWebSocketBroadcaster } = require('../src/evolution/evolutionWebSocketBroadcaster');

class EvolutionController {
  constructor() {
    this.isRunning = false;
    this.currentSimulation = null;
    this.broadcaster = new EvolutionWebSocketBroadcaster();
    this.simulationData = {
      totalGames: 0,
      totalEliminations: 0,
      evolutionEvents: 0,
      startTime: null,
      currentTournament: null,
      currentGame: null,
      strategies: [],
      eliminatedStrategies: [],
      evolutionTree: [],
      detailedLogs: []
    };
  }

  async startEvolution(req, res) {
    if (this.isRunning) {
      return res.status(400).json({ 
        error: 'Evolution simulation is already running',
        status: 'running'
      });
    }

    try {
      const { mode = 'bankruptcy_elimination', realTime = true, fullLogging = true } = req.body;
      
      console.log('🧬 Starting Evolution Observatory simulation...');
      
      // Reset simulation data
      this.simulationData = {
        totalGames: 0,
        totalEliminations: 0,
        evolutionEvents: 0,
        startTime: Date.now(),
        currentTournament: null,
        currentGame: null,
        strategies: [],
        eliminatedStrategies: [],
        evolutionTree: [],
        detailedLogs: []
      };

      // Create the bankruptcy evolution system
      this.currentSimulation = new BankruptcyEvolutionSystem({
        mode: mode,
        realTimeUpdates: realTime,
        fullLogging: fullLogging,
        onUpdate: (data) => this.handleSimulationUpdate(data),
        onLog: (log) => this.handleLog(log),
        broadcaster: this.broadcaster
      });

      // Start the evolution system
      this.currentSimulation.start();

      // Start the simulation in the background
      this.isRunning = true;
      this.runSimulationLoop();
      
      // Broadcast simulation started
      this.broadcaster.broadcast({
        type: 'simulation_started',
        data: {
          mode: mode,
          realTime: realTime,
          fullLogging: fullLogging,
          startTime: this.simulationData.startTime
        }
      });

      res.json({ 
        success: true, 
        message: 'Evolution simulation started',
        mode: mode,
        startTime: this.simulationData.startTime
      });

    } catch (error) {
      console.error('Failed to start evolution simulation:', error);
      this.isRunning = false;
      res.status(500).json({ 
        error: 'Failed to start evolution simulation',
        details: error.message 
      });
    }
  }

  async stopEvolution(req, res) {
    if (!this.isRunning) {
      return res.status(400).json({ 
        error: 'No evolution simulation is currently running',
        status: 'stopped'
      });
    }

    try {
      console.log('🧬 Stopping Evolution Observatory simulation...');
      
      this.isRunning = false;
      
      if (this.currentSimulation) {
        await this.currentSimulation.stop();
        this.currentSimulation = null;
      }

      // Broadcast simulation stopped
      this.broadcaster.broadcast({
        type: 'simulation_stopped',
        data: {
          endTime: Date.now(),
          totalRunTime: Date.now() - this.simulationData.startTime,
          finalStats: {
            totalGames: this.simulationData.totalGames,
            totalEliminations: this.simulationData.totalEliminations,
            evolutionEvents: this.simulationData.evolutionEvents
          }
        }
      });

      res.json({ 
        success: true, 
        message: 'Evolution simulation stopped',
        runTime: Date.now() - this.simulationData.startTime,
        finalStats: {
          totalGames: this.simulationData.totalGames,
          totalEliminations: this.simulationData.totalEliminations,
          evolutionEvents: this.simulationData.evolutionEvents
        }
      });

    } catch (error) {
      console.error('Failed to stop evolution simulation:', error);
      res.status(500).json({ 
        error: 'Failed to stop evolution simulation',
        details: error.message 
      });
    }
  }

  getStatus(req, res) {
    res.json({
      isRunning: this.isRunning,
      startTime: this.simulationData.startTime,
      runTime: this.isRunning ? Date.now() - this.simulationData.startTime : 0,
      stats: {
        totalGames: this.simulationData.totalGames,
        totalEliminations: this.simulationData.totalEliminations,
        evolutionEvents: this.simulationData.evolutionEvents
      },
      currentTournament: this.simulationData.currentTournament,
      currentGame: this.simulationData.currentGame,
      activeStrategies: this.simulationData.strategies.length,
      eliminatedStrategies: this.simulationData.eliminatedStrategies.length
    });
  }

  getCurrentData(req, res) {
    res.json({
      ...this.simulationData,
      isRunning: this.isRunning,
      runTime: this.isRunning ? Date.now() - this.simulationData.startTime : 0
    });
  }

  async runSimulationLoop() {
    console.log('🧬 Evolution simulation loop started');
    
    try {
      while (this.isRunning && this.currentSimulation) {
        // Run a single tournament cycle
        const tournamentResult = await this.currentSimulation.runTournament();
        
        if (tournamentResult.allEliminated) {
          console.log('🧬 All strategies eliminated - restarting with fresh population');
          await this.currentSimulation.restartWithFreshPopulation();
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('🧬 Evolution simulation loop error:', error);
      this.isRunning = false;
      
      // Broadcast error
      this.broadcaster.broadcast({
        type: 'simulation_error',
        data: {
          error: error.message,
          timestamp: Date.now()
        }
      });
    }
    
    console.log('🧬 Evolution simulation loop ended');
  }

  handleSimulationUpdate(data) {
    switch (data.type) {
      case 'tournament_started':
        this.simulationData.currentTournament = data.tournament;
        this.simulationData.strategies = data.strategies || [];
        this.broadcaster.broadcast({
          type: 'tournament_started',
          data: data.tournament
        });
        break;

      case 'game_started':
        this.simulationData.currentGame = data.game;
        this.simulationData.totalGames++;
        this.broadcaster.broadcast({
          type: 'game_started',
          data: data.game
        });
        break;

      case 'game_delay_started':
        this.broadcaster.broadcast({
          type: 'game_delay_started',
          data: data.data
        });
        break;

      case 'game_delay_ended':
        this.broadcaster.broadcast({
          type: 'game_delay_ended',
          data: data.data
        });
        break;

      case 'countdown_update':
        this.broadcaster.broadcast({
          type: 'countdown_update',
          data: data.data
        });
        break;

      case 'round_update':
        this.broadcaster.broadcast({
          type: 'round_update',
          data: data.round
        });
        break;

      case 'strategy_eliminated':
        this.simulationData.eliminatedStrategies.push(data.elimination);
        this.simulationData.totalEliminations++;
        this.broadcaster.broadcast({
          type: 'strategy_eliminated',
          data: data.elimination
        });
        break;

      case 'strategy_evolved':
        this.simulationData.evolutionTree.push(data.evolution);
        this.simulationData.evolutionEvents++;
        this.broadcaster.broadcast({
          type: 'strategy_evolved',
          data: data.evolution
        });
        break;

      case 'strategies_updated':
        this.simulationData.strategies = data.strategies || [];
        this.broadcaster.broadcast({
          type: 'strategies_updated',
          data: { strategies: data.strategies }
        });
        break;

      default:
        console.log('Unknown simulation update:', data.type);
    }
  }

  handleLog(log) {
    // Add to detailed logs (keep last 1000 logs)
    this.simulationData.detailedLogs.push({
      ...log,
      timestamp: Date.now()
    });
    
    if (this.simulationData.detailedLogs.length > 1000) {
      this.simulationData.detailedLogs = this.simulationData.detailedLogs.slice(-1000);
    }

    // Send individual log message immediately for real-time display
    this.broadcaster.broadcast({
      type: 'log',
      data: {
        ...log,
        timestamp: Date.now()
      }
    });
  }

  // Add WebSocket client
  addWebSocketClient(ws) {
    this.broadcaster.addClient(ws);
    
    // Send current state to new client
    ws.send(JSON.stringify({
      type: 'initial_state',
      data: {
        isRunning: this.isRunning,
        ...this.simulationData,
        runTime: this.isRunning ? Date.now() - this.simulationData.startTime : 0
      }
    }));
  }

  removeWebSocketClient(ws) {
    this.broadcaster.removeClient(ws);
  }
}

// Create singleton instance
const evolutionController = new EvolutionController();

module.exports = {
  startEvolution: (req, res) => evolutionController.startEvolution(req, res),
  stopEvolution: (req, res) => evolutionController.stopEvolution(req, res),
  getStatus: (req, res) => evolutionController.getStatus(req, res),
  getCurrentData: (req, res) => evolutionController.getCurrentData(req, res),
  addWebSocketClient: (ws) => evolutionController.addWebSocketClient(ws),
  removeWebSocketClient: (ws) => evolutionController.removeWebSocketClient(ws)
}; 