const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

async function checkPoolAuthority() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const mint = new PublicKey('7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb');
  const programId = new PublicKey('6PtE7SKWtvFCUd4c2TfkkszEt1i6L3ho8wvmwWSAR7Vs');
  
  // Derive the pool authority PDA
  const [poolAuthority] = await PublicKey.findProgramAddress(
    [Buffer.from('pool')],
    programId
  );
  
  console.log('Pool Authority PDA:', poolAuthority.toBase58());
  
  // Get the associated token account for this PDA
  const poolTokenAccount = await getAssociatedTokenAddress(mint, poolAuthority, true);
  console.log('Pool Token Account:', poolTokenAccount.toBase58());
  
  // Check if the account exists and who owns it
  try {
    const accountInfo = await connection.getAccountInfo(poolTokenAccount);
    if (accountInfo) {
      console.log('✅ Pool token account exists');
      console.log('Owner:', accountInfo.owner.toBase58());
      
      // Parse token account data to see the authority
      const TOKEN_ACCOUNT_DATA_LENGTH = 165;
      if (accountInfo.data.length === TOKEN_ACCOUNT_DATA_LENGTH) {
        const authority = new PublicKey(accountInfo.data.slice(32, 64));
        console.log('Token Account Authority:', authority.toBase58());
        console.log('Does PDA match authority?', authority.equals(poolAuthority));
        
        // Check balance
        const balance = accountInfo.data.readBigUInt64LE(64);
        console.log('Token Balance:', balance.toString());
      }
    } else {
      console.log('❌ Pool token account does not exist!');
    }
  } catch (err) {
    console.error('Error checking pool token account:', err.message);
  }
  
  // Also check what account has the actual SPL tokens
  console.log('\n🔍 Checking actual token distribution...');
  const knownTokenAccount = new PublicKey('8CFx4ijkRfa6haYoRbbtDw3HAbBLF1ARFtZtE5AG4DFN');
  const knownAccountInfo = await connection.getAccountInfo(knownTokenAccount);
  if (knownAccountInfo && knownAccountInfo.data.length === 165) {
    const authority = new PublicKey(knownAccountInfo.data.slice(32, 64));
    const balance = knownAccountInfo.data.readBigUInt64LE(64);
    console.log('Known token account authority:', authority.toBase58());
    console.log('Known token account balance:', balance.toString());
  }
}

checkPoolAuthority().catch(console.error); 