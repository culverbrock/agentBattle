const { isAddress, parseUnits, JsonRpcProvider, Wallet, Contract } = require('ethers');

const ABT_ADDRESS = '0x799b7b7cC889449952283CF23a15956920E7f85B';
const ABT_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];

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
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  try {
    const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new Wallet(process.env.FAUCET_PRIVATE_KEY, provider);
    const abt = new Contract(ABT_ADDRESS, ABT_ABI, wallet);
    const userBalance = await abt.balanceOf(address);
    if (userBalance.gte(parseUnits('100', 18))) {
      res.status(400).json({ error: 'You must have less than 100 ABT to claim.' });
      return;
    }
    const AMOUNT_TO_SEND = parseUnits('100', 18); // 100 ABT
    const tx = await abt.transfer(address, AMOUNT_TO_SEND);
    await tx.wait();
    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error('Error sending ABT:', err);
    res.status(500).json({ error: 'Failed to send ABT' });
  }
}; 