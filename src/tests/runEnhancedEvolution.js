/**
 * Enhanced Evolution Runner with Vote Trading & Trust Tracking
 * Integrates the new negotiation system with existing evolutionary framework
 */

const { EnhancedAgentInvoker } = require('../core/enhancedAgentInvoker');
const fs = require('fs');

class EnhancedEvolutionRunner {
    constructor() {
        this.strategies = [
            "Strategic Vote Trader: Make explicit vote-for-allocation deals. Track trust and honor commitments when beneficial. Focus on coalition mathematics.",
            "Trust Builder: Focus on consistent promise-keeping to build long-term alliances. Reference voting history and punish betrayers.",
            "Coalition Breaker: Identify and disrupt opposing coalitions through targeted vote offers and strategic betrayals when profitable.",
            "Mathematical Negotiator: Use precise calculations in vote trading. Make conditional commitments based on probabilities and expected values.",
            "Reputation Manager: Carefully balance short-term gains vs long-term trust. Track all players' promise-keeping patterns.",
            "Aggressive Dealer: Make bold vote offers to secure large allocations. Use intimidation and leverage in negotiations."
        ];
        
        this.playerBalances = {};
        this.strategies.forEach(strategy => {
            const name = strategy.split(':')[0];
            this.playerBalances[name] = 500; // Starting balance
        });
    }

    async runEnhancedEvolution(tournaments = 2, gamesPerTournament = 3) {
        console.log('🚀 ENHANCED EVOLUTION WITH VOTE TRADING');
        console.log('=======================================');
        console.log(`🎯 Running ${tournaments} tournaments × ${gamesPerTournament} games`);
        console.log(`📊 Strategies: ${this.strategies.length}\n`);

        const evolutionData = {
            tournaments: [],
            totalGames: 0,
            startTime: new Date().toISOString(),
            enhancedFeatures: ['vote_trading', 'trust_tracking', 'commitment_evaluation']
        };

        for (let tournament = 1; tournament <= tournaments; tournament++) {
            console.log(`\n🏆 === TOURNAMENT ${tournament}/${tournaments} ===`);
            
            const tournamentData = await this.runTournament(tournament, gamesPerTournament);
            evolutionData.tournaments.push(tournamentData);
            evolutionData.totalGames += gamesPerTournament;
            
            // Evolution between tournaments
            if (tournament < tournaments) {
                console.log('\n🧬 EVOLVING STRATEGIES...');
                await this.evolveStrategies();
            }
        }

        evolutionData.endTime = new Date().toISOString();
        
        // Save results
        const filename = `enhanced_evolution_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        fs.writeFileSync(filename, JSON.stringify(evolutionData, null, 2));
        
        console.log(`\n💾 Evolution data saved: ${filename}`);
        this.displayFinalResults(evolutionData);
        
        return evolutionData;
    }

    async runTournament(tournamentNumber, gamesCount) {
        const tournamentData = {
            tournament: tournamentNumber,
            games: [],
            startingBalances: { ...this.playerBalances },
            trustAnalytics: []
        };

        for (let gameNum = 1; gameNum <= gamesCount; gameNum++) {
            console.log(`\n🎮 Tournament ${tournamentNumber}, Game ${gameNum}/${gamesCount}`);
            
            const gameResult = await this.runSingleGame(gameNum);
            tournamentData.games.push(gameResult);
            
            // Update balances
            Object.entries(gameResult.economicDistribution).forEach(([player, tokens]) => {
                if (this.playerBalances[player] !== undefined) {
                    this.playerBalances[player] += (tokens - 100); // Subtract entry fee
                }
            });
            
            console.log(`🏆 Winner: ${gameResult.winner}`);
            console.log(`💰 Updated balances:`, 
                Object.entries(this.playerBalances)
                    .map(([p, b]) => `${p}: ${b}`)
                    .join(', ')
            );
        }

        tournamentData.endingBalances = { ...this.playerBalances };
        return tournamentData;
    }

    async runSingleGame(gameNumber) {
        const agentInvoker = new EnhancedAgentInvoker();
        
        // Select active players (all strategies for now)
        const activePlayers = {};
        this.strategies.forEach(strategy => {
            const name = strategy.split(':')[0];
            activePlayers[name] = strategy;
        });

        const gameHistory = { players: activePlayers };
        const gameResult = {
            gameNumber,
            players: Object.keys(activePlayers),
            rounds: [],
            winner: null,
            economicDistribution: {},
            trustAnalytics: {}
        };

        // Run 5 rounds
        for (let round = 1; round <= 5; round++) {
            console.log(`  📍 Round ${round}/5`);
            
            const roundResult = await this.runGameRound(agentInvoker, activePlayers, gameHistory, round);
            gameResult.rounds.push(roundResult);
            
            if (roundResult.winner) {
                gameResult.winner = roundResult.winner;
                gameResult.economicDistribution = roundResult.economicDistribution;
                gameResult.trustAnalytics = agentInvoker.getTrustAnalytics();
                break;
            }
        }

        // If no winner after 5 rounds, default distribution
        if (!gameResult.winner) {
            console.log('  ⏰ No winner after 5 rounds - equal distribution');
            const equalShare = 600 / Object.keys(activePlayers).length;
            Object.keys(activePlayers).forEach(player => {
                gameResult.economicDistribution[player] = equalShare;
            });
        }

        return gameResult;
    }

    async runGameRound(agentInvoker, players, gameHistory, round) {
        // Negotiation phase
        const negotiations = {};
        for (const [playerName, strategy] of Object.entries(players)) {
            try {
                negotiations[playerName] = await agentInvoker.generateNegotiation(
                    playerName, gameHistory, [], strategy
                );
                
                // Small delay to prevent rate limits
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.log(`    ⚠️ Negotiation failed for ${playerName}`);
                negotiations[playerName] = "I'll work strategically for mutual benefit.";
            }
        }

        // Proposal phase
        const proposals = {};
        for (const [playerName, strategy] of Object.entries(players)) {
            try {
                proposals[playerName] = await agentInvoker.generateProposal(
                    playerName, gameHistory, [], strategy
                );
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.log(`    ⚠️ Proposal failed for ${playerName}`);
                // Equal split fallback
                const equalShare = Math.floor(100 / Object.keys(players).length);
                proposals[playerName] = Object.fromEntries(
                    Object.keys(players).map(p => [p, equalShare])
                );
            }
        }

        // Voting phase
        const votes = {};
        for (const [playerName, strategy] of Object.entries(players)) {
            try {
                votes[playerName] = await agentInvoker.generateVote(
                    playerName, proposals, gameHistory, strategy
                );
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.log(`    ⚠️ Voting failed for ${playerName}`);
                // Equal vote fallback
                const equalVote = Math.floor(100 / Object.keys(players).length);
                votes[playerName] = Object.fromEntries(
                    Object.keys(players).map(p => [p, equalVote])
                );
            }
        }

        // Evaluate commitments
        agentInvoker.evaluateRoundCommitments(proposals);

        // Determine winner
        const voteResults = this.calculateVoteResults(votes);
        const winner = voteResults.winner;
        
        console.log(`    📊 Votes: ${Object.entries(voteResults.totalVotes).map(([p, v]) => `${p}:${v}`).join(', ')}`);
        
        const roundResult = {
            round,
            negotiations,
            proposals,
            votes,
            voteResults,
            winner: winner && voteResults.totalVotes[winner] > 300 ? winner : null
        };

        if (roundResult.winner) {
            // Calculate economic distribution
            const winningProposal = proposals[roundResult.winner];
            roundResult.economicDistribution = {};
            Object.entries(winningProposal).forEach(([player, percentage]) => {
                roundResult.economicDistribution[player] = (percentage / 100) * 600;
            });
        }

        return roundResult;
    }

    calculateVoteResults(votes) {
        const totalVotes = {};
        
        // Initialize
        Object.keys(votes).forEach(voter => {
            Object.keys(votes[voter]).forEach(recipient => {
                if (!totalVotes[recipient]) totalVotes[recipient] = 0;
            });
        });
        
        // Count votes
        Object.values(votes).forEach(voterAllocation => {
            Object.entries(voterAllocation).forEach(([recipient, voteCount]) => {
                totalVotes[recipient] += voteCount;
            });
        });
        
        // Find winner
        const winner = Object.entries(totalVotes).reduce((max, [player, votes]) => 
            votes > max.votes ? { player, votes } : max, 
            { player: null, votes: 0 }
        );
        
        return {
            totalVotes,
            winner: winner.player,
            winningVotes: winner.votes
        };
    }

    async evolveStrategies() {
        // Simple evolution: modify bottom performers
        const sortedByBalance = Object.entries(this.playerBalances)
            .sort(([,a], [,b]) => b - a);
        
        const topPerformers = sortedByBalance.slice(0, 3);
        const bottomPerformers = sortedByBalance.slice(-2);
        
        console.log(`🔬 Evolving based on performance:`);
        console.log(`  📈 Top: ${topPerformers.map(([p, b]) => `${p}(${b})`).join(', ')}`);
        console.log(`  📉 Bottom: ${bottomPerformers.map(([p, b]) => `${p}(${b})`).join(', ')}`);
        
        // For this demo, just adjust balances slightly
        bottomPerformers.forEach(([player]) => {
            this.playerBalances[player] = Math.max(100, this.playerBalances[player] * 0.9);
        });
    }

    displayFinalResults(evolutionData) {
        console.log('\n🏁 ENHANCED EVOLUTION COMPLETE!');
        console.log('================================');
        
        const finalBalances = Object.entries(this.playerBalances)
            .sort(([,a], [,b]) => b - a);
        
        console.log('\n🏆 FINAL RANKINGS:');
        finalBalances.forEach(([player, balance], index) => {
            const change = balance - 500;
            const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
            const trend = change > 0 ? `💰+${change}` : `💸${change}`;
            console.log(`${emoji} ${player}: ${balance} coins (${trend})`);
        });
        
        console.log(`\n📊 Total games played: ${evolutionData.totalGames}`);
        console.log(`⏱️ Duration: ${new Date(evolutionData.endTime).getTime() - new Date(evolutionData.startTime).getTime()} ms`);
        
        console.log('\n✨ ENHANCED FEATURES DEMONSTRATED:');
        console.log('🗣️ Explicit vote-for-allocation negotiations');
        console.log('🤝 Trust tracking and commitment evaluation');
        console.log('📊 Historical voting pattern analysis');
        console.log('🎯 Strategic depth beyond simple statements');
    }
}

async function main() {
    const runner = new EnhancedEvolutionRunner();
    
    // Run a focused test with enhanced negotiations
    await runner.runEnhancedEvolution(2, 3); // 2 tournaments, 3 games each
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { EnhancedEvolutionRunner }; 