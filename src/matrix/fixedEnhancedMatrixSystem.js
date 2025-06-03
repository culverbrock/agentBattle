/**
 * Fixed Enhanced Matrix System - Simplified prompts for better LLM compliance
 * Key fix: Clearer, simpler prompts that emphasize mathematical constraints
 */

const { callLLM } = require('../core/llmApi');

class FixedEnhancedMatrixSystem {
    constructor() {
        this.negotiationMatrix = null;
        this.players = [];
        this.playerExplanations = [];
        this.violationLog = [];
    }

    // Initialize matrix for a game
    initializeMatrix(players) {
        this.players = players;
        const numPlayers = players.length;
        const matrixWidth = numPlayers * 4;
        
        this.negotiationMatrix = Array(numPlayers).fill(null).map((_, playerIndex) => ({
            playerId: players[playerIndex].id,
            playerName: players[playerIndex].name,
            data: Array(matrixWidth).fill(0),
            lastModified: null,
            modificationCount: 0
        }));
        
        this.playerExplanations = Array(numPlayers).fill(null).map(() => []);
        
        console.log(`🔢 Initialized ${numPlayers}x${matrixWidth} matrix with simplified prompts`);
        return this.negotiationMatrix;
    }

    // Simplified negotiation round with clearer prompts
    async performNegotiationRound(playerIndex, strategy, roundNumber) {
        const playerName = this.players[playerIndex].name;
        const numPlayers = this.players.length;
        
        try {
            // Generate SIMPLIFIED prompt that worked in testing
            const prompt = this.generateSimplifiedPrompt(playerIndex, strategy, roundNumber);
            
            console.log(`🔢 [${playerName}] Updating matrix row ${playerIndex} (simplified prompt)...`);
            
            // Call LLM with simplified prompt
            const response = await callLLM(prompt, {
                temperature: 0.3, // Lower temperature for consistency
                max_tokens: 350,
                system: 'You are a strategic game player. Follow the exact JSON format. Be very careful that proposal and vote sections sum to exactly 100.'
            });
            
            // Parse response using same logic
            const parsedResponse = this.parseEnhancedResponse(response, numPlayers, playerIndex);
            
            if (parsedResponse.success) {
                const isValid = this.validateMatrixRow(parsedResponse.matrixRow, numPlayers, playerIndex);
                
                if (isValid.valid) {
                    this.updatePlayerRow(playerIndex, parsedResponse.matrixRow, parsedResponse.explanation, roundNumber);
                    console.log(`✅ [${playerName}] Matrix updated successfully`);
                    console.log(`💭 [${playerName}] "${parsedResponse.explanation.substring(0, 80)}..."`);
                    return true;
                } else {
                    console.log(`❌ [${playerName}] Invalid matrix: ${isValid.error}`);
                    this.logViolation(playerIndex, 'INVALID_MATRIX', isValid.error, roundNumber);
                    return false;
                }
            } else {
                console.log(`❌ [${playerName}] Parse failed: ${parsedResponse.error}`);
                this.logViolation(playerIndex, 'PARSE_FAILURE', parsedResponse.error, roundNumber);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ [${playerName}] Error:`, error.message);
            this.logViolation(playerIndex, 'SYSTEM_ERROR', error.message, roundNumber);
            return false;
        }
    }

    // Generate SIMPLIFIED prompt based on successful test pattern
    generateSimplifiedPrompt(playerIndex, strategy, roundNumber) {
        const numPlayers = this.players.length;
        const playerName = this.players[playerIndex].name;
        
        // Get current matrix state for context
        const currentMatrix = this.formatSimpleMatrixState();
        
        return `🎯 MATRIX NEGOTIATION - ${playerName} (Round ${roundNumber})

MATRIX STRUCTURE (${numPlayers * 4} columns):
📊 PROPOSAL (cols 0-${numPlayers-1}): % each player gets (MUST sum to 100)
🗳️ VOTES (cols ${numPlayers}-${numPlayers*2-1}): % of your votes for each proposal (MUST sum to 100)  
🎁 OFFERS (cols ${numPlayers*2}-${numPlayers*3-1}): Votes you promise each player (0-100)
📝 REQUESTS (cols ${numPlayers*3}-${numPlayers*4-1}): Votes you want from each player (0-100)

PLAYERS: ${this.players.map((p, i) => `${i}: ${p.name}${i === playerIndex ? ' ← YOU' : ''}`).join(', ')}

🚨 CRITICAL MATH RULES:
- Proposal section MUST sum to exactly 100
- Vote section MUST sum to exactly 100  
- Your self-allocation (position ${playerIndex}) must be ≥17%

CURRENT MATRIX STATE:
${currentMatrix}

YOUR STRATEGY: "${strategy}"

REQUIRED RESPONSE FORMAT:
{
  "explanation": "I analyzed the matrix and saw [observations]. I'm changing [changes] because [reasoning]. My goal is [objective].",
  "matrixRow": [${Array(numPlayers * 4).fill('num').join(',')}]
}

Your strategic analysis and matrix update:`;
    }

    // Simple matrix state format (no complex table)
    formatSimpleMatrixState() {
        return this.negotiationMatrix.map((rowObj, idx) => {
            const proposal = rowObj.data.slice(0, this.players.length);
            const votes = rowObj.data.slice(this.players.length, this.players.length * 2);
            return `Row ${idx} (${rowObj.playerName}): Proposal[${proposal.join(',')}] Votes[${votes.join(',')}]`;
        }).join('\n');
    }

    // Parse enhanced response (same as original)
    parseEnhancedResponse(response, numPlayers, playerIndex) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { success: false, error: 'No JSON object found in response' };
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            if (!parsed.explanation || !parsed.matrixRow) {
                return { success: false, error: 'Missing explanation or matrixRow fields' };
            }
            
            if (parsed.explanation.length < 50) {
                return { success: false, error: 'Explanation too short (minimum 50 characters)' };
            }
            
            if (!Array.isArray(parsed.matrixRow) || parsed.matrixRow.length !== numPlayers * 4) {
                return { success: false, error: `Matrix row must be array of ${numPlayers * 4} numbers` };
            }
            
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

    // Validate matrix row (same as original)
    validateMatrixRow(row, numPlayers, playerIndex) {
        try {
            const proposalSum = row.slice(0, numPlayers).reduce((sum, val) => sum + val, 0);
            if (Math.abs(proposalSum - 100) > 1) {
                return { valid: false, error: `Proposal section sums to ${proposalSum}, not 100` };
            }
            
            const selfAllocation = row[playerIndex];
            const minBreakEven = 17;
            if (selfAllocation < minBreakEven) {
                return { 
                    valid: false, 
                    error: `Self-allocation ${selfAllocation}% is below break-even (need ≥${minBreakEven}%)` 
                };
            }
            
            const voteSum = row.slice(numPlayers, numPlayers * 2).reduce((sum, val) => sum + val, 0);
            if (Math.abs(voteSum - 100) > 1) {
                return { valid: false, error: `Vote section sums to ${voteSum}, not 100` };
            }
            
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

    // Update player row (same as original)
    updatePlayerRow(playerIndex, newRowData, explanation, roundNumber) {
        if (playerIndex < 0 || playerIndex >= this.negotiationMatrix.length) {
            throw new Error(`Invalid player index: ${playerIndex}`);
        }
        
        const playerRow = this.negotiationMatrix[playerIndex];
        
        if (playerRow.playerId !== this.players[playerIndex].id) {
            throw new Error(`Player ${this.players[playerIndex].name} attempted to modify row belonging to ${playerRow.playerName}`);
        }
        
        playerRow.data = newRowData;
        playerRow.lastModified = new Date().toISOString();
        playerRow.modificationCount += 1;
        
        this.playerExplanations[playerIndex].push({
            round: roundNumber,
            explanation: explanation,
            timestamp: new Date().toISOString(),
            matrixSnapshot: [...newRowData]
        });
        
        console.log(`🔒 [${playerRow.playerName}] Row ${playerIndex} updated (mod #${playerRow.modificationCount})`);
    }

    // Log violations (same as original)
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

    // Get matrix data
    getMatrix() {
        return this.negotiationMatrix.map(rowObj => rowObj.data);
    }

    // Display results
    displayResults() {
        console.log('\n📊 FIXED MATRIX SYSTEM RESULTS');
        console.log('==============================');
        
        // Simple matrix display
        console.log('MATRIX STATE:');
        this.negotiationMatrix.forEach((rowObj, idx) => {
            const data = rowObj.data;
            const proposal = data.slice(0, this.players.length);
            const votes = data.slice(this.players.length, this.players.length * 2);
            console.log(`Row ${idx} (${rowObj.playerName}): Proposal[${proposal.join(',')}] Votes[${votes.join(',')}] (${rowObj.modificationCount} mods)`);
        });
        
        // Explanations
        console.log('\nPLAYER EXPLANATIONS:');
        this.playerExplanations.forEach((explanations, playerIndex) => {
            const playerName = this.players[playerIndex].name;
            console.log(`\n${playerName}:`);
            explanations.forEach(exp => {
                console.log(`  Round ${exp.round}: "${exp.explanation}"`);
            });
        });
        
        // Violations
        if (this.violationLog.length > 0) {
            console.log('\nVIOLATIONS:');
            this.violationLog.forEach(v => {
                console.log(`  ${v.playerName}: ${v.violationType} - ${v.details}`);
            });
        } else {
            console.log('\n✅ NO VIOLATIONS DETECTED');
        }
        
        // Summary stats
        const totalMods = this.negotiationMatrix.reduce((sum, row) => sum + row.modificationCount, 0);
        const totalExplanations = this.playerExplanations.reduce((sum, exps) => sum + exps.length, 0);
        const totalViolations = this.violationLog.length;
        
        console.log('\nSUMMARY:');
        console.log(`Matrix modifications: ${totalMods}`);
        console.log(`Explanations provided: ${totalExplanations}`);
        console.log(`Violations: ${totalViolations}`);
        console.log(`Success rate: ${((totalMods / (this.players.length * 3)) * 100).toFixed(1)}%`);
        
        return {
            matrix: this.getMatrix(),
            explanations: this.playerExplanations,
            violations: this.violationLog,
            totalMods,
            totalExplanations,
            totalViolations
        };
    }
}

module.exports = { FixedEnhancedMatrixSystem }; 