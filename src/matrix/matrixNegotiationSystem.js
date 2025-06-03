/**
 * Matrix-Based Negotiation System
 * Replaces text negotiations with pure numerical matrix updates
 * Each player can only modify their row, but can read the entire matrix
 */

const { callLLM } = require('../core/llmApi');

class MatrixNegotiationSystem {
    constructor() {
        this.negotiationMatrix = null;
        this.players = [];
        this.matrixStructure = {
            PROPOSED_ALLOCATION: 'columns 0-N: % of token pool I propose each player gets',
            VOTE_ALLOCATION: 'columns N-2N: % of my 100 votes I plan to give each player', 
            OFFERS: 'columns 2N-3N: votes I offer to give each player',
            REQUESTS: 'columns 3N-4N: votes I request from each player'
        };
    }

    // Initialize matrix for a game
    initializeMatrix(players) {
        this.players = players;
        const numPlayers = players.length;
        const matrixWidth = numPlayers * 4; // 4 sections: proposal, votes, offers, requests
        
        // Initialize empty matrix: players x (4 * numPlayers)
        this.negotiationMatrix = Array(numPlayers).fill(null).map(() => 
            Array(matrixWidth).fill(0)
        );
        
        console.log(`🔢 Initialized ${numPlayers}x${matrixWidth} negotiation matrix`);
        console.log(`📊 Matrix structure: ${numPlayers} players × 4 sections × ${numPlayers} columns each`);
        
        return this.negotiationMatrix;
    }

    // Generate explanation of matrix structure for players
    generateMatrixExplanation(playerIndex) {
        const numPlayers = this.players.length;
        const playerName = this.players[playerIndex].name;
        
        return `NEGOTIATION MATRIX EXPLANATION for ${playerName}:

You can ONLY modify ROW ${playerIndex} (your row). You can READ all other rows.

MATRIX COLUMNS (${numPlayers * 4} total):
📊 PROPOSED ALLOCATION (columns 0-${numPlayers-1}): 
   What % of the 600 token pool should each player get (must sum to 100)
   
🗳️ VOTE ALLOCATION (columns ${numPlayers}-${numPlayers*2-1}):
   How you'll distribute your 100 votes among proposals (must sum to 100)
   
🎁 OFFERS (columns ${numPlayers*2}-${numPlayers*3-1}):
   Votes you offer to give each player (0-100 each)
   
📝 REQUESTS (columns ${numPlayers*3}-${numPlayers*4-1}):
   Votes you want from each player (0-100 each)

PLAYERS:
${this.players.map((p, i) => `${i}: ${p.name}`).join('\n')}

CURRENT MATRIX STATE:`;
    }

    // Format matrix for display
    formatMatrixDisplay() {
        const numPlayers = this.players.length;
        let display = '\n';
        
        // Header
        display += 'PLAYER'.padEnd(20);
        display += '|PROPOSAL%'.padEnd(12);
        display += '|VOTES%'.padEnd(10);
        display += '|OFFERS'.padEnd(10);
        display += '|REQUESTS\n';
        display += '-'.repeat(65) + '\n';
        
        // Each player's row
        this.negotiationMatrix.forEach((row, playerIndex) => {
            const playerName = this.players[playerIndex].name;
            display += `${playerName}`.padEnd(20);
            
            // Proposed allocation section
            const proposalSection = row.slice(0, numPlayers);
            display += `|${proposalSection.join(',').substring(0,10)}`.padEnd(12);
            
            // Vote allocation section  
            const voteSection = row.slice(numPlayers, numPlayers * 2);
            display += `|${voteSection.join(',').substring(0,8)}`.padEnd(10);
            
            // Offers section
            const offerSection = row.slice(numPlayers * 2, numPlayers * 3);
            display += `|${offerSection.join(',').substring(0,8)}`.padEnd(10);
            
            // Requests section
            const requestSection = row.slice(numPlayers * 3, numPlayers * 4);
            display += `|${requestSection.join(',').substring(0,8)}\n`;
        });
        
        return display;
    }

    // Conduct matrix-based negotiation round
    async performNegotiationRound(playerIndex, strategy, roundNumber) {
        const playerName = this.players[playerIndex].name;
        const numPlayers = this.players.length;
        
        try {
            // Generate prompt for this player
            const explanation = this.generateMatrixExplanation(playerIndex);
            const matrixDisplay = this.formatMatrixDisplay();
            
            const prompt = `${explanation}
${matrixDisplay}

ROUND ${roundNumber} - UPDATE YOUR ROW (Row ${playerIndex})

Your strategy: "${strategy}"

CRITICAL CONSTRAINTS:
1. You must fill ALL 4 sections of your row. Don't leave offers/requests at 0!
2. RATIONALITY CHECK: You pay 100 tokens to enter, pool is 600 tokens total
   - You need AT LEAST 17% for yourself to break even (17% × 600 = 102 tokens > 100 entry fee)
   - Proposing less than 17% for yourself = GUARANTEED LOSS!

EXAMPLES of strategic matrix rows:
- Aggressive: [60,20,15,5, 80,10,10,0, 40,20,15,10, 80,60,40,20] (60% for self = big profit)
- Diplomatic: [25,25,25,25, 25,25,25,25, 30,30,30,0, 25,25,25,0] (25% for self = decent profit)
- Opportunistic: [40,30,20,10, 50,50,0,0, 60,40,0,0, 50,30,20,0] (40% for self = good profit)

Respond with ONLY a JSON array of ${numPlayers * 4} numbers representing your row:
[prop1,prop2,...,vote1,vote2,...,offer1,offer2,...,req1,req2,...]

Rules:
- Proposal section (first ${numPlayers} numbers): must sum to 100, YOUR allocation must be ≥17%
- Vote section (next ${numPlayers} numbers): must sum to 100  
- Offers section (next ${numPlayers} numbers): 0-100 each (votes you'll give others)
- Requests section (last ${numPlayers} numbers): 0-100 each (votes you want from others)

Your strategic row:`;

            console.log(`🔢 [${playerName}] Updating matrix row ${playerIndex}...`);
            
            // Call LLM with matrix update request
            const response = await callLLM(prompt, {
                temperature: 0.7,
                max_tokens: 150,
                system: 'You are a strategic game player. Respond ONLY with a JSON array of numbers. No text explanation.'
            });
            
            // Parse response
            const newRow = this.parseMatrixRow(response, numPlayers);
            
            if (newRow) {
                // Validate constraints
                const isValid = this.validateMatrixRow(newRow, numPlayers, playerIndex);
                
                if (isValid.valid) {
                    // Update matrix
                    this.negotiationMatrix[playerIndex] = newRow;
                    console.log(`✅ [${playerName}] Matrix updated successfully`);
                    return true;
                } else {
                    console.log(`❌ [${playerName}] Invalid matrix row: ${isValid.error}`);
                    // Keep existing row
                    return false;
                }
            } else {
                console.log(`❌ [${playerName}] Failed to parse matrix response`);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ [${playerName}] Matrix negotiation error:`, error.message);
            return false;
        }
    }

    // Parse LLM response into matrix row
    parseMatrixRow(response, numPlayers) {
        try {
            // Look for JSON array in response
            const arrayMatch = response.match(/\[([^\]]+)\]/);
            if (!arrayMatch) {
                throw new Error('No array found in response');
            }
            
            // Parse numbers
            const numbers = arrayMatch[1]
                .split(',')
                .map(n => parseFloat(n.trim()))
                .filter(n => !isNaN(n));
                
            if (numbers.length !== numPlayers * 4) {
                throw new Error(`Expected ${numPlayers * 4} numbers, got ${numbers.length}`);
            }
            
            return numbers;
            
        } catch (error) {
            console.log(`⚠️ Matrix parsing failed: ${error.message}`);
            return null;
        }
    }

    // Validate matrix row constraints
    validateMatrixRow(row, numPlayers, playerIndex) {
        try {
            // Check proposal section sums to 100
            const proposalSum = row.slice(0, numPlayers).reduce((sum, val) => sum + val, 0);
            if (Math.abs(proposalSum - 100) > 1) {
                return { valid: false, error: `Proposal section sums to ${proposalSum}, not 100` };
            }
            
            // CRITICAL: Check self-allocation is rational (minimum break-even)
            // Entry fee is 100 tokens, pool is 600 tokens, so minimum self-allocation is 16.67%
            const selfAllocation = row[playerIndex];
            const minBreakEven = 17; // 17% = ~102 tokens > 100 token entry fee
            
            if (selfAllocation < minBreakEven) {
                return { 
                    valid: false, 
                    error: `Self-allocation ${selfAllocation}% is below break-even (need at least ${minBreakEven}% to cover 100 token entry fee)` 
                };
            }
            
            // Check vote section sums to 100
            const voteSum = row.slice(numPlayers, numPlayers * 2).reduce((sum, val) => sum + val, 0);
            if (Math.abs(voteSum - 100) > 1) {
                return { valid: false, error: `Vote section sums to ${voteSum}, not 100` };
            }
            
            // Check all values are 0-100
            for (let i = 0; i < row.length; i++) {
                if (row[i] < 0 || row[i] > 100) {
                    return { valid: false, error: `Value ${row[i]} at position ${i} out of range 0-100` };
                }
            }
            
            return { valid: true };
            
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Extract proposal from matrix for a player
    getPlayerProposal(playerIndex) {
        const numPlayers = this.players.length;
        const proposalSection = this.negotiationMatrix[playerIndex].slice(0, numPlayers);
        
        const proposal = {};
        this.players.forEach((player, index) => {
            proposal[player.id] = Math.round(proposalSection[index]);
        });
        
        return proposal;
    }

    // Extract votes from matrix for a player  
    getPlayerVotes(playerIndex) {
        const numPlayers = this.players.length;
        const voteSection = this.negotiationMatrix[playerIndex].slice(numPlayers, numPlayers * 2);
        
        const votes = {};
        this.players.forEach((player, index) => {
            votes[player.id] = Math.round(voteSection[index]);
        });
        
        return votes;
    }

    // Analyze promise-keeping by comparing offers vs actual votes
    analyzePromiseKeeping() {
        const numPlayers = this.players.length;
        let totalPromises = 0;
        let promisesKept = 0;
        
        this.players.forEach((player, playerIndex) => {
            const row = this.negotiationMatrix[playerIndex];
            
            // Get what they offered each player
            const offers = row.slice(numPlayers * 2, numPlayers * 3);
            
            // Get how they actually voted  
            const votes = row.slice(numPlayers, numPlayers * 2);
            
            offers.forEach((offer, targetIndex) => {
                if (offer > 0) {
                    totalPromises++;
                    
                    // Check if they gave approximately what they promised
                    const actualVote = votes[targetIndex];
                    const tolerance = Math.max(5, offer * 0.2); // 20% tolerance or 5 points
                    
                    if (Math.abs(actualVote - offer) <= tolerance) {
                        promisesKept++;
                    }
                }
            });
        });
        
        const promiseKeepingRate = totalPromises > 0 ? (promisesKept / totalPromises * 100).toFixed(1) : 0;
        
        return {
            totalPromises,
            promisesKept,
            promiseKeepingRate: parseFloat(promiseKeepingRate)
        };
    }

    // Get current matrix state
    getMatrix() {
        return this.negotiationMatrix;
    }

    // Display final matrix summary
    displayFinalSummary() {
        console.log('\n🔢 FINAL NEGOTIATION MATRIX SUMMARY:');
        console.log('====================================');
        console.log(this.formatMatrixDisplay());
        
        const promiseAnalysis = this.analyzePromiseKeeping();
        console.log(`\n📊 PROMISE-KEEPING ANALYSIS:`);
        console.log(`   Total promises made: ${promiseAnalysis.totalPromises}`);
        console.log(`   Promises kept: ${promiseAnalysis.promisesKept}`);
        console.log(`   Promise-keeping rate: ${promiseAnalysis.promiseKeepingRate}%`);
        
        return promiseAnalysis;
    }
}

module.exports = { MatrixNegotiationSystem }; 