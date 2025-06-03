#!/usr/bin/env python3
"""
Strategy Relationship Matrix Visualizer
Creates visual graphs showing which strategies beat which others.
"""

import json
import glob
import os
import sys
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import pandas as pd
from matplotlib.patches import Rectangle
import networkx as nx

def find_latest_evolution_file():
    """Find the most recent enhanced evolution JSON file"""
    json_files = glob.glob('enhanced_evolution_*.json')
    if not json_files:
        print("No enhanced evolution JSON files found!")
        return None
    return max(json_files, key=os.path.getctime)

def load_strategy_matchups(filename=None):
    """Load strategy matchup data from evolution file"""
    if filename is None:
        filename = find_latest_evolution_file()
        if filename is None:
            return None
    
    print(f"Loading matchup data from: {filename}")
    
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
        
        matchups = data.get('strategyMatchups', {})
        if not matchups:
            print("No strategy matchups found in file!")
            return None
            
        return matchups
    except Exception as e:
        print(f"Error loading file: {e}")
        return None

def create_strategy_name_mapping():
    """Create readable names for strategies"""
    return {
        'aggressive_maximizer': 'Aggressive',
        'diplomatic_builder': 'Diplomatic', 
        'strategic_opportunist': 'Opportunist',
        'mathematical_analyzer': 'Analytical',
        'social_manipulator': 'Manipulator',
        'strategy_identifier': 'Identifier',
        'strategic_opportunist_evolved_gen1': 'Opportunist v2',
        'diplomatic_builder_evolved_gen1': 'Diplomatic v2',
        'mathematical_analyzer_evolved_gen1': 'Analytical v2'
    }

def get_short_name(strategy_id, name_map):
    """Get short readable name for strategy"""
    if strategy_id in name_map:
        return name_map[strategy_id]
    
    # Handle evolved strategies
    if '_evolved_' in strategy_id:
        base = strategy_id.split('_evolved_')[0]
        return name_map.get(base, base[:8]) + ' v2'
    
    if 'hybrid_' in strategy_id:
        return 'Hybrid'
    
    if 'novel_' in strategy_id:
        return 'Novel'
    
    return strategy_id[:8]

def create_win_rate_matrix(matchups):
    """Create a matrix of win rates between strategies"""
    name_map = create_strategy_name_mapping()
    
    # Get all unique strategies
    all_strategies = set()
    for strategy in matchups.keys():
        all_strategies.add(strategy)
        for opponent in matchups[strategy].keys():
            all_strategies.add(opponent)
    
    strategies = sorted(list(all_strategies))
    n = len(strategies)
    
    # Create matrix
    win_rate_matrix = np.zeros((n, n))
    win_matrix = np.zeros((n, n))
    loss_matrix = np.zeros((n, n))
    
    for i, strategy1 in enumerate(strategies):
        for j, strategy2 in enumerate(strategies):
            if strategy1 == strategy2:
                win_rate_matrix[i][j] = 0.5  # Self vs self
            elif strategy1 in matchups and strategy2 in matchups[strategy1]:
                matchup = matchups[strategy1][strategy2]
                wins = matchup.get('wins', 0)
                losses = matchup.get('losses', 0)
                total = wins + losses
                
                win_matrix[i][j] = wins
                loss_matrix[i][j] = losses
                
                if total > 0:
                    win_rate_matrix[i][j] = wins / total
                else:
                    win_rate_matrix[i][j] = 0
            else:
                win_rate_matrix[i][j] = 0
    
    # Create readable labels
    labels = [get_short_name(s, name_map) for s in strategies]
    
    return win_rate_matrix, win_matrix, loss_matrix, labels, strategies

def plot_win_rate_heatmap(win_rate_matrix, labels, output_file='strategy_matrix_heatmap.png'):
    """Create a heatmap showing win rates between strategies"""
    plt.figure(figsize=(12, 10))
    
    # Create custom colormap - red for losses, green for wins
    colors = ['darkred', 'red', 'lightcoral', 'white', 'lightgreen', 'green', 'darkgreen']
    n_bins = 100
    cmap = plt.cm.colors.LinearSegmentedColormap.from_list('win_rate', colors, N=n_bins)
    
    # Create heatmap
    ax = sns.heatmap(win_rate_matrix, 
                     xticklabels=labels, 
                     yticklabels=labels,
                     annot=True, 
                     fmt='.2f',
                     cmap=cmap,
                     center=0.5,
                     vmin=0, 
                     vmax=1,
                     square=True,
                     cbar_kws={'label': 'Win Rate'})
    
    plt.title('Strategy Relationship Matrix\nWin Rate (Row vs Column)', fontsize=16, fontweight='bold')
    plt.xlabel('Opponent Strategy', fontsize=12)
    plt.ylabel('Strategy', fontsize=12)
    
    # Rotate labels for better readability
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.show()
    
    print(f"✅ Win rate heatmap saved as: {output_file}")

def plot_win_loss_matrix(win_matrix, loss_matrix, labels, output_file='strategy_matrix_counts.png'):
    """Create a matrix showing actual win-loss counts"""
    plt.figure(figsize=(14, 10))
    
    n = len(labels)
    
    # Create annotation matrix with win-loss format
    annotations = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append('-')
            else:
                wins = int(win_matrix[i][j])
                losses = int(loss_matrix[i][j])
                if wins + losses > 0:
                    # Color code based on performance
                    if wins > losses:
                        row.append(f'🟢{wins}-{losses}')
                    elif losses > wins:
                        row.append(f'🔴{wins}-{losses}')
                    else:
                        row.append(f'🟡{wins}-{losses}')
                else:
                    row.append('0-0')
        annotations.append(row)
    
    # Create heatmap based on win rate but show counts
    win_rate_for_color = np.where(win_matrix + loss_matrix > 0, 
                                  win_matrix / (win_matrix + loss_matrix), 
                                  0.5)
    
    ax = plt.imshow(win_rate_for_color, cmap='RdYlGn', vmin=0, vmax=1)
    
    # Add text annotations
    for i in range(n):
        for j in range(n):
            plt.text(j, i, annotations[i][j], ha='center', va='center', 
                    fontsize=10, fontweight='bold')
    
    plt.xticks(range(n), labels, rotation=45, ha='right')
    plt.yticks(range(n), labels)
    plt.xlabel('Opponent Strategy', fontsize=12)
    plt.ylabel('Strategy', fontsize=12)
    plt.title('Strategy Matchup Results\n(Wins-Losses, Row vs Column)', fontsize=16, fontweight='bold')
    
    # Add colorbar
    cbar = plt.colorbar(ax, fraction=0.046, pad=0.04)
    cbar.set_label('Win Rate', fontsize=12)
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.show()
    
    print(f"✅ Win-loss matrix saved as: {output_file}")

def plot_dominance_scores(matchups, output_file='strategy_dominance.png'):
    """Create a bar chart showing overall dominance scores"""
    name_map = create_strategy_name_mapping()
    
    # Calculate dominance scores
    dominance_data = []
    
    for strategy in matchups:
        total_wins = 0
        total_games = 0
        
        for opponent_data in matchups[strategy].values():
            wins = opponent_data.get('wins', 0)
            losses = opponent_data.get('losses', 0)
            total_wins += wins
            total_games += wins + losses
        
        win_rate = (total_wins / total_games * 100) if total_games > 0 else 0
        
        dominance_data.append({
            'strategy': get_short_name(strategy, name_map),
            'win_rate': win_rate,
            'total_wins': total_wins,
            'total_games': total_games
        })
    
    # Sort by win rate
    dominance_data.sort(key=lambda x: x['win_rate'], reverse=True)
    
    # Create bar chart
    plt.figure(figsize=(12, 8))
    
    strategies = [d['strategy'] for d in dominance_data]
    win_rates = [d['win_rate'] for d in dominance_data]
    
    # Color bars based on performance
    colors = ['darkgreen' if wr >= 70 else 'green' if wr >= 60 else 'orange' if wr >= 40 else 'red' 
             for wr in win_rates]
    
    bars = plt.bar(strategies, win_rates, color=colors, alpha=0.7, edgecolor='black')
    
    # Add value labels on bars
    for i, (bar, data) in enumerate(zip(bars, dominance_data)):
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + 1,
                f'{height:.1f}%\n({data["total_wins"]}/{data["total_games"]})',
                ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    plt.xlabel('Strategy', fontsize=12)
    plt.ylabel('Win Rate (%)', fontsize=12)
    plt.title('Strategy Dominance Scores\n(Overall Win Rate Across All Matchups)', fontsize=16, fontweight='bold')
    plt.xticks(rotation=45, ha='right')
    plt.ylim(0, max(win_rates) * 1.2 if win_rates else 100)
    
    # Add grid for better readability
    plt.grid(axis='y', alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.show()
    
    print(f"✅ Dominance chart saved as: {output_file}")

def plot_network_graph(win_rate_matrix, labels, strategies, output_file='strategy_network.png'):
    """Create a network graph showing strategic relationships"""
    plt.figure(figsize=(14, 10))
    
    # Create directed graph
    G = nx.DiGraph()
    
    # Add nodes
    for label in labels:
        G.add_node(label)
    
    # Add edges for strong relationships (win rate > 60%)
    threshold = 0.6
    for i, strategy1 in enumerate(strategies):
        for j, strategy2 in enumerate(strategies):
            if i != j and win_rate_matrix[i][j] > threshold:
                weight = win_rate_matrix[i][j]
                G.add_edge(labels[i], labels[j], weight=weight)
    
    # Calculate layout
    pos = nx.spring_layout(G, k=2, iterations=50)
    
    # Draw nodes
    node_sizes = []
    for label in labels:
        # Size based on number of outgoing strong relationships
        out_degree = len([edge for edge in G.edges() if edge[0] == label])
        node_sizes.append(1000 + out_degree * 500)
    
    nx.draw_networkx_nodes(G, pos, node_size=node_sizes, 
                          node_color='lightblue', alpha=0.7, 
                          edgecolors='black', linewidths=2)
    
    # Draw edges with varying thickness based on win rate
    edges = G.edges(data=True)
    for edge in edges:
        weight = edge[2]['weight']
        width = (weight - threshold) * 10  # Scale thickness
        color = 'green' if weight > 0.7 else 'orange'
        nx.draw_networkx_edges(G, pos, edgelist=[edge[:2]], 
                              width=width, edge_color=color, alpha=0.7,
                              arrowsize=20, arrowstyle='->')
    
    # Draw labels
    nx.draw_networkx_labels(G, pos, font_size=10, font_weight='bold')
    
    plt.title('Strategy Relationship Network\n(Arrows show strong dominance relationships > 60% win rate)', 
             fontsize=16, fontweight='bold')
    plt.axis('off')
    
    # Add legend
    plt.text(0.02, 0.98, 'Edge thickness = win rate strength\nGreen = >70% win rate, Orange = 60-70%', 
             transform=plt.gca().transAxes, fontsize=10, verticalalignment='top',
             bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.show()
    
    print(f"✅ Network graph saved as: {output_file}")

def main():
    """Main function to create all visualizations"""
    print("🎨 Strategy Relationship Matrix Visualizer")
    print("==========================================")
    
    # Load data
    matchups = load_strategy_matchups()
    if not matchups:
        print("❌ No strategy matchup data found!")
        return
    
    print(f"📊 Found matchup data for {len(matchups)} strategies")
    
    # Create win rate matrix
    win_rate_matrix, win_matrix, loss_matrix, labels, strategies = create_win_rate_matrix(matchups)
    
    if len(labels) == 0:
        print("❌ No valid matchup data to visualize!")
        return
    
    print(f"📈 Creating visualizations for {len(labels)} strategies...")
    
    # Generate all visualizations
    try:
        plot_win_rate_heatmap(win_rate_matrix, labels)
        plot_win_loss_matrix(win_matrix, loss_matrix, labels)
        plot_dominance_scores(matchups)
        plot_network_graph(win_rate_matrix, labels, strategies)
        
        print("\n🎉 All strategy matrix visualizations created successfully!")
        print("📁 Files generated:")
        print("   - strategy_matrix_heatmap.png (Win rate heatmap)")
        print("   - strategy_matrix_counts.png (Win-loss counts)")
        print("   - strategy_dominance.png (Dominance scores)")
        print("   - strategy_network.png (Relationship network)")
        
    except Exception as e:
        print(f"❌ Error creating visualizations: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 