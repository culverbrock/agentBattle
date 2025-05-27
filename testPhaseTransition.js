const fetch = require('node-fetch');
const { ethers } = require('ethers');

const API = 'http://localhost:3000/api';

// Use two test ETH private keys (Sepolia or local fork)
const wallets = [
  new ethers.Wallet('0x59c6995e998f97a5a0044966f094538e8b8b3e1c7e43c3c3b6c7c3c3c3c3c3c3'), // Example key 1
  new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d2b2d6e6b8c6c6c6c6c6c6c6c6c6c6c6c6c6c6c')  // Example key 2
];

async function main() {
  // 1. Create game
  let res = await fetch(`${API}/games`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Game' }) });
  let game = await res.json();
  const gameId = game.id;
  console.log('Created game:', gameId);

  // 2. Add two players
  for (let i = 0; i < 2; i++) {
    await fetch(`${API}/games/${gameId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: wallets[i].address }) });
  }
  console.log('Added players', wallets[0].address, 'and', wallets[1].address);

  // 3. Submit strategies (mark ready) with signature
  for (let i = 0; i < 2; i++) {
    const playerId = wallets[i].address;
    const strategy = 'test';
    const message = `Ready for game: ${gameId}`;
    const signature = await wallets[i].signMessage(message);
    await fetch(`${API}/game-state/${gameId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, strategy, message, signature, walletType: 'eth' })
    });
  }
  console.log('Both players submitted strategies with signatures');

  // 4. Start game
  await fetch(`${API}/game-state/${gameId}/start`, { method: 'POST' });
  console.log('Game started');

  // 5. Fetch and print state
  res = await fetch(`${API}/game-state/${gameId}`);
  let state = await res.json();
  console.log('Game state after start:', state.state.phase, '| Round:', state.state.round);
  console.log('Full state:', JSON.stringify(state.state, null, 2));
}

main(); 