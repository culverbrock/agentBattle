import React, { useEffect, useState, useRef } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { Connection as SolConnection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import { useNavigate, Link } from 'react-router-dom';
window.Buffer = Buffer;

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
const API_URL = import.meta.env.VITE_API_URL || '';
const PRIZE_POOL_CA = import.meta.env.VITE_PRIZE_POOL_CA || '0x94Aba2204C686f41a1fC7dd5DBaA56172844593a';
const SOL_PRIZE_POOL_TOKEN_ACCOUNT = '9QxGRV3dEkqTaeaz5xcEWwbSxx5pmqPSmL9v62iWzDv';

// Utility to safely stringify objects with BigInt values
function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
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

function LobbyPage() {
  const [games, setGames] = useState([]);
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
  const navigate = useNavigate();

  // Fetch lobby state (for polling fallback)
  const fetchLobby = () => {
    fetch(`${API_URL}/api/games/lobby`)
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

  // MetaMask wallet connect
  const connectWallet = async () => {
    const provider = getMetaMaskProvider();
    if (provider) {
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setWalletType('metamask');
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
        localStorage.setItem('playerId', resp.publicKey.toString());
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
      const res = await fetch(`${API_URL}/api/claim-abt`, {
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
      const res = await fetch(`${API_URL}/api/claim-spl`, {
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
    await fetch(`${API_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGameName })
    });
    setNewGameName('');
    setShowCreateModal(false);
  };

  // Join game
  const handleJoinGame = async (gameId) => {
    const playerId = walletType === 'phantom' ? phantomAddress : walletAddress;
    if (!gameId || !playerId) return;
    setClaimError('');
    try {
      let txHashOrSig = '';
      if (walletType === 'metamask') {
        // Prompt for 100 ABT transfer to prize pool contract
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const abt = new ethers.Contract(ABT_ADDRESS, ["function transfer(address,uint256) returns (bool)"], signer);
        const amount = ethers.parseUnits('100', ABT_DECIMALS);
        const tx = await abt.transfer(PRIZE_POOL_CA, amount);
        setClaimError('Waiting for ABT transaction confirmation...');
        const receipt = await tx.wait();
        if (!receipt.status) throw new Error('Transaction failed');
        txHashOrSig = tx.hash;
      } else if (walletType === 'phantom') {
        // Prompt for 100 SPL transfer to prize pool token account
        if (!window.solana) throw new Error('Phantom not found');
        const connection = new SolConnection(SOL_DEVNET_URL, 'confirmed');
        const fromPubkey = new PublicKey(phantomAddress);
        const toPubkey = new PublicKey(SOL_PRIZE_POOL_TOKEN_ACCOUNT);
        const mint = new PublicKey(SPL_MINT_ADDRESS);
        const ata = await getAssociatedTokenAddress(mint, fromPubkey);
        const { Transaction, SystemProgram } = await import('@solana/web3.js');
        const { createTransferInstruction } = await import('@solana/spl-token');
        const amount = 100 * 10 ** SPL_DECIMALS;
        const ix = createTransferInstruction(ata, toPubkey, fromPubkey, amount, [], TOKEN_PROGRAM_ID);
        const tx = new Transaction().add(ix);
        tx.feePayer = fromPubkey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signed = await window.solana.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        setClaimError('Waiting for SPL transaction confirmation...');
        await connection.confirmTransaction(sig, 'confirmed');
        txHashOrSig = sig;
      } else {
        setClaimError('Connect MetaMask or Phantom to join');
        return;
      }
      // Proceed with joining the game, sending txHash or txSignature
      const res = await fetch(`${API_URL}/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, tx: txHashOrSig, chain: walletType === 'metamask' ? 'eth' : 'sol' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setSelectedGameId(gameId);
      setClaimError('');
    } catch (e) {
      setClaimError(e.message || 'Failed to join the game');
    }
  };

  // Delete game
  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Are you sure you want to delete this game?')) return;
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete game');
      fetchLobby(); // Refresh lobby list
    } catch (e) {
      alert(e.message || 'Failed to delete game');
    }
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

  // Helper to check if the connected wallet is already a player in the game
  const isAlreadyJoined = (game) => {
    const playerId = walletType === 'phantom' ? phantomAddress : walletAddress;
    return game.players.some(player => player.id === playerId);
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
            {/* Always show Claim ABT button for backend test */}
            {!claiming && !claimSuccess && (
              <>
                <button type="button" onClick={claimAbt} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4 }}>Claim ABT</button>
                {abtBalance !== null && abtBalance >= 100 && (
                  <span style={{ color: '#888', marginLeft: 8 }}>You must have less than 100 ABT to claim (backend enforced).</span>
                )}
              </>
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
            {/* Always show Claim SPL button for backend test */}
            {!claimingSpl && !claimSplSuccess && (
              <>
                <button type="button" onClick={claimSpl} style={{ padding: '6px 12px', background: '#8e44ad', color: '#fff', border: 'none', borderRadius: 4 }}>Claim SPL</button>
                {splBalance !== null && splBalance >= 100 && (
                  <span style={{ color: '#888', marginLeft: 8 }}>You must have less than 100 SPL to claim (backend enforced).</span>
                )}
              </>
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

  // Placeholder for entering the game room
  const handleEnterRoom = (gameId) => {
    navigate(`/game/${gameId}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fb' }}>
      {/* Header Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 40px 16px 40px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#222', letterSpacing: 1, marginRight: 48, marginTop: 6 }}>Agent Battle Lobby</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
          {/* Wallet Info & Connect/Disconnect */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Wallet Info Card */}
            <div style={{ background: '#f3f6fa', borderRadius: 12, padding: '12px 18px', minWidth: 180, boxShadow: '0 1px 4px rgba(0,0,0,0.03)', marginRight: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {walletType === 'metamask' && walletAddress && (
                <>
                  <div style={{ color: '#007bff', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>MetaMask: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span></div>
                  <div style={{ color: '#007bff', fontWeight: 600, fontSize: 15, marginBottom: 2 }}>ABT: <span style={{ fontFamily: 'monospace' }}>{abtBalance !== null ? abtBalance : '...'}</span></div>
                  <div style={{ color: '#333', fontWeight: 500, fontSize: 14, marginBottom: 2 }}>Network: <span style={{ fontFamily: 'monospace' }}>{network.name || 'Unknown'}</span> <span style={{ color: '#888', fontSize: 13 }}>(Chain ID: {network.chainId || 'N/A'})</span></div>
                  {network.chainId !== 11155111 && network.chainId !== 0 && (
                    <div style={{ color: '#fff', background: '#dc3545', borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: 13, margin: '4px 0 0 0' }}>Please switch to Sepolia to use ABT!</div>
                  )}
                  {abtBalance !== null && abtBalance >= 100 && (
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>You must have less than 100 ABT to claim (backend enforced).</div>
                  )}
                </>
              )}
              {walletType === 'phantom' && phantomAddress && (
                <>
                  <div style={{ color: '#8e44ad', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>Phantom: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{phantomAddress.slice(0, 6)}...{phantomAddress.slice(-4)}</span></div>
                  <div style={{ color: '#8e44ad', fontWeight: 600, fontSize: 15, marginBottom: 2 }}>SPL: <span style={{ fontFamily: 'monospace' }}>{splBalance !== null ? splBalance : '...'}</span></div>
                  {splBalance !== null && splBalance >= 100 && (
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>You must have less than 100 SPL to claim (backend enforced).</div>
                  )}
                </>
              )}
              {/* If not connected, show network info */}
              {!walletType && window.ethereum && (
                <div style={{ color: '#333', fontWeight: 500, fontSize: 14 }}>Network: {network.name || 'Unknown'} <span style={{ color: '#888', fontSize: 13 }}>(Chain ID: {network.chainId || 'N/A'})</span></div>
              )}
            </div>
            {/* Wallet Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {walletType && (
                <button
                  type="button"
                  onClick={async () => {
                    window.localStorage.removeItem('playerId');
                    if (window.solana && window.solana.isPhantom) {
                      try { await window.solana.disconnect(); } catch {}
                    }
                    window.location.reload();
                  }}
                  style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 600, fontSize: 15 }}
                >
                  Disconnect Wallet
                </button>
              )}
              {!walletType && (
                <>
                  <button type="button" onClick={connectWallet} style={{ padding: '6px 12px', background: '#f6851b', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 600, fontSize: 15 }}>Connect MetaMask</button>
                  <button type="button" onClick={connectPhantom} style={{ padding: '6px 12px', background: '#8e44ad', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 600, fontSize: 15 }}>Connect Phantom</button>
                </>
              )}
              {/* Claim/Add buttons for MetaMask */}
              {walletType === 'metamask' && walletAddress && (
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button type="button" onClick={addAbtToWallet} style={{ padding: '4px 10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13 }}>Add ABT</button>
                  <button type="button" onClick={claimAbt} style={{ padding: '4px 10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13 }}>Claim ABT</button>
                </div>
              )}
              {/* Claim button for Phantom */}
              {walletType === 'phantom' && phantomAddress && (
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button type="button" onClick={claimSpl} style={{ padding: '4px 10px', background: '#8e44ad', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13 }}>Claim SPL</button>
                </div>
              )}
            </div>
          </div>
          {/* Leaderboard Link */}
          <a href="/leaderboard" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold', fontSize: 20, marginLeft: 16, marginTop: 8 }}>🏆 Leaderboard</a>
        </div>
      </header>
      {/* Main Content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <button onClick={() => setShowCreateModal(true)} style={{ fontSize: 20, padding: '10px 24px', fontWeight: 600, background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>+ Create Table</button>
        </div>
        {/* Game List as Responsive Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, justifyItems: 'center' }}>
          {games.map(game => (
            <div key={game.id} style={{ border: '1px solid #ccc', borderRadius: 12, padding: 20, minWidth: 240, maxWidth: 340, width: '100%', background: '#fff', boxShadow: selectedGameId === game.id ? '0 0 12px #007bff44' : '0 1px 6px rgba(0,0,0,0.03)', transition: 'box-shadow 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{game.name}</div>
                {getStatusBadge(game)}
              </div>
              <div style={{ margin: '8px 0 12px 0', color: '#555' }}>Players: {game.players.length} / 10</div>
              <button
                onClick={() => handleJoinGame(game.id)}
                disabled={!isJoinable(game) || (!walletAddress && !phantomAddress) || isAlreadyJoined(game)}
                style={{ width: '100%', padding: 10, background: isJoinable(game) && (walletAddress || phantomAddress) && !isAlreadyJoined(game) ? '#007bff' : '#ccc', color: '#fff', border: 'none', borderRadius: 5, cursor: isJoinable(game) && (walletAddress || phantomAddress) && !isAlreadyJoined(game) ? 'pointer' : 'not-allowed', marginBottom: 10, fontWeight: 600, fontSize: 16 }}
              >
                {isAlreadyJoined(game) ? 'Joined' : 'Join'}
              </button>
              {isAlreadyJoined(game) && (
                <button
                  onClick={() => handleEnterRoom(game.id)}
                  style={{ width: '100%', padding: 10, background: '#28a745', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: 10, fontWeight: 600, fontSize: 16 }}
                >
                  Enter Room
                </button>
              )}
              {game.status && game.status !== 'lobby' && game.status !== 'in_progress' && (
                <Link to={`/history/${game.id}`} style={{ display: 'block', width: '100%', padding: 10, background: '#007bff', color: '#fff', borderRadius: 5, textAlign: 'center', textDecoration: 'none', marginBottom: 10, fontWeight: 600, fontSize: 16 }}>
                  View History
                </Link>
              )}
              <button
                onClick={() => handleDeleteGame(game.id)}
                style={{ width: '100%', padding: 8, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', marginTop: 4, fontWeight: 600 }}
              >
                Delete
              </button>
              <button
                onClick={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}
                style={{ width: '100%', padding: 6, background: '#eee', border: 'none', borderRadius: 5, cursor: 'pointer', marginTop: 6, fontWeight: 500 }}
              >
                {expandedGameId === game.id ? 'Hide Players' : 'Show Players'}
              </button>
              {expandedGameId === game.id && (
                <ul style={{ marginTop: 10, paddingLeft: 16 }}>
                  {game.players.map(player => (
                    <li key={player.id} style={{ color: '#333', fontSize: 15 }}>{player.name} ({player.status})</li>
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
              <input type="text" value={newGameName} onChange={e => setNewGameName(e.target.value)} placeholder="Table Name" style={{ width: '100%', padding: 10, fontSize: 16, marginBottom: 16, borderRadius: 4, border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '8px 18px', background: '#eee', border: 'none', borderRadius: 4, fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Create</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default LobbyPage; 