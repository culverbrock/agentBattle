import React, { useEffect, useState, useRef } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { Connection as SolConnection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const ABT_ADDRESS = '0x799b7b7cC889449952283CF23a15956920E7f85B';
const ABT_SYMBOL = 'ABT';
const ABT_DECIMALS = 18;
const ABT_IMAGE = '';
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];
const SPL_MINT_ADDRESS = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const SPL_DECIMALS = 6;
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Utility to safely stringify objects with BigInt values
function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

function LobbyPage() {
  const [games, setGames] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [phantomAddress, setPhantomAddress] = useState('');
  const [walletType, setWalletType] = useState(''); // 'metamask' or 'phantom'
  const [abtBalance, setAbtBalance] = useState(null);
  const [newGameName, setNewGameName] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState(null);
  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [network, setNetwork] = useState({ name: '', chainId: 0 });
  const [debug, setDebug] = useState({ networkError: '', balanceError: '' });
  const [splBalance, setSplBalance] = useState(null);
  const [claimingSpl, setClaimingSpl] = useState(false);
  const [claimSplError, setClaimSplError] = useState('');
  const [claimSplSuccess, setClaimSplSuccess] = useState(false);
  const [splFetchError, setSplFetchError] = useState('');

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
    ws.current.onclose = () => {
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
        setWalletType('metamask');
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
        setPlayerId(resp.publicKey.toString());
        setWalletType('phantom');
      } catch (err) {
        alert('Phantom connection failed');
      }
    } else {
      alert('Phantom not detected. Please install Phantom Wallet.');
    }
  };

  // Add ABT token to MetaMask
  const addAbtToWallet = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: ABT_ADDRESS,
              symbol: ABT_SYMBOL,
              decimals: ABT_DECIMALS,
              image: ABT_IMAGE,
            },
          },
        });
      } catch (error) {
        alert('Failed to add ABT token');
      }
    }
  };

  // Claim ABT from faucet
  const claimAbt = async () => {
    setClaiming(true);
    setClaimError('');
    setClaimSuccess(false);
    try {
      const res = await fetch('/api/claim-abt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      });
      const data = await res.json();
      if (data.success) {
        setClaimSuccess(true);
        // Wait a bit for the transaction to confirm, then refresh balance
        setTimeout(() => {
          fetchBalance();
        }, 5000);
      } else {
        setClaimError(data.error || 'Failed to claim ABT');
      }
    } catch (e) {
      setClaimError('Failed to claim ABT');
    }
    setClaiming(false);
  };

  // Fetch network info
  useEffect(() => {
    async function fetchNetwork() {
      if (window.ethereum) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const net = await provider.getNetwork();
          setNetwork({ name: net.name, chainId: net.chainId });
          setDebug(d => ({ ...d, networkError: '' }));
        } catch (e) {
          setNetwork({ name: '', chainId: 0 });
          setDebug(d => ({ ...d, networkError: e.message }));
        }
      } else {
        setNetwork({ name: '', chainId: 0 });
        setDebug(d => ({ ...d, networkError: 'window.ethereum not detected' }));
      }
    }
    fetchNetwork();
    // Listen for network/account changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', fetchNetwork);
      window.ethereum.on('accountsChanged', fetchNetwork);
      return () => {
        window.ethereum.removeListener('chainChanged', fetchNetwork);
        window.ethereum.removeListener('accountsChanged', fetchNetwork);
      };
    }
  }, [walletType, walletAddress]);

  // Fetch ABT balance (moved out for reuse)
  const fetchBalance = async () => {
    if (walletType === 'metamask' && walletAddress) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const token = new Contract(ABT_ADDRESS, ERC20_ABI, provider);
        const bal = await token.balanceOf(walletAddress);
        setAbtBalance(Number(formatUnits(bal, ABT_DECIMALS)));
        setDebug(d => ({ ...d, balanceError: '' }));
      } catch (e) {
        setAbtBalance(null);
        setDebug(d => ({ ...d, balanceError: e.message }));
      }
    } else {
      setAbtBalance(null);
      setDebug(d => ({ ...d, balanceError: 'No wallet connected or not MetaMask' }));
    }
  };

  // Fetch SPL balance for Phantom
  const fetchSplBalance = async () => {
    if (walletType === 'phantom' && phantomAddress) {
      try {
        const connection = new SolConnection(SOL_DEVNET_URL, 'confirmed');
        const mint = new PublicKey(SPL_MINT_ADDRESS);
        const owner = new PublicKey(phantomAddress);
        const ata = await getAssociatedTokenAddress(mint, owner);
        console.log('SPL Debug:', { mint: SPL_MINT_ADDRESS, owner: phantomAddress, ata: ata.toBase58() });
        try {
          const account = await getAccount(connection, ata);
          console.log('SPL Account:', account);
          setSplBalance(Number(account.amount) / 10 ** SPL_DECIMALS);
          setSplFetchError('');
        } catch (e) {
          console.log('SPL getAccount error:', e);
          setSplBalance(0);
          setSplFetchError(e.message || String(e));
        }
      } catch (e) {
        console.log('SPL fetch error:', e);
        setSplBalance(null);
        setSplFetchError(e.message || String(e));
      }
    } else {
      setSplBalance(null);
      setSplFetchError('');
    }
  };

  // Claim SPL from faucet
  const claimSpl = async () => {
    setClaimingSpl(true);
    setClaimSplError('');
    setClaimSplSuccess(false);
    try {
      const res = await fetch('/api/claim-spl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: phantomAddress })
      });
      const data = await res.json();
      if (data.success) {
        setClaimSplSuccess(true);
        setTimeout(() => {
          fetchSplBalance();
        }, 5000);
      } else {
        setClaimSplError(data.error || 'Failed to claim SPL');
      }
    } catch (e) {
      setClaimSplError('Failed to claim SPL');
    }
    setClaimingSpl(false);
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

  // Wallet display (now returns more info)
  const walletInfoDisplay = () => {
    if (walletType === 'metamask' && walletAddress) {
      return (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#007bff', fontWeight: 'bold' }}>MetaMask: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>
          <div style={{ color: '#007bff', fontWeight: 'bold' }}>
            {abtBalance !== null ? `ABT: ${abtBalance}` : 'ABT: ...'}
          </div>
          <div style={{ color: '#333', fontWeight: 'bold' }}>
            Network: {network.name || 'Unknown'} (Chain ID: {network.chainId || 'N/A'})
          </div>
          {network.chainId !== 11155111 && network.chainId !== 0 && (
            <div style={{ color: 'red', fontWeight: 'bold' }}>Please switch to Sepolia to use ABT!</div>
          )}
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={addAbtToWallet} style={{ marginRight: 8, padding: '6px 12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4 }}>Add ABT to Wallet</button>
            {/* Always show Claim ABT button */}
            {!claiming && !claimSuccess && (
              <button type="button" onClick={claimAbt} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4 }}>Claim ABT</button>
            )}
            {claiming && <span style={{ color: '#888', marginLeft: 8 }}>Claiming...</span>}
            {claimSuccess && <span style={{ color: '#28a745', marginLeft: 8 }}>Claimed!</span>}
            {claimError && <span style={{ color: 'red', marginLeft: 8 }}>{claimError}</span>}
          </div>
        </div>
      );
    }
    if (walletType === 'phantom' && phantomAddress) {
      return (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#8e44ad', fontWeight: 'bold' }}>Phantom: {phantomAddress.slice(0, 6)}...{phantomAddress.slice(-4)}</div>
          <div style={{ color: '#8e44ad', fontWeight: 'bold' }}>
            SPL: {splBalance !== null ? splBalance : '...'}
          </div>
          <div style={{ marginTop: 8 }}>
            {!claimingSpl && !claimSplSuccess && (
              <button type="button" onClick={claimSpl} style={{ padding: '6px 12px', background: '#8e44ad', color: '#fff', border: 'none', borderRadius: 4 }}>Claim SPL</button>
            )}
            {claimingSpl && <span style={{ color: '#888', marginLeft: 8 }}>Claiming...</span>}
            {claimSplSuccess && <span style={{ color: '#28a745', marginLeft: 8 }}>Claimed!</span>}
            {claimSplError && <span style={{ color: 'red', marginLeft: 8 }}>{claimSplError}</span>}
          </div>
        </div>
      );
    }
    // If MetaMask is available but not connected, show network info
    if (window.ethereum) {
      return (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#333', fontWeight: 'bold' }}>
            Network: {network.name || 'Unknown'} (Chain ID: {network.chainId || 'N/A'})
          </div>
          {network.chainId === 0 && (
            <div style={{ color: 'orange', fontWeight: 'bold' }}>Please connect MetaMask to see wallet and ABT info.</div>
          )}
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    fetchBalance();
    fetchSplBalance();
  }, [walletType, walletAddress, phantomAddress]);

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      {/* Debug Panel */}
      <div style={{ background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
        <div><strong>Debug Info</strong></div>
        <div>window.ethereum detected: {typeof window !== 'undefined' && window.ethereum ? 'Yes' : 'No'}</div>
        <div>walletType: {walletType || 'None'}</div>
        <div>walletAddress: {walletAddress || 'None'}</div>
        <div>phantomAddress: {phantomAddress || 'None'}</div>
        <div>network: {safeStringify(network)}</div>
        <div>ABT balance: {abtBalance !== null ? abtBalance : 'N/A'}</div>
        <div>SPL fetch error: {splFetchError || 'None'}</div>
        <div style={{ color: debug.networkError ? 'red' : '#888' }}>Network error: {debug.networkError || 'None'}</div>
        <div style={{ color: debug.balanceError ? 'red' : '#888' }}>Balance error: {debug.balanceError || 'None'}</div>
      </div>
      {/* Wallet/Personal Info Section */}
      <div style={{ marginBottom: 24 }}>
        {walletInfoDisplay()}
        {/* Wallet connect buttons if not connected */}
        {!walletType && (
          <div>
            <button type="button" onClick={connectWallet} style={{ marginRight: 8, padding: '6px 12px', background: '#f6851b', color: '#fff', border: 'none', borderRadius: 4 }}>Connect MetaMask</button>
            <button type="button" onClick={connectPhantom} style={{ marginRight: 8, padding: '6px 12px', background: '#8e44ad', color: '#fff', border: 'none', borderRadius: 4 }}>Connect Phantom</button>
          </div>
        )}
      </div>
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
              disabled={!isJoinable(game) || !playerId}
              style={{ width: '100%', padding: 8, background: isJoinable(game) && playerId ? '#007bff' : '#ccc', color: '#fff', border: 'none', borderRadius: 4, cursor: isJoinable(game) && playerId ? 'pointer' : 'not-allowed', marginBottom: 8 }}
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