import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

function ClaimWinningsPage() {
  const playerId = window.localStorage.getItem('playerId');
  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`${API_URL}/api/winnings/${playerId}`)
      .then(res => res.json())
      .then(data => {
        setWinnings(data.winnings || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch winnings');
        setLoading(false);
      });
  }, [playerId]);

  const handleClaim = async (win) => {
    setClaiming(c => ({ ...c, [win.id]: true }));
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_URL}/api/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, gameId: win.game_id, currency: win.currency })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Claimed ${win.amount} ${win.currency} for game ${win.game_id}`);
        setWinnings(winnings.filter(w => w.id !== win.id));
      } else {
        setError(data.error || 'Failed to claim winnings');
      }
    } catch (err) {
      setError('Failed to claim winnings');
    }
    setClaiming(c => ({ ...c, [win.id]: false }));
  };

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Claim Winnings</h1>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {successMsg && <div style={{ color: '#28a745', marginBottom: 8 }}>{successMsg}</div>}
      {!loading && winnings.length === 0 && <div style={{ color: '#888' }}>No claimable winnings at this time.</div>}
      {winnings.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>Game ID</th>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>Amount</th>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>Currency</th>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>Created At</th>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {winnings.map(win => (
              <tr key={win.id}>
                <td style={{ padding: 8, border: '1px solid #ccc', fontFamily: 'monospace' }}>{win.game_id}</td>
                <td style={{ padding: 8, border: '1px solid #ccc' }}>{win.amount}</td>
                <td style={{ padding: 8, border: '1px solid #ccc' }}>{win.currency}</td>
                <td style={{ padding: 8, border: '1px solid #ccc' }}>{new Date(win.created_at).toLocaleString()}</td>
                <td style={{ padding: 8, border: '1px solid #ccc' }}>
                  <button
                    onClick={() => handleClaim(win)}
                    disabled={claiming[win.id]}
                    style={{ padding: '6px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4 }}
                  >
                    {claiming[win.id] ? 'Claiming...' : 'Claim'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ClaimWinningsPage; 