#!/usr/bin/env python3
"""
Simple Balance Timeline Analyzer
Reads the CSV balance timeline data and provides insights using only built-in Python libraries.
"""

import csv
import glob
import os
from collections import defaultdict

def analyze_balance_timeline(csv_file=None):
    # If no file specified, find the most recent balance timeline CSV
    if csv_file is None:
        csv_files = glob.glob('balance_timeline_*.csv')
        if not csv_files:
            print("No balance timeline CSV files found!")
            return
        csv_file = max(csv_files, key=os.path.getctime)
        print(f"Using most recent file: {csv_file}")
    
    # Read and parse CSV data
    data = []
    try:
        with open(csv_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append({
                    'Strategy': row['Strategy'],
                    'StrategyId': row['StrategyId'],
                    'Tournament': int(row['Tournament']),
                    'Game': int(row['Game']),
                    'Balance': int(row['Balance']),
                    'Profit': int(row['Profit']),
                    'IsWinner': row['IsWinner'].lower() == 'true',
                    'IsEliminated': row['IsEliminated'].lower() == 'true'
                })
    except FileNotFoundError:
        print(f"File not found: {csv_file}")
        return
    
    # Organize data by strategy
    strategies = defaultdict(list)
    for row in data:
        strategies[row['Strategy']].append(row)
    
    # Sort each strategy's data by tournament and game
    for strategy in strategies:
        strategies[strategy].sort(key=lambda x: (x['Tournament'], x['Game']))
    
    print("\n📊 BALANCE TIMELINE ANALYSIS")
    print("=" * 50)
    
    # Calculate statistics for each strategy
    strategy_stats = []
    
    for strategy_name, strategy_data in strategies.items():
        # Get starting and final balances
        start_balance = strategy_data[0]['Balance']
        final_balance = strategy_data[-1]['Balance']
        total_change = final_balance - start_balance
        change_pct = (total_change / start_balance) * 100
        
        # Calculate peak balance
        peak_balance = max(row['Balance'] for row in strategy_data)
        
        # Calculate volatility (standard deviation of profit changes)
        game_data = [row for row in strategy_data if row['Game'] > 0]
        profits = [row['Profit'] for row in game_data]
        
        if profits:
            mean_profit = sum(profits) / len(profits)
            variance = sum((p - mean_profit) ** 2 for p in profits) / len(profits)
            volatility = variance ** 0.5
        else:
            volatility = 0
        
        # Calculate win rate
        wins = sum(1 for row in game_data if row['IsWinner'])
        total_games = len(game_data)
        win_rate = (wins / total_games) * 100 if total_games > 0 else 0
        
        strategy_stats.append({
            'name': strategy_name,
            'start': start_balance,
            'final': final_balance,
            'peak': peak_balance,
            'change': total_change,
            'change_pct': change_pct,
            'volatility': volatility,
            'wins': wins,
            'total_games': total_games,
            'win_rate': win_rate,
            'data': strategy_data
        })
    
    # Sort by final balance (descending)
    strategy_stats.sort(key=lambda x: x['final'], reverse=True)
    
    # Display results
    print(f"\n🏆 FINAL RANKINGS (by Balance)")
    print("-" * 50)
    
    for i, stats in enumerate(strategy_stats):
        rank_icon = ['🥇', '🥈', '🥉'][i] if i < 3 else '📍'
        change_icon = '📈' if stats['change'] >= 0 else '📉'
        
        print(f"{rank_icon} {stats['name']}")
        print(f"   💰 {stats['start']} → {stats['final']} coins ({change_icon} {stats['change']:+.0f}, {stats['change_pct']:+.1f}%)")
        print(f"   📊 Peak: {stats['peak']} | Volatility: ±{stats['volatility']:.1f}")
        print(f"   🏆 Win Rate: {stats['win_rate']:.1f}% ({stats['wins']}/{stats['total_games']})")
        print()
    
    # Generate ASCII timeline chart
    print("📈 BALANCE PROGRESSION TIMELINE")
    print("-" * 50)
    
    # Create simplified ASCII chart
    max_balance = max(max(row['Balance'] for row in stats['data']) for stats in strategy_stats)
    chart_height = 10
    chart_width = 40
    
    print(f"Balance")
    print(f"{max_balance:>4}|{'─' * chart_width}")
    
    # Show progression for each strategy
    for stats in strategy_stats[:3]:  # Top 3 strategies only for readability
        name = stats['name'][:12]  # Truncate name
        line = f"{name:>12}|"
        
        game_data = [row for row in stats['data'] if row['Game'] >= 0]
        for i in range(chart_width):
            # Map chart position to data point
            data_index = int((i / chart_width) * (len(game_data) - 1)) if len(game_data) > 1 else 0
            balance = game_data[data_index]['Balance']
            height_ratio = balance / max_balance
            
            # Simple representation
            if height_ratio > 0.8:
                line += "█"
            elif height_ratio > 0.6:
                line += "▓"
            elif height_ratio > 0.4:
                line += "▒"
            elif height_ratio > 0.2:
                line += "░"
            else:
                line += " "
        
        print(line)
    
    print(f"{'':>4}|{'─' * chart_width}")
    print(f"   0 Game 0{' ' * (chart_width - 15)}Final Game")
    
    # Key insights
    print("\n🎯 KEY INSIGHTS")
    print("-" * 50)
    
    most_profitable = max(strategy_stats, key=lambda x: x['change'])
    most_volatile = max(strategy_stats, key=lambda x: x['volatility'])
    most_consistent = min(strategy_stats, key=lambda x: x['volatility'])
    best_win_rate = max(strategy_stats, key=lambda x: x['win_rate'])
    
    print(f"💰 Most Profitable: {most_profitable['name']} ({most_profitable['change']:+.0f} coins)")
    print(f"🎲 Most Volatile: {most_volatile['name']} (±{most_volatile['volatility']:.1f} coins/game)")
    print(f"🎯 Most Consistent: {most_consistent['name']} (±{most_consistent['volatility']:.1f} coins/game)")
    print(f"🏆 Best Win Rate: {best_win_rate['name']} ({best_win_rate['win_rate']:.1f}%)")
    
    # Risk-reward analysis
    print(f"\n📊 RISK vs REWARD ANALYSIS")
    print("-" * 50)
    
    for stats in strategy_stats:
        risk_level = "HIGH" if stats['volatility'] > 60 else "MED" if stats['volatility'] > 30 else "LOW"
        reward_level = "HIGH" if stats['change'] > 100 else "MED" if stats['change'] > 0 else "LOW"
        
        print(f"{stats['name']}: Risk={risk_level}, Reward={reward_level}")
    
    print(f"\n📝 BLOG POST INSIGHTS:")
    print("-" * 30)
    print("1. Balance progression shows clear strategy differentiation")
    print("2. High volatility ≠ high returns (risk management matters)")
    print("3. Consistent strategies may sacrifice upside for stability")
    print("4. Win rate and profitability don't always correlate")
    print("5. Economic pressure creates distinct risk profiles")
    
    return csv_file

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    else:
        csv_file = None
    
    analyze_balance_timeline(csv_file) 