#!/usr/bin/env python3
"""
Balance Timeline Visualizer
Reads the CSV balance timeline data and creates a line chart showing strategy performance over time.
"""

import pandas as pd
import matplotlib.pyplot as plt
import sys
import glob
import os

def visualize_balance_timeline(csv_file=None):
    # If no file specified, find the most recent balance timeline CSV
    if csv_file is None:
        csv_files = glob.glob('balance_timeline_*.csv')
        if not csv_files:
            print("No balance timeline CSV files found!")
            return
        csv_file = max(csv_files, key=os.path.getctime)
        print(f"Using most recent file: {csv_file}")
    
    # Read the CSV data
    try:
        df = pd.read_csv(csv_file)
    except FileNotFoundError:
        print(f"File not found: {csv_file}")
        return
    
    # Create a combined game number (Tournament.Game format)
    df['GameNumber'] = df['Tournament'] + (df['Game'] / 10)
    
    # Create the plot
    plt.figure(figsize=(14, 8))
    
    # Plot each strategy
    strategies = df['Strategy'].unique()
    colors = plt.cm.Set3(range(len(strategies)))
    
    for i, strategy in enumerate(strategies):
        strategy_data = df[df['Strategy'] == strategy].sort_values('GameNumber')
        plt.plot(strategy_data['GameNumber'], strategy_data['Balance'], 
                marker='o', linewidth=2, label=strategy, color=colors[i])
    
    # Customize the plot
    plt.title('Strategy Balance Progression Over Time', fontsize=16, fontweight='bold')
    plt.xlabel('Game (Tournament.Game)', fontsize=12)
    plt.ylabel('Coin Balance', fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    
    # Add horizontal lines for key thresholds
    plt.axhline(y=500, color='gray', linestyle='--', alpha=0.5, label='Starting Balance')
    plt.axhline(y=100, color='red', linestyle='--', alpha=0.5, label='Elimination Threshold')
    
    # Adjust layout to prevent legend cutoff
    plt.tight_layout()
    
    # Save the plot
    output_file = csv_file.replace('.csv', '_chart.png')
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Chart saved as: {output_file}")
    
    # Show basic statistics
    print("\n📊 Balance Timeline Statistics:")
    print("=" * 40)
    
    final_balances = df[df['Game'] > 0].groupby('Strategy')['Balance'].last().sort_values(ascending=False)
    starting_balances = df[df['Game'] == 0].groupby('Strategy')['Balance'].first()
    
    for strategy in final_balances.index:
        start = starting_balances[strategy]
        final = final_balances[strategy]
        change = final - start
        change_pct = (change / start) * 100
        
        print(f"{strategy}:")
        print(f"  Start: {start} → Final: {final} ({change:+.0f} coins, {change_pct:+.1f}%)")
        
        # Calculate volatility
        strategy_data = df[df['Strategy'] == strategy]
        profits = strategy_data[strategy_data['Game'] > 0]['Profit']
        volatility = profits.std()
        print(f"  Volatility (σ): ±{volatility:.1f} coins per game")
        
        # Win rate
        wins = strategy_data['IsWinner'].sum()
        games = len(strategy_data[strategy_data['Game'] > 0])
        win_rate = (wins / games) * 100 if games > 0 else 0
        print(f"  Win Rate: {win_rate:.1f}% ({wins}/{games})")
        print()
    
    return output_file

if __name__ == "__main__":
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    else:
        csv_file = None
    
    output_file = visualize_balance_timeline(csv_file)
    
    print("\n🎯 Insights for Blog Post:")
    print("=" * 30)
    print("1. Use the PNG chart to show visual balance progression")
    print("2. Highlight strategy volatility differences")
    print("3. Compare win rates vs. profitability")
    print("4. Show how economic pressure creates different risk profiles")
    print("5. Demonstrate the survival/elimination dynamics") 