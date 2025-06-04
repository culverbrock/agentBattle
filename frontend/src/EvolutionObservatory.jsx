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
  const [completedGames, setCompletedGames] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
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
        
      case 'game_completed':
        // Store completed game results with final matrix and proposals
        const completedGame = {
          ...message.game,
          completedAt: Date.now()
        };
        setCompletedGames(prev => [...prev.slice(-20), completedGame]); // Keep last 20 games
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
          setDetailedLogs(prev => [...prev.slice(-10000), ...message.data.logs]); // Keep last 10,000 logs
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
        setEliminatedStrategies(prev => [...prev, message.elimination]);
        setSimulationStats(prev => ({ ...prev, totalEliminations: prev.totalEliminations + 1 }));
        break;
        
      case 'strategy_evolved':
        setEvolutionTree(prev => [...prev, message.evolution]);
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
        setDetailedLogs(prev => [...prev.slice(-10000), logEntry]); // Keep last 10,000 logs
        break;
        
      case 'balance_timeline_history':
        setBalanceHistory(message.data);
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
        <div className="header-title-section">
          <h1>🧬 AI Strategy Evolution Observatory</h1>
          <button 
            className="info-button"
            onClick={() => setShowInfoModal(true)}
            title="Learn about the evolution system"
          >
            ℹ️ How It Works
          </button>
        </div>
        <p>Watch artificial intelligence learn, adapt, and evolve in real-time</p>
        
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
            balanceHistory={balanceHistory}
            completedGames={completedGames}
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

      {/* Info Modal */}
      {showInfoModal && (
        <InfoModal onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
}

// Dashboard View Component
function DashboardView({ strategies, currentGame, currentTournament, currentRound, eliminatedStrategies, onSelectStrategy, isWaitingForNextGame, countdown, detailedLogs, aiReasoning, balanceHistory, completedGames }) {
  
  const downloadLogs = () => {
    const logData = {
      exportTimestamp: new Date().toISOString(),
      totalLogs: detailedLogs.length,
      logs: detailedLogs,
      metadata: {
        gameInfo: {
          currentTournament: currentTournament?.number || 'N/A',
          currentGame: currentGame?.number || 'N/A',
          currentRound: currentRound?.number || 'N/A'
        },
        strategiesSnapshot: strategies.map(s => ({
          id: s.id,
          name: s.name,
          balance: s.coinBalance,
          gamesPlayed: s.gamesPlayed
        })),
        eliminatedCount: eliminatedStrategies.length,
        completedGames: completedGames.length
      }
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evolution-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-view">
      <div className="dashboard-grid">
        {/* Live Logs - Most Important, Goes First */}
        <div className="live-activity-panel">
          <div className="panel-header-with-download">
            <h3>⚡ Live Matrix System Logs</h3>
            <button 
              className="download-logs-btn" 
              onClick={downloadLogs}
              title="Download complete log history as JSON file"
            >
              📥 Download Full Logs ({detailedLogs.length})
            </button>
          </div>
          <div className="live-logs-console">
            {isWaitingForNextGame ? (
              <div className="console-line">
                {countdown.formattedTime} - RateLimit: Waiting for rate limit delay
              </div>
            ) : detailedLogs.length > 0 ? (
              <div>
                {detailedLogs.slice(-150).map((log, idx) => (
                  <div key={idx} className="console-line">
                    {log.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="console-line">
                System: Waiting for simulation to start...
              </div>
            )}
          </div>
        </div>

        {/* Combined Game Status + Strategy Health */}
        <div className="game-strategy-panel">
          <h3>🎮 Game Status & Financial Health</h3>
          
          {/* Game Status Section */}
          <div className="game-status-section">
            <h4>Current Game</h4>
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

          {/* Strategy Health Section */}
          <div className="strategy-health-section">
            <h4>Strategy Financial Health</h4>
            <div className="strategy-grid">
              {strategies.map(strategy => (
                <div 
                  key={strategy.id} 
                  className="strategy-card"
                  onClick={() => onSelectStrategy(strategy)}
                >
                  <div className="strategy-name">{strategy.name}</div>
                  
                  {/* Enhanced Balance Display */}
                  <div className="balance-section">
                    <div className="primary-balance">
                      <span className="balance-label">Current:</span>
                      <span className="balance-value">{strategy.coinBalance || strategy.balanceInfo?.current || 0} coins</span>
                    </div>
                    
                    {strategy.balanceInfo && (
                      <>
                        <div className="balance-details">
                          <div className="balance-row">
                            <span className="detail-label">Initial:</span>
                            <span className="detail-value">{strategy.balanceInfo.initial} coins</span>
                          </div>
                          <div className="balance-row">
                            <span className="detail-label">Pre-Game:</span>
                            <span className="detail-value">{strategy.balanceInfo.preGame} coins</span>
                          </div>
                          <div className="balance-row">
                            <span className="detail-label">Total Change:</span>
                            <span className={`detail-value ${strategy.balanceInfo.totalChange >= 0 ? 'positive' : 'negative'}`}>
                              {strategy.balanceInfo.totalChange >= 0 ? '+' : ''}{strategy.balanceInfo.totalChange}
                            </span>
                          </div>
                          <div className="balance-row">
                            <span className="detail-label">Game Change:</span>
                            <span className={`detail-value ${strategy.balanceInfo.gameChange >= 0 ? 'positive' : 'negative'}`}>
                              {strategy.balanceInfo.gameChange >= 0 ? '+' : ''}{strategy.balanceInfo.gameChange}
                            </span>
                          </div>
                        </div>
                        
                        <div className="performance-metrics">
                          <div className="metric-row">
                            <span className="metric-label">Avg Profit:</span>
                            <span className={`metric-value ${strategy.balanceInfo.avgProfit >= 0 ? 'positive' : 'negative'}`}>
                              {strategy.balanceInfo.avgProfit >= 0 ? '+' : ''}{strategy.balanceInfo.avgProfit?.toFixed(1) || '0.0'}
                            </span>
                          </div>
                          <div className="metric-row">
                            <span className="metric-label">Total Profit:</span>
                            <span className={`metric-value ${strategy.balanceInfo.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                              {strategy.balanceInfo.totalProfit >= 0 ? '+' : ''}{strategy.balanceInfo.totalProfit?.toFixed(1) || '0.0'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="generation-info">
                          <span className="generation-label">{strategy.balanceInfo.generationInfo}</span>
                        </div>
                        
                        {strategy.balanceInfo.recentBalanceHistory && strategy.balanceInfo.recentBalanceHistory.length > 0 && (
                          <div className="balance-history">
                            <div className="history-title">Recent History:</div>
                            <div className="history-list">
                              {strategy.balanceInfo.recentBalanceHistory.slice(-3).map((entry, idx) => (
                                <div key={idx} className="history-entry">
                                  <span className="history-game">G{entry.game}:</span>
                                  <span className={`history-change ${entry.change >= 0 ? 'positive' : 'negative'}`}>
                                    {entry.change >= 0 ? '+' : ''}{entry.change}
                                  </span>
                                  <span className="history-reason">{entry.reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className={`strategy-status ${strategy.coinBalance < 100 ? 'danger' : strategy.coinBalance < 300 ? 'warning' : 'healthy'}`}>
                    {strategy.coinBalance < 100 ? '💀 Near Bankruptcy' : 
                     strategy.coinBalance < 300 ? '⚠️ At Risk' : '✅ Healthy'}
                  </div>
                  <div className="strategy-games">
                    Games: {strategy.gamesPlayed || strategy.balanceInfo?.gamesPlayed || 0}
                  </div>
                  <div className="strategy-description">
                    {strategy.strategy}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recently Eliminated */}
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

        {/* AI Reasoning */}
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

        {/* Game History Panel */}
        <div className="game-history-panel">
          <h3>🏆 Game History & Results</h3>
          <div className="game-history-container">
            {completedGames.length > 0 ? (
              <div className="completed-games-display">
                {completedGames
                  .slice(-10) // Show last 10 games
                  .reverse() // Most recent first
                  .map((game, idx) => (
                    <div key={game.number || idx} className="completed-game-entry">
                      <div className="game-header">
                        <div className="game-info">
                          <span className="game-number">🎮 Game #{game.number}</span>
                          <span className="game-time">
                            {game.endTime ? new Date(game.endTime).toLocaleTimeString() : 'In Progress'}
                          </span>
                          {game.duration && (
                            <span className="game-duration">
                              Duration: {Math.round(game.duration / 1000)}s
                            </span>
                          )}
                        </div>
                        
                        {game.summary && (
                          <div className="game-summary">
                            <span className={`validation-badge ${game.summary.isValid ? 'valid' : 'invalid'}`}>
                              {game.summary.isValid ? '✅ Valid' : '❌ Invalid'}
                            </span>
                            <span className="prize-pool">
                              Prize Pool: {game.summary.totalEntryFees} coins
                            </span>
                            <span className="utilization">
                              Used: {game.summary.prizePoolUtilized}
                            </span>
                          </div>
                        )}
                      </div>

                      {game.winner && (
                        <div className="game-winner">
                          <span className="winner-icon">🏆</span>
                          <span className="winner-name">{game.winner.name}</span>
                          <span className="winner-winnings">
                            +{game.winner.winnings} coins
                          </span>
                        </div>
                      )}

                      <div className="game-players">
                        <div className="players-header">
                          <strong>💰 Player Results ({game.players?.length || 0}/6):</strong>
                        </div>
                        <div className="players-grid">
                          {game.players?.map((player, playerIdx) => (
                            <div key={player.id || playerIdx} className="player-result">
                              <div className="player-name-section">
                                <span className="player-name">{player.name}</span>
                                {player.isWinner && <span className="winner-badge">👑</span>}
                                <span className="player-generation">Gen {player.generation}</span>
                              </div>
                              
                              <div className="player-balance-section">
                                <div className="balance-change-display">
                                  <span className="balance-before">{player.preGameBalance}</span>
                                  <span className="balance-arrow">→</span>
                                  <span className="balance-after">{player.currentBalance}</span>
                                  <span className={`balance-change ${player.balanceChange >= 0 ? 'positive' : 'negative'}`}>
                                    ({player.balanceChange >= 0 ? '+' : ''}{player.balanceChange})
                                  </span>
                                </div>
                                
                                <div className="player-performance">
                                  <span className="total-change">
                                    Total: {player.totalChange >= 0 ? '+' : ''}{player.totalChange}
                                  </span>
                                  <span className="games-played">
                                    Games: {player.gamesPlayed}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {game.validation && !game.validation.dataComplete && (
                        <div className="game-warnings">
                          <div className="warning">⚠️ Incomplete game data</div>
                          {!game.validation.playersValid && (
                            <div className="warning">❌ Player count invalid</div>
                          )}
                          {!game.validation.balancesValid && (
                            <div className="warning">❌ Balance validation failed</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : balanceHistory.length > 0 ? (
              // Fallback to balance history if no completed games yet
              <div className="balance-history-display">
                <div className="fallback-notice">
                  📊 Using legacy balance data (enhanced game history will appear for new games)
                </div>
                {/* Group balance data by game number */}
                {Object.entries(
                  balanceHistory.reduce((games, entry) => {
                    if (!games[entry.game]) games[entry.game] = [];
                    games[entry.game].push(entry);
                    return games;
                  }, {})
                )
                .sort(([gameA], [gameB]) => parseInt(gameB) - parseInt(gameA)) // Most recent games first
                .slice(0, 10) // Show last 10 games
                .map(([gameNumber, gameEntries]) => (
                  <div key={gameNumber} className="game-balance-entry">
                    <div className="game-balance-header">
                      <span className="game-number">Game #{gameNumber}</span>
                      <span className="game-timestamp">
                        {new Date(gameEntries[0]?.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="game-balance-changes">
                      <strong>💰 Strategy Balance Changes:</strong>
                      <div className="balance-changes-grid">
                        {gameEntries.map((entry, idx) => {
                          // Use the balance change calculated by the backend
                          const balanceChange = entry.balanceChange;
                          const beforeBalance = entry.balance - balanceChange;
                          
                          return (
                            <div key={idx} className="strategy-balance-change">
                              <div className="strategy-balance-name">{entry.strategyName}</div>
                              <div className="strategy-balance-details">
                                <span className="balance-before">{beforeBalance}</span>
                                <span className="balance-arrow">→</span>
                                <span className="balance-after">{entry.balance}</span>
                                <span className={`balance-change ${balanceChange >= 0 ? 'positive' : 'negative'}`}>
                                  ({balanceChange >= 0 ? '+' : ''}{balanceChange})
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-game-history">
                <p>No completed games yet. Start the simulation to see game results!</p>
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
                <div className="event-time">
                  {new Date(event.timestamp).toLocaleString()} 
                  <span className="event-game"> - Game #{event.gameNumber}</span>
                </div>
                <div className="event-content">
                  <div className="parent-strategy">
                    ☠️ {event.eliminatedStrategy?.name || 'Unknown Strategy'} 
                    <span className="fitness">
                      Balance: {event.eliminatedStrategy?.finalBalance || event.eliminatedStrategy?.coinBalance || 'N/A'} coins
                    </span>
                    <div className="elimination-reason">
                      Eliminated due to: {event.reason || 'Unknown reason'}
                    </div>
                  </div>
                  <div className="evolution-arrow">⬇️ EVOLVED INTO ⬇️</div>
                  <div className="child-strategy">
                    🧬 {event.newStrategy?.name || 'Unknown Strategy'}
                    <span className="mutation">
                      Generation: {event.newStrategy?.generationNumber || 'N/A'}
                    </span>
                    {event.newStrategy?.parentNames && (
                      <div className="parent-blend">
                        Parents: {event.newStrategy.parentNames.join(', ')}
                      </div>
                    )}
                  </div>
                  {event.newStrategy?.evolutionReasoning && (
                    <div className="evolution-reasoning">
                      <strong>Evolution Reasoning:</strong> {event.newStrategy.evolutionReasoning}
                    </div>
                  )}
                  {event.newStrategy?.strategy && (
                    <div className="new-strategy-description">
                      <strong>New Strategy:</strong> {event.newStrategy.strategy}
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
      <h3>📝 Live Evolution Logs ({logs.length} total)</h3>
      <div className="logs-console">
        {logs.length === 0 ? (
          <div className="console-line">No logs yet. {isRunning ? 'Simulation starting...' : 'Start the simulation to see logs!'}</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="console-line">
              {log.message}
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

// Info Modal Component
function InfoModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🧬 Evolution Observatory Guide</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div className="info-section">
            <h3>🎯 What This System Does</h3>
            <p>
              This is an AI strategy evolution laboratory where artificial intelligence agents compete in negotiation games, 
              learn from failures, and evolve new strategies through genetic programming principles. Watch as AI strategies 
              adapt, merge successful traits, and develop increasingly sophisticated negotiation tactics over time.
            </p>
          </div>

          <div className="info-section">
            <h3>🎮 How The Evolution Works</h3>
            <ul>
              <li><strong>Continuous Games:</strong> AI strategies play endless negotiation games to split prize pools</li>
              <li><strong>Bankruptcy Elimination:</strong> Strategies that run out of coins get eliminated</li>
              <li><strong>Weighted Evolution:</strong> New strategies are created by combining successful traits from profitable strategies</li>
              <li><strong>Rate Limited:</strong> 5-minute delays between games to respect OpenAI API limits</li>
              <li><strong>Population Maintenance:</strong> Always maintains exactly 6 competing strategies</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>📊 Dashboard Panels Explained</h3>
            
            <div className="panel-explanation">
              <h4>⚡ Live Matrix System Logs</h4>
              <p>Real-time console output showing exactly what the AI agents are thinking and doing during negotiations. 
              This mirrors the verbose output you'd see running the system manually.</p>
            </div>

            <div className="panel-explanation">
              <h4>🎮 Game Status & Financial Health</h4>
              <p>Current game information and strategy financial status. Watch for strategies approaching bankruptcy 
              (under 100 coins) - they're at risk of elimination and replacement.</p>
            </div>

            <div className="panel-explanation">
              <h4>☠️ Recently Eliminated</h4>
              <p>Shows the last 5 strategies that were eliminated due to bankruptcy. These failures inform the 
              evolution process by showing what doesn't work.</p>
            </div>

            <div className="panel-explanation">
              <h4>🧠 Latest AI Reasoning</h4>
              <p>Peek inside the AI's strategic thinking. See the actual reasoning each strategy used in recent 
              negotiations - their goals, tactics, and decision-making process.</p>
            </div>

            <div className="panel-explanation">
              <h4>🏆 Game History & Results</h4>
              <p>Complete historical record of completed games showing winners, final proposals, coin distributions, 
              and the complete negotiation matrix. Perfect for analyzing successful strategies.</p>
            </div>
          </div>

          <div className="info-section">
            <h3>🔬 Other Observatory Views</h3>
            <ul>
              <li><strong>🌳 Evolution Tree:</strong> Family tree showing how strategies evolved from parent strategies</li>
              <li><strong>📝 Live Logs:</strong> Full-screen view of all console output with unlimited scrollback</li>
              <li><strong>🧠 AI Reasoning:</strong> Deep dive into individual strategy thinking and decision patterns</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>💡 Pro Tips</h3>
            <ul>
              <li>Use the download button to export complete session data for external analysis</li>
              <li>Watch for patterns in successful proposals - they often influence future evolution</li>
              <li>Strategy names and descriptions evolve to reflect their learned behaviors</li>
              <li>The system learns from both successes and failures to create increasingly effective strategies</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>🤖 AI Agent Prompts & Technical Details</h3>
            <p>
              Each AI strategy receives a comprehensive prompt every negotiation round. Here's the actual template they see:
            </p>
            
            <div className="code-block">
              <h4>📝 Core AI Prompt Structure</h4>
              <pre>{`🎯 MATRIX NEGOTIATION - [Player Name] (Round X)

MATRIX STRUCTURE:
- First N columns: How each agent plans to split the prize pool (must sum to 100%)
- Next N columns: How each agent plans to vote (100 votes per agent, must sum to 100)
- Final N columns: Vote requests from other players

GAME PHASES:
🔄 PHASE 1 - MATRIX STRATEGY: Fill complete strategy in one response
🏃 PHASE 2 - AUTOMATIC EXECUTION: System extracts proposals and votes

WINNING CONDITION:
Proposal needs 61%+ votes to pass. If none pass, lowest-voted proposal eliminated.

CRITICAL FINANCIAL CALCULATION:
Entry cost: 100 coins. Break-even: 17% of prize pool.
Analyze each proposal for YOUR profit/loss.

RESPONSE FORMAT:
{
  "explanation": "Strategic reasoning for decisions",
  "matrixRow": [proposal_percentages, vote_allocations, vote_requests]
}`}</pre>
            </div>

            <p>
              The AI receives detailed profit calculations, coalition analysis, and strategic guidance for each decision.
            </p>
          </div>

          <div className="info-section">
            <h3>🔢 Matrix System Deep Dive</h3>
            
            <div className="matrix-explanation">
              <h4>📊 What Is The Matrix System?</h4>
              <p>
                The matrix system replaces traditional conversational negotiations with a structured numerical grid. 
                Instead of back-and-forth chat messages, each AI agent fills out their row in a shared matrix containing 
                their complete strategy for that round.
              </p>
            </div>

            <div className="matrix-explanation">
              <h4>🎯 Why Use Matrix Instead of Conversations?</h4>
              <ul>
                <li><strong>No Context Explosion:</strong> No need to pass entire conversation histories to each AI call</li>
                <li><strong>Structured Decisions:</strong> Forces agents to make concrete numerical commitments</li>
                <li><strong>Parallel Processing:</strong> All agents can update simultaneously without message ordering issues</li>
                <li><strong>Clear State:</strong> Complete game state visible in a single matrix snapshot</li>
                <li><strong>Faster Evolution:</strong> Rapid rounds enable more games and faster strategy evolution</li>
                <li><strong>Quantifiable Analysis:</strong> Easy to analyze patterns, coalitions, and strategic effectiveness</li>
              </ul>
            </div>

            <div className="matrix-explanation">
              <h4>🗃️ Matrix Structure (3-Section Format)</h4>
              <div className="matrix-breakdown">
                <div className="matrix-row">
                  <strong>Section 1 - Proposals (Columns 0-N):</strong> How to split the prize pool (must sum to 100%)
                </div>
                <div className="matrix-row">
                  <strong>Section 2 - Votes (Columns N-2N):</strong> How to allocate 100 votes across all proposals (must sum to 100%)
                </div>
                <div className="matrix-row">
                  <strong>Section 3 - Vote Requests (Columns 2N-3N):</strong> How many votes requested from each player (0-100 each)
                </div>
              </div>
            </div>

            <div className="matrix-explanation">
              <h4>💡 Strategic Complexity in the Matrix</h4>
              <p>
                Despite being numerical, the matrix enables sophisticated strategic behaviors:
              </p>
              <ul>
                <li><strong>Coalition Formation:</strong> Agents can offer favorable splits to build alliances</li>
                <li><strong>Vote Trading:</strong> "I'll vote for your proposal if you vote for mine"</li>
                <li><strong>Competitive Analysis:</strong> Agents analyze all other proposals for profit optimization</li>
                <li><strong>Trust & Betrayal:</strong> Agents can promise votes but allocate them elsewhere</li>
                <li><strong>Elimination Strategy:</strong> Agents adapt when others are eliminated</li>
              </ul>
            </div>

            <div className="matrix-explanation">
              <h4>🔄 How Matrix Negotiations Work</h4>
              <ol>
                <li><strong>Matrix Initialization:</strong> Each agent gets an empty row to fill</li>
                <li><strong>Strategic Analysis:</strong> AI analyzes current matrix state and other agents' strategies</li>
                <li><strong>Decision Making:</strong> AI fills their complete strategy (proposal + votes + requests) in one response</li>
                <li><strong>Validation:</strong> System validates mathematical constraints (sums to 100%, profitable allocations)</li>
                <li><strong>Iteration:</strong> Process repeats for multiple rounds until convergence</li>
                <li><strong>Resolution:</strong> System extracts final proposals and votes to determine winner</li>
              </ol>
            </div>
          </div>

          <div className="info-section">
            <h3>🧠 AI Strategic Intelligence</h3>
            
            <div className="matrix-explanation">
              <h4>🎯 Core Strategic Calculations</h4>
              <p>Each AI agent performs sophisticated analysis every round:</p>
              <ul>
                <li><strong>Profit Analysis:</strong> Calculate exact coin profit/loss from each proposal</li>
                <li><strong>Coalition Detection:</strong> Identify when other agents are forming alliances</li>
                <li><strong>Counter-Strategy:</strong> Respond to competitive moves with optimal countermoves</li>
                <li><strong>Risk Assessment:</strong> Balance aggressive profit-taking vs. coalition-building</li>
                <li><strong>Vote Efficiency:</strong> Allocate votes to maximize expected personal payoff</li>
              </ul>
            </div>

            <div className="matrix-explanation">
              <h4>📈 Example Strategic Behaviors</h4>
              <div className="strategy-examples">
                <div className="strategy-example">
                  <strong>🤝 Coalition Building:</strong> "Player A offers me 25%, but if I offer Player B 30%, they might abandon Player A's coalition and join mine."
                </div>
                <div className="strategy-example">
                  <strong>⚔️ Competitive Response:</strong> "Player C is taking 45% for themselves, so I'll offer everyone else better deals to isolate them."
                </div>
                <div className="strategy-example">
                  <strong>🎯 Vote Trading:</strong> "I'll give Player D 50 votes for their proposal because it gives me 35% vs. my own proposal's 30%."
                </div>
                <div className="strategy-example">
                  <strong>🛡️ Defensive Strategy:</strong> "Two players are teaming up against me, so I need to break their alliance by offering one of them a better deal."
                </div>
              </div>
            </div>
          </div>

          <div className="info-section">
            <h3>🎮 Create Your Own AI Strategy & Play!</h3>
            
            <div className="participation-explanation">
              <h4>🚀 How to Participate</h4>
              <p>
                You're not just a spectator! You can create your own negotiation strategies and watch AI agents 
                execute them in real games. Compete against other users' strategies and see how your approach 
                performs in the evolution laboratory.
              </p>
            </div>

            <div className="participation-explanation">
              <h4>✍️ Design Your Strategy</h4>
              <p>Create a custom negotiation strategy by describing your approach:</p>
              <div className="strategy-examples">
                <div className="strategy-example">
                  <strong>🤝 Cooperative Approach:</strong> "Always propose fair splits and build long-term alliances. Prioritize trust-building over short-term gains."
                </div>
                <div className="strategy-example">
                  <strong>⚔️ Aggressive Approach:</strong> "Maximize personal profit aggressively. Form temporary coalitions but prioritize self-interest."
                </div>
                <div className="strategy-example">
                  <strong>🧠 Analytical Approach:</strong> "Study opponent patterns carefully. Use mathematical analysis to predict optimal vote trading opportunities."
                </div>
                <div className="strategy-example">
                  <strong>🎭 Adaptive Approach:</strong> "Change tactics based on game state. Be cooperative when beneficial, aggressive when necessary."
                </div>
              </div>
            </div>

            <div className="participation-explanation">
              <h4>🎯 Game Modes Available</h4>
              <ul>
                <li><strong>🏆 Tournament Mode:</strong> Structured competitions with elimination rounds</li>
                <li><strong>🔄 Evolution Observatory:</strong> Watch strategies evolve and adapt over time (this view)</li>
                <li><strong>⚡ Quick Games:</strong> Fast single-game matches to test strategy effectiveness</li>
                <li><strong>📊 Custom Matches:</strong> Set up specific scenarios with chosen opponents</li>
                <li><strong>🧪 Strategy Testing:</strong> Private sandbox to refine your approach</li>
              </ul>
            </div>

            <div className="participation-explanation">
              <h4>📈 Track Your Performance</h4>
              <p>Monitor how your AI strategy performs:</p>
              <ul>
                <li><strong>Win Rate:</strong> Percentage of games where your strategy claims victory</li>
                <li><strong>Profit Analysis:</strong> Average coin profit per game and long-term earnings</li>
                <li><strong>Strategic Evolution:</strong> See how your strategy adapts and improves over time</li>
                <li><strong>Head-to-Head:</strong> Compare performance against specific opponent strategies</li>
                <li><strong>Coalition Patterns:</strong> Analyze your alliance-building effectiveness</li>
              </ul>
            </div>

            <div className="participation-explanation">
              <h4>🏅 Competitive Features</h4>
              <ul>
                <li><strong>🏆 Leaderboards:</strong> Global rankings of most successful strategies</li>
                <li><strong>🎖️ Achievement System:</strong> Unlock badges for strategic milestones</li>
                <li><strong>🔥 Seasonal Tournaments:</strong> Major competitions with special rewards</li>
                <li><strong>👥 Strategy Sharing:</strong> Learn from top-performing community strategies</li>
                <li><strong>📊 Analytics Dashboard:</strong> Deep insights into your strategic performance</li>
              </ul>
            </div>

            <div className="participation-explanation">
              <h4>🛠️ Advanced Features</h4>
              <ul>
                <li><strong>🔬 A/B Testing:</strong> Test strategy variations to optimize performance</li>
                <li><strong>🎛️ Parameter Tuning:</strong> Fine-tune risk tolerance, cooperation level, and aggression</li>
                <li><strong>📝 Strategy Versioning:</strong> Save and compare different iterations of your approach</li>
                <li><strong>🤖 AI Training:</strong> Help your strategy learn from past game experiences</li>
                <li><strong>📊 Market Analysis:</strong> Study meta-game trends and successful strategy patterns</li>
              </ul>
            </div>

            <div className="cta-section">
              <h4>🚀 Ready to Create Your Strategy?</h4>
              <p>
                Join thousands of players testing their negotiation strategies against AI opponents. 
                Whether you prefer cooperation, competition, or complex psychological tactics, there's 
                a place for your approach in the evolution laboratory.
              </p>
              <div className="cta-buttons">
                <button className="cta-primary">🎯 Create Strategy</button>
                <button className="cta-secondary">📊 View Leaderboards</button>
                <button className="cta-secondary">🎮 Quick Game</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EvolutionObservatory; 