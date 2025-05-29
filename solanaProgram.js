const { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } = require('@solana/web3.js');
const crypto = require('crypto');

const SOLANA_PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

// Authority keypair for calling set_winners (should be stored securely)
function getAuthorityKeypair() {
  // Try to load from environment variable (same as test files)
  if (process.env.SOL_PRIZE_POOL_PRIVATE_KEY) {
    try {
      const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
      return Keypair.fromSecretKey(Buffer.from(privateKeyArray));
    } catch (err) {
      console.error('[SOLANA] Failed to load SOL_PRIZE_POOL_PRIVATE_KEY:', err.message);
    }
  }
  
  // Fallback: deterministic keypair for demo purposes
  console.warn('[SOLANA] Using demo authority keypair. Set SOL_PRIZE_POOL_PRIVATE_KEY for production.');
  const seed = process.env.SOLANA_AUTHORITY_SEED || 'demo-authority-seed-change-in-production';
  const hash = crypto.createHash('sha256').update(seed).digest();
  return Keypair.fromSeed(hash.slice(0, 32));
}

// Calculate the discriminator for setWinners instruction (Anchor method)
function getSetWinnersDiscriminator() {
  const hash = crypto.createHash('sha256');
  hash.update('global:set_winners');
  const fullHash = hash.digest();
  return fullHash.slice(0, 8);
}

/**
 * Call set_winners on the Solana prize pool program
 * @param {string} gameId - The game ID 
 * @param {object} proposalDist - Winner distribution {playerId: percentage}
 * @param {number} totalAmount - Total prize pool amount
 */
async function setSolanaWinners(gameId, proposalDist, totalAmount) {
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const programId = new PublicKey(SOLANA_PROGRAM_ID);
  const authority = getAuthorityKeypair();
  
  console.log(`[SOLANA] Calling set_winners for game ${gameId}`);
  console.log(`[SOLANA] Authority: ${authority.publicKey.toBase58()}`);
  console.log(`[SOLANA] Proposal distribution:`, proposalDist);
  
  // Convert gameId (UUID string) to 32-byte array
  const gameIdBytes = Buffer.alloc(32);
  const gameIdStr = gameId.replace(/-/g, '');
  const gameIdHex = Buffer.from(gameIdStr, 'hex');
  gameIdHex.copy(gameIdBytes, 0, 0, Math.min(16, gameIdHex.length));
  
  // Extract winners and amounts from proposal
  const winners = [];
  const amounts = [];
  
  for (const [playerId, percentage] of Object.entries(proposalDist)) {
    try {
      // Convert playerId to PublicKey (assuming it's a Solana wallet address)
      const winnerPubkey = new PublicKey(playerId);
      const amount = Math.floor((Number(percentage) / 100) * totalAmount * 1_000_000); // Convert to SPL decimals (6)
      
      winners.push(winnerPubkey);
      amounts.push(BigInt(amount));
      
      console.log(`[SOLANA] Winner: ${playerId} gets ${amount} (${percentage}%)`);
    } catch (err) {
      console.error(`[SOLANA] Invalid winner address ${playerId}, skipping:`, err.message);
    }
  }
  
  if (winners.length === 0) {
    console.log('[SOLANA] No valid winners found, skipping set_winners call');
    return;
  }
  
  // Derive game account PDA
  const [gameAccount] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBytes],
    programId
  );
  
  console.log(`[SOLANA] Game account PDA: ${gameAccount.toBase58()}`);
  
  // Create set_winners instruction data using Anchor format
  const discriminator = getSetWinnersDiscriminator();
  console.log(`[SOLANA] Instruction discriminator: ${discriminator.toString('hex')}`);
  
  // Manual serialization (Anchor format)
  const gameIdArray = Array.from(gameIdBytes);
  const winnersArray = winners.map(w => w.toBytes());
  const amountsArray = amounts.map(a => {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(a);
    return buf;
  });
  
  // Serialize in Anchor format
  const instructionData = Buffer.concat([
    discriminator,
    Buffer.from(gameIdArray),
    Buffer.from([winnersArray.length, 0, 0, 0]), // u32 length prefix for winners vec
    Buffer.concat(winnersArray),
    Buffer.from([amountsArray.length, 0, 0, 0]), // u32 length prefix for amounts vec
    Buffer.concat(amountsArray)
  ]);
  
  console.log(`[SOLANA] Instruction data length: ${instructionData.length} bytes`);
  
  const setWinnersIx = new TransactionInstruction({
    keys: [
      { pubkey: gameAccount, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: new PublicKey('11111111111111111111111111111112'), isSigner: false, isWritable: false }, // System Program
    ],
    programId,
    data: instructionData
  });
  
  // Create and send transaction
  const transaction = new Transaction().add(setWinnersIx);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = authority.publicKey;
  
  // First simulate the transaction
  console.log('[SOLANA] Simulating transaction...');
  const simulation = await connection.simulateTransaction(transaction);
  console.log(`[SOLANA] Simulation success: ${!simulation.value.err}`);
  
  if (simulation.value.err) {
    console.error('[SOLANA] Simulation failed:', JSON.stringify(simulation.value.err));
    if (simulation.value.logs) {
      console.error('[SOLANA] Simulation logs:', simulation.value.logs);
    }
    throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }
  
  // Sign and send
  transaction.sign(authority);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  
  console.log(`[SOLANA] set_winners transaction sent: ${signature}`);
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
  console.log(`[SOLANA] set_winners confirmed for game ${gameId}`);
  
  return {
    signature,
    gameAccount: gameAccount.toBase58(),
    winners: winners.map(w => w.toBase58()),
    amounts: amounts.map(a => a.toString())
  };
}

module.exports = {
  setSolanaWinners
}; 