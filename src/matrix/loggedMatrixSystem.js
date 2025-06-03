/**
 * Logged Matrix System - Captures all LLM interactions for analysis
 * Based on clarified matrix system with comprehensive logging
 */

const { callLLM } = require('../core/llmApi');
const fs = require('fs');
const path = require('path');

class LoggedMatrixSystem {
    constructor() {
        this.negotiationMatrix = null;
        this.players = [];
        this.playerExplanations = [];
        this.violationLog = [];
        
        // Create log file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFile = `matrix_llm_log_${timestamp}.json`;
        this.llmInteractions = [];
        
        console.log(`📝 LLM interactions will be logged to: ${this.logFile}`);
    }

    // Log LLM interaction
    logLLMInteraction(playerName, playerIndex, round, prompt, response, success, error = null) {
        const interaction = {
            timestamp: new Date().toISOString(),
            playerName,
            playerIndex,
            round,
            prompt,
            response,
            success,
            error,
            promptLength: prompt.length,
            responseLength: response ? response.length : 0
        };
        
        this.llmInteractions.push(interaction);
        
        // Write to file immediately (so we don't lose data if crashed)
        fs.writeFileSync(this.logFile, JSON.stringify(this.llmInteractions, null, 2));
    }

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
        
        console.log(`🔢 Initialized ${numPlayers}x${matrixWidth} matrix with comprehensive LLM logging`);
        return this.negotiationMatrix;
    }

    async performNegotiationRound(playerIndex, strategy, roundNumber) {
        const playerName = this.players[playerIndex].name;
        const numPlayers = this.players.length;
        let llmResponse = '';
        
        try {
            const prompt = this.generateClarifiedPrompt(playerIndex, strategy, roundNumber);
            
            console.log(`🔢 [${playerName}] Updating matrix row ${playerIndex} (logged prompt)...`);
            
            // Call LLM and log everything
            llmResponse = await callLLM(prompt, {
                temperature: 0.3,
                max_tokens: 400,
                system: 'You are a strategic game player. Understand the difference between token percentages (final payout) and vote trading (negotiation currency). Follow the exact JSON format.'
            });
            
            // Log successful LLM call
            this.logLLMInteraction(playerName, playerIndex, roundNumber, prompt, llmResponse, true);
            
            const parsedResponse = this.parseResponse(llmResponse, numPlayers, playerIndex);
            
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
            // Log failed LLM call
            this.logLLMInteraction(playerName, playerIndex, roundNumber, 
                'Error occurred before prompt completion', llmResponse, false, error.message);
                
            console.error(`❌ [${playerName}] Error:`, error.message);
            this.logViolation(playerIndex, 'SYSTEM_ERROR', error.message, roundNumber);
            return false;
        }
    }

    // Generate CLARIFIED prompt that distinguishes tokens vs votes
    generateClarifiedPrompt(playerIndex, strategy, roundNumber) {
        const numPlayers = this.players.length;
        const playerName = this.players[playerIndex].name;
        const currentMatrix = this.formatSimpleMatrixState();
        
        return `🎯 MATRIX NEGOTIATION - ${playerName} (Round ${roundNumber})

🏦 IMPORTANT: TWO DIFFERENT CURRENCIES
💰 TOKENS: The actual payout (600 total tokens in the prize pool)
🗳️ VOTES: The negotiation currency used to decide which proposal wins

MATRIX STRUCTURE (${numPlayers * 4} columns):
💰 PROPOSAL (cols 0-${numPlayers-1}): % of TOKEN POOL each player gets (MUST sum to 100)
🗳️ VOTING (cols ${numPlayers}-${numPlayers*2-1}): % of YOUR VOTES for each proposal (MUST sum to 100)
🤝 VOTE OFFERS (cols ${numPlayers*2}-${numPlayers*3-1}): VOTES you promise to give each player (0-100)
📞 VOTE REQUESTS (cols ${numPlayers*3}-${numPlayers*4-1}): VOTES you want from each player (0-100)

PLAYERS: ${this.players.map((p, i) => `${i}: ${p.name}${i === playerIndex ? ' ← YOU' : ''}`).join(', ')}

🚨 CRITICAL UNDERSTANDING:
- PROPOSAL = "If this proposal wins, Player X gets Y% of the 600 token prize pool"
- VOTING = "I give X% of my votes to support Proposal Y" 
- VOTE OFFERS = "I promise to give X votes to Player Y (to build alliances)"
- VOTE REQUESTS = "I want X votes from Player Y (to strengthen my position)"

🚨 MATH RULES:
- Proposal section MUST sum to exactly 100 (token percentages)
- Voting section MUST sum to exactly 100 (your vote allocation)
- Your self-allocation (position ${playerIndex}) must be ≥17% (tokens, not votes)
- Vote offers/requests are individual numbers (not percentages)

CURRENT MATRIX STATE:
${currentMatrix}

YOUR STRATEGY: "${strategy}"

EXAMPLES of strategic thinking:
- "Player 2 is offering me 50 votes but only giving me 15% tokens - bad deal!"
- "I'll offer 30 votes to Player 1 because they gave me 25% in their proposal"
- "Player 3 requests 60 votes from me but offers only 10 votes back - greedy!"

REQUIRED RESPONSE FORMAT:
{
  "explanation": "I analyzed the matrix and saw [token/vote observations]. I'm changing [specific changes] because [reasoning about token payouts vs vote trading]. My goal is [strategic objective].",
  "matrixRow": [${Array(numPlayers * 4).fill('num').join(',')}]
}

Your strategic analysis and matrix update:`;
    }

    formatSimpleMatrixState() {
        return this.negotiationMatrix.map((rowObj, idx) => {
            const data = rowObj.data;
            const proposal = data.slice(0, this.players.length);
            const votes = data.slice(this.players.length, this.players.length * 2);
            const offers = data.slice(this.players.length * 2, this.players.length * 3);
            const requests = data.slice(this.players.length * 3, this.players.length * 4);
            return `Row ${idx} (${rowObj.playerName}): Tokens[${proposal.join(',')}%] Votes[${votes.join(',')}%] Offers[${offers.join(',')}] Requests[${requests.join(',')}]`;
        }).join('\n');
    }

    parseResponse(response, numPlayers, playerIndex) {
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

    validateMatrixRow(row, numPlayers, playerIndex) {
        try {
            // Validate proposal section (token percentages)
            const proposalSum = row.slice(0, numPlayers).reduce((sum, val) => sum + val, 0);
            if (Math.abs(proposalSum - 100) > 1) {
                return { valid: false, error: `Token proposal section sums to ${proposalSum}%, not 100%` };
            }
            
            // Validate self-allocation (tokens)
            const selfAllocation = row[playerIndex];
            const minBreakEven = 17;
            if (selfAllocation < minBreakEven) {
                return { 
                    valid: false, 
                    error: `Self token allocation ${selfAllocation}% is below break-even (need ≥${minBreakEven}%)` 
                };
            }
            
            // Validate voting section (vote percentages)
            const voteSum = row.slice(numPlayers, numPlayers * 2).reduce((sum, val) => sum + val, 0);
            if (Math.abs(voteSum - 100) > 1) {
                return { valid: false, error: `Vote allocation section sums to ${voteSum}%, not 100%` };
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

    getMatrix() {
        return this.negotiationMatrix.map(rowObj => rowObj.data);
    }

    displayResults() {
        console.log('\n📊 LOGGED MATRIX SYSTEM RESULTS');
        console.log('===============================');
        
        // Show LLM interaction summary
        console.log('\n📝 LLM INTERACTION SUMMARY:');
        console.log(`Total LLM calls: ${this.llmInteractions.length}`);
        console.log(`Log file: ${this.logFile}`);
        
        const successfulCalls = this.llmInteractions.filter(i => i.success).length;
        const failedCalls = this.llmInteractions.filter(i => !i.success).length;
        console.log(`Successful calls: ${successfulCalls}`);
        console.log(`Failed calls: ${failedCalls}`);
        
        if (this.llmInteractions.length > 0) {
            const avgPromptLength = this.llmInteractions.reduce((sum, i) => sum + i.promptLength, 0) / this.llmInteractions.length;
            const avgResponseLength = this.llmInteractions.reduce((sum, i) => sum + i.responseLength, 0) / this.llmInteractions.length;
            console.log(`Average prompt length: ${avgPromptLength.toFixed(0)} chars`);
            console.log(`Average response length: ${avgResponseLength.toFixed(0)} chars`);
        }
        
        // Show matrix state
        console.log('\nMATRIX STATE (with clear token/vote labels):');
        this.negotiationMatrix.forEach((rowObj, idx) => {
            const data = rowObj.data;
            const proposal = data.slice(0, this.players.length);
            const votes = data.slice(this.players.length, this.players.length * 2);
            const offers = data.slice(this.players.length * 2, this.players.length * 3);
            const requests = data.slice(this.players.length * 3, this.players.length * 4);
            
            console.log(`Row ${idx} (${rowObj.playerName}):`);
            console.log(`  💰 Token Proposal: [${proposal.join(',')}%] (sum: ${proposal.reduce((a,b) => a+b, 0)}%)`);
            console.log(`  🗳️ Vote Allocation: [${votes.join(',')}%] (sum: ${votes.reduce((a,b) => a+b, 0)}%)`);
            console.log(`  🤝 Vote Offers: [${offers.join(',')}] votes`);
            console.log(`  📞 Vote Requests: [${requests.join(',')}] votes`);
            console.log(`  🔧 Modifications: ${rowObj.modificationCount}`);
            console.log('');
        });
        
        // Show player explanations
        console.log('PLAYER EXPLANATIONS:');
        this.playerExplanations.forEach((explanations, playerIndex) => {
            const playerName = this.players[playerIndex].name;
            console.log(`\n${playerName}:`);
            explanations.forEach(exp => {
                console.log(`  Round ${exp.round}: "${exp.explanation}"`);
            });
        });
        
        // Show violations
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
        console.log(`LLM success rate: ${((successfulCalls / this.llmInteractions.length) * 100).toFixed(1)}%`);
        console.log(`Matrix update success rate: ${((totalMods / (this.players.length * 3)) * 100).toFixed(1)}%`);
        
        return {
            matrix: this.getMatrix(),
            explanations: this.playerExplanations,
            violations: this.violationLog,
            llmInteractions: this.llmInteractions,
            logFile: this.logFile,
            totalMods,
            totalExplanations,
            totalViolations,
            llmSuccessRate: (successfulCalls / this.llmInteractions.length) * 100
        };
    }

    // Export detailed logs for analysis
    exportDetailedLogs() {
        const detailedLog = {
            timestamp: new Date().toISOString(),
            players: this.players,
            matrix: this.getMatrix(),
            explanations: this.playerExplanations,
            violations: this.violationLog,
            llmInteractions: this.llmInteractions,
            summary: {
                totalPlayers: this.players.length,
                totalRounds: Math.max(...this.llmInteractions.map(i => i.round), 0),
                totalLLMCalls: this.llmInteractions.length,
                successfulCalls: this.llmInteractions.filter(i => i.success).length,
                totalMatrixUpdates: this.negotiationMatrix.reduce((sum, row) => sum + row.modificationCount, 0),
                totalViolations: this.violationLog.length
            }
        };
        
        const exportFile = `detailed_matrix_log_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        fs.writeFileSync(exportFile, JSON.stringify(detailedLog, null, 2));
        console.log(`📄 Detailed logs exported to: ${exportFile}`);
        
        return exportFile;
    }
}

module.exports = { LoggedMatrixSystem }; 