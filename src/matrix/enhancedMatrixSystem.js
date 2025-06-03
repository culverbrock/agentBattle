/**
 * Enhanced Matrix System with Validation and Understanding Checks
 * Ensures players only edit their own rows and must explain their reasoning
 */

const { callLLM } = require('../core/llmApi');

class EnhancedMatrixSystem {
    constructor() {
        this.negotiationMatrix = null;
        this.players = [];
        this.playerExplanations = []; // Store explanations for each round
        this.violationLog = []; // Track any attempted violations
    }

    // Initialize matrix for a game
    initializeMatrix(players) {
        this.players = players;
        const numPlayers = players.length;
        const matrixWidth = numPlayers * 4;
        
        // Initialize empty matrix with player ownership tracking
        this.negotiationMatrix = Array(numPlayers).fill(null).map((_, playerIndex) => ({
            playerId: players[playerIndex].id,
            playerName: players[playerIndex].name,
            data: Array(matrixWidth).fill(0),
            lastModified: null,
            modificationCount: 0
        }));
        
        this.playerExplanations = Array(numPlayers).fill(null).map(() => []);
        
        console.log(`🔢 Initialized ${numPlayers}x${matrixWidth} negotiation matrix with ownership tracking`);
        return this.negotiationMatrix;
    }

    // Enhanced negotiation round with explanation requirement
    async performNegotiationRound(playerIndex, strategy, roundNumber) {
        const playerName = this.players[playerIndex].name;
        const numPlayers = this.players.length;
        
        try {
            // Generate enhanced prompt requiring explanation
            const explanation = this.generateMatrixExplanation(playerIndex);
            const matrixDisplay = this.formatMatrixDisplay();
            
            const prompt = `${explanation}
${matrixDisplay}

ROUND ${roundNumber} - UPDATE YOUR ROW (Row ${playerIndex}) ONLY

Your strategy: "${strategy}"

🚨 CRITICAL RULES:
1. You can ONLY modify YOUR row (Row ${playerIndex})
2. You MUST provide a strategic explanation
3. Minimum 17% self-allocation (break-even requirement)
4. All sections must be filled strategically

REQUIRED RESPONSE FORMAT:
{
  "explanation": "I analyzed the matrix and saw [what you observed]. I'm changing [what you're changing] because [strategic reasoning]. My goal is [strategic objective].",
  "matrixRow": [prop1,prop2,...,vote1,vote2,...,offer1,offer2,...,req1,req2,...]
}

EXAMPLES of good explanations:
- "I saw Player 2 offering me 30 votes but requesting 50 from me. I'm reducing my offer to them from 25 to 15 votes and increasing my self-allocation from 25% to 35% because they're being greedy."
- "Player 3 proposed giving me only 10% while taking 40% for themselves. I'm voting 0% for their proposal and offering alliance votes to Player 1 who gave me 25%."
- "The matrix shows Players 1&2 are forming an alliance (high mutual offers). I'm adapting by requesting more votes from Player 4 and reducing my proposal generosity."

Your strategic analysis and matrix update:`;

            console.log(`🔢 [${playerName}] Updating matrix row ${playerIndex} with explanation...`);
            
            // Call LLM with enhanced prompt
            const response = await callLLM(prompt, {
                temperature: 0.7,
                max_tokens: 300,
                system: 'You are a strategic game player. You must provide both explanation and matrix data in the exact JSON format requested.'
            });
            
            // Parse enhanced response
            const parsedResponse = this.parseEnhancedResponse(response, numPlayers, playerIndex);
            
            if (parsedResponse.success) {
                // Validate the matrix row
                const isValid = this.validateMatrixRow(parsedResponse.matrixRow, numPlayers, playerIndex);
                
                if (isValid.valid) {
                    // Update matrix with ownership verification
                    this.updatePlayerRow(playerIndex, parsedResponse.matrixRow, parsedResponse.explanation, roundNumber);
                    console.log(`✅ [${playerName}] Matrix updated successfully`);
                    console.log(`💭 [${playerName}] Explanation: "${parsedResponse.explanation}"`);
                    return true;
                } else {
                    console.log(`❌ [${playerName}] Invalid matrix row: ${isValid.error}`);
                    this.logViolation(playerIndex, 'INVALID_MATRIX', isValid.error, roundNumber);
                    return false;
                }
            } else {
                console.log(`❌ [${playerName}] Failed to parse response: ${parsedResponse.error}`);
                this.logViolation(playerIndex, 'PARSE_FAILURE', parsedResponse.error, roundNumber);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ [${playerName}] Matrix negotiation error:`, error.message);
            this.logViolation(playerIndex, 'SYSTEM_ERROR', error.message, roundNumber);
            return false;
        }
    }

    // Parse enhanced response with explanation
    parseEnhancedResponse(response, numPlayers, playerIndex) {
        try {
            // Look for JSON object in response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { success: false, error: 'No JSON object found in response' };
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate required fields
            if (!parsed.explanation || !parsed.matrixRow) {
                return { success: false, error: 'Missing explanation or matrixRow fields' };
            }
            
            // Validate explanation quality
            if (parsed.explanation.length < 50) {
                return { success: false, error: 'Explanation too short (minimum 50 characters)' };
            }
            
            // Validate matrix row format
            if (!Array.isArray(parsed.matrixRow) || parsed.matrixRow.length !== numPlayers * 4) {
                return { success: false, error: `Matrix row must be array of ${numPlayers * 4} numbers` };
            }
            
            // Convert to numbers and validate
            const matrixRow = parsed.matrixRow.map(n => {
                const num = parseFloat(n);
                if (isNaN(num)) throw new Error(`Invalid number: ${n}`);
                return num;
            });
            
            return {
                success: true,
                explanation: parsed.explanation.trim(),
                matrixRow: matrixRow
            };
            
        } catch (error) {
            return { success: false, error: `JSON parsing failed: ${error.message}` };
        }
    }

    // Update player row with ownership verification
    updatePlayerRow(playerIndex, newRowData, explanation, roundNumber) {
        // CRITICAL: Verify player is only modifying their own row
        if (playerIndex < 0 || playerIndex >= this.negotiationMatrix.length) {
            throw new Error(`Invalid player index: ${playerIndex}`);
        }
        
        const playerRow = this.negotiationMatrix[playerIndex];
        
        // Verify ownership
        if (playerRow.playerId !== this.players[playerIndex].id) {
            throw new Error(`Player ${this.players[playerIndex].name} attempted to modify row belonging to ${playerRow.playerName}`);
        }
        
        // Update the data
        playerRow.data = newRowData;
        playerRow.lastModified = new Date().toISOString();
        playerRow.modificationCount += 1;
        
        // Store explanation
        this.playerExplanations[playerIndex].push({
            round: roundNumber,
            explanation: explanation,
            timestamp: new Date().toISOString(),
            matrixSnapshot: [...newRowData] // Store copy of the data
        });
        
        console.log(`🔒 [${playerRow.playerName}] Row ${playerIndex} updated (modification #${playerRow.modificationCount})`);
    }

    // Enhanced matrix validation with ownership checks
    validateMatrixRow(row, numPlayers, playerIndex) {
        try {
            // Standard validation
            const proposalSum = row.slice(0, numPlayers).reduce((sum, val) => sum + val, 0);
            if (Math.abs(proposalSum - 100) > 1) {
                return { valid: false, error: `Proposal section sums to ${proposalSum}, not 100` };
            }
            
            // Rationality check
            const selfAllocation = row[playerIndex];
            const minBreakEven = 17;
            if (selfAllocation < minBreakEven) {
                return { 
                    valid: false, 
                    error: `Self-allocation ${selfAllocation}% is below break-even (need ≥${minBreakEven}%)` 
                };
            }
            
            // Vote validation
            const voteSum = row.slice(numPlayers, numPlayers * 2).reduce((sum, val) => sum + val, 0);
            if (Math.abs(voteSum - 100) > 1) {
                return { valid: false, error: `Vote section sums to ${voteSum}, not 100` };
            }
            
            // Range validation
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

    // Log violations and suspicious activity
    logViolation(playerIndex, violationType, details, roundNumber) {
        const violation = {
            playerIndex,
            playerName: this.players[playerIndex].name,
            violationType,
            details,
            roundNumber,
            timestamp: new Date().toISOString()
        };
        
        this.violationLog.push(violation);
        console.log(`🚨 VIOLATION: ${violation.playerName} - ${violationType}: ${details}`);
    }

    // Enhanced matrix display with ownership info
    formatMatrixDisplay() {
        const numPlayers = this.players.length;
        let display = '\n';
        
        // Header
        display += 'ROW|PLAYER'.padEnd(25);
        display += '|PROPOSAL%'.padEnd(12);
        display += '|VOTES%'.padEnd(10);
        display += '|OFFERS'.padEnd(10);
        display += '|REQUESTS'.padEnd(12);
        display += '|MODS\n';
        display += '-'.repeat(75) + '\n';
        
        // Each player's row with ownership info
        this.negotiationMatrix.forEach((rowObj, playerIndex) => {
            const row = rowObj.data;
            display += `${playerIndex}`.padEnd(3);
            display += `|${rowObj.playerName}`.padEnd(22);
            
            // Proposal section
            const proposalSection = row.slice(0, numPlayers);
            display += `|${proposalSection.join(',').substring(0,10)}`.padEnd(12);
            
            // Vote section  
            const voteSection = row.slice(numPlayers, numPlayers * 2);
            display += `|${voteSection.join(',').substring(0,8)}`.padEnd(10);
            
            // Offers section
            const offerSection = row.slice(numPlayers * 2, numPlayers * 3);
            display += `|${offerSection.join(',').substring(0,8)}`.padEnd(10);
            
            // Requests section
            const requestSection = row.slice(numPlayers * 3, numPlayers * 4);
            display += `|${requestSection.join(',').substring(0,10)}`.padEnd(12);
            
            // Modification count
            display += `|${rowObj.modificationCount}\n`;
        });
        
        return display;
    }

    // Generate explanation with ownership emphasis
    generateMatrixExplanation(playerIndex) {
        const numPlayers = this.players.length;
        const playerName = this.players[playerIndex].name;
        
        return `🔒 MATRIX OWNERSHIP & RULES for ${playerName}:

🚨 YOU CAN ONLY MODIFY ROW ${playerIndex} (YOUR ROW)
🚨 ANY ATTEMPT TO MODIFY OTHER ROWS WILL BE DETECTED AND LOGGED

MATRIX STRUCTURE (${numPlayers * 4} columns):
📊 PROPOSAL (cols 0-${numPlayers-1}): % each player gets (must sum to 100)
🗳️ VOTES (cols ${numPlayers}-${numPlayers*2-1}): % of your votes for each proposal (must sum to 100)  
🎁 OFFERS (cols ${numPlayers*2}-${numPlayers*3-1}): Votes you promise each player (0-100)
📝 REQUESTS (cols ${numPlayers*3}-${numPlayers*4-1}): Votes you want from each player (0-100)

PLAYERS:
${this.players.map((p, i) => `${i}: ${p.name} ${i === playerIndex ? '← YOU' : ''}`).join('\n')}

CURRENT MATRIX STATE:`;
    }

    // Get matrix data (returns actual data arrays)
    getMatrix() {
        return this.negotiationMatrix.map(rowObj => rowObj.data);
    }

    // Get detailed analysis including explanations
    getDetailedAnalysis() {
        return {
            matrix: this.getMatrix(),
            explanations: this.playerExplanations,
            violations: this.violationLog,
            playerOwnership: this.negotiationMatrix.map(rowObj => ({
                playerId: rowObj.playerId,
                playerName: rowObj.playerName,
                modifications: rowObj.modificationCount,
                lastModified: rowObj.lastModified
            }))
        };
    }

    // Display comprehensive summary
    displayComprehensiveSummary() {
        console.log('\n🔍 COMPREHENSIVE MATRIX ANALYSIS');
        console.log('=================================');
        console.log(this.formatMatrixDisplay());
        
        console.log('\n💭 PLAYER EXPLANATIONS:');
        this.playerExplanations.forEach((explanations, playerIndex) => {
            const playerName = this.players[playerIndex].name;
            console.log(`\n${playerName}:`);
            explanations.forEach(exp => {
                console.log(`  Round ${exp.round}: "${exp.explanation}"`);
            });
        });
        
        if (this.violationLog.length > 0) {
            console.log('\n🚨 VIOLATIONS DETECTED:');
            this.violationLog.forEach(violation => {
                console.log(`  ${violation.playerName}: ${violation.violationType} - ${violation.details}`);
            });
        } else {
            console.log('\n✅ NO VIOLATIONS DETECTED');
        }
        
        return this.getDetailedAnalysis();
    }
}

module.exports = { EnhancedMatrixSystem }; 