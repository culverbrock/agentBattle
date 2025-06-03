import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const API_URL = import.meta.env.VITE_API_URL || '';

function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [simulationStats, setSimulationStats] = useState({
    totalGames: 0,
    totalEliminations: 0,
    evolutionEvents: 0,
    runningTime: 0
  });
  const [status, setStatus] = useState('');

  const authenticate = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        setAuthToken(data.token);
        setStatus('✅ Admin access granted');
        // Connect to WebSocket for real-time updates
        connectWebSocket();
      } else {
        setStatus('❌ Invalid password');
        setTimeout(() => setStatus(''), 3000);
      }
    } catch (error) {
      setStatus('❌ Authentication failed');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const connectWebSocket = () => {
    const ws = new WebSocket(`${WS_URL}/ws/evolution`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'initial_state':
          setIsSimulationRunning(message.data.isRunning);
          if (message.data.isRunning) {
            setSimulationStats({
              totalGames: message.data.totalGames || 0,
              totalEliminations: message.data.totalEliminations || 0,
              evolutionEvents: message.data.evolutionEvents || 0,
              runningTime: Math.floor(message.data.runTime / 1000) || 0
            });
          }
          break;
          
        case 'simulation_started':
          setIsSimulationRunning(true);
          setStatus('🚀 Simulation started');
          break;
          
        case 'simulation_stopped':
          setIsSimulationRunning(false);
          setStatus('⏹️ Simulation stopped');
          break;
      }
    };
  };

  const startSimulation = async () => {
    try {
      const response = await fetch(`${API_URL}/api/evolution/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          mode: 'bankruptcy_elimination',
          realTime: true,
          fullLogging: true 
        })
      });
      
      if (response.ok) {
        setStatus('🚀 Starting simulation...');
      } else {
        const errorData = await response.json();
        setStatus(`❌ Error: ${errorData.error || 'Failed to start'}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const stopSimulation = async () => {
    try {
      const response = await fetch(`${API_URL}/api/evolution/stop`, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        setStatus('⏹️ Stopping simulation...');
      } else {
        const errorData = await response.json();
        setStatus(`❌ Error: ${errorData.error || 'Failed to stop'}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h2>🔐 Evolution Observatory Admin</h2>
          <p>Enter admin password to control the simulation</p>
          
          <div className="login-form">
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && authenticate()}
            />
            <button onClick={authenticate}>Login</button>
          </div>
          
          {status && <div className="status-message">{status}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🔧 Evolution Observatory Admin Panel</h1>
        <p>Control and monitor the AI strategy evolution system</p>
      </div>

      <div className="admin-content">
        <div className="simulation-status">
          <h3>🎮 Simulation Status</h3>
          <div className="status-indicator">
            <span className={`status-light ${isSimulationRunning ? 'running' : 'stopped'}`}></span>
            <span className="status-text">
              {isSimulationRunning ? '🟢 Running' : '🔴 Stopped'}
            </span>
          </div>
          
          {status && <div className="admin-status">{status}</div>}
        </div>

        <div className="admin-controls">
          <h3>⚙️ Controls</h3>
          <div className="control-buttons">
            <button 
              onClick={startSimulation} 
              disabled={isSimulationRunning}
              className="admin-start-btn"
            >
              🚀 Start Simulation
            </button>
            <button 
              onClick={stopSimulation} 
              disabled={!isSimulationRunning}
              className="admin-stop-btn"
            >
              ⏹️ Stop Simulation
            </button>
          </div>
        </div>

        <div className="admin-stats">
          <h3>📊 Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Running Time</span>
              <span className="stat-value">{formatTime(simulationStats.runningTime)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Games Played</span>
              <span className="stat-value">{simulationStats.totalGames}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Eliminations</span>
              <span className="stat-value">{simulationStats.totalEliminations}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Evolution Events</span>
              <span className="stat-value">{simulationStats.evolutionEvents}</span>
            </div>
          </div>
        </div>

        <div className="admin-actions">
          <h3>🔗 Quick Links</h3>
          <div className="action-buttons">
            <a href="/" className="action-btn">
              📊 View Public Dashboard
            </a>
            <button 
              onClick={() => window.location.reload()} 
              className="action-btn secondary"
            >
              🔄 Refresh Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel; 