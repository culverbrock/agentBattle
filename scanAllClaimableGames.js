const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';
const YOUR_WALLET = '8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN';

async function scanAllClaimableGames() {
  console.log('🔍 Scanning ALL Game Accounts for Your Wallet (NO FILTERS)');
  console.log('=========================================================');
  console.log(`Your Wallet: ${YOUR_WALLET}`);
  console.log(`Program ID: ${PROGRAM_ID}`);
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  try {
    console.log('\n📡 Fetching ALL program accounts (no size filter)...');
    
    // Get ALL accounts owned by the program - NO FILTERS!
    const accounts = await connection.getProgramAccounts(programId, {
      encoding: 'base64'
      // NO filters - find everything!
    });
    
    console.log(`Found ${accounts.length} total accounts owned by program`);
    
    if (accounts.length === 0) {
      console.log('❌ No accounts found!');
      return;
    }
    
    console.log('\n📋 Analyzing each account (all sizes)...');
    
    let foundGamesForYou = 0;
    let totalClaimableAmount = 0;
    const gameAccounts = [];
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const pubkey = account.pubkey.toString();
      const data = Buffer.from(account.account.data, 'base64');
      
      console.log(`\n--- Account ${i + 1}: ${pubkey} ---`);
      console.log(`Data length: ${data.length} bytes`);
      console.log(`Lamports: ${account.account.lamports}`);
      
      if (data.length < 8) {
        console.log('⚠️ Account too small (< 8 bytes)');
        continue;
      }
      
      // Show discriminator for all accounts
      const discriminator = data.slice(0, 8);
      console.log(`Discriminator: [${Array.from(discriminator).join(', ')}]`);
      
      try {
        // Try to parse as game account
        let offset = 8; // Skip discriminator
        
        if (data.length < 40) {
          console.log('⚠️ Too small for full game data, but checking...');
          continue;
        }
        
        // Game ID (32 bytes)
        const gameId = data.slice(offset, offset + 32);
        offset += 32;
        
        // Check if we have enough data for winners length
        if (offset + 4 > data.length) {
          console.log('⚠️ Not enough data for winners length');
          continue;
        }
        
        // Winners vector length (4 bytes)
        const winnersLength = data.readUInt32LE(offset);
        offset += 4;
        
        const gameIdHex = gameId.toString('hex');
        const gameIdString = gameId.toString().replace(/\0/g, '');
        
        console.log(`Game ID (hex): ${gameIdHex}`);
        console.log(`Game ID (string): "${gameIdString}"`);
        console.log(`Number of winners: ${winnersLength}`);
        
        if (winnersLength > 100) {
          console.log('⚠️ Suspicious winners count, skipping...');
          continue;
        }
        
        // Check if we have enough data for all winners
        const winnersDataSize = winnersLength * 32;
        if (offset + winnersDataSize > data.length) {
          console.log(`⚠️ Not enough data for ${winnersLength} winners`);
          continue;
        }
        
        // Parse winners
        const winners = [];
        for (let j = 0; j < winnersLength; j++) {
          const winnerPubkey = new PublicKey(data.slice(offset, offset + 32));
          winners.push(winnerPubkey.toString());
          offset += 32;
        }
        
        console.log(`Winners: [${winners.join(', ')}]`);
        
        // Check if you're a winner
        const yourIndex = winners.indexOf(YOUR_WALLET);
        if (yourIndex !== -1) {
          console.log(`🎉 YOU ARE WINNER #${yourIndex}!`);
          foundGamesForYou++;
          
          // Check if we have enough data for amounts
          if (offset + 4 > data.length) {
            console.log('⚠️ Not enough data for amounts length');
            continue;
          }
          
          // Parse amounts vector length
          const amountsLength = data.readUInt32LE(offset);
          offset += 4;
          
          console.log(`Amounts count: ${amountsLength}`);
          
          // Check if we have enough data for all amounts
          if (offset + amountsLength * 8 > data.length) {
            console.log(`⚠️ Not enough data for ${amountsLength} amounts`);
            continue;
          }
          
          // Parse amounts
          const amounts = [];
          for (let j = 0; j < amountsLength; j++) {
            const amount = data.readBigUInt64LE(offset);
            amounts.push(amount.toString());
            offset += 8;
          }
          
          console.log(`Amounts: [${amounts.join(', ')}]`);
          
          if (yourIndex < amounts.length) {
            const yourAmount = amounts[yourIndex];
            const tokensAmount = Number(yourAmount) / 1_000_000;
            console.log(`💰 Your prize amount: ${yourAmount} (${tokensAmount} tokens)`);
            totalClaimableAmount += Number(yourAmount);
            
            // Check if we have enough data for claimed status
            if (offset + 4 <= data.length) {
              const claimedLength = data.readUInt32LE(offset);
              offset += 4;
              
              if (yourIndex < claimedLength && offset + yourIndex < data.length) {
                const claimed = data.readUInt8(offset + yourIndex) === 1;
                console.log(`🎫 Claimed status: ${claimed ? '✅ Already claimed' : '⏳ Available to claim'}`);
                
                if (!claimed) {
                  console.log(`🚀 CLAIMABLE GAME FOUND!`);
                  gameAccounts.push({
                    address: pubkey,
                    gameId: gameIdString || gameIdHex,
                    amount: tokensAmount,
                    claimed: false
                  });
                }
              } else {
                console.log('⚠️ Cannot determine claimed status');
                // Assume unclaimed for now
                gameAccounts.push({
                  address: pubkey,
                  gameId: gameIdString || gameIdHex,
                  amount: tokensAmount,
                  claimed: false
                });
              }
            } else {
              console.log('⚠️ No claimed status data');
              gameAccounts.push({
                address: pubkey,
                gameId: gameIdString || gameIdHex,
                amount: tokensAmount,
                claimed: false
              });
            }
          }
        } else {
          console.log('❌ You are not a winner in this game');
        }
        
      } catch (parseError) {
        console.log(`❌ Error parsing account: ${parseError.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 COMPLETE SUMMARY FOR ${YOUR_WALLET}:`);
    console.log(`Total accounts scanned: ${accounts.length}`);
    console.log(`Games where you're a winner: ${foundGamesForYou}`);
    console.log(`Total claimable amount: ${totalClaimableAmount / 1_000_000} tokens`);
    
    if (gameAccounts.length > 0) {
      console.log('\n🎁 CLAIMABLE GAMES FOUND:');
      gameAccounts.forEach((game, index) => {
        console.log(`${index + 1}. Game: ${game.gameId}`);
        console.log(`   Address: ${game.address}`);
        console.log(`   Amount: ${game.amount} tokens`);
        console.log(`   Status: ${game.claimed ? 'Claimed' : 'Available'}`);
      });
      
      console.log('\n💡 Your claim page should show ALL of these games!');
      console.log('💡 If it\'s missing any, there might be a filter issue.');
    }
    
    if (foundGamesForYou === 0) {
      console.log('\n🤔 Still no games found. This is very strange...');
    }
    
  } catch (error) {
    console.error('❌ Error scanning accounts:', error.message);
  }
}

async function main() {
  try {
    await scanAllClaimableGames();
  } catch (err) {
    console.error('Scan failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 