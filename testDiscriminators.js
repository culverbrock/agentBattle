const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction, 
  SystemProgram 
} = require('@solana/web3.js');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const PROGRAM_ID = '6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs';
const SOL_DEVNET_URL = 'https://api.devnet.solana.com';

// Calculate discriminator using different methods
function getDiscriminator(name) {
  const hash = crypto.createHash('sha256');
  hash.update(`global:${name}`);
  return hash.digest().slice(0, 8);
}

async function testDifferentDiscriminators() {
  console.log('🔍 Testing Different Discriminators');
  console.log('==================================');
  
  const connection = new Connection(SOL_DEVNET_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);
  
  // Load wallet
  const privateKeyArray = JSON.parse(process.env.SOL_PRIZE_POOL_PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(Buffer.from(privateKeyArray));
  
  // Try different instruction name variations
  const nameVariations = [
    'setWinners',           // CamelCase
    'set_winners',          // Snake case (Rust function name)
    'set-winners',          // Kebab case
    'SetWinners',           // PascalCase
    'winners_set',          // Alternative
    'winnersSet',           // Alternative camelCase
  ];
  
  console.log('Discriminator variations:');
  nameVariations.forEach(name => {
    const disc = getDiscriminator(name);
    console.log(`  ${name.padEnd(15)}: [${Array.from(disc).join(', ')}]`);
  });
  
  // Test game data
  const timestamp = Date.now().toString();
  const gameId = `discriminator-test-${timestamp}`;
  const gameIdBuffer = Buffer.alloc(32);
  const hash = Buffer.from(gameId).toString('hex').padEnd(64, '0');
  for (let i = 0; i < 32; i++) {
    gameIdBuffer[i] = parseInt(hash.substr(i * 2, 2), 16);
  }
  
  const winner = new PublicKey("8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN");
  const winners = [winner];
  const amounts = [BigInt(100_000_000)];
  
  // Derive game PDA
  const [gamePda] = await PublicKey.findProgramAddress(
    [Buffer.from('game'), gameIdBuffer],
    programId
  );
  
  console.log(`\nGame PDA: ${gamePda.toString()}`);
  
  // Check if account exists
  const existingAccount = await connection.getAccountInfo(gamePda);
  if (existingAccount) {
    console.log('⚠️ Game account already exists, skipping test...');
    return;
  }
  
  // Try each discriminator
  for (const name of nameVariations) {
    console.log(`\n🔄 Testing discriminator for "${name}"...`);
    
    const discriminator = getDiscriminator(name);
    
    // Serialize data
    const winnersLength = Buffer.alloc(4);
    winnersLength.writeUInt32LE(winners.length);
    const winnersData = Buffer.concat([
      winnersLength,
      ...winners.map(pk => pk.toBuffer())
    ]);
    
    const amountsLength = Buffer.alloc(4);
    amountsLength.writeUInt32LE(amounts.length);
    const amountsData = Buffer.concat([
      amountsLength,
      ...amounts.map(amount => {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(amount);
        return buf;
      })
    ]);
    
    const instructionData = Buffer.concat([
      discriminator,
      gameIdBuffer,
      winnersData,
      amountsData
    ]);
    
    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: gamePda, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId,
      data: instructionData
    });
    
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    try {
      // Simulate the transaction
      const simulation = await connection.simulateTransaction(transaction);
      
      if (!simulation.value.err) {
        console.log(`✅ SUCCESS with "${name}"!`);
        console.log(`   Discriminator: [${Array.from(discriminator).join(', ')}]`);
        
        // Try to send the actual transaction
        console.log('   Sending actual transaction...');
        const txHash = await connection.sendTransaction(transaction, [wallet]);
        console.log(`   ✅ Transaction: ${txHash}`);
        
        await connection.confirmTransaction(txHash);
        console.log('   ✅ Transaction confirmed!');
        
        return; // Stop on success
        
      } else {
        const error = simulation.value.err;
        if (error && error.InstructionError && error.InstructionError[1].Custom === 101) {
          console.log(`   ❌ ${name}: InstructionFallbackNotFound (wrong discriminator)`);
        } else {
          console.log(`   ⚠️ ${name}: ${JSON.stringify(error)} (might be right discriminator, different issue)`);
          if (simulation.value.logs) {
            simulation.value.logs.forEach(log => console.log(`      ${log}`));
          }
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ${name}: ${error.message}`);
    }
  }
  
  console.log('\n❌ None of the discriminators worked. The program might use a different naming scheme.');
}

async function main() {
  try {
    await testDifferentDiscriminators();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error); 