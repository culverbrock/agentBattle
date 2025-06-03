#!/usr/bin/env python3
"""
Balance Timeline Visualizer for Progress JSON Files
Generates charts showing coin evolution over tournaments and games
"""

import json
import sys
import matplotlib.pyplot as plt
import pandas as pd
from datetime import datetime
import numpy as np

def visualize_progress_data(json_file):
    """Generate balance timeline visualization from progress JSON"""
    
    print(f"📊 Loading progress data from {json_file}...")
    
    # Load the JSON data
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Extract balance timeline data
    balance_timeline = data.get('balanceTimeline', {})
    tournaments_completed = data.get('completedTournaments', 0)
    
    if not balance_timeline:
        print("❌ No balance timeline data found in progress file")
        return None
    
    print(f"✅ Found balance data for {len(balance_timeline)} strategies")
    print(f"🏆 Completed tournaments: {tournaments_completed}")
    
    # Convert to DataFrame for easier plotting
    plot_data = []
    
    for strategy_id, timeline in balance_timeline.items():
        strategy_name = timeline.get('name', strategy_id)
        # Create unique display name combining name and ID
        display_name = f"{strategy_name} ({strategy_id[-8:]})" if len(strategy_id) > 8 else f"{strategy_name} ({strategy_id})"
        datapoints = timeline.get('dataPoints', [])
        
        for point in datapoints:
            plot_data.append({
                'Strategy': display_name,  # Use unique display name
                'StrategyID': strategy_id,  # Keep original ID
                'Tournament': point.get('tournament', 0),
                'Game': point.get('game', 0),
                'Balance': point.get('balance', 0),
                'Profit': point.get('profit', 0),
                'IsWinner': point.get('isWinner', False),
                'IsEliminated': point.get('isEliminated', False)
            })
    
    df = pd.DataFrame(plot_data)
    
    if df.empty:
        print("❌ No timeline data to visualize")
        return None
    
    # Create unique game numbers for x-axis (tournament * 10 + game)
    df['GameNumber'] = df['Tournament'] * 10 + df['Game']
    
    print(f"📈 Plotting {len(df)} data points across {tournaments_completed} tournaments")
    
    # Create the visualization
    plt.figure(figsize=(16, 10))
    
    # Color mapping for strategies
    strategies = df['Strategy'].unique()
    colors = plt.cm.Set3(np.linspace(0, 1, len(strategies)))
    color_map = dict(zip(strategies, colors))
    
    # Plot balance lines for each strategy
    for strategy in strategies:
        strategy_data = df[df['Strategy'] == strategy].sort_values('GameNumber')
        
        if len(strategy_data) > 0:
            plt.plot(strategy_data['GameNumber'], strategy_data['Balance'], 
                    label=strategy, linewidth=2.5, marker='o', markersize=4,
                    color=color_map[strategy])
            
            # Highlight elimination points
            eliminated = strategy_data[strategy_data['IsEliminated'] == True]
            if len(eliminated) > 0:
                plt.scatter(eliminated['GameNumber'], eliminated['Balance'], 
                          color='red', s=100, marker='X', alpha=0.8, zorder=5)
    
    # Formatting
    plt.xlabel('Game Progress (Tournament.Game)', fontsize=12, fontweight='bold')
    plt.ylabel('Coin Balance', fontsize=12, fontweight='bold')
    plt.title(f'💰 Strategy Wealth Evolution Over {tournaments_completed} Tournaments\n'
              f'📅 Simulation: {data.get("timestamp", "Unknown")}', 
              fontsize=14, fontweight='bold', pad=20)
    
    # Add tournament boundaries
    for t in range(1, tournaments_completed + 1):
        plt.axvline(x=t*10, color='gray', linestyle='--', alpha=0.5)
        plt.text(t*10 + 3, plt.ylim()[1] * 0.95, f'T{t}', 
                rotation=90, alpha=0.7, fontsize=9)
    
    # Add profit/loss line at starting balance
    plt.axhline(y=500, color='black', linestyle='-', alpha=0.3, linewidth=1)
    plt.text(plt.xlim()[1] * 0.02, 520, 'Starting Balance (500)', 
             alpha=0.7, fontsize=9)
    
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    # Save the chart
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f'balance_evolution_{timestamp}.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    
    print(f"✅ Balance evolution chart saved: {output_file}")
    
    # Show final standings
    print(f"\n🏆 FINAL STANDINGS after {tournaments_completed} tournaments:")
    print("=" * 60)
    
    # Get final balances for each strategy
    final_standings = []
    for strategy in strategies:
        strategy_data = df[df['Strategy'] == strategy].sort_values('GameNumber')
        if len(strategy_data) > 0:
            final_balance = strategy_data.iloc[-1]['Balance']
            profit = final_balance - 500
            final_standings.append({
                'Strategy': strategy,
                'Final_Balance': final_balance,
                'Profit': profit,
                'Games_Played': len(strategy_data) - 1  # Subtract starting point
            })
    
    # Sort by final balance
    final_standings.sort(key=lambda x: x['Final_Balance'], reverse=True)
    
    for i, standing in enumerate(final_standings):
        rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][i] if i < 6 else '📍'
        profit_icon = '💰' if standing['Profit'] >= 0 else '💸'
        profit_str = f"+{standing['Profit']}" if standing['Profit'] >= 0 else str(standing['Profit'])
        
        print(f"{rank} {standing['Strategy']}: {standing['Final_Balance']} coins "
              f"({profit_icon}{profit_str}) - {standing['Games_Played']} games")
    
    # Show some statistics
    print(f"\n📊 SIMULATION STATISTICS:")
    print(f"   💎 Richest strategy: {final_standings[0]['Strategy']} ({final_standings[0]['Final_Balance']} coins)")
    print(f"   📈 Biggest profit: +{max(s['Profit'] for s in final_standings)} coins")
    if any(s['Profit'] < 0 for s in final_standings):
        print(f"   📉 Biggest loss: {min(s['Profit'] for s in final_standings)} coins")
    
    total_games = tournaments_completed * 7  # Assuming 7 games per tournament
    print(f"   🎮 Total games: ~{total_games}")
    
    return output_file

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 visualize_from_progress.py <progress_file.json>")
        sys.exit(1)
    
    json_file = sys.argv[1]
    result = visualize_progress_data(json_file)
    
    if result:
        print(f"\n🎉 Visualization complete! Open {result} to see the chart.")
    else:
        print("❌ Visualization failed.")
        sys.exit(1) 