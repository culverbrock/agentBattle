import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

function getPlayerName(players, id) {
  if (!id) return '';
  const p = players.find(p => p.id === id);
  return p ? (p.name || p.id) : id;
}

function summarizeState(prev, curr, players) {
  // Try to summarize the action that happened between prev and curr
  if (!curr) return '';
  const phase = curr.phase || curr.context?.phase;
  const round = curr.round || curr.context?.round;
  // Detect phase change
  if (prev && (phase !== (prev.phase || prev.context?.phase))) {
    return `Phase changed to ${phase} (Round ${round})`;
  }
  // Detect proposal
  if (curr.lastProposal && curr.lastProposal.playerId) {
    return `${getPlayerName(players, curr.lastProposal.playerId)} submitted a proposal`;
  }
  // Detect vote
  if (curr.lastVote && curr.lastVote.playerId) {
    return `${getPlayerName(players, curr.lastVote.playerId)} voted`;
  }
  // Detect elimination
  if (curr.lastEliminated && curr.lastEliminated.length > 0) {
    return `Eliminated: ${curr.lastEliminated.map(id => getPlayerName(players, id)).join(', ')}`;
  }
  // Fallback
  return `Phase: ${phase} | Round: ${round}`;
}

function GameHistory() {
  const { gameId } = useParams();
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/game-state/${gameId}/history`)
      .then(res => res.json())
      .then(data => {
        setHistory(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load game history.');
        setLoading(false);
      });
  }, [gameId]);

  if (loading) return <div style={{ padding: 32 }}>Loading game history...</div>;
  if (error) return <div style={{ color: 'red', padding: 32 }}>{error}</div>;
  if (!history) return null;

  const { states, messages } = history;
  // Try to extract player list from the first state
  let players = [];
  if (states.length > 0) {
    const s = states[0].state || states[0].context;
    players = s.players || s.context?.players || [];
  }

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Game History: {gameId}</h1>
      <Link to="/" style={{ color: '#007bff', textDecoration: 'none' }}>← Back to Lobby</Link>
      <div style={{ margin: '24px 0' }}>
        <h2>Timeline</h2>
        <div style={{ display: 'flex', gap: 32 }}>
          {/* State transitions */}
          <div style={{ flex: 2 }}>
            <h3>Game Phases & Actions</h3>
            <ol style={{ paddingLeft: 20 }}>
              {states.map((s, i) => {
                const curr = s.state || s.context;
                const prev = i > 0 ? (states[i - 1].state || states[i - 1].context) : null;
                const summary = summarizeState(prev, curr, players);
                const phase = curr.phase || curr.context?.phase || 'unknown';
                return (
                  <li key={s.id} style={{ marginBottom: 12, background: '#f5f5f5', borderRadius: 6, padding: 10, borderLeft: phase === 'end' || phase === 'endgame' ? '4px solid #28a745' : '4px solid #007bff' }}>
                    <div style={{ fontWeight: 'bold', color: phase === 'end' || phase === 'endgame' ? '#28a745' : '#007bff' }}>{summary}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</div>
                    <pre style={{ fontSize: 12, margin: 0, background: 'none', border: 'none' }}>{JSON.stringify(curr, null, 2)}</pre>
                  </li>
                );
              })}
            </ol>
          </div>
          {/* Chat/messages */}
          <div style={{ flex: 1 }}>
            <h3>Chat & Messages</h3>
            <ul style={{ paddingLeft: 16 }}>
              {messages.map(m => (
                <li key={m.id} style={{ marginBottom: 8, background: '#fffbe6', borderRadius: 4, padding: 6, borderLeft: '3px solid #ffc107' }}>
                  <b>{getPlayerName(players, m.player_id) || 'System'}:</b> {m.content}
                  <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>{m.created_at ? new Date(m.created_at).toLocaleTimeString() : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameHistory; 