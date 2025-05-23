import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LobbyPage from './LobbyPage';
import LeaderboardPage from './LeaderboardPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </Router>
  );
}

export default App;
