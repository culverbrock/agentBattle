const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('./database');
const { startLobbyWebSocketServer, broadcastLobbyState } = require('./lobbyWebSocketServer');
const cors = require('cors');
const { ethers } = require('ethers');
const solanaWeb3 = require('@solana/web3.js');
const nacl = require('tweetnacl');
const app = express();
app.use(express.json());
app.use(cors());

// Use '/api' prefix for all API routes
const router = express.Router();

// Admin authentication endpoint (placed on main app, not router)
app.post('/api/admin/authenticate', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'evolutionAdmin2024';
  
  if (password === ADMIN_PASSWORD) {
    // Generate a simple session token
    const sessionToken = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session (in production, use Redis or database)
    global.adminSessions = global.adminSessions || new Set();
    global.adminSessions.add(sessionToken);
    
    // Auto-expire session after 24 hours
    setTimeout(() => {
      global.adminSessions.delete(sessionToken);
    }, 24 * 60 * 60 * 1000);
    
    res.json({ 
      success: true, 
      token: sessionToken,
      message: 'Admin access granted' 
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid admin password' 
    });
  }
});

// Middleware to check admin session
const requireAdminAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !global.adminSessions?.has(token)) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  
  next();
};

const leaderboardHandler = require('./api/leaderboard');
const { router: gameStateRouter } = require('./api/gameState');
const { startGameRoomWebSocketServer } = require('./gameRoomWebSocketServer');
const { saveGameState, loadGameState } = require('./gameStatePersistence');
const claimSplHandler = require('./api/claim-spl');
const claimAbtHandler = require('./api/claim-abt');
const bridgeUtils = require('./bridgeUtils');
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { createTransferInstruction, getAssociatedTokenAddress } = require('@solana/spl-token');
const evolutionController = require('./api/evolutionController');
const { startEvolutionWebSocketServer } = require('./evolutionWebSocketServer');

/**
 * @route POST /games
 * @desc Create a new game
 * @body { name: string }
 * @returns { id, name, status, created_at, updated_at }
 */
router.post('/games', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Game name is required' });
  }
  const id = uuidv4();
  try {
    const query = `INSERT INTO games (id, name, status) VALUES ($1, $2, 'lobby') RETURNING *`;
    const { rows } = await pool.query(query, [id, name]);
    res.status(201).json(rows[0]);
    // Broadcast lobby state after creating a game
    broadcastLobbyState();
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

/**
 * @route POST /games/:gameId/join
 * @desc Join a game
 */
router.post('/games/:gameId/join', async (req, res) => {
  const { playerId } = req.body;
  const { gameId } = req.params;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  try {
    // Check current player count
    const countQ = `SELECT COUNT(*) FROM player_games WHERE game_id = $1`;
    const { rows: countRows } = await pool.query(countQ, [gameId]);
    const playerCount = parseInt(countRows[0].count, 10);
    if (playerCount >= 10) {
      return res.status(400).json({ error: 'Game is full (max 10 players)' });
    }
    // Upsert player into the players table (if not exists)
    const playerQ = `INSERT INTO players (id, name, status) VALUES ($1, $2, 'connected')
      ON CONFLICT (id) DO UPDATE SET name = $2, status = 'connected' RETURNING *`;
    await pool.query(playerQ, [playerId, playerId]);
    // Insert into player_games (if not already present)
    const joinQ = `INSERT INTO player_games (player_id, game_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
    await pool.query(joinQ, [playerId, gameId]);
    // Fetch all players for this game
    const playersQ = `SELECT p.id, p.name, p.status FROM players p
      JOIN player_games pg ON p.id = pg.player_id WHERE pg.game_id = $1`;
    const { rows: players } = await pool.query(playersQ, [gameId]);
    // Update and persist game state
    let state = await loadGameState(gameId);
    if (state) {
      state.players = players;
      await saveGameState(gameId, state);
    } else {
      // Create initial game state if missing
      state = {
        phase: 'lobby',
        round: 0,
        maxRounds: 10,
        players: players,
        eliminated: [],
        proposals: [],
        votes: {},
        speakingOrder: [],
        currentSpeakerIdx: 0,
        strategyMessages: {},
        gameId: gameId,
        winnerProposal: null,
        ended: false
      };
      await saveGameState(gameId, state);
    }
    res.status(200).json(players.find(p => p.id === playerId));
    // Broadcast lobby state after player joins
    broadcastLobbyState();
  } catch (err) {
    console.error('Error joining game:', err);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

/**
 * @route POST /games/:gameId/proposals
 * @desc Submit a proposal
 */
// router.post('/games/:gameId/proposals', (req, res) => {
//   // TODO: Implement proposal submission
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route POST /games/:gameId/votes
 * @desc Submit a vote
 */
// router.post('/games/:gameId/votes', (req, res) => {
//   // TODO: Implement voting
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route GET /games/:gameId
 * @desc Fetch game state
 */
// router.get('/games/:gameId', (req, res) => {
//   // TODO: Implement fetch game state
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route GET /games/:gameId/players
 * @desc Fetch players in a game
 */
router.get('/games/:gameId/players', (req, res) => {
  // TODO: Implement fetch players
  res.status(501).json({ message: 'Not implemented' });
});

/**
 * @route GET /games/:gameId/proposals
 * @desc Fetch proposals for a game
 */
// router.get('/games/:gameId/proposals', (req, res) => {
//   // TODO: Implement fetch proposals
//   res.status(501).json({ message: 'Not implemented' });
// });

/**
 * @route POST /games/:gameId/leave
 * @desc Leave a game
 */
router.post('/games/:gameId/leave', async (req, res) => {
  const { playerId } = req.body;
  const { gameId } = req.params;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  try {
    // Remove from player_games
    const leaveQ = `DELETE FROM player_games WHERE player_id = $1 AND game_id = $2`;
    await pool.query(leaveQ, [playerId, gameId]);
    // Optionally, set player status to 'disconnected' if not in any games
    const checkQ = `SELECT COUNT(*) FROM player_games WHERE player_id = $1`;
    const { rows: checkRows } = await pool.query(checkQ, [playerId]);
    if (parseInt(checkRows[0].count, 10) === 0) {
      await pool.query(`UPDATE players SET status = 'disconnected' WHERE id = $1`, [playerId]);
    }
    // Fetch all players for this game
    const playersQ = `SELECT p.id, p.name, p.status FROM players p
      JOIN player_games pg ON p.id = pg.player_id WHERE pg.game_id = $1`;
    const { rows: players } = await pool.query(playersQ, [gameId]);
    res.status(200).json({ success: true });
    // Broadcast lobby state after player leaves
    broadcastLobbyState();
  } catch (err) {
    console.error('Error leaving game:', err);
    res.status(500).json({ error: 'Failed to leave game' });
  }
});

/**
 * @route GET /games/lobby
 * @desc Fetch current lobby state: open games and their players
 */
router.get('/games/lobby', async (req, res) => {
  console.log('--- /api/games/lobby called ---');
  try {
    const gamesQ = `SELECT id, name FROM games WHERE status = 'lobby'`;
    const { rows: games } = await pool.query(gamesQ);
    console.log('Lobby games:', games);
    for (const game of games) {
      const playersQ = `SELECT p.id, p.name, p.status FROM players p
        JOIN player_games pg ON p.id = pg.player_id WHERE pg.game_id = $1`;
      const { rows: players } = await pool.query(playersQ, [game.id]);
      game.players = players;
      // console.log(`Players for game ${game.id}:`, players); // Removed to reduce log noise
    }
    res.status(200).json({ games });
  } catch (err) {
    console.error('Error fetching lobby state:', err.stack || err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

/**
 * @route DELETE /games/:gameId
 * @desc Delete a game and all associated data
 */
router.delete('/games/:gameId', async (req, res) => {
  const { gameId } = req.params;
  try {
    // Delete all associated data (order matters due to FKs)
    await pool.query('DELETE FROM players WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM proposals WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM votes WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM messages WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM strategies WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM transactions WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM game_states WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM games WHERE id = $1', [gameId]);
    res.status(200).json({ success: true });
    broadcastLobbyState();
  } catch (err) {
    console.error('Error deleting game:', err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

router.get('/leaderboard', leaderboardHandler);

router.post('/game-state/:gameId/ready', async (req, res) => {
  const { gameId } = req.params;
  const { playerId, strategy, message, signature, walletType } = req.body;
  console.log('[READY] Incoming:', { gameId, playerId, strategy, message, signature, walletType });
  if (!playerId || !strategy || !message || !signature || !walletType) {
    console.log('[READY] Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }
  let valid = false;
  try {
    if (walletType === 'eth') {
      try {
        console.log('[READY][ETH] message:', message);
        console.log('[READY][ETH] signature:', signature);
        console.log('[READY][ETH] playerId:', playerId);
        const recovered = ethers.verifyMessage(message, signature);
        console.log('[READY][ETH] Recovered:', recovered, 'Expected:', playerId);
        valid = (recovered.toLowerCase() === playerId.toLowerCase());
      } catch (e) {
        console.log('[READY][ETH] Signature verification error:', e);
        return res.status(401).json({ error: 'Invalid ETH signature' });
      }
    } else if (walletType === 'sol') {
      try {
        const pubkey = new solanaWeb3.PublicKey(playerId);
        const msgUint8 = new TextEncoder().encode(message);
        const sigUint8 = Buffer.from(signature, 'base64');
        valid = nacl.sign.detached.verify(msgUint8, sigUint8, pubkey.toBytes());
        console.log('[READY][SOL] Verification result:', valid);
      } catch (e) {
        console.log('[READY][SOL] Signature verification error:', e);
        return res.status(401).json({ error: 'Invalid SOL signature' });
      }
    } else {
      console.log('[READY] Unknown wallet type:', walletType);
      return res.status(400).json({ error: 'Unknown wallet type' });
    }
    if (!valid) {
      console.log('[READY] Signature does not match playerId');
      return res.status(401).json({ error: 'Signature does not match playerId' });
    }
    // --- Mark player as ready and broadcast update ---
    const { createGameStateMachine } = require('./gameStateMachine');
    const { broadcastGameRoomState, broadcastGameEvent } = require('./gameRoomWebSocketServer');
    // Load current state
    let state = await loadGameState(gameId);
    if (!state) return res.status(404).json({ error: 'Game not found' });
    const machine = createGameStateMachine(state);
    const nextState = machine.transition(machine.initialState, { type: 'PLAYER_READY', playerId, strategy });
    await saveGameState(gameId, nextState.context);
    console.log('[WS BROADCAST] Broadcasting state_update for game', gameId);
    broadcastGameRoomState(gameId, nextState.context);
    broadcastGameEvent(gameId, { type: 'state_update', data: nextState.context });
    res.json({ gameId, state: nextState.context });
  } catch (err) {
    console.error('[READY] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/claim-spl', claimSplHandler);
router.post('/claim-abt', claimAbtHandler);

// --- CLAIM SYSTEM ENDPOINTS ---

// Get all claimable winnings for a player
router.get('/winnings/:playerId', async (req, res) => {
  const { playerId } = req.params;
  try {
    // Determine wallet type
    const isEth = playerId.startsWith('0x');
    
    let allWinnings = [];
    
    if (isEth) {
      // ETH: Pure on-chain, check smart contract directly
      // (Database entries would be redundant - smart contract is source of truth)
      console.log(`[WINNINGS] ETH wallet detected: ${playerId} - checking smart contract`);
      
      // Note: For ETH, the frontend handles on-chain checking directly
      // This endpoint could fetch from smart contract here too, but frontend already does it
      // For now, return empty since ETH frontend checks contract directly
      allWinnings = [];
      
    } else {
      // SPL: Pure on-chain, scan Solana blockchain directly
      try {
        console.log(`[WINNINGS] SPL wallet detected: ${playerId} - scanning Solana blockchain`);
        
        const onChainWinnings = await scanSolanaWinnings(playerId);
        
        // Only return real on-chain prizes
        for (const onChainWin of onChainWinnings) {
          allWinnings.push({
            id: `onchain-${onChainWin.address}`,
            player_id: playerId,
            game_id: onChainWin.gameId || `onchain-${onChainWin.address}`,
            amount: onChainWin.amount,
            currency: 'SPL',
            claimed: onChainWin.claimed,
            created_at: new Date().toISOString(),
            is_onchain: true,
            account_address: onChainWin.address
          });
        }
        
        console.log(`[WINNINGS] Found ${onChainWinnings.length} real on-chain SPL prizes for ${playerId}`);
      } catch (scanError) {
        console.error('[WINNINGS] Error scanning Solana blockchain:', scanError);
        // Don't fail the entire request if scanning fails
      }
    }
    
    res.json({ winnings: allWinnings });
  } catch (err) {
    console.error('[CLAIM] Error fetching winnings:', err);
    res.status(500).json({ error: 'Failed to fetch winnings' });
  }
});

// Helper function to scan Solana blockchain for winnings
async function scanSolanaWinnings(walletAddress) {
  const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
  const SOL_DEVNET_URL = process.env.SOL_DEVNET_URL || 'https://api.devnet.solana.com';
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  const winnings = [];
  
  try {
    // Get all accounts owned by the program
    const accounts = await connection.getProgramAccounts(programId, {
      encoding: 'base64'
    });
    
    for (const account of accounts) {
      try {
        const data = Buffer.from(account.account.data, 'base64');
        
        if (data.length < 40) continue; // Too small for game data
        
        let offset = 8; // Skip discriminator
        
        // Game ID (32 bytes)
        const gameId = data.slice(offset, offset + 32);
        offset += 32;
        
        // Winners vector length (4 bytes)
        const winnersLength = data.readUInt32LE(offset);
        offset += 4;
        
        if (winnersLength > 100) continue; // Suspicious
        
        // Check if we have enough data for all winners
        const winnersDataSize = winnersLength * 32;
        if (offset + winnersDataSize > data.length) continue;
        
        // Parse winners
        const winners = [];
        for (let j = 0; j < winnersLength; j++) {
          const winnerPubkey = new PublicKey(data.slice(offset, offset + 32));
          winners.push(winnerPubkey.toString());
          offset += 32;
        }
        
        // Check if this wallet is a winner
        const yourIndex = winners.indexOf(walletAddress);
        if (yourIndex !== -1) {
          // Parse amounts
          if (offset + 4 > data.length) continue;
          
          const amountsLength = data.readUInt32LE(offset);
          offset += 4;
          
          if (offset + amountsLength * 8 > data.length) continue;
          
          const amounts = [];
          for (let j = 0; j < amountsLength; j++) {
            const amount = data.readBigUInt64LE(offset);
            amounts.push(amount.toString());
            offset += 8;
          }
          
          if (yourIndex < amounts.length) {
            const yourAmount = amounts[yourIndex];
            const tokensAmount = Number(yourAmount) / 1_000_000;
            
            // Check claimed status
            let claimed = false;
            if (offset + 4 <= data.length) {
              const claimedLength = data.readUInt32LE(offset);
              offset += 4;
              
              if (yourIndex < claimedLength && offset + yourIndex < data.length) {
                claimed = data.readUInt8(offset + yourIndex) === 1;
              }
            }
            
            // Convert game ID to string if possible
            const gameIdString = gameId.toString().replace(/\0/g, '') || gameId.toString('hex');
            
            winnings.push({
              address: account.pubkey.toString(),
              gameId: gameIdString,
              amount: tokensAmount,
              claimed: claimed
            });
          }
        }
      } catch (parseError) {
        // Skip malformed accounts
        continue;
      }
    }
  } catch (error) {
    console.error('Error scanning Solana accounts:', error);
    throw error;
  }
  
  return winnings;
}

// Claim winnings (by id or gameId+playerId+currency)
router.post('/claim', async (req, res) => {
  const { playerId, gameId, currency } = req.body;
  if (!playerId || !gameId || !currency) {
    return res.status(400).json({ error: 'playerId, gameId, and currency are required' });
  }
  try {
    console.log(`[CLAIM] Attempting claim for playerId: ${playerId}, gameId: ${gameId}, currency: ${currency}`);
    
    // First, fetch the winning record
    const { rows } = await pool.query(
      `SELECT * FROM winnings WHERE LOWER(player_id) = LOWER($1) AND game_id = $2 AND currency = $3 AND claimed = false ORDER BY created_at DESC LIMIT 1`,
      [playerId, gameId, currency]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No claimable winnings found for this game' });
    }
    
    const win = rows[0];
    let payoutSuccess = false;
    
    if (currency === 'ABT') {
      // --- ABT payout: call withdraw() on ABTPrizePoolV2 as relayer ---
      try {
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        const relayer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const abtPrizePool = new ethers.Contract(
          process.env.ABT_PRIZE_POOL_V2,
          [
            "function winnings(address) view returns (uint256)",
            "function withdrawn(address) view returns (bool)",
            "function withdraw() external"
          ],
          relayer
        );
        // Check if already withdrawn
        const alreadyWithdrawn = await abtPrizePool.withdrawn(playerId);
        if (alreadyWithdrawn) {
          return res.status(400).json({ error: 'Winnings already withdrawn on-chain' });
        }
        console.log(`[CLAIM] Relayer address for withdraw: ${relayer.address}`);
        // The relayer can only withdraw its own winnings unless the contract supports relayer withdrawal for others
        if (relayer.address.toLowerCase() !== playerId.toLowerCase()) {
          return res.status(400).json({ error: 'Relayer cannot withdraw for this player. Use the player wallet to claim.' });
        }
        const tx = await abtPrizePool.withdraw();
        await tx.wait();
        payoutSuccess = true;
        console.log(`[CLAIM] ABT withdraw() tx sent for ${playerId}:`, tx.hash);
      } catch (err) {
        console.error('[CLAIM] ABT payout error:', err);
        return res.status(500).json({ error: 'Failed to payout ABT winnings' });
      }
    } else if (currency === 'SPL') {
      // --- SPL payout: call Solana program's claim instruction ---
      try {
        console.log(`[CLAIM] Processing SPL claim for ${win.amount} SPL to ${playerId} via Solana program`);
        
        // Validate environment variables
        if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
          console.error('[CLAIM] Missing SOL_PRIZE_POOL_PRIVATE_KEY environment variable');
          return res.status(500).json({ error: 'Server configuration error: missing Solana private key' });
        }
        
        if (!process.env.SOL_SPL_MINT) {
          console.error('[CLAIM] Missing SOL_SPL_MINT environment variable');
          return res.status(500).json({ error: 'Server configuration error: missing SPL mint address' });
        }
        
        let payer;
        try {
          const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
          payer = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
          console.log(`[CLAIM] Loaded payer wallet: ${payer.publicKey.toBase58()}`);
        } catch (keyErr) {
          console.error('[CLAIM] Failed to parse SOL_PRIZE_POOL_PRIVATE_KEY:', keyErr);
          return res.status(500).json({ error: 'Server configuration error: invalid Solana private key format' });
        }
        
        const connection = new Connection(process.env.SOL_DEVNET_URL || 'https://api.devnet.solana.com', 'confirmed');
        
        // Program and account setup
        const programId = new PublicKey('6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs');
        const mint = new PublicKey(process.env.SOL_SPL_MINT);
        const claimer = new PublicKey(playerId);
        
        // Derive PDAs  
        const [poolAuthority] = await PublicKey.findProgramAddress(
          [Buffer.from('pool')],
          programId
        );
        
        // Convert gameId to bytes32 for program
        const gameIdBytes = Buffer.alloc(32);
        const gameIdStr = gameId.replace(/-/g, '');
        const gameIdHex = Buffer.from(gameIdStr, 'hex');
        gameIdHex.copy(gameIdBytes, 0, 0, Math.min(16, gameIdHex.length));
        
        const [gamePda] = await PublicKey.findProgramAddress(
          [Buffer.from('game'), gameIdBytes],
          programId
        );
        
        // Token accounts
        const poolTokenAccount = await getAssociatedTokenAddress(mint, poolAuthority, true);
        const claimerTokenAccount = await getAssociatedTokenAddress(mint, claimer);
        
        console.log(`[CLAIM] SPL program claim details:`, {
          gameId,
          claimer: playerId,
          amount: win.amount,
          payerWallet: payer.publicKey.toBase58(),
          gamePda: gamePda.toBase58(),
          poolAuthority: poolAuthority.toBase58(),
          poolTokenAccount: poolTokenAccount.toBase58(),
          claimerTokenAccount: claimerTokenAccount.toBase58()
        });
        
        // First check if the game account exists
        try {
          const gameAccount = await connection.getAccountInfo(gamePda);
          if (!gameAccount) {
            console.error('[CLAIM] Game account does not exist - winners must be set first');
            return res.status(400).json({ error: 'Game winners not set yet. Please contact support.' });
          }
          console.log('[CLAIM] Game account exists, proceeding with claim');
        } catch (err) {
          console.error('[CLAIM] Error checking game account:', err);
          return res.status(500).json({ error: 'Failed to verify game state' });
        }
        
        // Create claim instruction with correct format from IDL
        const discriminator = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]); // claim instruction discriminator
        const instructionData = Buffer.concat([
          discriminator,
          gameIdBytes
        ]);
        
        const claimIx = new solanaWeb3.TransactionInstruction({
          keys: [
            { pubkey: gamePda, isSigner: false, isWritable: true },
            { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
            { pubkey: claimerTokenAccount, isSigner: false, isWritable: true },
            { pubkey: poolAuthority, isSigner: false, isWritable: false },
            { pubkey: claimer, isSigner: true, isWritable: false },
            { pubkey: solanaWeb3.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
          ],
          programId,
          data: instructionData
        });
        
        // Since the user isn't signing this transaction, we need the payer to sign it
        // But the program requires the claimer to be a signer, which creates a problem
        // This means users need to sign their own claim transactions
        console.error('[CLAIM] Program requires claimer to sign transaction - backend cannot claim on behalf of user');
        return res.status(400).json({ 
          error: 'On-chain claiming requires user signature. Please use the frontend claim button with your connected wallet.' 
        });
        
      } catch (err) {
        console.error('[CLAIM] SPL program claim error:', err);
        return res.status(500).json({ error: `Failed to process SPL claim: ${err.message}` });
      }
    } else {
      return res.status(400).json({ error: 'Unsupported currency for claim' });
    }
    
    if (payoutSuccess) {
      await pool.query(
        `UPDATE winnings SET claimed = true, claimed_at = NOW() WHERE id = $1`,
        [win.id]
      );
      console.log(`[CLAIM] Player ${playerId} claimed winnings for game ${gameId} (${currency}):`, win.amount);
      res.json({ success: true, winnings: [win] });
    } else {
      res.status(500).json({ error: 'Payout failed' });
    }
  } catch (err) {
    console.error('[CLAIM] Error processing claim:', err);
    res.status(500).json({ error: 'Failed to process claim' });
  }
});

// Add evolution endpoints - some protected, some public
router.post('/evolution/start', requireAdminAuth, evolutionController.startEvolution);
router.post('/evolution/stop', requireAdminAuth, evolutionController.stopEvolution);
router.get('/evolution/status', evolutionController.getStatus); // Public - read-only
router.get('/evolution/data', evolutionController.getCurrentData); // Public - read-only

app.use('/api', router);
app.use('/api/game-state', gameStateRouter);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

// Start the WebSocket server for lobby updates
startLobbyWebSocketServer(server);
// Start the WebSocket server for game room updates
startGameRoomWebSocketServer(server);
// Start the WebSocket server for evolution observatory
startEvolutionWebSocketServer(server);

// TODO: After implementing join/leave, call broadcastLobbyState() after those actions as well. 