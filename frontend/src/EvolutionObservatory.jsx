import React, { useEffect, useState, useRef } from 'react';
import './EvolutionObservatory.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const API_URL = import.meta.env.VITE_API_URL || '';

function EvolutionObservatory() {
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [currentTournament, setCurrentTournament] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [eliminatedStrategies, setEliminatedStrategies] = useState([]);
  const [evolutionTree, setEvolutionTree] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'tree', 'logs', 'reasoning'
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [simulationStats, setSimulationStats] = useState({
    totalGames: 0,
    totalEliminations: 0,
    evolutionEvents: 0,
    runningTime: 0
  });
  
  // Rate limiting and countdown states
  const [isWaitingForNextGame, setIsWaitingForNextGame] = useState(false);
  const [countdown, setCountdown] = useState({ minutes: 0, seconds: 0, formattedTime: '0:00', timeRemaining: 0 });
  const [aiReasoning, setAiReasoning] = useState([]);
  const [detailedLogs, setDetailedLogs] = useState([]);
  
  const wsRef = useRef(null);
  const startTimeRef = useRef(null);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Update running time
  useEffect(() => {
    if (isSimulationRunning && startTimeRef.current) {
      const interval = setInterval(() => {
        setSimulationStats(prev => ({
          ...prev,
          runningTime: Math.floor((Date.now() - startTimeRef.current) / 1000)
        }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isSimulationRunning]);

  const connectWebSocket = () => {
    wsRef.current = new WebSocket(`${WS_URL}/ws/evolution`);
    
    wsRef.current.onopen = () => {
      console.log('🧬 Connected to Evolution Observatory');
    };
    
    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleEvolutionUpdate(message);
    };
    
    wsRef.current.onclose = () => {
      console.log('🧬 Evolution Observatory disconnected');
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
    
    wsRef.current.onerror = (error) => {
      console.error('🧬 Evolution Observatory error:', error);
    };
  };

  const handleEvolutionUpdate = (message) => {
    switch (message.type) {
      case 'initial_state':
        // Handle the initial state when connecting to ongoing simulation
        const data = message.data;
        console.log('🔍 Frontend received initial_state:', {
          isRunning: data.isRunning,
          strategiesCount: data.strategies?.length || 0,
          eliminatedCount: data.eliminatedStrategies?.length || 0
        });
        setIsSimulationRunning(data.isRunning);
        if (data.isRunning) {
          startTimeRef.current = Date.now() - data.runTime;
          setSimulationStats({
            totalGames: data.totalGames || 0,
            totalEliminations: data.totalEliminations || 0,
            evolutionEvents: data.evolutionEvents || 0,
            runningTime: Math.floor(data.runTime / 1000) || 0
          });
        }
        setStrategies(data.strategies || []);
        setEliminatedStrategies(data.eliminatedStrategies || []);
        setEvolutionTree(data.evolutionTree || []);
        setCurrentTournament(data.currentTournament);
        setCurrentGame(data.currentGame);
        setDetailedLogs(data.detailedLogs || []);
        console.log('🧬 Received initial state - simulation running:', data.isRunning);
        break;
        
      case 'simulation_started':
        setIsSimulationRunning(true);
        startTimeRef.current = Date.now();
        setSimulationStats(prev => ({ ...prev, runningTime: 0 }));
        break;
        
      case 'simulation_stopped':
        setIsSimulationRunning(false);
        setIsWaitingForNextGame(false);
        break;
        
      case 'tournament_started':
        setCurrentTournament(message.data);
        setStrategies(message.data.strategies || []);
        break;
        
      case 'game_started':
        setCurrentGame(message.data);
        setSimulationStats(prev => ({ ...prev, totalGames: prev.totalGames + 1 }));
        setIsWaitingForNextGame(false);
        break;
        
      case 'game_delay_started':
        setIsWaitingForNextGame(true);
        break;
        
      case 'game_delay_ended':
        setIsWaitingForNextGame(false);
        break;
        
      case 'countdown_update':
        setCountdown(message.data);
        break;
        
      case 'round_update':
        setCurrentRound(message.data);
        if (message.data.logs) {
          setDetailedLogs(prev => [...prev.slice(-200), ...message.data.logs]); // Keep last 200 logs
        }
        if (message.data.reasoning) {
          setAiReasoning(prev => [...prev.slice(-10), ...Object.entries(message.data.reasoning).map(([strategyId, reasoning]) => ({
            strategyId,
            reasoning,
            timestamp: Date.now(),
            round: message.data.number
          }))]);
        }
        break;
        
      case 'strategy_eliminated':
        setEliminatedStrategies(prev => [...prev, message.data]);
        setSimulationStats(prev => ({ ...prev, totalEliminations: prev.totalEliminations + 1 }));
        break;
        
      case 'strategy_evolved':
        setEvolutionTree(prev => [...prev, message.data]);
        setSimulationStats(prev => ({ ...prev, evolutionEvents: prev.evolutionEvents + 1 }));
        break;
        
      case 'strategies_updated':
        console.log('🔍 Frontend received strategies_updated:', message.data?.strategies?.length || 0, 'strategies');
        setStrategies(message.data.strategies || []);
        break;
        
      case 'log':
        // Handle individual log messages - add to detailedLogs
        const logEntry = {
          ...message.data,
          timestamp: message.data.timestamp || Date.now()
        };
        setDetailedLogs(prev => [...prev.slice(-200), logEntry]); // Keep last 200 logs
        break;
        
      default:
        console.log('Unknown evolution message:', message);
    }
  };

  const startSimulation = async () => {
    try {
      const response = await fetch(`${API_URL}/api/evolution/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: 'bankruptcy_elimination',
          realTime: true,
          fullLogging: true 
        })
      });
      
      if (response.ok) {
        console.log('🧬 Evolution simulation started');
      } else {
        const errorData = await response.json();
        if (response.status === 400 && errorData.error?.includes('already running')) {
          console.log('🧬 Simulation already running - syncing state');
          // The WebSocket should receive the current state automatically
        } else {
          console.error('Failed to start simulation:', errorData);
        }
      }
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  };

  const stopSimulation = async () => {
    try {
      await fetch(`${API_URL}/api/evolution/stop`, { method: 'POST' });
      console.log('🧬 Evolution simulation stopped');
    } catch (error) {
      console.error('Failed to stop simulation:', error);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="evolution-observatory">
      <div className="observatory-header">
        <h1>🧬 AI Strategy Evolution Observatory</h1>
        <p>Watch artificial intelligence learn, adapt, and evolve in real-time</p>
        
        <div className="simulation-controls">
          {!isSimulationRunning ? (
            <button onClick={startSimulation} className="start-btn">
              🚀 Start Evolution Simulation
            </button>
          ) : (
            <button onClick={stopSimulation} className="stop-btn">
              ⏹️ Stop Simulation
            </button>
          )}
        </div>

        {/* Rate Limit Countdown Display */}
        {isWaitingForNextGame && (
          <div className="countdown-display">
            <div className="countdown-header">
              <h3>⏱️ Rate Limit Delay</h3>
              <p>Waiting to respect OpenAI API rate limits</p>
            </div>
            <div className="countdown-timer">
              <span className="countdown-time">{countdown.formattedTime}</span>
              <span className="countdown-label">until next game</span>
            </div>
            <div className="countdown-progress">
              <div 
                className="countdown-progress-bar"
                style={{
                  width: `${Math.max(0, 100 - (countdown.timeRemaining / (5 * 60 * 1000)) * 100)}%`
                }}
              ></div>
            </div>
          </div>
        )}

        <div className="simulation-stats">
          <div className="stat">
            <span className="stat-label">Running Time:</span>
            <span className="stat-value">{formatTime(simulationStats.runningTime)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Games Played:</span>
            <span className="stat-value">{simulationStats.totalGames}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Eliminations:</span>
            <span className="stat-value">{simulationStats.totalEliminations}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Evolution Events:</span>
            <span className="stat-value">{simulationStats.evolutionEvents}</span>
          </div>
        </div>
      </div>

      <div className="view-tabs">
        <button 
          className={activeView === 'dashboard' ? 'tab-active' : 'tab'}
          onClick={() => setActiveView('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={activeView === 'tree' ? 'tab-active' : 'tab'}
          onClick={() => setActiveView('tree')}
        >
          🌳 Evolution Tree
        </button>
        <button 
          className={activeView === 'logs' ? 'tab-active' : 'tab'}
          onClick={() => setActiveView('logs')}
        >
          📝 Live Logs
        </button>
        <button 
          className={activeView === 'reasoning' ? 'tab-active' : 'tab'}
          onClick={() => setActiveView('reasoning')}
        >
          🧠 AI Reasoning
        </button>
      </div>

      <div className="observatory-content">
        {activeView === 'dashboard' && (
          <DashboardView 
            strategies={strategies}
            currentGame={currentGame}
            currentTournament={currentTournament}
            currentRound={currentRound}
            eliminatedStrategies={eliminatedStrategies}
            onSelectStrategy={setSelectedStrategy}
            isWaitingForNextGame={isWaitingForNextGame}
            countdown={countdown}
            detailedLogs={detailedLogs}
            aiReasoning={aiReasoning}
          />
        )}
        
        {activeView === 'tree' && <EvolutionTreeView 
          evolutionTree={evolutionTree}
          strategies={strategies}
          eliminatedStrategies={eliminatedStrategies}
        />}
        
        {activeView === 'logs' && <LogsView 
          logs={detailedLogs}
          isRunning={isSimulationRunning}
        />}
        
        {activeView === 'reasoning' && <ReasoningView 
          selectedStrategy={selectedStrategy}
          currentRound={currentRound}
          strategies={strategies}
          onSelectStrategy={setSelectedStrategy}
        />}
      </div>
    </div>
  );
}

// Dashboard View Component
function DashboardView({ strategies, currentGame, currentTournament, currentRound, eliminatedStrategies, onSelectStrategy, isWaitingForNextGame, countdown, detailedLogs, aiReasoning }) {
  return (
    <div className="dashboard-view">
      <div className="dashboard-grid">
        <div className="game-status-panel">
          <h3>🎮 Current Game Status</h3>
          {isWaitingForNextGame ? (
            <div className="waiting-status">
              <p><strong>Status:</strong> Waiting for rate limit delay</p>
              <p><strong>Next Game:</strong> {countdown.formattedTime}</p>
              <p><strong>Reason:</strong> OpenAI API rate limiting</p>
            </div>
          ) : currentGame ? (
            <div>
              <p><strong>Tournament:</strong> {currentTournament?.number || 'N/A'}</p>
              <p><strong>Game:</strong> {currentGame.number || 'N/A'}</p>
              <p><strong>Round:</strong> {currentRound?.number || 'N/A'}</p>
              <p><strong>Phase:</strong> {currentRound?.phase || 'Waiting'}</p>
              {currentRound?.winner && (
                <p><strong>Winner:</strong> {currentRound.winner}</p>
              )}
            </div>
          ) : (
            <p>No active game</p>
          )}
        </div>

        <div className="strategy-health-panel">
          <h3>💰 Strategy Financial Health</h3>
          <div className="strategy-grid">
            {strategies.map(strategy => (
              <div 
                key={strategy.id} 
                className="strategy-card"
                onClick={() => onSelectStrategy(strategy)}
              >
                <div className="strategy-name">{strategy.name}</div>
                <div className="strategy-balance">
                  {strategy.coinBalance} coins
                </div>
                <div className={`strategy-status ${strategy.coinBalance < 100 ? 'danger' : strategy.coinBalance < 300 ? 'warning' : 'healthy'}`}>
                  {strategy.coinBalance < 100 ? '💀 Near Bankruptcy' : 
                   strategy.coinBalance < 300 ? '⚠️ At Risk' : '✅ Healthy'}
                </div>
                <div className="strategy-games">
                  Games: {strategy.gamesPlayed || 0}
                </div>
                <div className="strategy-description">
                  {strategy.strategy}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="elimination-panel">
          <h3>☠️ Recently Eliminated</h3>
          <div className="eliminated-list">
            {eliminatedStrategies.slice(-5).map((elimination, idx) => (
              <div key={idx} className="elimination-entry">
                <span className="eliminated-name">{elimination.strategyName}</span>
                <span className="elimination-reason">{elimination.reason}</span>
                <span className="elimination-time">{new Date(elimination.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="live-activity-panel">
          <h3>⚡ Live Logs</h3>
          <div className="live-logs-container">
            {isWaitingForNextGame ? (
              <div className="activity-feed">
                <div className="log-entry delay">
                  <span className="log-time">{countdown.formattedTime}</span>
                  <span className="log-source">RateLimit</span>
                  <span className="log-message">Waiting for rate limit delay</span>
                </div>
              </div>
            ) : detailedLogs.length > 0 ? (
              <div className="activity-feed">
                {detailedLogs.slice(-15).map((log, idx) => (
                  <div key={idx} className={`log-entry log-${log.level || 'info'}`}>
                    <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="log-source">{log.source || 'System'}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="activity-feed">
                <div className="log-entry">
                  <span className="log-source">System</span>
                  <span className="log-message">Waiting for simulation to start...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ai-reasoning-panel">
          <h3>🧠 Latest AI Reasoning</h3>
          <div className="reasoning-container">
            {aiReasoning.length > 0 ? (
              <div className="reasoning-feed">
                {aiReasoning.slice(-3).map((reasoning, idx) => {
                  const strategy = strategies.find(s => s.id === reasoning.strategyId);
                  return (
                    <div key={idx} className="reasoning-entry">
                      <div className="reasoning-header">
                        <span className="strategy-name">{strategy?.name || 'Unknown Strategy'}</span>
                        <span className="reasoning-round">Round {reasoning.round}</span>
                      </div>
                      <div className="reasoning-text">
                        {reasoning.reasoning.substring(0, 150)}
                        {reasoning.reasoning.length > 150 ? '...' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="reasoning-feed">
                <div className="reasoning-entry">
                  <div className="reasoning-text">No AI reasoning available yet. Start simulation to see strategic thinking!</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Evolution Tree View Component  
function EvolutionTreeView({ evolutionTree, strategies, eliminatedStrategies }) {
  return (
    <div className="evolution-tree-view">
      <h3>🌳 Strategy Evolution Family Tree</h3>
      <p>Trace how AI strategies mutate and evolve over time</p>
      
      <div className="tree-container">
        {evolutionTree.length === 0 ? (
          <p>No evolution events yet. Start the simulation to see strategies evolve!</p>
        ) : (
          <div className="evolution-timeline">
            {evolutionTree.map((event, idx) => (
              <div key={idx} className="evolution-event">
                <div className="event-time">{new Date(event.timestamp).toLocaleString()}</div>
                <div className="event-content">
                  <div className="parent-strategy">
                    📰 {event.parentStrategy?.name || 'Unknown'} 
                    <span className="fitness">Fitness: {event.parentFitness?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div className="evolution-arrow">⬇️ EVOLVED INTO ⬇️</div>
                  <div className="child-strategy">
                    🧬 {event.childStrategy?.name || 'Unknown'}
                    <span className="mutation">Mutation: {event.mutationType || 'Unknown'}</span>
                  </div>
                  {event.reasoning && (
                    <div className="evolution-reasoning">
                      <strong>Evolution Reasoning:</strong> {event.reasoning}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Logs View Component
function LogsView({ logs, isRunning }) {
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="logs-view">
      <h3>📝 Live Evolution Logs</h3>
      <div className="logs-container">
        {logs.length === 0 ? (
          <p>No logs yet. {isRunning ? 'Simulation starting...' : 'Start the simulation to see logs!'}</p>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className={`log-entry log-${log.level || 'info'}`}>
              <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className="log-source">{log.source || 'System'}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

// AI Reasoning View Component
function ReasoningView({ selectedStrategy, currentRound, strategies, onSelectStrategy }) {
  return (
    <div className="reasoning-view">
      <h3>🧠 AI Strategic Reasoning</h3>
      
      <div className="strategy-selector">
        <label>Select Strategy to Inspect:</label>
        <select 
          value={selectedStrategy?.id || ''} 
          onChange={(e) => {
            const strategy = strategies.find(s => s.id === e.target.value);
            onSelectStrategy(strategy);
          }}
        >
          <option value="">Choose a strategy...</option>
          {strategies.map(strategy => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name} ({strategy.coinBalance} coins)
            </option>
          ))}
        </select>
      </div>

      {selectedStrategy ? (
        <div className="reasoning-content">
          <div className="strategy-details">
            <h4>{selectedStrategy.name}</h4>
            <p><strong>Archetype:</strong> {selectedStrategy.archetype}</p>
            <p><strong>Current Balance:</strong> {selectedStrategy.coinBalance} coins</p>
            <p><strong>Games Played:</strong> {selectedStrategy.gamesPlayed || 0}</p>
            <p><strong>Strategy Description:</strong> {selectedStrategy.strategy}</p>
          </div>

          {currentRound && currentRound.reasoning && currentRound.reasoning[selectedStrategy.id] && (
            <div className="current-reasoning">
              <h4>Current Round Reasoning:</h4>
              <div className="reasoning-text">
                {currentRound.reasoning[selectedStrategy.id]}
              </div>
            </div>
          )}

          {currentRound && currentRound.matrix && currentRound.matrix[selectedStrategy.id] && (
            <div className="strategy-matrix">
              <h4>Current Strategy Matrix:</h4>
              <div className="matrix-display">
                <div className="matrix-section">
                  <strong>Proposal:</strong> [{currentRound.matrix[selectedStrategy.id].proposal?.join(', ') || 'N/A'}]
                </div>
                <div className="matrix-section">
                  <strong>Votes:</strong> [{currentRound.matrix[selectedStrategy.id].votes?.join(', ') || 'N/A'}]
                </div>
                <div className="matrix-section">
                  <strong>Vote Requests:</strong> [{currentRound.matrix[selectedStrategy.id].requests?.join(', ') || 'N/A'}]
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p>Select a strategy to see its AI reasoning and decision-making process.</p>
      )}
    </div>
  );
}

export default EvolutionObservatory; 