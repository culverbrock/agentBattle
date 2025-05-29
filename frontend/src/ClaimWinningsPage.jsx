import React, { useEffect, useState, useCallback } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { Connection as SolConnection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { ethers, keccak256, toUtf8Bytes } from "ethers";
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
  "function withdraw(bytes32 gameId) external"
];

// Solana Prize Pool Program
const SOLANA_PRIZE_POOL_PROGRAM_ID = "6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs";

function ClaimWinningsPage() {
  console.log('[ClaimWinningsPage] Component initializing...');
  
  // Wallet state
  const [walletAddress, setWalletAddress] = useState(() => {
    const id = window.localStorage.getItem('playerId');
    const address = id && id.startsWith('0x') ? id : '';
    console.log('[ClaimWinningsPage] Initial walletAddress:', address);
    return address;
  });
  const [phantomAddress, setPhantomAddress] = useState(() => {
    const id = window.localStorage.getItem('playerId');
    const address = id && !id.startsWith('0x') ? id : '';
    console.log('[ClaimWinningsPage] Initial phantomAddress:', address);
    return address;
  });
  const [walletType, setWalletType] = useState(() => {
    const id = window.localStorage.getItem('playerId');
    let type = '';
    if (!id) type = '';
    else if (id.startsWith('0x')) type = 'metamask';
    else if (id.length > 32) type = 'phantom';
    console.log('[ClaimWinningsPage] Initial walletType:', type);
    return type;
  });

  // Logging state
  const [logs, setLogs] = useState([]);
  const log = (msg) => {
    console.log('[ClaimWinningsPage]', msg);
    setLogs(l => [...l, msg]);
  };

  // Claim winnings state
  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  // On-chain claimed status cache
  const [onChainClaimed, setOnChainClaimed] = useState({});

  console.log('[ClaimWinningsPage] State initialized, setting up functions...');

  // Fetch winnings
  const fetchWinnings = () => {
    console.log('[ClaimWinningsPage] fetchWinnings called');
    const playerId = walletType === 'phantom' ? phantomAddress : walletAddress;
    log(`[ClaimWinningsPage] playerId: ${playerId}`);
    if (!playerId) {
      console.log('[ClaimWinningsPage] No playerId, clearing winnings');
      setWinnings([]);
      setLoading(false);
      log('[ClaimWinningsPage] No playerId set.');
      return;
    }
    setLoading(true);
    const url = `${API_URL}/api/winnings/${playerId}`;
    console.log('[ClaimWinningsPage] Fetching from URL:', url);
    log(`[ClaimWinningsPage] Fetching: ${url}`);
    fetch(url)
      .then(res => {
        console.log('[ClaimWinningsPage] Fetch response received, status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[ClaimWinningsPage] Data received:', data);
        log(`[ClaimWinningsPage] Raw winnings: ${JSON.stringify(data)}`);
        setWinnings(data.winnings || []);
        setLoading(false);
        console.log('[ClaimWinningsPage] Winnings set, loading complete');
      })
      .catch(err => {
        console.error('[ClaimWinningsPage] Fetch error:', err);
        setError('Failed to fetch winnings');
        setLoading(false);
        log(`[ClaimWinningsPage] Fetch error: ${err}`);
      });
  };

  useEffect(() => {
    console.log('[ClaimWinningsPage] useEffect triggered for fetchWinnings');
    console.log('[ClaimWinningsPage] Current state - walletAddress:', walletAddress, 'phantomAddress:', phantomAddress, 'walletType:', walletType);
    fetchWinnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, phantomAddress, walletType]);

  console.log('[ClaimWinningsPage] Setting up wallet functions...');

  // Wallet connect logic (copied from LobbyPage)
  function getMetaMaskProvider() {
    console.log('[ClaimWinningsPage] getMetaMaskProvider called');
    if (window.ethereum?.providers) {
      console.log('[ClaimWinningsPage] Multiple providers detected');
      return window.ethereum.providers.find(
        (p) => p.isMetaMask && !p.isPhantom
      ) || null;
    }
    if (window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isPhantom) {
      console.log('[ClaimWinningsPage] Single MetaMask provider detected');
      return window.ethereum;
    }
    console.log('[ClaimWinningsPage] No MetaMask provider found');
    return null;
  }
  const connectWallet = async () => {
    console.log('[ClaimWinningsPage] connectWallet called');
    const provider = getMetaMaskProvider();
    if (provider) {
      try {
        console.log('[ClaimWinningsPage] Requesting MetaMask accounts...');
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        console.log('[ClaimWinningsPage] MetaMask accounts received:', accounts);
        setWalletAddress(accounts[0]);
        setWalletType('metamask');
        setPhantomAddress('');
        window.localStorage.setItem('playerId', accounts[0]);
        log(`[ClaimWinningsPage] Connected MetaMask: ${accounts[0]}`);
      } catch (err) {
        console.error('[ClaimWinningsPage] MetaMask connection error:', err);
        alert('Wallet connection failed');
        log(`[ClaimWinningsPage] MetaMask connect error: ${err}`);
      }
    } else {
      console.log('[ClaimWinningsPage] MetaMask not detected');
      alert('MetaMask not detected. Please install MetaMask.');
      log('[ClaimWinningsPage] MetaMask not detected.');
    }
  };
  const connectPhantom = async () => {
    console.log('[ClaimWinningsPage] connectPhantom called');
    if (window.solana && window.solana.isPhantom) {
      try {
        console.log('[ClaimWinningsPage] Connecting to Phantom...');
        const resp = await window.solana.connect();
        console.log('[ClaimWinningsPage] Phantom connected:', resp.publicKey.toString());
        setPhantomAddress(resp.publicKey.toString());
        setWalletType('phantom');
        setWalletAddress('');
        window.localStorage.setItem('playerId', resp.publicKey.toString());
        log(`[ClaimWinningsPage] Connected Phantom: ${resp.publicKey.toString()}`);
      } catch (err) {
        console.error('[ClaimWinningsPage] Phantom connection error:', err);
        alert('Phantom connection failed');
        log(`[ClaimWinningsPage] Phantom connect error: ${err}`);
      }
    } else {
      console.log('[ClaimWinningsPage] Phantom not detected');
      alert('Phantom not detected. Please install Phantom.');
      log('[ClaimWinningsPage] Phantom not detected.');
    }
  };
  const disconnectWallet = () => {
    console.log('[ClaimWinningsPage] disconnectWallet called');
    setWalletAddress('');
    setPhantomAddress('');
    setWalletType('');
    window.localStorage.removeItem('playerId');
    log('[ClaimWinningsPage] Disconnected wallet.');
  };

  console.log('[ClaimWinningsPage] Setting up claim functions...');

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
      const gameIdBytes32 = keccak256(toUtf8Bytes(win.game_id));
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

  const claimSplOnChain = async (win) => {
    setError("");
    setSuccessMsg("");
    try {
      if (!window.solana) throw new Error("Phantom wallet required");
      
      console.log(`[ClaimWinningsPage] Claiming SPL prize for game ${win.game_id}...`);
      
      const { Connection, PublicKey, Transaction, TransactionInstruction } = await import('@solana/web3.js');
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const programId = new PublicKey('6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs');
      const mint = new PublicKey('7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb');
      const claimer = new PublicKey(phantomAddress);
      
      // Derive PDAs
      const [poolAuthority] = await PublicKey.findProgramAddress(
        [Buffer.from('pool')],
        programId
      );
      
      console.log('[ClaimWinningsPage] PDA derivation details:', {
        programId: programId.toBase58(),
        poolAuthority: poolAuthority.toBase58(),
        seeds: ['pool']
      });
      
      // Verify this matches the expected pool authority from the program
      // The error shows: FiRatRMB4SJKYooWb5XxYNVo91Vk1VBMWMhXiDDT6BQx
      if (poolAuthority.toBase58() !== 'FiRatRMB4SJKYooWb5XxYNVo91Vk1VBMWMhXiDDT6BQx') {
        console.warn('[ClaimWinningsPage] Pool authority mismatch!');
        console.warn('Expected: FiRatRMB4SJKYooWb5XxYNVo91Vk1VBMWMhXiDDT6BQx');
        console.warn('Derived:', poolAuthority.toBase58());
      }
      
      // All SPL winnings are now on-chain with known account addresses
      const gamePda = new PublicKey(win.account_address);
      console.log(`[ClaimWinningsPage] Using game account: ${gamePda.toBase58()}`);
      
      // Token accounts
      const poolTokenAccount = await getAssociatedTokenAddress(mint, poolAuthority, true);
      const claimerTokenAccount = await getAssociatedTokenAddress(mint, claimer);
      
      console.log('[ClaimWinningsPage] SPL claim details:', {
        gameId: win.game_id,
        claimer: phantomAddress,
        amount: win.amount,
        gamePda: gamePda.toBase58(),
        poolAuthority: poolAuthority.toBase58(),
        poolTokenAccount: poolTokenAccount.toBase58(),
        claimerTokenAccount: claimerTokenAccount.toBase58()
      });
      
      // Check if accounts exist and create them if needed
      const gameAccount = await connection.getAccountInfo(gamePda);
      if (!gameAccount) {
        throw new Error('Game account not found on blockchain.');
      }
      
      // Read the actual game ID from the account data
      const gameAccountData = gameAccount.data;
      if (gameAccountData.length < 40) {
        throw new Error('Invalid game account data');
      }
      
      // Extract the game ID from the account (skip 8-byte discriminator, then 32-byte game ID)
      const actualGameId = gameAccountData.slice(8, 40);
      console.log('[ClaimWinningsPage] Using actual game ID from account:', Array.from(actualGameId));
      
      // Import createAssociatedTokenAccountInstruction
      const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
      
      const instructions = [];
      
      // Check if pool token account exists, create if not
      const poolTokenAccountInfo = await connection.getAccountInfo(poolTokenAccount);
      if (!poolTokenAccountInfo) {
        console.log('[ClaimWinningsPage] Pool token account does not exist, creating it...');
        const createPoolTokenAccountIx = createAssociatedTokenAccountInstruction(
          claimer, // payer
          poolTokenAccount, // ata
          poolAuthority, // owner
          mint // mint
        );
        instructions.push(createPoolTokenAccountIx);
      }
      
      // Check if claimer token account exists, create if not
      const claimerTokenAccountInfo = await connection.getAccountInfo(claimerTokenAccount);
      if (!claimerTokenAccountInfo) {
        console.log('[ClaimWinningsPage] Claimer token account does not exist, creating it...');
        const createClaimerTokenAccountIx = createAssociatedTokenAccountInstruction(
          claimer, // payer
          claimerTokenAccount, // ata
          claimer, // owner
          mint // mint
        );
        instructions.push(createClaimerTokenAccountIx);
      }
      
      // Create claim instruction - use the actual game ID from account data
      const discriminator = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
      
      const instructionData = Buffer.concat([
        discriminator,
        actualGameId
      ]);
      
      const claimIx = new TransactionInstruction({
        keys: [
          { pubkey: gamePda, isSigner: false, isWritable: true },          // game
          { pubkey: claimer, isSigner: true, isWritable: true },           // winner 
          { pubkey: poolTokenAccount, isSigner: false, isWritable: true }, // prizePoolTokenAccount
          { pubkey: claimerTokenAccount, isSigner: false, isWritable: true }, // winnerTokenAccount
          { pubkey: poolAuthority, isSigner: false, isWritable: false },   // prizePoolAuthority
          { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false } // tokenProgram
        ],
        programId,
        data: instructionData
      });
      
      // Add claim instruction to the list
      instructions.push(claimIx);
      
      const tx = new Transaction().add(...instructions);
      
      // Set required transaction properties
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = claimer;
      
      // Sign and send with Phantom
      const signed = await window.solana.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      
      console.log(`[ClaimWinningsPage] SPL claim successful:`, signature);
      
      setSuccessMsg(`Successfully claimed ${win.amount} SPL! Transaction: ${signature.slice(0, 8)}...`);
      
      // Remove from local winnings list and refresh
      setWinnings(winnings.filter(w => w.id !== win.id));
      log(`[ClaimWinningsPage] SPL claim successful: ${signature}`);
      
      // Refresh winnings to get updated claimed status from blockchain
      setTimeout(fetchWinnings, 2000);
      
    } catch (err) {
      log(`[ClaimWinningsPage] SPL claim error: ${err.message}`);
      setError(err.message);
    }
  };

  // Check on-chain claimed status for ABT winnings
  const checkOnChainClaimed = useCallback(async (win) => {
    if (win.currency !== 'ABT' || !walletAddress) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(ABT_PRIZE_POOL_V3, [
        "function withdrawn(bytes32 gameId, address player) view returns (bool)"
      ], provider);
      const gameIdBytes32 = keccak256(toUtf8Bytes(win.game_id));
      const withdrawn = await contract.withdrawn(gameIdBytes32, walletAddress);
      setOnChainClaimed(c => ({ ...c, [win.id]: withdrawn }));
    } catch (err) {
      log(`[ClaimWinningsPage] On-chain claimed check error: ${err.message}`);
    }
  }, [walletAddress]);

  // Deduplicate winnings: only show the latest unclaimed winning per game
  const dedupedWinnings = Object.values(
    winnings
      .filter(w => !w.claimed) // Only unclaimed
      .reduce((acc, w) => {
        if (!acc[w.game_id] || new Date(w.created_at) > new Date(acc[w.game_id].created_at)) {
          acc[w.game_id] = w;
        }
        return acc;
      }, {})
  );

  console.log('[ClaimWinningsPage] Deduplication complete');
  console.log('[ClaimWinningsPage] Original winnings count:', winnings.length);
  console.log('[ClaimWinningsPage] Deduped winnings count:', dedupedWinnings.length);
  console.log('[ClaimWinningsPage] Deduped winnings:', dedupedWinnings);

  // Check on-chain claimed status when winnings change
  useEffect(() => {
    console.log('[ClaimWinningsPage] useEffect for on-chain check triggered');
    console.log('[ClaimWinningsPage] Checking', dedupedWinnings.length, 'deduped winnings');
    dedupedWinnings.forEach(win => {
      if (win.currency === 'ABT' && walletType === 'metamask') {
        console.log('[ClaimWinningsPage] Checking on-chain claimed status for ABT winning:', win.id);
        checkOnChainClaimed(win);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedupedWinnings, walletType, walletAddress]);

  console.log('[ClaimWinningsPage] About to render component');
  console.log('[ClaimWinningsPage] Render state - loading:', loading, 'error:', error, 'winnings.length:', winnings.length);

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', fontFamily: 'sans-serif', padding: 16 }}>
      {console.log('[ClaimWinningsPage] Rendering JSX...')}
      <h1>Claim Winnings</h1>
      {console.log('[ClaimWinningsPage] Rendered header')}
      {/* Wallet connect UI */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f3f6fa', borderRadius: 8 }}>
        {console.log('[ClaimWinningsPage] Rendering wallet connect UI')}
        <div style={{ marginBottom: 8 }}>
          <b>Wallet:</b> {walletType ? (
            <span style={{ color: '#007bff' }}>{walletType === 'metamask' ? 'MetaMask' : 'Phantom'}: {(walletType === 'metamask' ? walletAddress : phantomAddress) || '(none)'}</span>
          ) : <span style={{ color: '#888' }}>(not connected)</span>}
        </div>
        <button onClick={connectWallet} style={{ marginRight: 8, padding: '6px 16px' }}>Connect MetaMask</button>
        <button onClick={connectPhantom} style={{ marginRight: 8, padding: '6px 16px' }}>Connect Phantom</button>
        <button onClick={disconnectWallet} style={{ padding: '6px 16px' }}>Disconnect</button>
      </div>
      {console.log('[ClaimWinningsPage] Rendered wallet UI')}
      {/* Logging output */}
      <div style={{ background: '#222', color: '#fff', fontSize: 13, padding: 10, borderRadius: 6, marginBottom: 16, maxHeight: 180, overflow: 'auto' }}>
        {console.log('[ClaimWinningsPage] Rendering debug log with', logs.length, 'entries')}
        <b>Debug Log:</b>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {logs.map((l, i) => <li key={i} style={{ marginBottom: 2 }}>{l}</li>)}
        </ul>
      </div>
      {console.log('[ClaimWinningsPage] Rendered debug log')}
      {loading && <div>Loading...</div>}
      {loading && console.log('[ClaimWinningsPage] Rendered loading state')}
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {error && console.log('[ClaimWinningsPage] Rendered error:', error)}
      {successMsg && <div style={{ color: 'green' }}>{successMsg}</div>}
      {successMsg && console.log('[ClaimWinningsPage] Rendered success message:', successMsg)}
      {!loading && winnings.length === 0 && <div style={{ color: '#888' }}>No claimable winnings at this time.</div>}
      {!loading && winnings.length === 0 && console.log('[ClaimWinningsPage] Rendered no winnings message')}
      {dedupedWinnings.length > 0 && (
        <>
          {console.log('[ClaimWinningsPage] Rendering winnings table with', dedupedWinnings.length, 'entries')}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Game ID</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Amount</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Currency</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Created At</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Claimed</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {dedupedWinnings.map((win, i) => (
                <tr key={win.id}>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{win.game_id}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{win.amount}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{win.currency}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{new Date(win.created_at).toLocaleString()}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{win.currency === 'ABT' && walletType === 'metamask' ? (onChainClaimed[win.id] ? 'Yes' : 'No') : (win.claimed ? 'Yes' : 'No')}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>
                    {walletType === 'metamask' && win.currency === 'ABT' && !win.claimed && (
                      <button onClick={() => claimOnChain(win)} disabled={claiming[win.id]}>Claim ABT Prize</button>
                    )}
                    {walletType === 'phantom' && win.currency === 'SPL' && !win.claimed && (
                      <button onClick={() => claimSplOnChain(win)} disabled={claiming[win.id]}>
                        Claim SPL Prize
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {console.log('[ClaimWinningsPage] Rendered complete winnings table')}
        </>
      )}
      {console.log('[ClaimWinningsPage] Component render complete')}
    </div>
  );
}

export default ClaimWinningsPage; 