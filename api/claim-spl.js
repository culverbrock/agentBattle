const { PublicKey, Connection, Keypair, sendAndConfirmTransaction, clusterApiUrl, Transaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');

const MINT_ADDRESS = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const AMOUNT_TO_SEND = 100 * 1e6; // 100 tokens, 6 decimals
const DEVNET_URL = clusterApiUrl('devnet');

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
    if (!process.env.SOLANA_KEYPAIR) {
      res.status(500).json({ error: 'SOLANA_KEYPAIR env var not set' });
      return;
    }
    const secret = JSON.parse(process.env.SOLANA_KEYPAIR);
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
    // Build and send transaction
    const tx = new Transaction().add(transferIx);
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const txSig = await sendAndConfirmTransaction(
      connection,
      tx,
      [payer]
    );
    res.status(200).json({ success: true, txSig });
  } catch (err) {
    console.error('Error sending SPL tokens:', err);
    res.status(500).json({ error: 'Failed to send SPL tokens' });
  }
}; 