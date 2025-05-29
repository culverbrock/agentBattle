require('dotenv').config();
const { ethers } = require('ethers');
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { transfer, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } = require('@solana/spl-token');

/**
 * Fund reserve pools with gas tokens and initial token balances
 */
async function fundReservePools() {
  console.log('💰 Funding Cross-Chain Reserve Pools...\n');
  
  // Validate environment variables
  const requiredVars = [
    'ABT_RESERVE_POOL_ADDRESS',
    'SPL_RESERVE_POOL_ADDRESS', 
    'DEPLOYER_PRIVATE_KEY',
    'SOL_PRIZE_POOL_PRIVATE_KEY',
    'ABT_TOKEN_ADDRESS',
    'SOL_SPL_MINT',
    'SEPOLIA_RPC_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.log('Make sure you have added the reserve pool env vars and existing wallet vars.');
    return;
  }
  
  try {
    await fundABTReserve();
    console.log('');
    await fundSPLReserve();
    console.log('');
    console.log('✅ Reserve pool funding completed successfully!');
    console.log('🧪 Now run: node testCrossChainPayout.js');
  } catch (error) {
    console.error('❌ Reserve pool funding failed:', error.message);
  }
}

/**
 * Fund ABT Reserve with ETH (gas) and ABT tokens
 */
async function fundABTReserve() {
  console.log('🔸 Funding ABT Reserve Pool (Ethereum)...');
  
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const deployerWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const abtReserveAddress = process.env.ABT_RESERVE_POOL_ADDRESS;
  
  console.log(`Deployer wallet: ${deployerWallet.address}`);
  console.log(`ABT Reserve address: ${abtReserveAddress}`);
  
  // Check deployer balances
  const ethBalance = await provider.getBalance(deployerWallet.address);
  console.log(`Deployer ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
  
  // 1. Fund with ETH for gas (0.01 ETH)
  const ethToSend = ethers.parseEther('0.01');
  if (ethBalance > ethToSend) {
    console.log('Sending 0.01 ETH for gas...');
    const ethTx = await deployerWallet.sendTransaction({
      to: abtReserveAddress,
      value: ethToSend
    });
    await ethTx.wait();
    console.log(`✅ ETH sent: ${ethTx.hash}`);
  } else {
    console.log('⚠️  Insufficient ETH for gas funding');
  }
  
  // 2. Fund with ABT tokens (10000 ABT)
  const abtContract = new ethers.Contract(
    process.env.ABT_TOKEN_ADDRESS,
    ['function transfer(address to, uint256 amount) returns (bool)', 'function balanceOf(address) view returns (uint256)'],
    deployerWallet
  );
  
  const abtBalance = await abtContract.balanceOf(deployerWallet.address);
  console.log(`Deployer ABT balance: ${ethers.formatUnits(abtBalance, 18)} ABT`);
  
  const abtToSend = ethers.parseUnits('10000', 18);
  if (abtBalance >= abtToSend) {
    console.log('Sending 10000 ABT...');
    const abtTx = await abtContract.transfer(abtReserveAddress, abtToSend);
    await abtTx.wait();
    console.log(`✅ ABT sent: ${abtTx.hash}`);
  } else {
    console.log('⚠️  Insufficient ABT for token funding');
  }
}

/**
 * Fund SPL Reserve with SOL (gas) and SPL tokens
 */
async function fundSPLReserve() {
  console.log('🔸 Funding SPL Reserve Pool (Solana)...');
  
  const connection = new Connection(process.env.SOL_DEVNET_URL || 'https://api.devnet.solana.com', 'confirmed');
  const deployerKeypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY)));
  const splReserveAddress = new PublicKey(process.env.SPL_RESERVE_POOL_ADDRESS);
  
  console.log(`Deployer wallet: ${deployerKeypair.publicKey.toBase58()}`);
  console.log(`SPL Reserve address: ${splReserveAddress.toBase58()}`);
  
  // Check deployer balances
  const solBalance = await connection.getBalance(deployerKeypair.publicKey);
  console.log(`Deployer SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  
  // 1. Fund with SOL for gas (0.1 SOL)
  const solToSend = 0.1 * LAMPORTS_PER_SOL;
  if (solBalance > solToSend) {
    console.log('Sending 0.1 SOL for gas...');
    const solTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: deployerKeypair.publicKey,
        toPubkey: splReserveAddress,
        lamports: solToSend
      })
    );
    
    const solTxSig = await connection.sendTransaction(solTx, [deployerKeypair]);
    await connection.confirmTransaction(solTxSig);
    console.log(`✅ SOL sent: ${solTxSig}`);
  } else {
    console.log('⚠️  Insufficient SOL for gas funding');
  }
  
  // 2. Fund with SPL tokens (1000 SPL)
  const mintAddress = new PublicKey(process.env.SOL_SPL_MINT);
  
  // Get deployer's token account
  const deployerTokenAccount = await getAssociatedTokenAddress(mintAddress, deployerKeypair.publicKey);
  
  // Get or create reserve's token account
  const reserveTokenAccount = await getAssociatedTokenAddress(mintAddress, splReserveAddress);
  
  try {
    // Check if reserve token account exists
    await getAccount(connection, reserveTokenAccount);
    console.log('Reserve token account already exists');
  } catch (error) {
    // Create reserve token account if it doesn't exist
    console.log('Creating reserve token account...');
    const createAccountTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        deployerKeypair.publicKey, // payer
        reserveTokenAccount,       // token account
        splReserveAddress,         // owner
        mintAddress               // mint
      )
    );
    
    const createSig = await connection.sendTransaction(createAccountTx, [deployerKeypair]);
    await connection.confirmTransaction(createSig);
    console.log(`✅ Token account created: ${createSig}`);
  }
  
  // Transfer SPL tokens
  const splToSend = 10000 * 1_000_000; // 10000 SPL (6 decimals)
  console.log('Sending 10000 SPL...');
  
  const transferSig = await transfer(
    connection,
    deployerKeypair,
    deployerTokenAccount,
    reserveTokenAccount,
    deployerKeypair,
    splToSend
  );
  
  console.log(`✅ SPL sent: ${transferSig}`);
}

// Run if called directly
if (require.main === module) {
  fundReservePools().catch(console.error);
}

module.exports = { fundReservePools }; 