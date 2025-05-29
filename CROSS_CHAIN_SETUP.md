# 🌉 Cross-Chain Bridge System

## 🎯 **Problem Solved**

The system handles cross-chain liquidity imbalances when prize distributions don't match entry fee distributions.

### **Example Scenario:**
- **Entry Fees**: 100 ABT + 100 SPL = 200 total "prize units"
- **Winning Proposal**: 90% to ABT player (180 ABT), 10% to SPL player (20 SPL)
- **Problem**: Need 180 ABT but only have 100 ABT in pool!
- **Solution**: Use 80 excess SPL to cover the 80 ABT deficit via reserve system

## 🏗️ **Architecture**

### **Reserve Pool System**
Instead of burning/minting tokens across chains, we maintain reserve pools that act as cross-chain liquidity buffers:

1. **ABT Reserve Pool** (Ethereum wallet with ABT tokens)
2. **SPL Reserve Pool** (Solana wallet with SPL tokens)
3. **Smart Transfer Logic** that moves funds between prize pools and reserves as needed

### **How It Works**
1. **Game Ends**: System calculates what each winner should receive in their preferred currency
2. **Deficit Detection**: If one chain lacks sufficient funds, detect the deficit
3. **Cross-Chain Transfer**: Move excess funds from surplus chain to reserve, move reserve funds from deficit chain to prize pool
4. **Normal Payout**: Winners claim as usual from their respective prize pools

## ⚙️ **Configuration Required**

### **Environment Variables**
```bash
# Existing variables (already configured)
ABT_TOKEN_ADDRESS=0x799b7b7cC889449952283CF23a15956920E7f85B
ABT_PRIZE_POOL_V3=0xa2852c3da70A7A481cE97a1E5bde7Da37EFB0c36
SOL_SPL_MINT=7iJY63ffm5Q7QC6mxb6v3QECMv2Ss4E5UcMmmdaMfFCb
SOL_PRIZE_POOL_TOKEN_ACCOUNT=Fp9wXBYossFZmR29EGgpLzC5GAwBUZHgoeuN834WtDup
DEPLOYER_PRIVATE_KEY=[existing]
SOL_PRIZE_POOL_PRIVATE_KEY=[existing]

# NEW: Reserve pool configuration
ABT_RESERVE_POOL_ADDRESS=[ABT reserve wallet address]
ABT_RESERVE_PRIVATE_KEY=[ABT reserve wallet private key]
SPL_RESERVE_POOL_ADDRESS=[SPL reserve wallet address] 
SPL_RESERVE_PRIVATE_KEY=[SPL reserve wallet private key - JSON array format]
```

### **Setup Steps**

1. **Create Reserve Wallets**
   ```bash
   node createReservePools.js
   ```

2. **Fund Reserve Pools**
   - Transfer initial ABT to ABT reserve (e.g., 10,000 ABT)
   - Transfer initial SPL to SPL reserve (e.g., 10,000 SPL)

3. **Test Cross-Chain Scenarios**
   ```bash
   node testCrossChainPayout.js
   ```

## 🔄 **Flow Examples**

### **Scenario 1: ABT Deficit**
- **Entry Fees**: 100 ABT + 300 SPL
- **Payouts**: 350 ABT needed, 50 SPL needed
- **Action**: Transfer 250 SPL to reserve → Transfer 250 ABT from reserve to prize pool

### **Scenario 2: SPL Deficit**  
- **Entry Fees**: 300 ABT + 100 SPL
- **Payouts**: 50 ABT needed, 350 SPL needed
- **Action**: Transfer 250 ABT to reserve → Transfer 250 SPL from reserve to prize pool

### **Scenario 3: Balanced**
- **Entry Fees**: 200 ABT + 200 SPL  
- **Payouts**: 200 ABT needed, 200 SPL needed
- **Action**: No cross-chain transfers needed

## ⚡ **Benefits**

1. **Scalable**: Works at any volume - deficits and surpluses balance over time
2. **No Token Burning**: Preserves total token supply
3. **Instant Payouts**: No waiting for cross-chain bridges
4. **Fail-Safe**: If reserves run low, system logs errors but doesn't break
5. **Audit Trail**: All cross-chain transfers are logged and trackable

## 🚨 **Monitoring**

The system logs all cross-chain operations:
- `[BRIDGE] Cross-chain payout needed`
- `[BRIDGE] Handling [currency] deficit of [amount]`
- `[BRIDGE] Cross-chain payout completed successfully`

Monitor reserve balances regularly and top up as needed.

## 🔧 **Future Enhancements**

1. **Auto-Rebalancing**: Periodic reserve rebalancing
2. **Multi-Reserve**: Multiple reserve pools for redundancy
3. **Dynamic Reserves**: Adjust reserve sizes based on game volume
4. **Cross-Chain Bridges**: Integration with actual bridges for larger imbalances 