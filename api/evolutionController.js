/**
 * Evolution Controller - Manages the AI Strategy Evolution Observatory
 * Handles starting/stopping continuous evolution simulations with bankruptcy elimination
 */

const { ContinuousEvolutionSystem } = require('../src/evolution/bankruptcyEvolutionSystem');
const { EvolutionWebSocketBroadcaster } = require('../src/evolution/evolutionWebSocketBroadcaster');

// Singleton evolution system that auto-starts
let globalEvolutionSystem = null;

class EvolutionController {
  constructor() {
    this.broadcaster = new EvolutionWebSocketBroadcaster();
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
    
    // Initialize the global evolution system on startup
    this.initializeGlobalSystem();
  }

  async initializeGlobalSystem() {
    if (!globalEvolutionSystem) {
      console.log('🧬 Initializing global evolution system...');
      
      globalEvolutionSystem = new ContinuousEvolutionSystem({
        mode: 'continuous_evolution',
        realTimeUpdates: true,
        fullLogging: true,
        autoStart: true, // Auto-start enabled for production
        onUpdate: (data) => this.handleSimulationUpdate(data),
        onLog: (log) => this.handleLog(log),
        broadcaster: this.broadcaster
      });
      
      console.log('🧬 Global evolution system initialized and auto-starting...');
    }
  }

  get isRunning() {
    return globalEvolutionSystem ? globalEvolutionSystem.isRunning : false;
  }

  get currentSimulation() {
    return globalEvolutionSystem;
  }

  async startEvolution(req, res) {
    if (!globalEvolutionSystem) {
      return res.status(500).json({ 
        error: 'Evolution system not initialized',
        status: 'error'
      });
    }

    if (this.isRunning) {
      return res.status(400).json({ 
        error: 'Evolution simulation is already running',
        status: 'running'
      });
    }

    try {
      console.log('🧬 Resuming evolution system...');
      
      // Just start the existing system
      globalEvolutionSystem.start();
      
      // Restart the evolution loop if needed
      globalEvolutionSystem.runContinuousEvolution().catch(error => {
        console.error('Evolution loop error:', error);
      });
      
      // Broadcast simulation resumed
      this.broadcaster.broadcast({
        type: 'simulation_resumed',
        data: {
          resumeTime: Date.now(),
          message: 'Evolution system resumed from pause'
        }
      });

      res.json({ 
        success: true, 
        message: 'Evolution simulation resumed',
        action: 'resumed',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Failed to resume evolution simulation:', error);
      res.status(500).json({ 
        error: 'Failed to resume evolution simulation',
        details: error.message 
      });
    }
  }

  async stopEvolution(req, res) {
    if (!globalEvolutionSystem) {
      return res.status(500).json({ 
        error: 'Evolution system not initialized',
        status: 'error'
      });
    }

    if (!this.isRunning) {
      return res.status(400).json({ 
        error: 'No evolution simulation is currently running',
        status: 'stopped'
      });
    }

    try {
      console.log('🧬 Pausing evolution system...');
      
      // Just stop the existing system (don't destroy it)
      await globalEvolutionSystem.stop();

      // Broadcast simulation paused
      this.broadcaster.broadcast({
        type: 'simulation_paused',
        data: {
          pauseTime: Date.now(),
          message: 'Evolution system paused (state preserved)'
        }
      });

      res.json({ 
        success: true, 
        message: 'Evolution simulation paused',
        action: 'paused',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Failed to pause evolution simulation:', error);
      res.status(500).json({ 
        error: 'Failed to pause evolution simulation',
        details: error.message 
      });
    }
  }

  getStatus(req, res) {
    const system = globalEvolutionSystem;
    
    res.json({
      isRunning: this.isRunning,
      startTime: this.simulationData.startTime,
      runTime: this.isRunning ? Date.now() - this.simulationData.startTime : 0,
      stats: {
        totalGames: system ? system.totalGamesPlayed : 0,
        totalEliminations: this.simulationData.totalEliminations,
        evolutionEvents: system ? system.totalEvolutions : 0
      },
      currentTournament: null, // Not applicable for continuous evolution
      currentGame: this.simulationData.currentGame,
      activeStrategies: this.simulationData.strategies.length,
      eliminatedStrategies: this.simulationData.eliminatedStrategies.length,
      systemType: 'continuous_evolution',
      autoStarted: true
    });
  }

  getCurrentData(req, res) {
    const system = globalEvolutionSystem;
    
    res.json({
      ...this.simulationData,
      isRunning: this.isRunning,
      runTime: this.isRunning ? Date.now() - this.simulationData.startTime : 0,
      totalGames: system ? system.totalGamesPlayed : 0,
      totalEvolutions: system ? system.totalEvolutions : 0,
      systemType: 'continuous_evolution',
      autoStarted: true
    });
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
          data: data.data
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
        console.log('🔍 Updating strategies:', data.strategies?.length || 0, 'strategies');
        this.simulationData.strategies = data.strategies || [];
        this.broadcaster.broadcast({
          type: 'strategies_updated',
          data: { strategies: data.strategies }
        });
        console.log('🔍 Broadcasted strategies_updated to clients');
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