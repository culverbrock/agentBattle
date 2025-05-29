require('dotenv').config();
const ethers = require('ethers');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { createMintToInstruction, createBurnInstruction, getAssociatedTokenAddress, transfer, TOKEN_PROGRAM_ID } = require('@solana/spl-token');

// ENV/config
const ABT_TOKEN_ADDRESS = process.env.ABT_TOKEN_ADDRESS;
const ABT_PRIZE_POOL_V3 = process.env.ABT_PRIZE_POOL_V3;
const SPL_MINT_ADDRESS = process.env.SOL_SPL_MINT;
const SOL_PRIZE_POOL_TOKEN_ACCOUNT = process.env.SOL_PRIZE_POOL_TOKEN_ACCOUNT;
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Reserve pool addresses (controlled by backend)
const ABT_RESERVE_POOL = process.env.ABT_RESERVE_POOL_ADDRESS; // Backend-controlled wallet with ABT
const SPL_RESERVE_POOL = process.env.SPL_RESERVE_POOL_ADDRESS; // Backend-controlled wallet with SPL

// --- Cross-Chain Bridge Functions ---

/**
 * Handle cross-chain payout when one chain lacks sufficient funds
 * @param {string} deficitCurrency - Currency that needs more funds (ABT or SPL)
 * @param {number} deficitAmount - Amount needed beyond what's available
 * @param {string} surplusCurrency - Currency with excess funds
 * @param {number} surplusAmount - Amount of excess funds available
 */
async function handleCrossChainPayout(deficitCurrency, deficitAmount, surplusCurrency, surplusAmount) {
  console.log(`[BRIDGE] Cross-chain payout needed:`);
  console.log(`[BRIDGE] - ${deficitCurrency} deficit: ${deficitAmount}`);
  console.log(`[BRIDGE] - ${surplusCurrency} surplus: ${surplusAmount}`);
  
  if (deficitAmount > surplusAmount) {
    throw new Error(`Insufficient total funds: deficit ${deficitAmount} > surplus ${surplusAmount}`);
  }
  
  // Validate environment variables
  const missingVars = [];
  if (!ABT_RESERVE_POOL) missingVars.push('ABT_RESERVE_POOL_ADDRESS');
  if (!SPL_RESERVE_POOL) missingVars.push('SPL_RESERVE_POOL_ADDRESS');
  if (!process.env.ABT_RESERVE_PRIVATE_KEY) missingVars.push('ABT_RESERVE_PRIVATE_KEY');
  if (!process.env.SPL_RESERVE_PRIVATE_KEY) missingVars.push('SPL_RESERVE_PRIVATE_KEY');
  if (!process.env.SOL_PRIZE_POOL_PRIVATE_KEY) missingVars.push('SOL_PRIZE_POOL_PRIVATE_KEY');
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}. Run 'node createReservePools.js' to generate them.`);
  }
  
  try {
    if (deficitCurrency === 'ABT') {
      // Transfer reserve ABT to prize pool to cover deficit
      console.log(`[BRIDGE] Transferring ${deficitAmount} ABT from reserve to prize pool`);
      await transferABTFromReserve(deficitAmount);
      console.log(`[BRIDGE] ✅ ABT deficit covered. Surplus ${surplusAmount} ${surplusCurrency} remains in prize pool for future games.`);
    } else if (deficitCurrency === 'SPL') {
      // Transfer reserve SPL to prize pool to cover deficit  
      console.log(`[BRIDGE] Transferring ${deficitAmount} SPL from reserve to prize pool`);
      await transferSPLFromReserve(deficitAmount);
      console.log(`[BRIDGE] ✅ SPL deficit covered. Surplus ${surplusAmount} ${surplusCurrency} remains in prize pool for future games.`);
    }
    
    console.log(`[BRIDGE] Cross-chain payout completed successfully`);
  } catch (err) {
    console.error(`[BRIDGE] Cross-chain payout failed:`, err);
    throw err;
  }
}

// --- ABT (Ethereum) Functions ---
async function transferABTToReserve(amount) {
  console.log(`[BRIDGE] Transferring ${amount} ABT from prize pool to reserve`);
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  const abt = new ethers.Contract(ABT_TOKEN_ADDRESS, [
    "function transfer(address to, uint256 amount) returns (bool)"
  ], signer);
  
  const amountWei = ethers.parseUnits(amount.toString(), 18);
  const tx = await abt.transfer(ABT_RESERVE_POOL, amountWei);
  await tx.wait();
  console.log(`[BRIDGE] ABT transfer to reserve completed: ${tx.hash}`);
}

async function transferABTFromReserve(amount) {
  console.log(`[BRIDGE] Transferring ${amount} ABT from reserve to prize pool`);
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const reserveSigner = new ethers.Wallet(process.env.ABT_RESERVE_PRIVATE_KEY, provider);
  
  const abt = new ethers.Contract(ABT_TOKEN_ADDRESS, [
    "function transfer(address to, uint256 amount) returns (bool)"
  ], reserveSigner);
  
  const amountWei = ethers.parseUnits(amount.toString(), 18);
  const tx = await abt.transfer(ABT_PRIZE_POOL_V3, amountWei);
  await tx.wait();
  console.log(`[BRIDGE] ABT transfer from reserve completed: ${tx.hash}`);
}

// --- SPL (Solana) Functions ---
async function transferSPLToReserve(amount) {
  console.log(`[BRIDGE] Transferring ${amount} SPL from prize pool to reserve`);
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const payer = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY)));
  
  const reserveTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(SPL_MINT_ADDRESS),
    new PublicKey(SPL_RESERVE_POOL)
  );
  
  const amountLamports = amount * 1_000_000; // Convert to SPL decimals (6)
  
  const signature = await transfer(
    connection,
    payer,
    new PublicKey(SOL_PRIZE_POOL_TOKEN_ACCOUNT),
    reserveTokenAccount,
    payer,
    amountLamports
  );
  
  console.log(`[BRIDGE] SPL transfer to reserve completed: ${signature}`);
}

async function transferSPLFromReserve(amount) {
  console.log(`[BRIDGE] Transferring ${amount} SPL from reserve to prize pool`);
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const reservePayer = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.SPL_RESERVE_PRIVATE_KEY)));
  
  const reserveTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(SPL_MINT_ADDRESS),
    reservePayer.publicKey
  );
  
  const amountLamports = amount * 1_000_000; // Convert to SPL decimals (6)
  
  const signature = await transfer(
    connection,
    reservePayer,
    reserveTokenAccount,
    new PublicKey(SOL_PRIZE_POOL_TOKEN_ACCOUNT),
    reservePayer,
    amountLamports
  );
  
  console.log(`[BRIDGE] SPL transfer from reserve completed: ${signature}`);
}

// --- Legacy Stub Functions (Keep for backward compatibility) ---
async function burnABT(amount, provider, signer) {
  console.log(`[BRIDGE] burnABT called - using reserve system instead`);
}

async function mintABT(to, amount, provider, signer) {
  console.log(`[BRIDGE] mintABT called - using reserve system instead`);
}

async function burnSPL(amount, payer, connection) {
  console.log(`[BRIDGE] burnSPL called - using reserve system instead`);
}

async function mintSPL(to, amount, payer, connection) {
  console.log(`[BRIDGE] mintSPL called - using reserve system instead`);
}

module.exports = {
  handleCrossChainPayout,
  transferABTToReserve,
  transferABTFromReserve,
  transferSPLToReserve,
  transferSPLFromReserve,
  burnABT,
  mintABT,
  burnSPL,
  mintSPL
}; 