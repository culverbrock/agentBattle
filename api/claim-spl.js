const { PublicKey, Connection, Keypair, sendAndConfirmTransaction, clusterApiUrl } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const MINT_ADDRESS = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const AMOUNT_TO_SEND = 100 * 1e6; // 100 tokens, 6 decimals
const DEVNET_URL = clusterApiUrl('devnet');
const KEYPAIR_PATH = path.join(require('os').homedir(), '.config', 'solana', 'id.json');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { address } = req.body;
  if (!address) {
    res.status(400).json({ error: 'Missing address' });
    return;
  }
  let recipient;
  try {
    recipient = new PublicKey(address);
  } catch (e) {
    res.status(400).json({ error: 'Invalid Solana address' });
    return;
  }
  try {
    const connection = new Connection(DEVNET_URL, 'confirmed');
    const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
    const payer = Keypair.fromSecretKey(Uint8Array.from(secret));
    const mint = new PublicKey(MINT_ADDRESS);
    // Get or create associated token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient);
    // Create transfer instruction
    const transferIx = createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      payer.publicKey,
      AMOUNT_TO_SEND,
      [],
      TOKEN_PROGRAM_ID
    );
    // Send transaction
    const txSig = await sendAndConfirmTransaction(
      connection,
      {
        feePayer: payer.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [transferIx],
        signers: [payer],
      }
    );
    res.status(200).json({ success: true, txSig });
  } catch (err) {
    console.error('Error sending SPL tokens:', err);
    res.status(500).json({ error: 'Failed to send SPL tokens' });
  }
}; 