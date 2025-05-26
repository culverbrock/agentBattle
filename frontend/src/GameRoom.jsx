import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';

const API_URL = import.meta.env.VITE_API_URL || '';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/game-room';

function phaseInstruction(phase, isMyTurn) {
  switch (phase) {
    case 'strategy': return 'Submit your strategy for this round.';
    case 'negotiation': return isMyTurn ? 'It is your turn to speak.' : 'Waiting for the current speaker...';
    case 'proposal': return 'Submit a proposal for how to split the prize.';
    case 'voting': return 'Vote for a proposal.';
    case 'elimination': return 'Vote to eliminate a player.';
    case 'endgame':
    case 'end': return 'Game over!';
    case 'lobby': return 'Waiting for players to be ready...';
    default: return '';
  }
}

// Helper to get the MetaMask provider (not Phantom)
function getMetaMaskProvider() {
  // EIP-5749: Multiple injected providers
  if (window.ethereum?.providers) {
    // Prefer MetaMask that is NOT Phantom
    return window.ethereum.providers.find(
      (p) => p.isMetaMask && !p.isPhantom
    ) || null;
  }
  // Single provider fallback
  if (window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isPhantom) {
    return window.ethereum;
  }
  return null;
}

function GameRoom() {
  const { gameId } = useParams();
  const [gameState, setGameState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const chatEndRef = useRef(null);
  const [chatInput, setChatInput] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [voteInput, setVoteInput] = useState('');
  const [error, setError] = useState('');
  const playerId = window.localStorage.getItem('playerId'); // or get from context
  const [onlinePlayerIds, setOnlinePlayerIds] = useState([]);
  const [strategyInput, setStrategyInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState(() => {
    const id = window.localStorage.getItem('playerId');
    return id && id.startsWith('0x') ? id : '';
  });
  const [phantomAddress, setPhantomAddress] = useState(() => {
    const id = window.localStorage.getItem('playerId');
    return id && !id.startsWith('0x') ? id : '';
  });
  const [walletType, setWalletType] = useState(() => {
    const id = window.localStorage.getItem('playerId');
    if (!id) return '';
    if (id.startsWith('0x')) return 'metamask';
    if (id.length > 32) return 'phantom';
    return '';
  });

  // Fetch initial state and messages
  useEffect(() => {
    fetch(`${API_URL}/api/game-state/${gameId}`)
      .then(res => res.json())
      .then(data => {
        setGameState(data.state);
        // Always update isReady from the latest gameState
        const me = data.state?.players?.find(p => p.id === playerId);
        setIsReady(!!me?.ready);
      });
    fetch(`${API_URL}/api/game-state/${gameId}/messages`)
      .then(res => res.json())
      .then(setMessages);
  }, [gameId, playerId]);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', gameId, playerId }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state_update' || msg.type === 'end') {
        setGameState(msg.data);
        // Always update isReady from the latest gameState
        const me = msg.data?.players?.find(p => p.id === playerId);
        setIsReady(!!me?.ready);
      } else if (msg.type === 'message') {
        setMessages(prev => [...prev, msg.data]);
      } else if (msg.type === 'proposal' || msg.type === 'vote' || msg.type === 'elimination') {
        setGameState(msg.data.state);
        const me = msg.data.state?.players?.find(p => p.id === playerId);
        setIsReady(!!me?.ready);
      } else if (msg.type === 'presence') {
        setOnlinePlayerIds(msg.data.playerIds);
      }
    };
    ws.onclose = () => setWsConnected(false);
    return () => ws.close();
  }, [gameId, playerId]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send chat message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, content: chatInput, type: 'chat' })
      });
      setChatInput('');
    } catch (err) {
      setError('Failed to send message.');
    }
  };

  // Phase-specific actions
  const submitStrategy = async (e) => {
    e.preventDefault();
    if (!actionInput.trim()) return;
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, message: actionInput })
      });
      setActionInput('');
    } catch (err) {
      setError('Failed to submit strategy.');
    }
  };
  const submitSpeak = async (e) => {
    e.preventDefault();
    if (!actionInput.trim()) return;
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, message: actionInput })
      });
      setActionInput('');
    } catch (err) {
      setError('Failed to speak.');
    }
  };
  const submitProposal = async (e) => {
    e.preventDefault();
    if (!actionInput.trim()) return;
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, proposal: actionInput })
      });
      setActionInput('');
    } catch (err) {
      setError('Failed to submit proposal.');
    }
  };
  const submitVote = async (e) => {
    e.preventDefault();
    if (!voteInput.trim()) return;
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, votes: voteInput })
      });
      setVoteInput('');
    } catch (err) {
      setError('Failed to vote.');
    }
  };
  const submitElimination = async (e) => {
    e.preventDefault();
    if (!voteInput.trim()) return;
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/eliminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eliminated: voteInput })
      });
      setVoteInput('');
    } catch (err) {
      setError('Failed to submit elimination.');
    }
  };
  const continueGame = async () => {
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/continue`, { method: 'POST' });
    } catch (err) {
      setError('Failed to continue.');
    }
  };
  const endGame = async () => {
    setError('');
    try {
      await fetch(`${API_URL}/api/game-state/${gameId}/end`, { method: 'POST' });
    } catch (err) {
      setError('Failed to end game.');
    }
  };
  const markReady = async () => {
    if (!strategyInput.trim()) return;
    let playerId = window.localStorage.getItem('playerId');
    let walletType = '';
    let signature = '';
    let message = `Ready for game: ${gameId}`;
    if (window.ethereum && playerId && playerId.startsWith('0x')) {
      walletType = 'eth';
      // MetaMask signature
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      signature = await signer.signMessage(message);
    } else if (window.solana && playerId && playerId.length > 32) {
      walletType = 'sol';
      // Phantom signature
      const encodedMessage = new TextEncoder().encode(message);
      const signed = await window.solana.signMessage(encodedMessage, 'utf8');
      signature = signed.signature ? Buffer.from(signed.signature).toString('base64') : '';
    } else {
      setError('No wallet connected or unknown wallet type');
      return;
    }
    await fetch(`${API_URL}/api/game-state/${gameId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, strategy: strategyInput, message, signature, walletType })
    });
    // Do NOT setIsReady(true) here; let WebSocket/gameState update handle it
  };
  const startGame = async () => {
    await fetch(`${API_URL}/api/game-state/${gameId}/start`, { method: 'POST' });
  };

  // MetaMask wallet connect
  const connectWallet = async () => {
    const provider = getMetaMaskProvider();
    if (provider) {
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setWalletType('metamask');
        setPhantomAddress('');
        localStorage.setItem('playerId', accounts[0]);
      } catch (err) {
        alert('Wallet connection failed');
      }
    } else {
      alert('MetaMask not detected. Please install MetaMask.');
    }
  };

  // Phantom wallet connect
  const connectPhantom = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const resp = await window.solana.connect();
        setPhantomAddress(resp.publicKey.toString());
        setWalletType('phantom');
        setWalletAddress('');
        localStorage.setItem('playerId', resp.publicKey.toString());
      } catch (err) {
        alert('Phantom connection failed');
      }
    } else {
      alert('Phantom not detected. Please install Phantom Wallet.');
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    window.localStorage.removeItem('playerId');
    setWalletAddress('');
    setPhantomAddress('');
    setWalletType('');
    if (window.solana && window.solana.isPhantom) {
      try { await window.solana.disconnect(); } catch {}
    }
    window.location.reload();
  };

  // Helpers
  const phase = gameState?.phase;
  const round = gameState?.round;
  const players = gameState?.players || [];
  const proposals = gameState?.proposals || [];
  const votes = gameState?.votes || [];
  const isMyTurn = gameState?.currentPlayer === playerId;
  const currentPlayer = players.find(p => p.id === gameState?.currentPlayer);
  const allReady = players.length >= 2 && players.every(p => p.ready);

  // Helper to get player name
  const getPlayerName = (id) => {
    const p = players.find(p => p.id === id);
    return p ? (p.name || p.id) : id;
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 16, padding: '8px 16px', background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}>← Leave Room</button>
      {/* Wallet connect/disconnect UI */}
      <div style={{ marginBottom: 16 }}>
        {walletType === 'metamask' && walletAddress && (
          <span style={{ color: '#007bff', fontWeight: 'bold', marginRight: 8 }}>MetaMask: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
        )}
        {walletType === 'phantom' && phantomAddress && (
          <span style={{ color: '#8e44ad', fontWeight: 'bold', marginRight: 8 }}>Phantom: {phantomAddress.slice(0, 6)}...{phantomAddress.slice(-4)}</span>
        )}
        {walletType && (
          <button
            type="button"
            onClick={disconnectWallet}
            style={{ marginRight: 8, padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4 }}
          >
            Disconnect Wallet
          </button>
        )}
        {!walletType && (
          <>
            <button type="button" onClick={connectWallet} style={{ marginRight: 8, padding: '6px 12px', background: '#f6851b', color: '#fff', border: 'none', borderRadius: 4 }}>Connect MetaMask</button>
            <button type="button" onClick={connectPhantom} style={{ marginRight: 8, padding: '6px 12px', background: '#8e44ad', color: '#fff', border: 'none', borderRadius: 4 }}>Connect Phantom</button>
          </>
        )}
      </div>
      {/* Debug panel for raw game state */}
      <div style={{ background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
        <div><strong>Debug: Raw gameState</strong></div>
        <pre style={{ fontSize: 12, margin: 0, background: 'none', border: 'none' }}>{JSON.stringify(gameState, null, 2)}</pre>
      </div>
      {gameState?.strategyMessages && (
        <div style={{ background: '#e9f7ef', border: '1px solid #b2dfdb', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <b>Strategy Panel:</b>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {players.map(p => (
              <li key={p.id}>
                <span style={{ fontWeight: p.id === playerId ? 'bold' : undefined }}>
                  {p.name || p.id}{p.id === playerId ? ' (You)' : ''}:
                </span>
                <span style={{ marginLeft: 8, color: '#007bff' }}>
                  {gameState.strategyMessages?.[p.id] || <i>No strategy submitted</i>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <h1>Game Room: {gameId}</h1>
      <div>Status: {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      <div style={{ margin: '16px 0', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <h2>Game State</h2>
        <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#007bff' }}>{phaseInstruction(phase, isMyTurn)}</div>
        <div>Phase: <b>{phase}</b> | Round: <b>{round}</b></div>
        <div>Players: {players.map(p => (
          <span key={p.id} style={{ marginRight: 8, fontWeight: p.id === gameState?.currentPlayer ? 'bold' : undefined, color: p.id === playerId ? '#28a745' : undefined, display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: onlinePlayerIds.includes(p.id) ? '#28a745' : '#bbb', marginRight: 4, border: '1px solid #888' }} />
            {p.name || p.id}{p.id === playerId ? ' (You)' : ''}{p.id === gameState?.currentPlayer ? ' ←' : ''}
            {!onlinePlayerIds.includes(p.id) && (
              <span title="Agent is playing for this player while they are offline" style={{ marginLeft: 4, color: '#888', fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
                🤖 Agent
              </span>
            )}
          </span>
        ))}</div>
        {/* If any player is offline, show a help message */}
        {players.some(p => !onlinePlayerIds.includes(p.id)) && (
          <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            <span>🤖 Agent is playing for offline players until they reconnect.</span>
          </div>
        )}
        {proposals.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <b>Proposals:</b>
            <ul>{proposals.map((pr, i) => <li key={i}>{getPlayerName(pr.playerId)}: {pr.proposal || JSON.stringify(pr)}</li>)}</ul>
          </div>
        )}
        {votes.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <b>Votes:</b>
            <ul>{votes.map((v, i) => <li key={i}>{getPlayerName(v.playerId)}: {v.votes || JSON.stringify(v)}</li>)}</ul>
          </div>
        )}
        {/* Phase-specific actions */}
        <div style={{ marginTop: 16 }}>
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          {phase === 'negotiation' && (
            <div style={{ color: '#888' }}>Agents are negotiating...</div>
          )}
          {phase === 'proposal' && (
            <div style={{ color: '#888' }}>Agents are submitting proposals...</div>
          )}
          {phase === 'voting' && (
            <div style={{ color: '#888' }}>Agents are voting...</div>
          )}
          {phase === 'elimination' && (
            <div style={{ color: '#888' }}>Agents are eliminating a player...</div>
          )}
          {(phase === 'endgame' || phase === 'end') && (
            <div style={{ marginTop: 16 }}>
              <b>Game Over!</b>
              <button onClick={endGame} style={{ marginLeft: 16, padding: '8px 16px' }}>End Game</button>
              <Link to={`/history/${gameId}`} style={{ marginLeft: 16, padding: '8px 16px', background: '#007bff', color: '#fff', borderRadius: 4, textDecoration: 'none' }}>View History</Link>
            </div>
          )}
          {phase === 'lobby' && (
            <div style={{ margin: '24px 0', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <h2>Game Lobby</h2>
              <div style={{ marginBottom: 12 }}>
                <b>Players:</b>
                {players.map(p => (
                  <span key={p.id} style={{ marginRight: 12, color: p.ready ? '#28a745' : '#888' }}>
                    {p.name || p.id}{p.id === playerId ? ' (You)' : ''} {p.ready ? '✅ Ready' : '⏳ Not Ready'}
                  </span>
                ))}
              </div>
              {!isReady && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    value={strategyInput}
                    onChange={e => setStrategyInput(e.target.value)}
                    placeholder="Enter your negotiation strategy..."
                    style={{ width: 320, padding: 8, marginRight: 8 }}
                  />
                  <button onClick={markReady} style={{ padding: '8px 16px' }}>Ready</button>
                </div>
              )}
              {isReady && <div style={{ color: '#28a745', marginBottom: 12 }}>You are ready! Waiting for others...</div>}
              <button
                onClick={startGame}
                disabled={!allReady}
                style={{ padding: '8px 24px', background: allReady ? '#007bff' : '#ccc', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 16 }}
              >
                Start Game
              </button>
            </div>
          )}
          {/* Continue button for next round or phase */}
          {gameState?.canContinue && (
            <button onClick={continueGame} style={{ marginTop: 16, padding: '8px 16px' }}>Continue</button>
          )}
        </div>
      </div>
      <div style={{ margin: '16px 0', padding: 16, background: '#fff', borderRadius: 8, minHeight: 200 }}>
        <h2>Chat</h2>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 4 }}>
              <b>{getPlayerName(msg.player_id) || 'System'}:</b> {msg.content}
              {msg.created_at && <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>{new Date(msg.created_at).toLocaleTimeString()}</span>}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Type a message..."
            style={{ flex: 1, padding: 8 }}
          />
          <button type="submit" style={{ padding: '8px 16px' }}>Send</button>
        </form>
      </div>
      {/* Agent action log display */}
      <div style={{ marginTop: 24, background: '#f9f9f9', borderRadius: 8, padding: 16 }}>
        <h3>Agent Actions</h3>
        {/* Negotiation messages */}
        {phase === 'negotiation' && (
          <div style={{ marginBottom: 12 }}>
            <b>Negotiation:</b>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {messages.filter(m => m.type === 'negotiation').map((msg, i) => (
                <li key={i}>
                  <span style={{ color: '#007bff' }}>{getPlayerName(msg.player_id)}</span>
                  <span style={{ color: '#888', marginLeft: 6, fontSize: 13 }}>({players.find(p => p.id === msg.player_id)?.agent?.strategy || 'default'} agent)</span>:
                  <span style={{ marginLeft: 8 }}>{msg.content}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Proposals */}
        {phase === 'proposal' && proposals.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <b>Proposals:</b>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {proposals.map((pr, i) => (
                <li key={i}>
                  <span style={{ color: '#007bff' }}>{getPlayerName(pr.playerId)}</span>
                  <span style={{ color: '#888', marginLeft: 6, fontSize: 13 }}>({players.find(p => p.id === pr.playerId)?.agent?.strategy || 'default'} agent)</span>:
                  <span style={{ marginLeft: 8 }}>{pr.proposal ? JSON.stringify(pr.proposal) : JSON.stringify(pr)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Votes */}
        {phase === 'voting' && votes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <b>Votes:</b>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {votes.map((v, i) => (
                <li key={i}>
                  <span style={{ color: '#007bff' }}>{getPlayerName(v.playerId)}</span>
                  <span style={{ color: '#888', marginLeft: 6, fontSize: 13 }}>({players.find(p => p.id === v.playerId)?.agent?.strategy || 'default'} agent)</span>:
                  <span style={{ marginLeft: 8 }}>{v.votes ? JSON.stringify(v.votes) : JSON.stringify(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Eliminations */}
        {phase === 'elimination' && (
          <div style={{ marginBottom: 12 }}>
            <b>Eliminations:</b>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {players.filter(p => p.status === 'eliminated').map((p, i) => (
                <li key={i}>
                  <span style={{ color: '#dc3545' }}>{getPlayerName(p.id)}</span> eliminated
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameRoom; 