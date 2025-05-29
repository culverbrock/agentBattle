const { ethers } = require('ethers');
const { Keypair } = require('@solana/web3.js');

/**
 * Generate reserve pool wallets for cross-chain bridge system
 */
async function createReservePools() {
  console.log('🌉 Creating Cross-Chain Reserve Pools...\n');
  
  // Create ABT Reserve Pool (Ethereum)
  console.log('🔸 Creating ABT Reserve Pool (Ethereum)...');
  const abtReserveWallet = ethers.Wallet.createRandom();
  console.log(`ABT Reserve Address: ${abtReserveWallet.address}`);
  console.log(`ABT Reserve Private Key: ${abtReserveWallet.privateKey}`);
  console.log('');
  
  // Create SPL Reserve Pool (Solana)
  console.log('🔸 Creating SPL Reserve Pool (Solana)...');
  const splReserveKeypair = Keypair.generate();
  const splReservePrivateKeyArray = Array.from(splReserveKeypair.secretKey);
  console.log(`SPL Reserve Address: ${splReserveKeypair.publicKey.toBase58()}`);
  console.log(`SPL Reserve Private Key: ${JSON.stringify(splReservePrivateKeyArray)}`);
  console.log('');
  
  console.log('📋 Environment Variables to Add:');
  console.log('================================');
  console.log(`# ABT Reserve Pool (Ethereum)`);
  console.log(`ABT_RESERVE_POOL_ADDRESS=${abtReserveWallet.address}`);
  console.log(`ABT_RESERVE_PRIVATE_KEY=${abtReserveWallet.privateKey}`);
  console.log('');
  console.log(`# SPL Reserve Pool (Solana)`);
  console.log(`SPL_RESERVE_POOL_ADDRESS=${splReserveKeypair.publicKey.toBase58()}`);
  console.log(`SPL_RESERVE_PRIVATE_KEY='${JSON.stringify(splReservePrivateKeyArray)}'`);
  console.log('');
  
  console.log('⚠️  Next Steps:');
  console.log('1. Add the environment variables above to your .env file');
  console.log('2. Run: node fundReservePools.js (to fund with tokens + gas)');
  console.log('3. Test with: node testCrossChainPayout.js');
  console.log('');
  
  return {
    abt: {
      address: abtReserveWallet.address,
      privateKey: abtReserveWallet.privateKey
    },
    spl: {
      address: splReserveKeypair.publicKey.toBase58(),
      privateKey: JSON.stringify(splReservePrivateKeyArray)
    }
  };
}

// Run if called directly
if (require.main === module) {
  createReservePools().catch(console.error);
}

module.exports = { createReservePools }; 