/**
 * Enhanced Negotiation Framework with Vote Trading & Trust Tracking
 * Addresses the vague negotiation problem with concrete vote commitments
 */

class EnhancedNegotiationSystem {
    constructor() {
        this.voteCommitments = new Map(); // Track explicit vote promises
        this.trustScores = new Map(); // Track trust between players in current game
        this.votingHistory = []; // Track all voting patterns in current game
        this.proposalHistory = []; // Track all proposals in current game
        this.reputationSystem = new Map(); // Track long-term reputation across multiple games
        this.promiseKeptCount = new Map(); // Track how many promises each player kept
        this.promiseMadeCount = new Map(); // Track how many promises each player made
    }

    // Enhanced negotiation prompt with vote trading mechanics
    generateNegotiationPrompt(playerName, gameState, round) {
        const { players, previousVoting, previousProposals } = gameState;
        const otherPlayers = players.filter(p => p !== playerName);
        
        return `
🗣️ POLITICAL NEGOTIATION - Round ${round}/5

YOU ARE: ${playerName}
YOUR STRATEGY: ${gameState.playerStrategy}

GAME RULES:
- 600 token pool, need 301+ votes to win
- Each player controls 100 votes
- Players: ${otherPlayers.join(', ')}

${this.buildClearVotingAnalysis(previousVoting, previousProposals, playerName)}

🎯 REQUIRED: Address each player individually with specific vote trades

MANDATORY FORMAT - Address each player separately:

${otherPlayers.map(player => 
`${player}: [Your specific offer/demand to ${player}]`
).join('\n')}

EXAMPLES OF STRONG NEGOTIATIONS:
• "Alice: I need 25% from your proposal. Give me 25%+ and you get my 100 votes."
• "Bob: Support my proposal with 80+ votes and I'll allocate you 30% in mine."  
• "Charlie: You betrayed me last round. Give me 35% or I vote against you."
• "Diana: Let's form an alliance - I give you 40 votes if you give me 40 votes."

FORBIDDEN - Don't say these vague things:
❌ "Let's work together"
❌ "I propose an alliance" 
❌ "Mutual benefit"

REQUIRED - Be specific:
✅ Exact vote amounts: "I give you 60 votes"
✅ Allocation demands: "I need 30% from your proposal"  
✅ Conditional threats: "Less than 20% = zero votes"
✅ Coalition offers: "Team up against [Player]"

Generate your message to each player now:`;
    }

    // Build clearer voting analysis that actually explains what happened
    buildClearVotingAnalysis(previousVoting, previousProposals, currentPlayer) {
        if (!previousVoting || previousVoting.length === 0) {
            return "🔄 PREVIOUS ROUND ANALYSIS:\nNo previous rounds to analyze.";
        }

        let analysis = "🔄 PREVIOUS ROUND ANALYSIS:\n";
        
        const lastRound = previousVoting[previousVoting.length - 1];
        const lastProposals = previousProposals ? previousProposals[previousProposals.length - 1] : null;
        
        // Analyze what happened to the current player
        if (lastProposals && lastProposals[currentPlayer]) {
            const myProposal = lastProposals[currentPlayer];
            const votesIReceived = this.calculateVotesReceived(currentPlayer, lastRound);
            const didIWin = votesIReceived > 300;
            
            analysis += `📊 YOUR LAST ROUND:\n`;
            analysis += `  • Your proposal: ${Object.entries(myProposal).map(([p, pct]) => `${p}:${pct}%`).join(', ')}\n`;
            analysis += `  • Votes you received: ${votesIReceived}/600 ${didIWin ? '🏆 WON' : '❌ LOST'}\n`;
        }
        
        // Analyze who voted for whom and why
        analysis += `\n🗳️ WHO VOTED FOR WHOM:\n`;
        Object.entries(lastRound).forEach(([voter, votes]) => {
            const topVote = this.getTopVoteRecipient(votes);
            const reason = this.analyzeVotingReason(voter, topVote.player, lastProposals);
            analysis += `  • ${voter} → ${topVote.player} (${topVote.votes} votes) ${reason}\n`;
        });
        
        // Trust implications
        analysis += `\n⚖️ TRUST IMPLICATIONS:\n`;
        analysis += `  • Players who kept promises: [Track this]\n`;
        analysis += `  • Players who broke commitments: [Track this]\n`;

        return analysis;
    }

    // Calculate total votes received by a player
    calculateVotesReceived(player, votingRound) {
        let total = 0;
        Object.values(votingRound).forEach(voterAllocation => {
            total += voterAllocation[player] || 0;
        });
        return total;
    }

    // Analyze why someone voted for someone
    analyzeVotingReason(voter, recipient, proposals) {
        if (!proposals || !proposals[recipient]) return "";
        
        const allocation = proposals[recipient][voter] || 0;
        
        if (allocation > 25) return `💰 (got ${allocation}% allocation)`;
        if (allocation === 0) return `❌ (got 0% - punishment vote?)`;
        if (voter === recipient) return `🤲 (self-vote)`;
        return `❓ (got only ${allocation}%)`;
    }

    // Track explicit vote commitments made during negotiation
    recordVoteCommitment(fromPlayer, toPlayer, condition, voteAmount) {
        const key = `${fromPlayer}->${toPlayer}`;
        this.voteCommitments.set(key, {
            condition,
            voteAmount,
            round: this.getCurrentRound(),
            fulfilled: null // Will be checked after voting
        });
    }

    // Check if players followed through on their commitments
    evaluateCommitments(actualVotes, proposals) {
        this.voteCommitments.forEach((commitment, key) => {
            const [fromPlayer, toPlayer] = key.split('->');
            
            // Check if condition was met in proposal
            const targetProposal = proposals[toPlayer];
            const conditionMet = this.wasConditionMet(commitment.condition, targetProposal ? targetProposal[fromPlayer] || 0 : 0);
            
            // Check if vote commitment was honored
            const actualVote = actualVotes[fromPlayer] ? actualVotes[fromPlayer][toPlayer] || 0 : 0;
            
            let fulfilled = false;
            
            // Evaluate based on commitment type
            switch (commitment.type) {
                case 'vote_offer':
                    const expectedVotes = commitment.offeredVotes || 0;
                    fulfilled = actualVote >= expectedVotes * 0.8; // 80% tolerance
                    break;
                    
                case 'alliance_proposal':
                    fulfilled = actualVote >= 20; // Expected minimum for alliance
                    break;
                    
                case 'seeking_allocation':
                    // If they met our demand, we should reward them
                    const demandMet = targetProposal ? (targetProposal[fromPlayer] || 0) >= (commitment.requiredAllocation || 25) : false;
                    fulfilled = demandMet ? actualVote >= 15 : true; // If demand not met, no obligation
                    break;
                    
                case 'threat':
                    // Threat should be carried out if condition not met
                    fulfilled = conditionMet ? actualVote >= 15 : actualVote <= 10;
                    break;
                    
                default:
                    // General promise - some cooperation expected
                    fulfilled = actualVote >= 10;
            }
            
            // Update trust score
            this.updateTrustScore(fromPlayer, toPlayer, fulfilled);
            
            // Mark commitment as fulfilled or broken
            commitment.fulfilled = fulfilled;
            
            console.log(`📊 [COMMITMENT] ${fromPlayer} → ${toPlayer}: ${commitment.type} = ${fulfilled ? '✅ KEPT' : '❌ BROKEN'} (gave ${actualVote} votes)`);
        });
    }

    // Update trust scores based on promise-keeping
    updateTrustScore(promiser, promisee, fulfilled) {
        const key = `${promisee}_trust`;
        const currentTrust = this.trustScores.get(key) || {};
        
        if (!currentTrust[promiser]) {
            currentTrust[promiser] = { kept: 0, total: 0 };
        }
        
        currentTrust[promiser].total += 1;
        if (fulfilled) {
            currentTrust[promiser].kept += 1;
        }
        
        // Calculate trust ratio
        const trustRatio = currentTrust[promiser].kept / currentTrust[promiser].total;
        currentTrust[promiser].score = trustRatio;
        
        this.trustScores.set(key, currentTrust);
    }

    // Enhanced voting prompt with EXPLICIT identity persistence
    generateVotingPrompt(playerName, proposals, gameState) {
        const commitmentsToMe = this.getCommitmentsToPlayer(playerName);
        const commitmentsIMade = this.getCommitmentsMadeByPlayer(playerName);
        const proposalEntries = Object.entries(proposals);
        const playerNames = proposalEntries.map(([name]) => name);
        
        return `
🗳️ VOTING TIME - ${playerName}

YOU control 100 votes total to distribute.

🧠 EXACTLY WHAT YOU SAID IN NEGOTIATIONS 5 MINUTES AGO:
${commitmentsIMade.length > 0 ? 
    commitmentsIMade.map(c => `"${c.targetPlayer}: [YOU promised] ${c.summary}"`).join('\n') :
    '[YOU made no specific promises]'
}

📋 WHAT HAPPENED SINCE YOUR NEGOTIATIONS:
${proposalEntries.map(([proposer, allocation]) => {
    const myShare = allocation[playerName] || 0;
    const commitment = commitmentsIMade.find(c => c.targetPlayer === proposer);
    const status = commitment ? 
        (myShare >= 20 ? 'HONORED your request' : 'IGNORED your demand') : 
        'No deal made';
    return `• ${proposer}: Gave YOU ${myShare}% (${status})`;
}).join('\n')}

💰 PROMISES OTHERS MADE TO YOU:
${commitmentsToMe.length > 0 ? 
    commitmentsToMe.map(c => {
        const theirProposal = proposals[c.player];
        const myAllocation = theirProposal ? theirProposal[playerName] || 0 : 0;
        const kept = myAllocation >= 20 ? '✅ KEPT' : '❌ BROKEN';
        return `• ${c.player} promised: "${c.description}" → gave you ${myAllocation}% (${kept})`;
    }).join('\n') :
    '• No explicit promises received'
}

⚖️ CRITICAL MOMENT - HONOR YOUR WORD OR BETRAY?
${commitmentsIMade.length > 0 ? 
    `YOU made specific promises above. Do you:
    🤝 HONOR your commitments (vote for those who helped you)
    ⚔️ BETRAY your promises (vote purely for self-interest)` :
    'You made no promises - vote strategically for maximum gain'
}

${this.generateVoteEnforcement(playerName, commitmentsIMade, proposals)}

🎯 RESPOND WITH ONLY JSON - NO EXPLANATIONS:
{"${playerNames.join('": X, "')}"}: X}

Replace X with vote amounts (must sum to exactly 100).`;
    }

    // Parse negotiation messages for explicit commitments
    parseNegotiationForCommitments(playerName, message) {
        const commitments = [];
        
        // Split message into targeted communications
        const playerMessages = this.parsePlayerTargetedMessages(message);
        
        playerMessages.forEach(({ targetPlayer, content }) => {
            // Pattern 1: "I need X% from your proposal" or "Give me X%"
            const needPattern = /(I need|Give me) (\d+)%/gi;
            let match = needPattern.exec(content);
            if (match) {
                commitments.push({
                    type: 'seeking_allocation',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    requiredAllocation: parseInt(match[2]),
                    condition: `Need ${match[2]}% allocation`
                });
            }
            
            // Pattern 2: "allocate X votes" or "give you X votes"
            const voteOfferPattern = /(allocate|give you|support.*with) (\d+) votes/gi;
            match = voteOfferPattern.exec(content);
            if (match) {
                commitments.push({
                    type: 'vote_offer',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    offeredVotes: parseInt(match[2]),
                    condition: `Offering ${match[2]} votes`
                });
            }
            
            // Pattern 3: "X-Y split" or "50-50" or percentage splits
            const splitPattern = /(\d+)[-\/](\d+) split|(\d+)%.*(\d+)%/gi;
            match = splitPattern.exec(content);
            if (match) {
                commitments.push({
                    type: 'split_proposal',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    proposedSplit: match[1] ? `${match[1]}-${match[2]}` : `${match[3]}-${match[4]}`,
                    condition: 'Split proposal'
                });
            }
            
            // Pattern 4: "If you X then I Y" conditional
            const conditionalPattern = /if you.*?(\d+).*?then.*?(\d+)|if you.*?(\d+).*?I.*?(\d+)/gi;
            match = conditionalPattern.exec(content);
            if (match) {
                commitments.push({
                    type: 'conditional_trade',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    condition: 'Conditional exchange',
                    details: content.substring(0, 100)
                });
            }
            
            // Pattern 5: Threats - "or else", "consequences", "oppose"
            const threatPattern = /(consequences|oppose|or else|against you|punishment)/i;
            if (threatPattern.test(content)) {
                commitments.push({
                    type: 'threat',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    description: 'Threat made'
                });
            }
            
            // Pattern 6: Alliance/coalition - more flexible
            const alliancePattern = /(alliance|coalition|together|team|work.*with|partner)/i;
            if (alliancePattern.test(content)) {
                commitments.push({
                    type: 'alliance_proposal',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    description: 'Alliance/coalition proposed'
                });
            }
            
            // Pattern 7: Trust/betrayal references
            const trustPattern = /(trust|betray|broke|promise|reliable|consistent)/i;
            if (trustPattern.test(content)) {
                commitments.push({
                    type: 'trust_reference',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    description: 'Trust/betrayal referenced'
                });
            }
            
            // Pattern 8: Specific numbers - any commitment with numbers
            const numberPattern = /(\d+)/g;
            const numbers = content.match(numberPattern);
            if (numbers && numbers.length > 0) {
                commitments.push({
                    type: 'numerical_commitment',
                    fromPlayer: playerName,
                    targetPlayer: targetPlayer,
                    numbers: numbers,
                    description: `Contains numbers: ${numbers.join(', ')}`
                });
            }
        });
        
        return commitments;
    }

    // Parse player-targeted messages from negotiation
    parsePlayerTargetedMessages(message) {
        const playerMessages = [];
        
        // Split by player names followed by colon
        const lines = message.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
            // Look for "PlayerName: Message" format
            const targetMatch = line.match(/^([A-Za-z\s]+):\s*(.+)$/);
            if (targetMatch) {
                const targetPlayer = targetMatch[1].trim();
                const content = targetMatch[2].trim();
                playerMessages.push({ targetPlayer, content });
            } else {
                // If no specific target, assume it's to all players
                playerMessages.push({ targetPlayer: 'all', content: line.trim() });
            }
        });
        
        return playerMessages;
    }

    // Helper methods
    getTopVoteRecipient(votes) {
        const topEntry = Object.entries(votes).reduce((max, [player, voteCount]) => 
            voteCount > max.votes ? { player, votes: voteCount } : max, 
            { player: null, votes: 0 }
        );
        
        return {
            player: topEntry.player,
            percentage: Math.round((topEntry.votes / 100) * 100)
        };
    }

    wasConditionMet(condition, proposal) {
        // Implementation depends on condition format
        // For now, simple percentage check
        if (condition && condition.includes('%')) {
            const match = condition.match(/(\d+)%/);
            if (match && match[1]) {
                const requiredPercentage = parseInt(match[1]);
                return proposal >= requiredPercentage;
            }
        }
        return false;
    }

    getCommitmentsToPlayer(playerName) {
        const commitments = [];
        this.voteCommitments.forEach((commitment, key) => {
            const [fromPlayer, toPlayer] = key.split('->');
            // Get commitments made TO this player (where toPlayer === playerName)
            if (toPlayer === playerName) {
                let description = '';
                
                switch (commitment.type) {
                    case 'seeking_allocation':
                        description = `Wants ${commitment.requiredAllocation}% from you, offers ${commitment.offeredVotes} votes`;
                        break;
                    case 'vote_offer':
                        description = `Offered ${commitment.offeredVotes} votes`;
                        break;
                    case 'conditional_seeking':
                        description = `${commitment.requiredAllocation}%+ from you = ${commitment.offeredVotes} votes`;
                        break;
                    case 'threat':
                        description = `Threatened: Less than ${commitment.minAllocation}% = zero votes`;
                        break;
                    case 'reciprocal_support':
                        description = `Wants ${commitment.requiredVotes}+ votes for ${commitment.offeredAllocation}%`;
                        break;
                    case 'alliance_proposal':
                        description = `Proposed alliance/partnership`;
                        break;
                    case 'coalition_seeking':
                        description = `Seeking coalition`;
                        break;
                    case 'trust_reference':
                        description = `Referenced trust/betrayal`;
                        break;
                    default:
                        description = `${commitment.voteAmount || 0} votes if ${commitment.condition}`;
                }
                
                commitments.push({
                    player: fromPlayer,
                    type: commitment.type,
                    description: description,
                    requiredAllocation: commitment.requiredAllocation,
                    offeredVotes: commitment.offeredVotes
                });
            }
        });
        return commitments;
    }

    getCurrentRound() {
        return this.votingHistory.length + 1;
    }

    // Get commitments made BY a player (not TO them)
    getCommitmentsMadeByPlayer(playerName) {
        const commitments = [];
        
        // Search through stored commitments for this player's promises
        this.voteCommitments.forEach((commitment, key) => {
            const [fromPlayer, toPlayer] = key.split('->');
            if (fromPlayer === playerName) {
                commitments.push({
                    targetPlayer: toPlayer,
                    type: commitment.type,
                    summary: this.summarizeCommitment(commitment)
                });
            }
        });
        
        return commitments;
    }

    // Create concise commitment summaries to save tokens
    summarizeCommitment(commitment) {
        switch (commitment.type) {
            case 'vote_offer':
                return `Give ${commitment.offeredVotes || 0} votes`;
            case 'seeking_allocation':
                return `Need ${commitment.requiredAllocation || 0}% in return`;
            case 'alliance_proposal':
                return `Form alliance/partnership`;
            case 'threat':
                return `Threatened punishment if betrayed`;
            case 'conditional_trade':
                return `Conditional vote exchange`;
            case 'split_proposal':
                return `Proposed vote split arrangement`;
            default:
                return `${commitment.type} commitment`;
        }
    }

    // Generate analysis of whether commitments were honored in proposals
    generateCommitmentAnalysis(playerName, commitments, proposals) {
        if (commitments.length === 0) {
            return "No commitments to evaluate.";
        }

        const analysis = commitments.map(commitment => {
            const targetProposal = proposals[commitment.targetPlayer];
            const myAllocation = targetProposal ? targetProposal[playerName] || 0 : 0;
            
            // More specific analysis based on commitment type and actual promises
            switch (commitment.type) {
                case 'vote_offer':
                    // Check if they gave a reasonable allocation in return for promised votes
                    const reasonableReturn = myAllocation >= 15; // Expect at least 15% for vote promises
                    return `💰 PROMISE TO HONOR: Give ${commitment.offeredVotes || 0} votes to ${commitment.targetPlayer} (they gave you ${myAllocation}% ${reasonableReturn ? '✅ FAIR' : '❌ UNFAIR'})`;
                
                case 'seeking_allocation':
                    // Check if they met our allocation demand
                    const demandMet = myAllocation >= (commitment.requiredAllocation || 25);
                    return `📊 DEMAND CHECK: Asked ${commitment.targetPlayer} for ${commitment.requiredAllocation || 25}% → got ${myAllocation}% (${demandMet ? '✅ MET' : '❌ FAILED'})`;
                
                case 'alliance_proposal':
                    // Check if they treated us as an ally
                    const allyTreatment = myAllocation >= 20;
                    return `🤝 ALLIANCE PROMISE: ${commitment.targetPlayer} gave you ${myAllocation}% (${allyTreatment ? '✅ HONORED ALLIANCE' : '❌ BETRAYED ALLIANCE'})`;
                
                case 'threat':
                    return `⚡ THREAT MADE: Threatened ${commitment.targetPlayer} - follow through or lose credibility`;
                
                case 'conditional_trade':
                    return `🔄 CONDITIONAL DEAL: Check if ${commitment.targetPlayer}'s ${myAllocation}% meets your conditions`;
                
                default:
                    return `❓ OTHER PROMISE: ${commitment.targetPlayer} gave you ${myAllocation}% - evaluate if fair`;
            }
        });

        return `🔍 YOUR PROMISE ANALYSIS:\n${analysis.join('\n')}`;
    }

    generatePromiseHonoredAnalysis(playerName, commitmentsToMe, proposals) {
        if (commitmentsToMe.length === 0) {
            return "No promises to evaluate from other players.";
        }

        const analysis = commitmentsToMe.map(commitment => {
            const promiserProposal = proposals[commitment.player];
            const myAllocationFromThem = promiserProposal ? promiserProposal[playerName] || 0 : 0;
            
            // Analyze promise fulfillment based on commitment type
            let fulfillmentStatus = '';
            switch (commitment.type) {
                case 'seeking_allocation':
                    const requiredPct = commitment.requiredAllocation || 25;
                    fulfillmentStatus = myAllocationFromThem >= requiredPct ? '✅ HONORED' : '❌ BROKEN';
                    break;
                case 'vote_offer':
                    fulfillmentStatus = myAllocationFromThem > 15 ? '✅ FAIR DEAL' : '❓ UNCLEAR';
                    break;
                case 'alliance_proposal':
                    fulfillmentStatus = myAllocationFromThem >= 20 ? '✅ ALLY BEHAVIOR' : '❌ BETRAYAL';
                    break;
                case 'threat':
                    fulfillmentStatus = myAllocationFromThem < 15 ? '⚠️ THREAT EXECUTED' : '✅ THREAT AVOIDED';
                    break;
                default:
                    fulfillmentStatus = myAllocationFromThem >= 20 ? '✅ REASONABLE' : '❌ DISAPPOINTING';
            }
            
            return `${commitment.player} promised "${commitment.description}" → gave you ${myAllocationFromThem}% (${fulfillmentStatus})`;
        });

        return `🔍 PROMISE FULFILLMENT ANALYSIS:\n${analysis.join('\n')}`;
    }

    // Update reputation based on promise-keeping
    updatePlayerReputation(playerName, promisesKept, promisesMade) {
        const currentRep = this.reputationSystem.get(playerName) || { kept: 0, made: 0, score: 1.0 };
        
        currentRep.kept += promisesKept;
        currentRep.made += promisesMade;
        currentRep.score = currentRep.made > 0 ? currentRep.kept / currentRep.made : 1.0;
        
        this.reputationSystem.set(playerName, currentRep);
        
        // Also update round-specific counters
        this.promiseKeptCount.set(playerName, (this.promiseKeptCount.get(playerName) || 0) + promisesKept);
        this.promiseMadeCount.set(playerName, (this.promiseMadeCount.get(playerName) || 0) + promisesMade);
    }

    // Get reputation description for a player
    getReputationDescription(playerName) {
        const rep = this.reputationSystem.get(playerName) || { kept: 0, made: 0, score: 1.0 };
        
        if (rep.made === 0) return "Unknown reputation";
        
        if (rep.score >= 0.8) return "🟢 HIGHLY TRUSTWORTHY";
        if (rep.score >= 0.6) return "🟡 SOMEWHAT RELIABLE";
        if (rep.score >= 0.4) return "🟠 QUESTIONABLE";
        if (rep.score >= 0.2) return "🔴 UNTRUSTWORTHY";
        return "💀 PROMISE-BREAKER";
    }

    // Get reputation for voting prompt
    getReputationSummary() {
        const summary = [];
        this.reputationSystem.forEach((rep, playerName) => {
            if (rep.made > 0) {
                summary.push(`${playerName}: ${this.getReputationDescription(playerName)} (${rep.kept}/${rep.made})`);
            }
        });
        return summary.length > 0 ? summary.join('\n') : "No reputation data available";
    }

    // Calculate immediate consequences of breaking promises
    calculateImmediateConsequences(playerName, commitmentsIMade, proposals) {
        if (commitmentsIMade.length === 0) {
            return "No promises to break - you can vote however you want.";
        }

        const consequences = [];
        let totalVotesOwed = 0;
        let totalAlliesBetrayed = 0;

        commitmentsIMade.forEach(commitment => {
            const targetProposal = proposals[commitment.targetPlayer];
            const allocationReceived = targetProposal ? targetProposal[playerName] || 0 : 0;

            switch (commitment.type) {
                case 'vote_offer':
                    const votesOwed = commitment.offeredVotes || 0;
                    totalVotesOwed += votesOwed;
                    consequences.push(`💔 Break vote promise to ${commitment.targetPlayer}: Lose ${votesOwed} vote commitment (they gave you ${allocationReceived}%)`);
                    break;
                
                case 'alliance_proposal':
                    totalAlliesBetrayed++;
                    const expectedVotes = 30; // Default alliance expectation
                    consequences.push(`🗡️ Betray alliance with ${commitment.targetPlayer}: Lose ally who gave you ${allocationReceived}% (expected ~${expectedVotes} votes)`);
                    break;
                
                case 'seeking_allocation':
                    if (allocationReceived >= (commitment.requiredAllocation || 25)) {
                        consequences.push(`✅ ${commitment.targetPlayer} MET your demand (${allocationReceived}% ≥ ${commitment.requiredAllocation || 25}%) - honor your side!`);
                    } else {
                        consequences.push(`❌ ${commitment.targetPlayer} FAILED your demand (${allocationReceived}% < ${commitment.requiredAllocation || 25}%) - you're free to punish`);
                    }
                    break;
            }
        });

        consequences.push(`🔥 TOTAL BETRAYAL COST: ${totalVotesOwed} votes owed + ${totalAlliesBetrayed} allies betrayed = MASSIVE reputation damage`);
        
        return consequences.join('\n');
    }

    // Generate enforced vote allocation based on promises
    generateEnforcedVoteAllocation(playerName, commitmentsIMade, proposals) {
        if (commitmentsIMade.length === 0) {
            return "No specific promises made - vote strategically based on proposals.";
        }

        const enforced = [];
        let remainingVotes = 100;
        const allocations = {};

        // Calculate required vote allocations based on promises
        commitmentsIMade.forEach(commitment => {
            const targetProposal = proposals[commitment.targetPlayer];
            const allocationReceived = targetProposal ? targetProposal[playerName] || 0 : 0;

            switch (commitment.type) {
                case 'vote_offer':
                    const votesOwed = Math.min(commitment.offeredVotes || 0, remainingVotes);
                    if (votesOwed > 0) {
                        allocations[commitment.targetPlayer] = (allocations[commitment.targetPlayer] || 0) + votesOwed;
                        remainingVotes -= votesOwed;
                        enforced.push(`📋 REQUIRED: Give ${votesOwed} votes to ${commitment.targetPlayer} (promise made)`);
                    }
                    break;
                
                case 'alliance_proposal':
                    const allianceVotes = Math.min(25, remainingVotes); // Standard alliance share
                    if (allianceVotes > 0) {
                        allocations[commitment.targetPlayer] = (allocations[commitment.targetPlayer] || 0) + allianceVotes;
                        remainingVotes -= allianceVotes;
                        enforced.push(`🤝 REQUIRED: Give ${allianceVotes} votes to ally ${commitment.targetPlayer}`);
                    }
                    break;
                
                case 'seeking_allocation':
                    if (allocationReceived >= (commitment.requiredAllocation || 25)) {
                        const rewardVotes = Math.min(20, remainingVotes);
                        if (rewardVotes > 0) {
                            allocations[commitment.targetPlayer] = (allocations[commitment.targetPlayer] || 0) + rewardVotes;
                            remainingVotes -= rewardVotes;
                            enforced.push(`✅ REWARD: Give ${rewardVotes} votes to ${commitment.targetPlayer} (met your demand)`);
                        }
                    }
                    break;
            }
        });

        enforced.push(`🏦 REMAINING VOTES: ${remainingVotes} (allocate strategically)`);
        
        if (Object.keys(allocations).length > 0) {
            enforced.push(`📊 SUGGESTED ALLOCATION: ${JSON.stringify(allocations)}`);
        }

        return enforced.join('\n');
    }

    // Generate specific vote enforcement based on promises made
    generateVoteEnforcement(playerName, commitmentsIMade, proposals) {
        if (commitmentsIMade.length === 0) {
            return "💰 No promises binding you - vote for whoever gives you the most tokens.";
        }

        const enforcements = [];
        commitmentsIMade.forEach(commitment => {
            const targetProposal = proposals[commitment.targetPlayer];
            const myAllocation = targetProposal ? targetProposal[playerName] || 0 : 0;
            
            if (myAllocation >= 15) {
                enforcements.push(`✅ ${commitment.targetPlayer}: They gave you ${myAllocation}% - HONOR your promise with votes`);
            } else {
                enforcements.push(`❌ ${commitment.targetPlayer}: They gave you only ${myAllocation}% - feel free to BETRAY`);
            }
        });

        return `\n🎯 PROMISE-KEEPING GUIDE:\n${enforcements.join('\n')}`;
    }
}

module.exports = { EnhancedNegotiationSystem }; 