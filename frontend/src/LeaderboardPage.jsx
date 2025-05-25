import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function LeaderboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API_URL}/api/leaderboard`)
      .then(res => res.json())
      .then(json => {
        if (Array.isArray(json)) {
          setData(json);
        } else {
          setError(json.error || 'Failed to load leaderboard');
        }
        setLoading(false);
      })
      .catch(e => {
        setError('Failed to load leaderboard');
        setLoading(false);
      });
  }, []);

  const sorted = [...data].sort((a, b) => (b.abt + b.spl) - (a.abt + a.spl));

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Leaderboard</h1>
      <Link to="/" style={{ textDecoration: 'none', color: '#007bff' }}>&larr; Back to Lobby</Link>
      {loading && <div style={{ marginTop: 24 }}>Loading...</div>}
      {error && <div style={{ color: 'red', marginTop: 24 }}>{error}</div>}
      {!loading && !error && (
        <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>Rank</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Wallet Address</th>
              <th style={{ textAlign: 'right', padding: 8 }}>ABT</th>
              <th style={{ textAlign: 'right', padding: 8 }}>SPL</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.address} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{i + 1}</td>
                <td style={{ padding: 8, fontFamily: 'monospace' }}>{row.address}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{row.abt}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{row.spl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default LeaderboardPage; 