/**
 * Test Rationality Validation in Matrix System
 * Ensures players can't propose irrational self-allocations below break-even
 */

const { MatrixNegotiationSystem } = require('../matrix/matrixNegotiationSystem');

async function testRationalityValidation() {
    console.log('🧠 TESTING RATIONALITY VALIDATION');
    console.log('==================================');
    console.log('🎯 Goal: Prevent players from proposing losses to themselves');
    console.log('💰 Break-even: Need ≥17% (102 tokens) to cover 100 token entry fee');
    console.log('');

    const matrixSystem = new MatrixNegotiationSystem();
    
    const players = [
        { id: 'player1', name: 'Test Player 1' },
        { id: 'player2', name: 'Test Player 2' },
        { id: 'player3', name: 'Test Player 3' },
        { id: 'player4', name: 'Test Player 4' }
    ];
    
    matrixSystem.initializeMatrix(players);
    
    console.log('🧪 TEST CASES:');
    console.log('==============');
    
    // Test Case 1: Rational proposal (should pass)
    const rationalRow = [25, 25, 25, 25,  25, 25, 25, 25,  20, 20, 20, 20,  25, 25, 25, 25];
    console.log('\n✅ Test 1: Rational proposal (25% for self)');
    console.log(`   Row: [${rationalRow.join(', ')}]`);
    const rationalResult = matrixSystem.validateMatrixRow(rationalRow, 4, 0);
    console.log(`   Result: ${rationalResult.valid ? '✅ VALID' : '❌ INVALID'}`);
    if (!rationalResult.valid) console.log(`   Error: ${rationalResult.error}`);
    
    // Test Case 2: Irrational proposal - too low self-allocation (should fail)
    const irrationalRow = [10, 30, 30, 30,  25, 25, 25, 25,  20, 20, 20, 20,  25, 25, 25, 25];
    console.log('\n❌ Test 2: Irrational proposal (10% for self = LOSS)');
    console.log(`   Row: [${irrationalRow.join(', ')}]`);
    console.log(`   Analysis: 10% × 600 tokens = 60 tokens < 100 entry fee = -40 token loss`);
    const irrationalResult = matrixSystem.validateMatrixRow(irrationalRow, 4, 0);
    console.log(`   Result: ${irrationalResult.valid ? '✅ VALID' : '❌ INVALID (as expected)'}`);
    if (!irrationalResult.valid) console.log(`   Error: ${irrationalResult.error}`);
    
    // Test Case 3: Edge case - exactly break-even (should pass)
    const breakEvenRow = [17, 28, 28, 27,  25, 25, 25, 25,  20, 20, 20, 20,  25, 25, 25, 25];
    console.log('\n⚖️  Test 3: Exactly break-even (17% for self)');
    console.log(`   Row: [${breakEvenRow.join(', ')}]`);
    console.log(`   Analysis: 17% × 600 tokens = 102 tokens > 100 entry fee = +2 token profit`);
    const breakEvenResult = matrixSystem.validateMatrixRow(breakEvenRow, 4, 0);
    console.log(`   Result: ${breakEvenResult.valid ? '✅ VALID' : '❌ INVALID'}`);
    if (!breakEvenResult.valid) console.log(`   Error: ${breakEvenResult.error}`);
    
    // Test Case 4: The problematic case from earlier (should fail)
    const problematicRow = [2, 40, 20, 38,  35, 30, 20, 15,  40, 20, 20, 0,  40, 30, 20, 0];
    console.log('\n🚨 Test 4: The problematic case (2% for self = MAJOR LOSS)');
    console.log(`   Row: [${problematicRow.join(', ')}]`);
    console.log(`   Analysis: 2% × 600 tokens = 12 tokens < 100 entry fee = -88 token loss!`);
    const problematicResult = matrixSystem.validateMatrixRow(problematicRow, 4, 0);
    console.log(`   Result: ${problematicResult.valid ? '✅ VALID' : '❌ INVALID (as expected)'}`);
    if (!problematicResult.valid) console.log(`   Error: ${problematicResult.error}`);
    
    console.log('\n📊 SUMMARY:');
    console.log('===========');
    console.log(`✅ Rational proposals (≥17%): ${rationalResult.valid && breakEvenResult.valid ? 'ACCEPTED' : 'FAILED'}`);
    console.log(`❌ Irrational proposals (<17%): ${!irrationalResult.valid && !problematicResult.valid ? 'REJECTED' : 'FAILED'}`);
    
    if (rationalResult.valid && breakEvenResult.valid && !irrationalResult.valid && !problematicResult.valid) {
        console.log('\n🎉 RATIONALITY VALIDATION WORKING CORRECTLY!');
        console.log('   Players can no longer propose guaranteed losses to themselves.');
        return true;
    } else {
        console.log('\n❌ VALIDATION FAILED - Some test cases didn\'t work as expected');
        return false;
    }
}

// Run test
testRationalityValidation()
    .then(success => {
        if (success) {
            console.log('\n✅ Test passed! Matrix system now prevents irrational proposals.');
        } else {
            console.log('\n❌ Test failed! Need to fix validation logic.');
        }
    })
    .catch(console.error);

module.exports = { testRationalityValidation }; 