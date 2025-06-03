require('dotenv').config();
const { handleCrossChainPayout } = require('./bridgeUtils');

/**
 * Test the cross-chain payout system with the user's example scenario
 */
async function testCrossChainPayoutScenario() {
  console.log('🧪 Testing Cross-Chain Payout System\n');
  
  console.log('📋 Test Scenario:');
  console.log('- Entry Fees: 100 ABT + 100 SPL = 200 total prize units');
  console.log('- Winning Proposal: 90% to ABT player (180 ABT), 10% to SPL player (20 SPL)');
  console.log('- Problem: Need 180 ABT but only have 100 ABT!');
  console.log('- Solution: Use 80 excess SPL to cover 80 ABT deficit\n');
  
  // Simulate the scenario
  const entryFees = {
    ABT: 100,
    SPL: 100
  };
  
  const payouts = {
    ABT: 180, // 90% of 200
    SPL: 20   // 10% of 200
  };
  
  console.log('🔍 Analysis:');
  console.log(`ABT Available: ${entryFees.ABT}, ABT Needed: ${payouts.ABT}`);
  console.log(`SPL Available: ${entryFees.SPL}, SPL Needed: ${payouts.SPL}`);
  
  const abtDeficit = payouts.ABT - entryFees.ABT;
  const splSurplus = entryFees.SPL - payouts.SPL;
  
  console.log(`ABT Deficit: ${abtDeficit}`);
  console.log(`SPL Surplus: ${splSurplus}\n`);
  
  if (abtDeficit > 0 && splSurplus >= abtDeficit) {
    console.log('✅ Cross-chain transfer needed and possible!');
    console.log(`🌉 Executing: Transfer ${splSurplus} SPL to reserve, transfer ${abtDeficit} ABT from reserve\n`);
    
    try {
      // Test the bridge function (this will log the operations)
      await handleCrossChainPayout('ABT', abtDeficit, 'SPL', splSurplus);
      console.log('\n✅ Cross-chain payout test completed successfully!');
    } catch (error) {
      console.error('\n❌ Cross-chain payout test failed:', error.message);
      
      if (error.message.includes('Missing SOL_PRIZE_POOL_PRIVATE_KEY') ||
          error.message.includes('Missing ABT_RESERVE_POOL_ADDRESS') ||
          error.message.includes('Missing SPL_RESERVE_POOL_ADDRESS')) {
        console.log('\n📝 To fix this error:');
        console.log('1. Run: node createReservePools.js');
        console.log('2. Add the generated environment variables to your .env file');
        console.log('3. Fund both reserve pools with tokens');
        console.log('4. Run this test again');
      }
    }
  } else {
    console.log('❌ Cross-chain transfer not possible with current balances');
  }
}

/**
 * Test multiple scenarios
 */
async function testMultipleScenarios() {
  console.log('🧪 Testing Multiple Cross-Chain Scenarios\n');
  
  const scenarios = [
    {
      name: "User's Example - ABT Deficit",
      entryFees: { ABT: 100, SPL: 100 },
      payouts: { ABT: 180, SPL: 20 }
    },
    {
      name: "SPL Deficit",
      entryFees: { ABT: 300, SPL: 100 },
      payouts: { ABT: 50, SPL: 350 }
    },
    {
      name: "Balanced - No Transfer Needed",
      entryFees: { ABT: 200, SPL: 200 },
      payouts: { ABT: 200, SPL: 200 }
    },
    {
      name: "Impossible - Insufficient Total Funds",
      entryFees: { ABT: 100, SPL: 100 },
      payouts: { ABT: 150, SPL: 150 }
    }
  ];
  
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`\n📋 Scenario ${i + 1}: ${scenario.name}`);
    console.log(`Entry Fees: ${scenario.entryFees.ABT} ABT + ${scenario.entryFees.SPL} SPL`);
    console.log(`Payouts: ${scenario.payouts.ABT} ABT + ${scenario.payouts.SPL} SPL`);
    
    const abtDeficit = Math.max(0, scenario.payouts.ABT - scenario.entryFees.ABT);
    const splDeficit = Math.max(0, scenario.payouts.SPL - scenario.entryFees.SPL);
    const abtSurplus = Math.max(0, scenario.entryFees.ABT - scenario.payouts.ABT);
    const splSurplus = Math.max(0, scenario.entryFees.SPL - scenario.payouts.SPL);
    
    if (abtDeficit > 0 && splSurplus >= abtDeficit) {
      console.log(`✅ ABT deficit ${abtDeficit} can be covered by SPL surplus ${splSurplus}`);
    } else if (splDeficit > 0 && abtSurplus >= splDeficit) {
      console.log(`✅ SPL deficit ${splDeficit} can be covered by ABT surplus ${abtSurplus}`);
    } else if (abtDeficit === 0 && splDeficit === 0) {
      console.log(`✅ Balanced - no cross-chain transfer needed`);
    } else {
      console.log(`❌ Cannot balance: ABT deficit ${abtDeficit}, SPL deficit ${splDeficit}, ABT surplus ${abtSurplus}, SPL surplus ${splSurplus}`);
    }
  }
}

// Run tests
async function runTests() {
  await testCrossChainPayoutScenario();
  console.log('\n' + '='.repeat(60) + '\n');
  await testMultipleScenarios();
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testCrossChainPayoutScenario, testMultipleScenarios }; 