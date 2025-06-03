// Evolution Reporter - Generate comprehensive analysis tables and reports
const fs = require('fs');

class EvolutionReporter {
  constructor(data) {
    this.data = data;
    this.isPartialData = data.completedTournaments && data.totalTournaments && 
                        data.completedTournaments < data.totalTournaments;
  }

  // Smart truncation that preserves sentence completeness
  smartTruncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastSentenceEnd > maxLength * 0.6) { // If we can keep at least 60% and end on sentence
      return truncated.substring(0, lastSentenceEnd + 1);
    } else {
      // Fallback: truncate at last space and add period
      const lastSpace = truncated.lastIndexOf(' ');
      return truncated.substring(0, lastSpace > 0 ? lastSpace : maxLength - 3) + '...';
    }
  }

  generateMarkdownReport() {
    let report = `# Enhanced Agent Battle Evolution Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    
    // Add progress information for partial data
    if (this.isPartialData) {
      report += `**⚠️ PARTIAL DATA:** ${this.data.completedTournaments}/${this.data.totalTournaments} tournaments completed\n`;
      report += `**Last Update:** ${this.data.timestamp}\n`;
    }
    report += `\n`;
    
    // Core Strategies Overview
    report += this.generateCoreStrategiesTable();
    
    // Balance Timeline Visualization - NEW
    report += this.generateBalanceTimeline();
    
    // Tournament-by-Tournament Analysis
    report += this.generateTournamentAnalysis();
    
    // Game-by-Game Performance Tables
    report += this.generateGamePerformanceAnalysis();
    
    // Strategy Evolution Tracking
    report += this.generateEvolutionTracking();
    
    // Strategy Relationship Matrix - NEW
    report += this.generateStrategyRelationshipMatrix();
    
    // Economic Performance Analysis
    report += this.generateEconomicAnalysis();
    
    // Coalition and Strategic Move Analysis
    report += this.generateCoalitionAnalysis();
    
    // Final Rankings and Insights
    report += this.generateFinalInsights();
    
    return report;
  }

  generateCoreStrategiesTable() {
    let section = `## Core Starting Strategies\n\n`;
    section += `The simulation began with 6 distinct strategic archetypes, each starting with 500 coins:\n\n`;
    
    section += `| Strategy | Archetype | Core Approach |\n`;
    section += `|----------|-----------|---------------|\n`;
    
    // Assuming CORE_STRATEGIES are available in the data
    const coreStrategies = [
      { name: 'Aggressive Maximizer', archetype: 'AGGRESSIVE', strategy: 'Demand the largest possible share. Use threats and aggressive tactics. Form coalitions only when absolutely necessary to avoid elimination.' },
      { name: 'Diplomatic Builder', archetype: 'DIPLOMATIC', strategy: 'Build long-term trust through consistently fair offers. Prioritize mutual benefit and stable coalitions. Avoid betrayals.' },
      { name: 'Strategic Opportunist', archetype: 'OPPORTUNISTIC', strategy: 'Adapt rapidly to changing situations. Form and break alliances based on immediate advantage. Keep all options open.' },
      { name: 'Mathematical Analyzer', archetype: 'ANALYTICAL', strategy: 'Make all decisions based on expected value calculations. Minimize risk through probability analysis. Avoid emotional decisions.' },
      { name: 'Social Manipulator', archetype: 'MANIPULATIVE', strategy: 'Use psychological tactics to influence others. Make strategic promises and betrayals. Create chaos to exploit confusion.' },
      { name: 'Strategy Identifier', archetype: 'STRATEGY_IDENTIFIER', strategy: 'Analyze opponent negotiation patterns, proposal behaviors, and voting tendencies to identify their strategies. Adapt your approach to optimally counter each opponent type in real-time.' }
    ];
    
    coreStrategies.forEach(strategy => {
      section += `| **${strategy.name}** | ${strategy.archetype} | ${this.smartTruncate(strategy.strategy, 100)} |\n`;
    });
    
    section += `\n**Economic Rules:**\n`;
    section += `- Starting balance: 500 coins\n`;
    section += `- Entry fee per game: 100 coins\n`;
    section += `- Bankruptcy threshold: <100 coins (eliminated and replaced)\n`;
    section += `- Prize distribution based on winning proposals\n\n`;
    
    return section;
  }

  generateTournamentAnalysis() {
    let section = `## Tournament-by-Tournament Performance\n\n`;
    
    if (!this.data.tournaments || this.data.tournaments.length === 0) {
      return section + `No tournament data available.\n\n`;
    }

    this.data.tournaments.forEach((tournament, index) => {
      section += `### Tournament ${tournament.tournamentNumber}\n\n`;
      
      // Starting vs Ending Balances
      section += `#### Financial Performance\n\n`;
      section += `| Strategy | Starting Balance | Ending Balance | Net Change | Games Played |\n`;
      section += `|----------|------------------|----------------|------------|-------------|\n`;
      
      const startingBalances = tournament.startingBalances || [];
      const endingBalances = tournament.endingBalances || [];
      
      startingBalances.forEach(start => {
        const end = endingBalances.find(e => e.id === start.id);
        const netChange = end ? end.balance - start.balance : 0;
        const changeIcon = netChange >= 0 ? '📈' : '📉';
        
        section += `| ${start.name} | ${start.balance} | ${end ? end.balance : 'N/A'} | ${changeIcon} ${netChange >= 0 ? '+' : ''}${netChange} | ${tournament.games?.length || 0} |\n`;
      });
      
      section += `\n`;
      
      // Strategy Evolution
      if (tournament.strategiesEliminated?.length > 0) {
        section += `**💀 Eliminated:** ${tournament.strategiesEliminated.map(s => s.name || s.id).join(', ')}\n\n`;
      }
      
      if (tournament.strategiesEvolved?.length > 0) {
        section += `**🧬 Evolved Strategies:**\n`;
        tournament.strategiesEvolved.forEach(evolved => {
          section += `- **${evolved.name}** [${evolved.archetype}]: ${this.smartTruncate(evolved.strategy, 100)}\n`;
        });
        section += `\n`;
      }
    });
    
    return section;
  }

  generateGamePerformanceAnalysis() {
    let section = `## Game-by-Game Performance Analysis\n\n`;
    
    if (!this.data.tournaments) {
      return section + `No game data available.\n\n`;
    }

    this.data.tournaments.forEach((tournament, tIndex) => {
      section += `### Tournament ${tournament.tournamentNumber} - Detailed Game Results\n\n`;
      
      if (!tournament.games || tournament.games.length === 0) {
        section += `No game data available for this tournament.\n\n`;
        return;
      }

      tournament.games.forEach((game, gIndex) => {
        section += `#### Game ${game.gameNumber}\n\n`;
        
        // Game Summary
        section += `**Winner:** ${game.finalResult?.winner?.name || 'Unknown'}\n`;
        section += `**Rounds Played:** ${game.rounds?.length || 0}\n\n`;
        
        // Economic Results
        section += `**Economic Impact:**\n\n`;
        section += `| Player | Strategy | Entry Fee | Payout | Profit/Loss | Winner |\n`;
        section += `|--------|----------|-----------|--------|-------------|--------|\n`;
        
        if (game.economicImpact) {
          game.economicImpact.forEach(impact => {
            const profitIcon = impact.profit >= 0 ? '💰' : '💸';
            const winnerIcon = impact.isWinner ? '🏆' : '';
            section += `| ${impact.playerName} | ${impact.strategyId} | ${impact.entryFee} | ${impact.payout} | ${profitIcon} ${impact.profit >= 0 ? '+' : ''}${impact.profit} | ${winnerIcon} |\n`;
          });
        }
        section += `\n`;
        
        // Round-by-Round Analysis
        if (game.rounds && game.rounds.length > 0) {
          section += `**Round Details:**\n\n`;
          
          game.rounds.forEach((round, rIndex) => {
            section += `**Round ${round.roundNumber}:**\n`;
            
            // Key negotiations
            if (round.negotiations && round.negotiations.length > 0) {
              section += `- **Key Messages:**\n`;
              round.negotiations.forEach(neg => {
                section += `  - ${neg.playerName}: "${neg.message}"\n`;
              });
            }
            
            // Coalitions formed
            if (round.coalitionsFormed && round.coalitionsFormed.length > 0) {
              section += `- **Coalitions Attempted:** ${round.coalitionsFormed.length}\n`;
            }
            
            // Strategic moves
            if (round.strategicMoves && round.strategicMoves.length > 0) {
              section += `- **Strategic Moves:** ${round.strategicMoves.map(move => move.type).join(', ')}\n`;
            }
            
            section += `\n`;
          });
        }
      });
    });
    
    return section;
  }

  generateEvolutionTracking() {
    let section = `## Strategy Evolution Tracking\n\n`;
    
    // Create a family tree of strategy evolution
    section += `### Strategy Evolution Family Tree\n\n`;
    section += `This shows how strategies evolved from the original 5 archetypes:\n\n`;
    
    // Track evolution through tournaments
    const evolutionTree = this.buildEvolutionTree();
    
    section += `\`\`\`\n`;
    section += `GENERATION 1 (Starting Strategies)\n`;
    section += `├── Aggressive Maximizer [AGGRESSIVE]\n`;
    section += `├── Diplomatic Builder [DIPLOMATIC]\n`;
    section += `├── Strategic Opportunist [OPPORTUNISTIC]\n`;
    section += `├── Mathematical Analyzer [ANALYTICAL]\n`;
    section += `└── Social Manipulator [MANIPULATIVE]\n`;
    section += `\n`;
    
    // Add evolution paths
    if (this.data.tournaments) {
      this.data.tournaments.forEach((tournament, index) => {
        if (tournament.strategiesEvolved && tournament.strategiesEvolved.length > 0) {
          section += `GENERATION ${index + 2} (After Tournament ${tournament.tournamentNumber})\n`;
          tournament.strategiesEvolved.forEach((evolved, eIndex) => {
            const isLast = eIndex === tournament.strategiesEvolved.length - 1;
            const prefix = isLast ? '└──' : '├──';
            section += `${prefix} ${evolved.name} [${evolved.archetype}]\n`;
            if (evolved.parentStrategy) {
              section += `    └─ Evolved from: ${evolved.parentStrategy}\n`;
            } else if (evolved.parentStrategies) {
              section += `    └─ Hybrid of: ${evolved.parentStrategies.join(' + ')}\n`;
            }
          });
          section += `\n`;
        }
      });
    }
    
    section += `\`\`\`\n\n`;
    
    return section;
  }

  buildEvolutionTree() {
    // Helper method to build evolution tree structure
    const tree = {
      generation1: ['Aggressive Maximizer', 'Diplomatic Builder', 'Strategic Opportunist', 'Mathematical Analyzer', 'Social Manipulator'],
      subsequent: []
    };
    
    if (this.data.tournaments) {
      this.data.tournaments.forEach(tournament => {
        if (tournament.strategiesEvolved) {
          tree.subsequent.push({
            tournament: tournament.tournamentNumber,
            evolved: tournament.strategiesEvolved
          });
        }
      });
    }
    
    return tree;
  }

  generateEconomicAnalysis() {
    let section = `## Economic Performance Analysis\n\n`;
    
    // Calculate overall strategy performance
    const strategyPerformance = this.calculateOverallPerformance();
    
    section += `### Overall Strategy Performance (All Tournaments)\n\n`;
    section += `| Strategy | Total Games | Total Invested | Total Returned | Net Profit | ROI% | Win Rate | Avg Profit/Game |\n`;
    section += `|----------|-------------|----------------|----------------|------------|------|----------|------------------|\n`;
    
    Object.entries(strategyPerformance).forEach(([strategyId, perf]) => {
      const roi = perf.totalInvested > 0 ? ((perf.totalReturned - perf.totalInvested) / perf.totalInvested * 100).toFixed(1) : 0;
      const winRate = perf.gamesPlayed > 0 ? (perf.wins / perf.gamesPlayed * 100).toFixed(1) : 0;
      const avgProfit = perf.gamesPlayed > 0 ? ((perf.totalReturned - perf.totalInvested) / perf.gamesPlayed).toFixed(1) : 0;
      const profitIcon = perf.totalReturned - perf.totalInvested >= 0 ? '💰' : '💸';
      
      section += `| ${strategyId} | ${perf.gamesPlayed} | ${perf.totalInvested} | ${perf.totalReturned} | ${profitIcon} ${(perf.totalReturned - perf.totalInvested >= 0 ? '+' : '')}${(perf.totalReturned - perf.totalInvested).toFixed(0)} | ${roi}% | ${winRate}% | ${avgProfit} |\n`;
    });
    
    section += `\n### Key Economic Insights\n\n`;
    
    // Find best and worst performers
    const performers = Object.entries(strategyPerformance)
      .map(([id, perf]) => ({
        id,
        ...perf,
        netProfit: perf.totalReturned - perf.totalInvested,
        roi: perf.totalInvested > 0 ? (perf.totalReturned - perf.totalInvested) / perf.totalInvested * 100 : 0
      }))
      .sort((a, b) => b.netProfit - a.netProfit);
    
    if (performers.length > 0) {
      const best = performers[0];
      const worst = performers[performers.length - 1];
      
      section += `**🏆 Most Profitable:** ${best.id} with ${best.netProfit >= 0 ? '+' : ''}${best.netProfit.toFixed(0)} coins profit (${best.roi.toFixed(1)}% ROI)\n\n`;
      section += `**💸 Least Profitable:** ${worst.id} with ${worst.netProfit >= 0 ? '+' : ''}${worst.netProfit.toFixed(0)} coins profit (${worst.roi.toFixed(1)}% ROI)\n\n`;
      
      // Survival analysis
      const survivors = performers.filter(p => p.netProfit >= -400); // Those who didn't get eliminated too often
      section += `**🏥 Survival Rate:** ${survivors.length}/${performers.length} strategies maintained positive/neutral performance\n\n`;
    }
    
    return section;
  }

  calculateOverallPerformance() {
    const performance = {};
    
    if (!this.data.tournaments) return performance;
    
    this.data.tournaments.forEach(tournament => {
      if (!tournament.games) return;
      
      tournament.games.forEach(game => {
        if (!game.economicImpact) return;
        
        game.economicImpact.forEach(impact => {
          if (!performance[impact.strategyId]) {
            performance[impact.strategyId] = {
              gamesPlayed: 0,
              totalInvested: 0,
              totalReturned: 0,
              wins: 0
            };
          }
          
          const perf = performance[impact.strategyId];
          perf.gamesPlayed++;
          perf.totalInvested += impact.entryFee;
          perf.totalReturned += impact.payout;
          if (impact.isWinner) perf.wins++;
        });
      });
    });
    
    return performance;
  }

  generateCoalitionAnalysis() {
    let section = `## Coalition and Strategic Behavior Analysis\n\n`;
    
    const coalitionData = this.analyzeCoalitionBehavior();
    
    section += `### Coalition Formation Patterns\n\n`;
    section += `| Tournament | Game | Round | Coalition Attempts | Strategic Moves | Winner Strategy |\n`;
    section += `|------------|------|-------|-------------------|-----------------|----------------|\n`;
    
    if (this.data.tournaments) {
      this.data.tournaments.forEach(tournament => {
        if (!tournament.games) return;
        
        tournament.games.forEach(game => {
          if (!game.rounds) return;
          
          game.rounds.forEach(round => {
            const coalitions = round.coalitionsFormed?.length || 0;
            const moves = round.strategicMoves?.length || 0;
            const winner = game.finalResult?.winner?.name || 'Unknown';
            
            if (coalitions > 0 || moves > 0) {
              section += `| ${tournament.tournamentNumber} | ${game.gameNumber} | ${round.roundNumber} | ${coalitions} | ${moves} | ${winner} |\n`;
            }
          });
        });
      });
    }
    
    section += `\n### Strategic Move Types\n\n`;
    
    const moveTypes = coalitionData.moveTypes;
    if (Object.keys(moveTypes).length > 0) {
      section += `| Move Type | Frequency | Success Rate* |\n`;
      section += `|-----------|-----------|---------------|\n`;
      
      Object.entries(moveTypes).forEach(([type, count]) => {
        section += `| ${type} | ${count} | TBD** |\n`;
      });
      
      section += `\n*Success rate calculation requires cross-referencing with game outcomes\n`;
      section += `**TBD = To Be Determined in future analysis\n\n`;
    }
    
    return section;
  }

  analyzeCoalitionBehavior() {
    const moveTypes = {};
    let totalCoalitions = 0;
    
    if (this.data.tournaments) {
      this.data.tournaments.forEach(tournament => {
        if (!tournament.games) return;
        
        tournament.games.forEach(game => {
          if (!game.rounds) return;
          
          game.rounds.forEach(round => {
            if (round.coalitionsFormed) {
              totalCoalitions += round.coalitionsFormed.length;
            }
            
            if (round.strategicMoves) {
              round.strategicMoves.forEach(move => {
                moveTypes[move.type] = (moveTypes[move.type] || 0) + 1;
              });
            }
          });
        });
      });
    }
    
    return {
      totalCoalitions,
      moveTypes
    };
  }

  generateFinalInsights() {
    let section = `## Key Findings and Strategic Insights\n\n`;
    
    const performance = this.calculateOverallPerformance();
    const coalitionData = this.analyzeCoalitionBehavior();
    
    section += `### 🎯 Core Insights\n\n`;
    
    // Performance insights
    const performers = Object.entries(performance)
      .map(([id, perf]) => ({
        id,
        ...perf,
        netProfit: perf.totalReturned - perf.totalInvested,
        roi: perf.totalInvested > 0 ? (perf.totalReturned - perf.totalInvested) / perf.totalInvested * 100 : 0,
        winRate: perf.gamesPlayed > 0 ? perf.wins / perf.gamesPlayed * 100 : 0
      }))
      .sort((a, b) => b.netProfit - a.netProfit);
    
    if (performers.length > 0) {
      section += `#### 1. **Economic Performance Patterns**\n\n`;
      
      const profitable = performers.filter(p => p.netProfit > 0);
      const unprofitable = performers.filter(p => p.netProfit <= 0);
      
      section += `- **${profitable.length}/${performers.length}** strategies achieved positive returns\n`;
      section += `- **Highest ROI:** ${performers[0].roi.toFixed(1)}% (${performers[0].id})\n`;
      section += `- **Best Win Rate:** ${Math.max(...performers.map(p => p.winRate)).toFixed(1)}%\n\n`;
      
      section += `#### 2. **Strategic Behavior Patterns**\n\n`;
      section += `- **Total Coalition Attempts:** ${coalitionData.totalCoalitions}\n`;
      section += `- **Most Common Move:** ${Object.entries(coalitionData.moveTypes).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None detected'}\n`;
      section += `- **Strategic Diversity:** ${Object.keys(coalitionData.moveTypes).length} different move types observed\n\n`;
      
      section += `#### 3. **Evolution Effectiveness**\n\n`;
      const tournaments = this.data.tournaments?.length || 0;
      const evolutions = this.data.tournaments?.reduce((sum, t) => sum + (t.strategiesEvolved?.length || 0), 0) || 0;
      
      section += `- **Total Tournaments:** ${tournaments}\n`;
      section += `- **Strategy Evolutions:** ${evolutions}\n`;
      section += `- **Adaptation Rate:** ${tournaments > 0 ? (evolutions / tournaments).toFixed(1) : 0} new strategies per tournament\n\n`;
    }
    
    section += `### 🏆 Winning Strategy Characteristics\n\n`;
    
    if (performers.length > 0) {
      const topPerformer = performers[0];
      section += `The most successful strategy was **${topPerformer.id}** with:\n`;
      section += `- Net profit of ${topPerformer.netProfit.toFixed(0)} coins\n`;
      section += `- ${topPerformer.roi.toFixed(1)}% return on investment\n`;
      section += `- ${topPerformer.winRate.toFixed(1)}% win rate across ${topPerformer.gamesPlayed} games\n\n`;
    }
    
    section += `### 🔬 Research Implications\n\n`;
    section += `1. **Economic Rationality:** Strategies with built-in economic reality checks performed better\n`;
    section += `2. **Coalition Dynamics:** Active coalition management was crucial for success\n`;
    section += `3. **Adaptability:** Strategies that could evolve their tactics showed greater longevity\n`;
    section += `4. **Risk Management:** Balanced approaches outperformed pure strategies\n\n`;
    
    section += `### 📊 Data Export Information\n\n`;
    section += `Complete data exported to: \`${this.data.exportFile || 'enhanced_evolution_data.json'}\`\n`;
    section += `Total data points collected: ${this.calculateDataPoints()}\n\n`;
    
    return section;
  }

  calculateDataPoints() {
    let points = 0;
    
    if (this.data.tournaments) {
      this.data.tournaments.forEach(tournament => {
        if (tournament.games) {
          tournament.games.forEach(game => {
            points += 1; // Game itself
            if (game.rounds) {
              points += game.rounds.length; // Each round
              game.rounds.forEach(round => {
                points += (round.negotiations?.length || 0); // Each negotiation
                points += (round.proposals?.length || 0); // Each proposal
                points += Object.keys(round.votes || {}).length; // Each vote
              });
            }
          });
        }
      });
    }
    
    return points;
  }

  generateBalanceTimeline() {
    let section = `## Strategy Performance Over Time\n\n`;
    
    // Look for balance timeline in multiple places
    let timeline = this.data.balanceTimeline;
    if (!timeline && this.data.tournaments && this.data.tournaments.length > 0) {
      // Try to find it in tournament data
      for (const tournament of this.data.tournaments) {
        if (tournament.balanceTimeline) {
          timeline = tournament.balanceTimeline;
          break;
        }
      }
    }
    
    if (!timeline || Object.keys(timeline).length === 0) {
      return section + `No balance timeline data available.\n\n`;
    }

    section += `### Coin Balance Progression\n\n`;
    section += `This chart shows how each strategy's coin balance changed over time across all games:\n\n`;
    
    // Generate ASCII chart
    section += this.generateASCIIChart(timeline);
    
    // Generate detailed balance table
    section += this.generateBalanceTable(timeline);
    
    // Generate insights from timeline data
    section += this.generateTimelineInsights(timeline);
    
    // Export CSV data for external plotting
    this.exportBalanceCSV(timeline);
    
    return section;
  }

  generateASCIIChart(timeline) {
    let chart = `\n\`\`\`\nCoin Balance Over Time (Games)\n\n`;
    
    // Find the range of balances and games
    let maxBalance = 0;
    let maxGame = 0;
    const strategies = Object.keys(timeline);
    
    strategies.forEach(strategyId => {
      timeline[strategyId].dataPoints.forEach(point => {
        maxBalance = Math.max(maxBalance, point.balance);
        maxGame = Math.max(maxGame, point.tournament * 10 + point.game); // Rough game numbering
      });
    });
    
    // Create a simplified ASCII chart (showing key milestones)
    const chartHeight = 15;
    const chartWidth = 60;
    
    chart += `Balance\n`;
    chart += `${maxBalance}|`;
    for (let i = 0; i < chartWidth; i++) chart += '-';
    chart += `\n`;
    
    // Show a few key data points for each strategy
    strategies.forEach((strategyId, index) => {
      const data = timeline[strategyId];
      const name = data.name.substring(0, 12); // Truncate for display
      const symbol = ['*', '+', 'o', '#', '%', '@'][index % 6];
      
      let line = `${name.padEnd(12)}|`;
      const points = data.dataPoints;
      
      for (let x = 0; x < chartWidth; x++) {
        const gameIndex = Math.floor((x / chartWidth) * (points.length - 1));
        const point = points[gameIndex];
        const height = Math.floor((point.balance / maxBalance) * chartHeight);
        
        if (Math.floor(x / (chartWidth / chartHeight)) === height) {
          line += symbol;
        } else {
          line += ' ';
        }
      }
      
      chart += line + '\n';
    });
    
    chart += `       0|`;
    for (let i = 0; i < chartWidth; i++) chart += '-';
    chart += `\n`;
    chart += `        Game 0`;
    chart += ' '.repeat(chartWidth - 20);
    chart += `Final Game\n\n`;
    
    // Legend
    chart += `Legend:\n`;
    strategies.forEach((strategyId, index) => {
      const symbol = ['*', '+', 'o', '#', '%', '@'][index % 6];
      const name = timeline[strategyId].name;
      chart += `${symbol} = ${name}\n`;
    });
    
    chart += `\`\`\`\n\n`;
    
    return chart;
  }

  generateBalanceTable(timeline) {
    let table = `### Detailed Balance Progression\n\n`;
    
    table += `| Strategy | Starting | Peak | Final | Total Change | Volatility | Eliminations |\n`;
    table += `|----------|----------|------|-------|--------------|------------|-------------|\n`;
    
    Object.entries(timeline).forEach(([strategyId, data]) => {
      const points = data.dataPoints;
      if (points.length === 0) return;
      
      const starting = points[0].balance;
      const final = points[points.length - 1].balance;
      const peak = Math.max(...points.map(p => p.balance));
      const totalChange = final - starting;
      
      // Calculate volatility (standard deviation of changes)
      const changes = points.slice(1).map((p, i) => p.balance - points[i].balance);
      const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
      const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length;
      const volatility = Math.sqrt(variance).toFixed(1);
      
      // Count eliminations (balance drops below 100)
      const eliminations = points.filter(p => p.isEliminated).length;
      
      const changeIcon = totalChange >= 0 ? '📈' : '📉';
      const name = this.smartTruncate(data.name, 15);
      
      table += `| ${name} | ${starting} | ${peak} | ${final} | ${changeIcon} ${totalChange >= 0 ? '+' : ''}${totalChange} | ±${volatility} | ${eliminations} |\n`;
    });
    
    table += `\n*Volatility = Standard deviation of balance changes per game*\n\n`;
    
    return table;
  }

  generateTimelineInsights(timeline) {
    let insights = `### Timeline Insights\n\n`;
    
    // Analyze patterns across all strategies
    const allPoints = [];
    Object.entries(timeline).forEach(([strategyId, data]) => {
      data.dataPoints.forEach(point => {
        allPoints.push({
          ...point,
          strategyId,
          strategyName: data.name
        });
      });
    });
    
    // Group by game to see trends
    const gameData = {};
    allPoints.forEach(point => {
      const gameKey = `T${point.tournament}G${point.game}`;
      if (!gameData[gameKey]) {
        gameData[gameKey] = [];
      }
      gameData[gameKey].push(point);
    });
    
    insights += `#### Performance Patterns\n\n`;
    
    // Find most consistent performers
    const consistencyScores = {};
    Object.entries(timeline).forEach(([strategyId, data]) => {
      const changes = data.dataPoints.slice(1).map((p, i) => 
        Math.abs(p.balance - data.dataPoints[i].balance)
      );
      const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
      consistencyScores[strategyId] = {
        name: data.name,
        avgChange: avgChange.toFixed(1)
      };
    });
    
    const mostConsistent = Object.entries(consistencyScores)
      .sort(([,a], [,b]) => a.avgChange - b.avgChange)[0];
    
    insights += `**🎯 Most Consistent Strategy:** ${mostConsistent[1].name} (avg change: ±${mostConsistent[1].avgChange} coins per game)\n\n`;
    
    // Find biggest winner and loser trends
    const finalBalances = Object.entries(timeline).map(([strategyId, data]) => ({
      strategyId,
      name: data.name,
      final: data.dataPoints[data.dataPoints.length - 1]?.balance || 0,
      starting: data.dataPoints[0]?.balance || 500,
      change: (data.dataPoints[data.dataPoints.length - 1]?.balance || 0) - (data.dataPoints[0]?.balance || 500)
    })).sort((a, b) => b.change - a.change);
    
    if (finalBalances.length > 0) {
      const biggest_winner = finalBalances[0];
      const biggest_loser = finalBalances[finalBalances.length - 1];
      
      insights += `**📈 Biggest Gainer:** ${biggest_winner.name} (+${biggest_winner.change} coins)\n`;
      insights += `**📉 Biggest Loser:** ${biggest_loser.name} (${biggest_loser.change} coins)\n\n`;
    }
    
    // Survival analysis
    const eliminationData = Object.entries(timeline).map(([strategyId, data]) => {
      const eliminations = data.dataPoints.filter(p => p.isEliminated).length;
      return {
        name: data.name,
        eliminations,
        finalBalance: data.dataPoints[data.dataPoints.length - 1]?.balance || 0
      };
    });
    
    const survivors = eliminationData.filter(d => d.finalBalance >= 100);
    const eliminated = eliminationData.filter(d => d.finalBalance < 100);
    
    insights += `**🏥 Survival Rate:** ${survivors.length}/${eliminationData.length} strategies survived to the end\n`;
    if (eliminated.length > 0) {
      insights += `**💀 Eliminated:** ${eliminated.map(e => e.name).join(', ')}\n`;
    }
    insights += `\n`;
    
    return insights;
  }

  exportBalanceCSV(timeline) {
    if (!timeline || Object.keys(timeline).length === 0) return;
    
    let csv = 'Strategy,StrategyId,Tournament,Game,Balance,Profit,IsWinner,IsEliminated\n';
    
    Object.entries(timeline).forEach(([strategyId, data]) => {
      data.dataPoints.forEach(point => {
        csv += `"${data.name}","${strategyId}",${point.tournament},${point.game},${point.balance},${point.profit},${point.isWinner},${point.isEliminated}\n`;
      });
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `balance_timeline_${timestamp}.csv`;
    
    try {
      fs.writeFileSync(filename, csv);
      console.log(`📊 Balance timeline CSV exported to ${filename}`);
    } catch (err) {
      console.log(`⚠️  Could not export CSV: ${err.message}`);
    }
  }

  exportReport(filename) {
    const report = this.generateMarkdownReport();
    fs.writeFileSync(filename, report);
    console.log(`📊 Comprehensive report exported to ${filename}`);
    return filename;
  }

  generateStrategyRelationshipMatrix() {
    let section = `## Strategy Relationship Matrix\n\n`;
    
    // Look for matchup data in the right place
    let matchups = this.data.strategyMatchups;
    if (!matchups && this.data.tournaments) {
      // Try to find it in other data locations
      matchups = this.data.matchups || {};
    }
    
    if (!matchups || Object.keys(matchups).length === 0) {
      return section + `No strategy matchup data available.\n\n`;
    }

    section += `This matrix shows how each strategy performs against others. Numbers show **Wins-Losses** in head-to-head games:\n\n`;
    
    // Get all unique strategy IDs
    const allStrategies = new Set();
    Object.keys(matchups).forEach(strategy => {
      allStrategies.add(strategy);
      Object.keys(matchups[strategy] || {}).forEach(opponent => {
        allStrategies.add(opponent);
      });
    });
    
    const strategies = Array.from(allStrategies).sort();
    
    if (strategies.length === 0) {
      return section + `No matchup data found.\n\n`;
    }
    
    // Create the matrix table
    section += `| Strategy | `;
    strategies.forEach(strategy => {
      const shortName = this.getShortStrategyName(strategy);
      section += `${shortName} | `;
    });
    section += `\n`;
    
    section += `|----------|`;
    strategies.forEach(() => section += `------|`);
    section += `\n`;
    
    // Fill in the matrix
    strategies.forEach(strategy1 => {
      const name1 = this.getShortStrategyName(strategy1);
      section += `| **${name1}** | `;
      
      strategies.forEach(strategy2 => {
        if (strategy1 === strategy2) {
          section += `**-** | `; // Self vs self
        } else {
          const matchup = matchups[strategy1]?.[strategy2];
          if (matchup) {
            const wins = matchup.wins || 0;
            const losses = matchup.losses || 0;
            const total = wins + losses;
            
            if (total > 0) {
              const winRate = ((wins / total) * 100).toFixed(0);
              const color = wins > losses ? '🟢' : wins < losses ? '🔴' : '🟡';
              section += `${color}${wins}-${losses} | `;
            } else {
              section += `0-0 | `;
            }
          } else {
            section += `0-0 | `;
          }
        }
      });
      section += `\n`;
    });
    
    section += `\n**Legend:** 🟢 = Winning record, 🔴 = Losing record, 🟡 = Tied record\n\n`;
    
    // Analysis section
    section += this.generateMatchupInsights(matchups, strategies);
    
    return section;
  }

  getShortStrategyName(strategyId) {
    // Convert strategy IDs to short readable names
    const nameMap = {
      'aggressive_maximizer': 'Aggressive',
      'diplomatic_builder': 'Diplomatic', 
      'strategic_opportunist': 'Opportunist',
      'mathematical_analyzer': 'Analytical',
      'social_manipulator': 'Manipulator',
      'strategy_identifier': 'Identifier'
    };
    
    // Handle evolved strategies
    if (strategyId.includes('_evolved_')) {
      const base = strategyId.split('_evolved_')[0];
      return (nameMap[base] || base) + ' v2';
    }
    
    if (strategyId.includes('hybrid_')) {
      return 'Hybrid';
    }
    
    if (strategyId.includes('novel_')) {
      return 'Novel';
    }
    
    return nameMap[strategyId] || strategyId.substring(0, 8);
  }

  generateMatchupInsights(matchups, strategies) {
    let insights = `### 🎯 Key Matchup Insights\n\n`;
    
    // Find the most dominant strategy
    const dominanceScores = {};
    strategies.forEach(strategy => {
      let totalWins = 0;
      let totalGames = 0;
      
      Object.values(matchups[strategy] || {}).forEach(matchup => {
        totalWins += matchup.wins || 0;
        totalGames += (matchup.wins || 0) + (matchup.losses || 0);
      });
      
      dominanceScores[strategy] = {
        winRate: totalGames > 0 ? (totalWins / totalGames * 100) : 0,
        totalWins,
        totalGames
      };
    });
    
    const sortedByWinRate = Object.entries(dominanceScores)
      .filter(([, data]) => data.totalGames > 0)
      .sort(([,a], [,b]) => b.winRate - a.winRate);
    
    if (sortedByWinRate.length > 0) {
      const [topStrategy, topData] = sortedByWinRate[0];
      insights += `**🏆 Most Dominant Strategy:** ${this.getShortStrategyName(topStrategy)} `;
      insights += `(${topData.winRate.toFixed(1)}% win rate, ${topData.totalWins}/${topData.totalGames} games)\n\n`;
    }
    
    // Find counter relationships (A beats B, B beats C, C beats A)
    insights += `**⚔️ Strategic Counters:**\n`;
    const counters = this.findCounterRelationships(matchups, strategies);
    if (counters.length > 0) {
      counters.forEach(counter => {
        insights += `- ${this.getShortStrategyName(counter.winner)} consistently beats ${this.getShortStrategyName(counter.loser)} `;
        insights += `(${counter.wins}-${counter.losses})\n`;
      });
    } else {
      insights += `- No clear counter-strategies emerged yet\n`;
    }
    insights += `\n`;
    
    // Rock-paper-scissors dynamics
    const cycles = this.findCyclicRelationships(matchups, strategies);
    if (cycles.length > 0) {
      insights += `**🪨📄✂️ Rock-Paper-Scissors Dynamics:**\n`;
      cycles.forEach(cycle => {
        insights += `- ${cycle.join(' → ')} → ${cycle[0]}\n`;
      });
      insights += `\n`;
    }
    
    return insights;
  }

  findCounterRelationships(matchups, strategies) {
    const counters = [];
    
    strategies.forEach(strategy1 => {
      strategies.forEach(strategy2 => {
        if (strategy1 !== strategy2) {
          const matchup = matchups[strategy1]?.[strategy2];
          if (matchup) {
            const wins = matchup.wins || 0;
            const losses = matchup.losses || 0;
            const total = wins + losses;
            
            // Consider it a counter if win rate > 70% and at least 3 games
            if (total >= 3 && wins / total > 0.7) {
              counters.push({
                winner: strategy1,
                loser: strategy2,
                wins,
                losses,
                winRate: (wins / total * 100).toFixed(1)
              });
            }
          }
        }
      });
    });
    
    return counters.sort((a, b) => b.winRate - a.winRate);
  }

  findCyclicRelationships(matchups, strategies) {
    // Look for A beats B, B beats C, C beats A patterns
    // This is a simplified check for 3-way cycles
    const cycles = [];
    
    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        for (let k = j + 1; k < strategies.length; k++) {
          const s1 = strategies[i];
          const s2 = strategies[j]; 
          const s3 = strategies[k];
          
          const s1BeatsS2 = this.getWinRate(matchups, s1, s2) > 0.6;
          const s2BeatsS3 = this.getWinRate(matchups, s2, s3) > 0.6;
          const s3BeatsS1 = this.getWinRate(matchups, s3, s1) > 0.6;
          
          if (s1BeatsS2 && s2BeatsS3 && s3BeatsS1) {
            cycles.push([
              this.getShortStrategyName(s1),
              this.getShortStrategyName(s2), 
              this.getShortStrategyName(s3)
            ]);
          }
        }
      }
    }
    
    return cycles;
  }

  getWinRate(matchups, strategy1, strategy2) {
    const matchup = matchups[strategy1]?.[strategy2];
    if (!matchup) return 0;
    
    const total = (matchup.wins || 0) + (matchup.losses || 0);
    return total > 0 ? (matchup.wins || 0) / total : 0;
  }
}

// Utility function to generate report from evolution data
function generateEvolutionReport(evolutionResult) {
  const reporter = new EvolutionReporter(evolutionResult);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `evolution_report_${timestamp}.md`;
  return reporter.exportReport(filename);
}

function generateProgressReport(progressFile) {
  console.log(`📊 Generating report from progress file: ${progressFile}`);
  
  try {
    const fs = require('fs');
    const progressData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    
    console.log(`📈 Found ${progressData.completedTournaments} completed tournaments`);
    
    const reporter = new EvolutionReporter(progressData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `progress_report_${timestamp}.md`;
    
    const report = reporter.generateMarkdownReport();
    fs.writeFileSync(reportFile, report);
    
    console.log(`✅ Progress report generated: ${reportFile}`);
    
    // Also try to generate balance chart if data exists
    if (progressData.balanceTimeline) {
      console.log('📊 Generating balance timeline chart from progress data...');
      const csvFile = `progress_timeline_${timestamp}.csv`;
      reporter.exportBalanceTimelineCSV(csvFile);
      
      // Generate chart
      try {
        const { exec } = require('child_process');
        exec(`python3 visualize_balance_timeline.py ${csvFile}`, (error, stdout, stderr) => {
          if (error) {
            console.error('Chart generation failed:', error.message);
          } else {
            console.log('📊 Progress balance chart generated successfully!');
          }
        });
      } catch (err) {
        console.error('❌ Could not generate progress chart:', err.message);
      }
    }
    
    return reportFile;
  } catch (err) {
    console.error('❌ Failed to generate progress report:', err.message);
    return null;
  }
}

module.exports = {
  EvolutionReporter,
  generateEvolutionReport,
  generateProgressReport
}; 