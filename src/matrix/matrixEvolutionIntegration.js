/**
 * Matrix-Based Evolution Integration
 * Replaces text negotiations in the evolution system with fast matrix updates
 */

const { MatrixNegotiationSystem } = require('./matrixNegotiationSystem');

class MatrixEvolutionInvoker {
    constructor() {
        this.matrixSystem = new MatrixNegotiationSystem();
        this.currentMatrix = null;
    }

    // Initialize matrix for a game
    initializeGameMatrix(players) {
        this.matrixSystem.initializeMatrix(players);
        this.currentMatrix = this.matrixSystem.getMatrix();
        
        console.log('🔢 Matrix negotiation system initialized');
        return this.currentMatrix;
    }

    // Perform all negotiation rounds using matrix
    async performMatrixNegotiations(players, strategies, numRounds = 3) {
        console.log(`\n🔢 === MATRIX NEGOTIATIONS (${numRounds} rounds) ===`);
        
        // Initialize matrix if not done already
        if (!this.currentMatrix) {
            this.initializeGameMatrix(players);
        }
        
        // Run negotiation rounds
        for (let round = 1; round <= numRounds; round++) {
            console.log(`\n🔄 Matrix Round ${round}/${numRounds}:`);
            
            // Each player updates their matrix row
            for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
                const player = players[playerIndex];
                const strategy = strategies.find(s => s.id === player.agent.strategyId);
                
                if (strategy) {
                    await this.matrixSystem.performNegotiationRound(
                        playerIndex,
                        strategy.strategy,  // Use the strategy text
                        round
                    );
                } else {
                    console.log(`⚠️  No strategy found for player ${player.name}`);
                }
            }
            
            // Show matrix after each round (compact view)
            if (round === numRounds) {
                console.log('\n📊 Final Matrix:');
                console.log(this.matrixSystem.formatMatrixDisplay());
            }
        }
        
        return {
            finalMatrix: this.matrixSystem.getMatrix(),
            negotiationSummary: this.matrixSystem.analyzePromiseKeeping(),
            roundsCompleted: numRounds
        };
    }

    // Generate proposal from matrix (replaces LLM proposal generation)
    generateMatrixProposal(playerIndex, players) {
        console.log('🔢 Using matrix proposal generation');
        
        const proposal = this.matrixSystem.getPlayerProposal(playerIndex);
        
        // Validate proposal
        const total = Object.values(proposal).reduce((sum, val) => sum + val, 0);
        if (Math.abs(total - 100) > 1) {
            // Fallback to equal split if invalid
            const equalShare = Math.floor(100 / players.length);
            const remainder = 100 - (equalShare * players.length);
            
            players.forEach((player, index) => {
                proposal[player.id] = equalShare + (index === 0 ? remainder : 0);
            });
        }
        
        return proposal;
    }

    // Generate votes from matrix (replaces LLM vote generation)
    generateMatrixVotes(playerIndex, proposals) {
        console.log('🔢 Using matrix vote generation');
        
        const votes = this.matrixSystem.getPlayerVotes(playerIndex);
        
        // Map votes to proposer IDs
        const proposerIds = proposals.map(p => p.playerId);
        const matrixVotes = {};
        
        proposerIds.forEach((proposerId, index) => {
            const playerVotes = Object.values(votes);
            matrixVotes[proposerId] = playerVotes[index] || Math.floor(100 / proposerIds.length);
        });
        
        // Validate vote totals
        const total = Object.values(matrixVotes).reduce((sum, val) => sum + val, 0);
        if (Math.abs(total - 100) > 1) {
            // Normalize to 100
            const factor = 100 / total;
            Object.keys(matrixVotes).forEach(key => {
                matrixVotes[key] = Math.round(matrixVotes[key] * factor);
            });
        }
        
        return matrixVotes;
    }

    // Get negotiation summary (replaces text analysis)
    getMatrixNegotiationSummary() {
        return this.matrixSystem.analyzePromiseKeeping();
    }

    // Reset for new game
    resetForNewGame() {
        this.currentMatrix = null;
        this.matrixSystem = new MatrixNegotiationSystem();
    }

    // Get final matrix for analysis
    getFinalMatrix() {
        return this.matrixSystem.getMatrix();
    }

    // Display final results
    displayFinalResults() {
        return this.matrixSystem.displayFinalSummary();
    }
}

module.exports = { MatrixEvolutionInvoker }; 