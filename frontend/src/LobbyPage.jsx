import React, { useEffect, useState, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

function LobbyPage() {
  const [games, setGames] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState(null);
  const wsRef = useRef(null);
  const pollRef = useRef(null);

  // Fetch lobby state (for polling fallback)
  const fetchLobby = () => {
    fetch('/api/games/lobby')
      .then(res => res.json())
      .then(data => setGames(data.games || []));
  };

  // Initial fetch
  useEffect(() => {
    fetchLobby();
  }, []);

  // WebSocket for real-time updates, with polling fallback
  useEffect(() => {
    function startPolling() {
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchLobby, 3000);
      }
    }
    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    wsRef.current = new window.WebSocket(WS_URL);
    wsRef.current.onopen = () => {
      stopPolling();
    };
    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'lobby_update') {
        setGames(msg.data.games || []);
      }
    };
    wsRef.current.onerror = () => {
      startPolling();
    };
    wsRef.current.onclose = () => {
      startPolling();
    };
    return () => {
      wsRef.current && wsRef.current.close();
      stopPolling();
    };
  }, []);

  // MetaMask wallet connect
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setPlayerId(accounts[0]);
      } catch (err) {
        alert('Wallet connection failed');
      }
    } else {
      alert('MetaMask not detected. Please install MetaMask.');
    }
  };

  // Create game
  const handleCreateGame = async (e) => {
    e && e.preventDefault();
    if (!newGameName) return;
    await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGameName })
    });
    setNewGameName('');
    setShowCreateModal(false);
  };

  // Join game
  const handleJoinGame = async (gameId) => {
    if (!gameId || !playerName || !playerId) return;
    await fetch(`/api/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, name: playerName })
    });
    setSelectedGameId(gameId);
  };

  // Status badge helper
  const getStatusBadge = (game) => {
    if (game.status === 'lobby' || !game.status) return <span style={{color: 'green', fontWeight: 'bold'}}>Open</span>;
    if (game.status === 'in_progress') return <span style={{color: 'orange', fontWeight: 'bold'}}>In Progress</span>;
    if (game.status === 'full') return <span style={{color: 'red', fontWeight: 'bold'}}>Full</span>;
    return <span>{game.status}</span>;
  };

  // Joinable logic
  const isJoinable = (game) => {
    return (!game.status || game.status === 'lobby');
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Agent Battle Lobby</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => setShowCreateModal(true)} style={{ fontSize: 18, padding: '8px 16px' }}>+ Create Table</button>
        <div>
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            style={{ marginRight: 8 }}
          />
          {/* Wallet connect */}
          {walletAddress ? (
            <span style={{ marginRight: 8, color: '#007bff', fontWeight: 'bold' }}>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          ) : (
            <button type="button" onClick={connectWallet} style={{ marginRight: 8, padding: '6px 12px', background: '#f6851b', color: '#fff', border: 'none', borderRadius: 4 }}>Connect Wallet</button>
          )}
        </div>
      </div>
      {/* Game List */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {games.map(game => (
          <div key={game.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 220, flex: '1 1 220px', background: '#fafafa', boxShadow: selectedGameId === game.id ? '0 0 8px #007bff' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>{game.name}</div>
              {getStatusBadge(game)}
            </div>
            <div style={{ margin: '8px 0' }}>Players: {game.players.length} / 6</div>
            <button
              onClick={() => handleJoinGame(game.id)}
              disabled={!isJoinable(game) || !walletAddress}
              style={{ width: '100%', padding: 8, background: isJoinable(game) && walletAddress ? '#007bff' : '#ccc', color: '#fff', border: 'none', borderRadius: 4, cursor: isJoinable(game) && walletAddress ? 'pointer' : 'not-allowed', marginBottom: 8 }}
            >
              Join
            </button>
            <button
              onClick={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}
              style={{ width: '100%', padding: 4, background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              {expandedGameId === game.id ? 'Hide Players' : 'Show Players'}
            </button>
            {expandedGameId === game.id && (
              <ul style={{ marginTop: 8 }}>
                {game.players.map(player => (
                  <li key={player.id}>{player.name} ({player.status})</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {/* Create Table Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateGame} style={{ background: '#fff', padding: 32, borderRadius: 8, minWidth: 320, boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>
            <h2>Create New Table</h2>
            <input
              type="text"
              placeholder="Table name"
              value={newGameName}
              onChange={e => setNewGameName(e.target.value)}
              style={{ width: '100%', marginBottom: 16, padding: 8 }}
            />
            {/* Future: Add max players, stakes, etc. */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4 }}>Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default LobbyPage; 