import React, { useEffect, useState, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

function LobbyPage() {
  const [games, setGames] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
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

  // Create game
  const handleCreateGame = async (e) => {
    e.preventDefault();
    if (!newGameName) return;
    await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGameName })
    });
    setNewGameName('');
  };

  // Join game
  const handleJoinGame = async (e) => {
    e.preventDefault();
    if (!selectedGameId || !playerName || !playerId) return;
    await fetch(`/api/games/${selectedGameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, name: playerName })
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Game Lobby</h1>
      <form onSubmit={handleCreateGame} style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="New game name"
          value={newGameName}
          onChange={e => setNewGameName(e.target.value)}
        />
        <button type="submit">Create Game</button>
      </form>
      <form onSubmit={handleJoinGame} style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Your player ID"
          value={playerId}
          onChange={e => setPlayerId(e.target.value)}
        />
        <select value={selectedGameId} onChange={e => setSelectedGameId(e.target.value)}>
          <option value="">Select a game</option>
          {games.map(game => (
            <option key={game.id} value={game.id}>{game.name}</option>
          ))}
        </select>
        <button type="submit">Join Game</button>
      </form>
      <h2>Open Games</h2>
      <ul>
        {games.map(game => (
          <li key={game.id}>
            <strong>{game.name}</strong> (ID: {game.id})
            <ul>
              {game.players.map(player => (
                <li key={player.id}>{player.name} ({player.status})</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LobbyPage; 