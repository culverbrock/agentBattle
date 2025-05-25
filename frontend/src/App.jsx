import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LobbyPage from './LobbyPage';
import LeaderboardPage from './LeaderboardPage';
import GameRoom from './GameRoom';
import GameHistory from './GameHistory';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/game/:gameId" element={<GameRoom />} />
        <Route path="/history/:gameId" element={<GameHistory />} />
      </Routes>
    </Router>
  );
}

export default App;
