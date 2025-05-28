import React, { useEffect, useState } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { Connection as SolConnection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { ethers } from "ethers";
window.Buffer = Buffer;

const API_URL = import.meta.env.VITE_API_URL || '';
const ABT_ADDRESS = '0x799b7b7cC889449952283CF23a15956920E7f85B';
const ABT_SYMBOL = 'ABT';
const ABT_DECIMALS = 18;
const SPL_MINT_ADDRESS = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const SPL_DECIMALS = 6;
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';
const ABT_PRIZE_POOL_V2 = "0x94006Fb7D2fb9E6F2826214EdEC0Fd45fd30f67B";
const ABT_PRIZE_POOL_V3 = "0xa2852c3da70A7A481cE97a1E5bde7Da37EFB0c36";
const ABT_PRIZE_POOL_ABI = [
  "function withdraw() external"
];

function ClaimWinningsPage() {
  // Wallet state
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

  // Logging state
  const [logs, setLogs] = useState([]);
  const log = (msg) => setLogs(l => [...l, msg]);

  // Claim winnings state
  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch winnings
  useEffect(() => {
    const playerId = walletType === 'phantom' ? phantomAddress : walletAddress;
    log(`[ClaimWinningsPage] playerId: ${playerId}`);
    if (!playerId) {
      setWinnings([]);
      setLoading(false);
      log('[ClaimWinningsPage] No playerId set.');
      return;
    }
    setLoading(true);
    const url = `${API_URL}/api/winnings/${playerId}`;
    log(`[ClaimWinningsPage] Fetching: ${url}`);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        log(`[ClaimWinningsPage] Raw winnings: ${JSON.stringify(data)}`);
        setWinnings(data.winnings || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch winnings');
        setLoading(false);
        log(`[ClaimWinningsPage] Fetch error: ${err}`);
      });
  }, [walletAddress, phantomAddress, walletType]);

  // Wallet connect logic (copied from LobbyPage)
  function getMetaMaskProvider() {
    if (window.ethereum?.providers) {
      return window.ethereum.providers.find(
        (p) => p.isMetaMask && !p.isPhantom
      ) || null;
    }
    if (window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isPhantom) {
      return window.ethereum;
    }
    return null;
  }
  const connectWallet = async () => {
    const provider = getMetaMaskProvider();
    if (provider) {
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setWalletType('metamask');
        setPhantomAddress('');
        window.localStorage.setItem('playerId', accounts[0]);
        log(`[ClaimWinningsPage] Connected MetaMask: ${accounts[0]}`);
      } catch (err) {
        alert('Wallet connection failed');
        log(`[ClaimWinningsPage] MetaMask connect error: ${err}`);
      }
    } else {
      alert('MetaMask not detected. Please install MetaMask.');
      log('[ClaimWinningsPage] MetaMask not detected.');
    }
  };
  const connectPhantom = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const resp = await window.solana.connect();
        setPhantomAddress(resp.publicKey.toString());
        setWalletType('phantom');
        setWalletAddress('');
        window.localStorage.setItem('playerId', resp.publicKey.toString());
        log(`[ClaimWinningsPage] Connected Phantom: ${resp.publicKey.toString()}`);
      } catch (err) {
        alert('Phantom connection failed');
        log(`[ClaimWinningsPage] Phantom connect error: ${err}`);
      }
    } else {
      alert('Phantom not detected. Please install Phantom.');
      log('[ClaimWinningsPage] Phantom not detected.');
    }
  };
  const disconnectWallet = () => {
    setWalletAddress('');
    setPhantomAddress('');
    setWalletType('');
    window.localStorage.removeItem('playerId');
    log('[ClaimWinningsPage] Disconnected wallet.');
  };

  const handleClaim = async (win) => {
    setClaiming(c => ({ ...c, [win.id]: true }));
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_URL}/api/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: walletType === 'phantom' ? phantomAddress : walletAddress, gameId: win.game_id, currency: win.currency })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Claimed ${win.amount} ${win.currency} for game ${win.game_id}`);
        setWinnings(winnings.filter(w => w.id !== win.id));
        log(`[ClaimWinningsPage] Claimed: ${JSON.stringify(win)}`);
      } else {
        setError(data.error || 'Failed to claim winnings');
        log(`[ClaimWinningsPage] Claim error: ${data.error}`);
      }
    } catch (err) {
      setError('Failed to claim winnings');
      log(`[ClaimWinningsPage] Claim fetch error: ${err}`);
    }
    setClaiming(c => ({ ...c, [win.id]: false }));
  };

  const claimOnChain = async (win) => {
    setError("");
    setSuccessMsg("");
    try {
      if (!window.ethereum) throw new Error("MetaMask required");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ABT_PRIZE_POOL_V3, ABT_PRIZE_POOL_ABI, signer);
      // Convert gameId (UUID) to bytes32
      const gameIdBytes32 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(win.game_id));
      const tx = await contract.withdraw(gameIdBytes32);
      log(`[ClaimWinningsPage] withdraw(${win.game_id}) tx: ${tx.hash}`);
      await tx.wait();
      setSuccessMsg("Claimed on-chain! Check your wallet balance.");
      fetchWinnings();
    } catch (err) {
      log(`[ClaimWinningsPage] On-chain claim error: ${err.message}`);
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Claim Winnings</h1>
      {/* Wallet connect UI */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f3f6fa', borderRadius: 8 }}>
        <div style={{ marginBottom: 8 }}>
          <b>Wallet:</b> {walletType ? (
            <span style={{ color: '#007bff' }}>{walletType === 'metamask' ? 'MetaMask' : 'Phantom'}: {(walletType === 'metamask' ? walletAddress : phantomAddress) || '(none)'}</span>
          ) : <span style={{ color: '#888' }}>(not connected)</span>}
        </div>
        <button onClick={connectWallet} style={{ marginRight: 8, padding: '6px 16px' }}>Connect MetaMask</button>
        <button onClick={connectPhantom} style={{ marginRight: 8, padding: '6px 16px' }}>Connect Phantom</button>
        <button onClick={disconnectWallet} style={{ padding: '6px 16px' }}>Disconnect</button>
      </div>
      {/* Logging output */}
      <div style={{ background: '#222', color: '#fff', fontSize: 13, padding: 10, borderRadius: 6, marginBottom: 16, maxHeight: 180, overflow: 'auto' }}>
        <b>Debug Log:</b>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {logs.map((l, i) => <li key={i} style={{ marginBottom: 2 }}>{l}</li>)}
        </ul>
      </div>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {successMsg && <div style={{ color: 'green' }}>{successMsg}</div>}
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
            {winnings.filter(w => w.currency === 'ABT' && !w.claimed).map((win, i) => (
              <tr key={win.id}>
                <td>{win.game_id}</td>
                <td>{win.amount}</td>
                <td>{win.currency}</td>
                <td>{new Date(win.created_at).toLocaleString()}</td>
                <td>
                  {walletType === 'metamask' && (
                    <button onClick={() => claimOnChain(win)} disabled={claiming[win.id]}>Claim On-Chain (MetaMask)</button>
                  )}
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