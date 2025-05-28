/**
 * @route POST /api/games/[gameId]/join
 * @desc Join a game (Vercel serverless function)
 * @body { playerId: string, name: string }
 * @returns { player }
 */
const pool = require('../../../database');
const ethers = require('ethers');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAccount } = require('@solana/spl-token');
const ABT_ADDRESS = process.env.ABT_TOKEN_ADDRESS || '0x799b7b7cC889449952283CF23a15956920E7f85B';
const PRIZE_POOL_CA = process.env.PRIZE_POOL_CA || '0x94Aba2204C686f41a1fC7dd5DBaA56172844593a';
const SOL_PRIZE_POOL_TOKEN_ACCOUNT = process.env.SOL_PRIZE_POOL_TOKEN_ACCOUNT || 'AhKmoZR7KHQzUYpV9WEAR8FBLi4SxXAAcMSfYTPnH4he';
const SPL_MINT_ADDRESS = process.env.SOL_SPL_MINT || '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { playerId, tx, chain } = req.body;
  const { gameId } = req.query;
  if (!playerId || !tx || !chain) {
    res.status(400).json({ error: 'playerId, tx, and chain are required' });
    return;
  }
  try {
    let paymentConfirmed = false;
    let amount = 0;
    if (chain === 'eth') {
      // Verify ABT transfer to prize pool contract
      const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      const receipt = await provider.getTransactionReceipt(tx);
      if (!receipt || receipt.status !== 1) throw new Error('Transaction not confirmed');
      // Check logs for transfer
      const iface = new ethers.Interface([
        "event Transfer(address indexed from, address indexed to, uint256 value)"
      ]);
      const logs = receipt.logs.filter(l => l.address.toLowerCase() === ABT_ADDRESS.toLowerCase());
      for (const log of logs) {
        try {
          const parsed = iface.parseLog(log);
          if (
            parsed.args.from.toLowerCase() === playerId.toLowerCase() &&
            parsed.args.to.toLowerCase() === PRIZE_POOL_CA.toLowerCase() &&
            parsed.args.value.toString() === ethers.parseUnits('100', 18).toString()
          ) {
            paymentConfirmed = true;
            amount = 100;
            break;
          }
        } catch {}
      }
    } else if (chain === 'sol') {
      // Verify SPL transfer to prize pool token account
      const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
      const txInfo = await connection.getParsedTransaction(tx, { commitment: 'confirmed' });
      if (!txInfo) throw new Error('Transaction not found');
      const instructions = txInfo.transaction.message.instructions;
      for (const ix of instructions) {
        if (
          ix.program === 'spl-token' &&
          ix.parsed &&
          ix.parsed.type === 'transfer' &&
          ix.parsed.info.source &&
          ix.parsed.info.destination === SOL_PRIZE_POOL_TOKEN_ACCOUNT &&
          ix.parsed.info.authority === playerId &&
          Number(ix.parsed.info.amount) === 100 * 10 ** 6
        ) {
          paymentConfirmed = true;
          amount = 100;
          break;
        }
      }
    }
    if (!paymentConfirmed) {
      res.status(400).json({ error: 'Payment not confirmed on-chain' });
      return;
    }
    // Store payment record in payments table
    const currency = chain === 'eth' ? 'ABT' : 'SPL';
    await pool.query(
      `INSERT INTO payments (game_id, player_id, amount, currency, tx_hash, chain, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [gameId, playerId, amount, currency, tx, chain]
    );
    // Add player to game
    const query = `INSERT INTO players (id, name, status, game_id) VALUES ($1, $2, 'connected', $3)
      ON CONFLICT (id) DO UPDATE SET name = $2, status = 'connected', game_id = $3 RETURNING *`;
    const { rows } = await pool.query(query, [playerId, playerId, gameId]);
    res.status(200).json({ ...rows[0], payment: { tx, chain, amount } });
  } catch (err) {
    console.error('Error joining game:', err);
    res.status(500).json({ error: 'Failed to join game' });
  }
} 