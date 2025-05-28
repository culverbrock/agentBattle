import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LobbyPage from './LobbyPage';
import LeaderboardPage from './LeaderboardPage';
import GameRoom from './GameRoom';
import GameHistory from './GameHistory';
import ClaimWinningsPage from './ClaimWinningsPage';

function App() {
  return (
    <Router>
      <div style={{ padding: 16 }}>
        <nav style={{ marginBottom: 24 }}>
          <Link to="/" style={{ marginRight: 16 }}>Lobby</Link>
          <Link to="/leaderboard" style={{ marginRight: 16 }}>Leaderboard</Link>
          <Link to="/claim-winnings" style={{ marginRight: 16 }}>Claim Winnings</Link>
        </nav>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/game/:gameId" element={<GameRoom />} />
          <Route path="/history/:gameId" element={<GameHistory />} />
          <Route path="/claim-winnings" element={<ClaimWinningsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
