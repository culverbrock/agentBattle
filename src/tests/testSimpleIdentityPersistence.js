/**
 * Test Simple Identity Persistence
 * Demonstrates how to maintain player identity across separate API calls
 * through explicit "YOU said/did this" prompting
 */

const { callLLM } = require('../core/llmApi');

class SimpleIdentityTest {
    constructor() {
        this.playerMemory = new Map(); // Track what each player said/did
    }

    async runIdentityTest() {
        console.log('🧠 TESTING IDENTITY PERSISTENCE ACROSS API CALLS');
        console.log('================================================');

        const playerName = "TestPlayer";
        
        // Phase 1: Negotiation (separate API call)
        console.log('\n📢 PHASE 1: NEGOTIATION');
        const negotiationPrompt = `
YOU ARE: ${playerName}
SITUATION: Alice controls the group vote. You need her support.

Make a SPECIFIC promise to Alice to get her vote.
Use this format: "Alice: If you support me, I will [specific commitment]"`;

        const negotiationResponse = await callLLM(negotiationPrompt);
        console.log(`💬 ${playerName} said: "${negotiationResponse}"`);
        
        // Store what this player said
        this.playerMemory.set(playerName, {
            negotiation: negotiationResponse,
            timestamp: Date.now()
        });

        // Phase 2: Voting WITH explicit memory (Alice met her side)
        console.log('\n🗳️ PHASE 2: VOTING (with explicit memory - Alice helped you)');
        
        const memory = this.playerMemory.get(playerName);
        const votingPrompt = `
YOU ARE: ${playerName}

🧠 EXACTLY WHAT YOU PROMISED ALICE 5 MINUTES AGO:
"${memory.negotiation}"

📋 WHAT HAPPENED SINCE THEN:
- Alice DID support you as requested
- Alice's proposal gives her 40%, you get 20%
- You now control the votes

⚖️ CRITICAL MOMENT: You made a specific promise above. Alice kept her word.
Do you HONOR your promise, or BETRAY Alice?

Vote for Alice (0-100): Higher = honor promise, Lower = betray`;

        const votingResponse = await callLLM(votingPrompt, { temperature: 0.7 });
        console.log(`🗳️ ${playerName} voted for Alice: ${votingResponse}`);

        // Phase 3: Voting WITHOUT memory (control)
        console.log('\n🗳️ PHASE 3: VOTING (without memory - Alice helped you)');
        
        const votingPromptNoMemory = `
YOU ARE: ${playerName}

📋 CURRENT SITUATION:
- Alice's proposal gives her 40%, you get 20%
- You control the votes

Vote for Alice (0-100):`;

        const votingResponseNoMemory = await callLLM(votingPromptNoMemory, { temperature: 0.7 });
        console.log(`🗳️ ${playerName} voted (no memory): ${votingResponseNoMemory}`);

        // Phase 4: Test betrayal scenario with memory
        console.log('\n🗳️ PHASE 4: VOTING (with memory - Alice betrayed you)');
        
        const betrayalPrompt = `
YOU ARE: ${playerName}

🧠 EXACTLY WHAT YOU PROMISED ALICE 5 MINUTES AGO:
"${memory.negotiation}"

📋 WHAT HAPPENED SINCE THEN:
- Alice BETRAYED you - she voted against you!
- Alice's proposal gives her 45%, you get only 5%
- You now control the votes

⚖️ BETRAYAL SCENARIO: You made a promise, but Alice broke her word first.
Are you still bound by your promise, or can you retaliate?

Vote for Alice (0-100): Higher = still honor promise, Lower = retaliate`;

        const betrayalResponse = await callLLM(betrayalPrompt, { temperature: 0.7 });
        console.log(`🗳️ ${playerName} voted (betrayal scenario): ${betrayalResponse}`);

        // Analysis
        console.log('\n📊 IDENTITY PERSISTENCE ANALYSIS:');
        console.log(`💬 Original promise: "${memory.negotiation}"`);
        console.log(`🗳️ Vote with memory (Alice helped): ${votingResponse}`);
        console.log(`🗳️ Vote without memory: ${votingResponseNoMemory}`);
        console.log(`🗳️ Vote with memory (Alice betrayed): ${betrayalResponse}`);
        
        const memoryEffect = Math.abs(parseInt(votingResponse) - parseInt(votingResponseNoMemory));
        const betrayalEffect = Math.abs(parseInt(votingResponse) - parseInt(betrayalResponse));
        
        console.log(`\n🧠 Memory effect: ${memoryEffect} points`);
        console.log(`⚔️ Betrayal response: ${betrayalEffect} points`);
        console.log(`\n${memoryEffect > 10 ? '✅ Memory prompting WORKS!' : '❌ Memory prompting failed'}`);
    }
}

// Run the test
async function runTest() {
    const test = new SimpleIdentityTest();
    await test.runIdentityTest();
}

runTest().catch(console.error); 