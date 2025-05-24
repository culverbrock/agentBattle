const { JsonRpcProvider, Contract } = require('ethers');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getMint, getTokenAccountsByOwner } = require('@solana/spl-token');
const fetch = require('node-fetch');

const ABT_ADDRESS = '0x799b7b7cC889449952283CF23a15956920E7f85B';
const ABT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];
const SPL_MINT_ADDRESS = '7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// TODO: Replace with a persistent store or DB in production
const abtClaimers = [
  // Add known ABT claimers here for testnet, or fetch from logs/db
  '0x1234...abcd',
  '0x5678...efgh',
  '0x9abc...wxyz',
];

async function getAbtHoldersFromEtherscan() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.error('[leaderboard] ETHERSCAN_API_KEY not set');
    return [];
  }
  // Etherscan Sepolia endpoint
  const url = `https://api-sepolia.etherscan.io/api?module=token&action=tokenholderlist&contractaddress=${ABT_ADDRESS}&page=1&offset=100&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.result)) {
      console.error('[leaderboard] Etherscan error:', data);
      return [];
    }
    // data.result: [{TokenHolderAddress, TokenHolderQuantity}, ...]
    return data.result.map(holder => ({
      address: holder.TokenHolderAddress,
      abt: Number(holder.TokenHolderQuantity) / 1e18,
      spl: 0
    }));
  } catch (err) {
    console.error('[leaderboard] Error fetching from Etherscan:', err);
    return [];
  }
}

module.exports = async function handler(req, res) {
  console.log('[leaderboard] handler called', { method: req.method, url: req.url });
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    // --- ABT Holders (live from Etherscan) ---
    const abtResults = await getAbtHoldersFromEtherscan();
    console.log(`[leaderboard] ABT holders found: ${abtResults.length}`);
    // --- SPL Holders (live from Solana devnet) ---
    const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
    const mint = new PublicKey(SPL_MINT_ADDRESS);
    const tokenAccounts = await connection.getProgramAccounts(
      new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      {
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mint.toBase58() } },
        ],
      }
    );
    let splResults = [];
    for (const acc of tokenAccounts) {
      const owner = acc.account.data.slice(32, 64);
      const ownerPubkey = new PublicKey(owner);
      // Parse amount (8 bytes at offset 64)
      const amountBuf = acc.account.data.slice(64, 72);
      const amount = amountBuf.readBigUInt64LE();
      if (amount > 0n) {
        splResults.push({ address: ownerPubkey.toBase58(), abt: 0, spl: Number(amount) / 1e6 });
      }
    }
    console.log(`[leaderboard] SPL holders found: ${splResults.length}`);
    // Merge and dedupe by address
    const all = {};
    for (const row of abtResults.concat(splResults)) {
      if (!all[row.address]) all[row.address] = { address: row.address, abt: 0, spl: 0 };
      all[row.address].abt += row.abt;
      all[row.address].spl += row.spl;
    }
    // Sort by total (abt + spl)
    const leaderboard = Object.values(all).sort((a, b) => (b.abt + b.spl) - (a.abt + a.spl));
    console.log(`[leaderboard] Returning leaderboard with ${leaderboard.length} entries`);
    res.status(200).json(leaderboard);
  } catch (err) {
    console.error('[leaderboard] Error building leaderboard:', err);
    res.status(500).json({ error: 'Failed to build leaderboard' });
  }
}; 