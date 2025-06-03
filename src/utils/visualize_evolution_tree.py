#!/usr/bin/env python3
"""
Evolution Tree Visualizer for Agent Battle Strategy Evolution
Shows both balance evolution over time and strategy family trees with parent-child relationships
"""

import json
import sys
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import pandas as pd
import networkx as nx
from datetime import datetime
import numpy as np
import textwrap

def load_evolution_data(json_file):
    """Load and parse evolution data from JSON file"""
    print(f"📊 Loading evolution data from {json_file}...")
    
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    balance_timeline = data.get('balanceTimeline', {})
    
    # Handle both old and new data formats
    tournament_data = data.get('tournamentData', data.get('tournaments', []))
    tournaments_completed = data.get('completedTournaments', len(tournament_data))
    
    print(f"✅ Found data for {len(balance_timeline)} strategies across {tournaments_completed} tournaments")
    
    # If no balance timeline, try to extract from tournament data
    if not balance_timeline and tournament_data:
        print("🔄 No balance timeline found, attempting to reconstruct from tournament data...")
        balance_timeline = reconstruct_balance_timeline(tournament_data)
        print(f"📈 Reconstructed balance data for {len(balance_timeline)} strategies")
    
    return data, balance_timeline, tournament_data, tournaments_completed

def reconstruct_balance_timeline(tournament_data):
    """Reconstruct balance timeline from tournament data for older formats"""
    balance_timeline = {}
    
    for tournament in tournament_data:
        tournament_num = tournament.get('tournamentNumber', 0)
        
        # Get starting strategies
        starting_strategies = tournament.get('strategies', [])
        for strategy in starting_strategies:
            strategy_id = strategy['id']
            strategy_name = strategy['name']
            
            if strategy_id not in balance_timeline:
                balance_timeline[strategy_id] = {
                    'name': strategy_name,
                    'archetype': strategy.get('archetype', 'UNKNOWN'),
                    'dataPoints': []
                }
            
            # Add starting balance for this tournament
            balance_timeline[strategy_id]['dataPoints'].append({
                'tournament': tournament_num,
                'game': 0,
                'balance': strategy.get('coinBalance', 500),
                'profit': 0,
                'isWinner': False,
                'isEliminated': False
            })
        
        # Process games if available
        games = tournament.get('games', [])
        for game in games:
            game_number = game.get('gameNumber', 0)
            economic_impacts = game.get('economicImpact', [])
            
            for impact in economic_impacts:
                strategy_id = impact.get('strategyId', '')
                if strategy_id in balance_timeline:
                    # Calculate new balance (approximate)
                    last_balance = balance_timeline[strategy_id]['dataPoints'][-1]['balance']
                    new_balance = last_balance + impact.get('profit', 0)
                    
                    balance_timeline[strategy_id]['dataPoints'].append({
                        'tournament': tournament_num,
                        'game': game_number,
                        'balance': new_balance,
                        'profit': impact.get('profit', 0),
                        'isWinner': impact.get('isWinner', False),
                        'isEliminated': new_balance < 100
                    })
    
    return balance_timeline

def create_balance_evolution_chart(balance_timeline, tournaments_completed, timestamp):
    """Create balance evolution chart similar to existing visualizer"""
    
    # Convert to DataFrame for easier plotting
    plot_data = []
    
    for strategy_id, timeline in balance_timeline.items():
        strategy_name = timeline.get('name', strategy_id)
        display_name = f"{strategy_name}" # Simplified name for cleaner chart
        datapoints = timeline.get('dataPoints', [])
        
        for point in datapoints:
            plot_data.append({
                'Strategy': display_name,
                'StrategyID': strategy_id,
                'Tournament': point.get('tournament', 0),
                'Game': point.get('game', 0),
                'Balance': point.get('balance', 0),
                'Profit': point.get('profit', 0),
                'IsWinner': point.get('isWinner', False),
                'IsEliminated': point.get('isEliminated', False)
            })
    
    df = pd.DataFrame(plot_data)
    if df.empty:
        return None
    
    # Create unique game numbers for x-axis
    df['GameNumber'] = df['Tournament'] * 10 + df['Game']
    
    plt.figure(figsize=(20, 12))
    
    # Color mapping for strategies
    strategies = df['Strategy'].unique()
    colors = plt.cm.Set3(np.linspace(0, 1, len(strategies)))
    color_map = dict(zip(strategies, colors))
    
    # Plot balance lines for each strategy
    for strategy in strategies:
        strategy_data = df[df['Strategy'] == strategy].sort_values('GameNumber')
        
        if len(strategy_data) > 0:
            plt.plot(strategy_data['GameNumber'], strategy_data['Balance'], 
                    label=strategy, linewidth=3, marker='o', markersize=5,
                    color=color_map[strategy])
            
            # Highlight elimination points
            eliminated = strategy_data[strategy_data['IsEliminated'] == True]
            if len(eliminated) > 0:
                plt.scatter(eliminated['GameNumber'], eliminated['Balance'], 
                          color='red', s=150, marker='X', alpha=0.8, zorder=5)
    
    # Formatting
    plt.xlabel('Game Progress (Tournament.Game)', fontsize=14, fontweight='bold')
    plt.ylabel('Coin Balance', fontsize=14, fontweight='bold')
    plt.title(f'💰 Strategy Wealth Evolution Over {tournaments_completed} Tournaments\n'
              f'📅 Simulation: {timestamp}', 
              fontsize=16, fontweight='bold', pad=20)
    
    # Add tournament boundaries
    for t in range(1, tournaments_completed + 1):
        plt.axvline(x=t*10, color='gray', linestyle='--', alpha=0.5)
        plt.text(t*10 + 2, plt.ylim()[1] * 0.95, f'T{t}', 
                rotation=90, alpha=0.7, fontsize=10)
    
    # Add profit/loss line
    plt.axhline(y=500, color='black', linestyle='-', alpha=0.3, linewidth=1)
    plt.text(plt.xlim()[1] * 0.02, 520, 'Starting Balance (500)', 
             alpha=0.7, fontsize=10)
    
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    return df, color_map

def create_evolution_tree(tournament_data, color_map):
    """Create strategy evolution family tree"""
    
    plt.figure(figsize=(24, 16))
    
    # Build evolution graph
    G = nx.DiGraph()
    strategy_info = {}
    
    # Track all strategies across tournaments
    all_strategies = {}
    
    # First pass: collect all strategy info
    for tournament in tournament_data:
        tournament_num = tournament.get('tournamentNumber', 0)
        
        # Add starting strategies
        for strategy in tournament.get('strategies', []):
            if strategy['id'] not in all_strategies:
                all_strategies[strategy['id']] = {
                    'name': strategy['name'],
                    'archetype': strategy['archetype'],
                    'first_seen': tournament_num,
                    'strategy_text': strategy.get('strategy', ''),
                    'is_core': True
                }
        
        # Add evolution details if available (new format)
        evolution_details = tournament.get('evolutionDetails', {})
        
        for created in evolution_details.get('created', []):
            strategy_id = created['id']
            all_strategies[strategy_id] = {
                'name': created['name'],
                'archetype': created['archetype'],
                'first_seen': tournament_num,
                'strategy_text': created.get('strategy', ''),
                'parents': created.get('parents', []),
                'avoiding': created.get('avoiding', ''),
                'is_core': False
            }
        
        # Handle older format - look for evolved strategies in strategiesEvolved
        evolved_strategies = tournament.get('strategiesEvolved', [])
        for evolved in evolved_strategies:
            strategy_id = evolved.get('id', '')
            if strategy_id and strategy_id not in all_strategies:
                all_strategies[strategy_id] = {
                    'name': evolved.get('name', 'Unknown Evolved'),
                    'archetype': evolved.get('archetype', 'EVOLVED'),
                    'first_seen': tournament_num,
                    'strategy_text': evolved.get('strategy', ''),
                    'parents': evolved.get('basedOn', []),
                    'avoiding': evolved.get('avoiding', ''),
                    'is_core': False
                }
    
    # If we have very few strategies (all core), create a simple display
    if len(all_strategies) <= 6 and all(s.get('is_core', True) for s in all_strategies.values()):
        print("📊 Detected core-strategies-only simulation, creating simplified tree...")
        return create_simple_strategy_display(all_strategies, color_map)
    
    # Second pass: build graph relationships
    for strategy_id, info in all_strategies.items():
        G.add_node(strategy_id, **info)
        
        # Add edges from parents to children
        if 'parents' in info and info['parents']:
            for parent_info in info['parents']:
                parent_name = parent_info.get('name', '')
                # Find parent by name
                for pid, pinfo in all_strategies.items():
                    if pinfo['name'] == parent_name:
                        weight = parent_info.get('weight', 50)
                        G.add_edge(pid, strategy_id, weight=weight)
                        break
    
    # Create layout with generations
    generations = {}
    for node_id, data in G.nodes(data=True):
        gen = data.get('first_seen', 0)
        if gen not in generations:
            generations[gen] = []
        generations[gen].append(node_id)
    
    # Position nodes by generation
    pos = {}
    y_spacing = 1.5
    x_spacing = 2.0
    
    for gen, nodes in generations.items():
        y = -gen * y_spacing  # Newer generations at bottom
        for i, node_id in enumerate(nodes):
            x = (i - len(nodes)/2) * x_spacing
            pos[node_id] = (x, y)
    
    # Draw the graph
    ax = plt.gca()
    
    # Draw edges with weights
    for edge in G.edges(data=True):
        parent, child, data = edge
        weight = data.get('weight', 50)
        
        # Draw edge
        x1, y1 = pos[parent]
        x2, y2 = pos[child]
        
        # Color edge by weight
        edge_color = plt.cm.viridis(weight / 100)
        plt.plot([x1, x2], [y1, y2], color=edge_color, linewidth=weight/10, alpha=0.7)
        
        # Add weight label
        mid_x, mid_y = (x1 + x2) / 2, (y1 + y2) / 2
        plt.text(mid_x, mid_y, f'{weight}%', fontsize=8, ha='center', 
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.8))
    
    # Draw nodes
    for node_id, (x, y) in pos.items():
        data = G.nodes[node_id]
        name = data['name']
        archetype = data['archetype']
        is_core = data.get('is_core', False)
        
        # Node color
        if is_core:
            node_color = 'lightblue'
            border_color = 'blue'
        else:
            node_color = 'lightgreen'
            border_color = 'darkgreen'
        
        # Get strategy color if available
        if name in color_map:
            node_color = color_map[name]
        
        # Draw node
        circle = plt.Circle((x, y), 0.3, color=node_color, alpha=0.8, 
                           ec=border_color, linewidth=2)
        ax.add_patch(circle)
        
        # Add name
        plt.text(x, y, name, ha='center', va='center', fontsize=9, 
                fontweight='bold', wrap=True)
        
        # Add archetype below
        plt.text(x, y-0.5, archetype, ha='center', va='center', fontsize=7, 
                style='italic', alpha=0.7)
    
    # Add generation labels
    for gen in generations.keys():
        y = -gen * y_spacing
        plt.text(-8, y, f'Gen {gen}', fontsize=12, fontweight='bold', 
                rotation=90, ha='center', va='center')
    
    plt.title('🧬 Strategy Evolution Family Tree\n'
              'Blue = Core Strategies, Green = Evolved Strategies, Line Width = Inheritance Weight', 
              fontsize=16, fontweight='bold', pad=20)
    
    plt.axis('equal')
    plt.axis('off')
    plt.tight_layout()
    
    return G, all_strategies

def create_simple_strategy_display(all_strategies, color_map):
    """Create simple display for core-strategies-only simulations"""
    
    fig, ax = plt.subplots(figsize=(16, 10))
    
    # Arrange strategies in a circle
    n_strategies = len(all_strategies)
    angles = np.linspace(0, 2*np.pi, n_strategies, endpoint=False)
    radius = 3
    
    for i, (strategy_id, info) in enumerate(all_strategies.items()):
        x = radius * np.cos(angles[i])
        y = radius * np.sin(angles[i])
        
        name = info['name']
        archetype = info['archetype']
        
        # Node color
        node_color = 'lightblue'
        border_color = 'blue'
        
        # Get strategy color if available
        if name in color_map:
            node_color = color_map[name]
        
        # Draw node
        circle = plt.Circle((x, y), 0.5, color=node_color, alpha=0.8, 
                           ec=border_color, linewidth=2)
        ax.add_patch(circle)
        
        # Add name
        plt.text(x, y, name, ha='center', va='center', fontsize=10, 
                fontweight='bold', wrap=True)
        
        # Add archetype below
        plt.text(x, y-0.8, archetype, ha='center', va='center', fontsize=8, 
                style='italic', alpha=0.7)
    
    plt.title('💎 Core Strategy Overview\n'
              'Initial 6 strategies competing in the simulation', 
              fontsize=16, fontweight='bold', pad=20)
    
    plt.axis('equal')
    plt.axis('off')
    plt.xlim(-5, 5)
    plt.ylim(-5, 5)
    plt.tight_layout()
    
    return None, all_strategies

def create_strategy_details_table(all_strategies, tournament_data):
    """Create detailed table of all strategies and their evolution"""
    
    fig, ax = plt.subplots(figsize=(20, 14))
    ax.axis('tight')
    ax.axis('off')
    
    # Prepare table data
    table_data = []
    
    for strategy_id, info in all_strategies.items():
        name = info['name']
        archetype = info['archetype']
        generation = info['first_seen']
        is_core = info.get('is_core', False)
        strategy_text = textwrap.fill(info.get('strategy_text', ''), width=50)
        
        # Get parent info
        parents_text = ''
        if 'parents' in info and info['parents']:
            parent_strs = [f"{p['name']} ({p.get('weight', '?')}%)" for p in info['parents']]
            parents_text = ', '.join(parent_strs)
        
        avoiding_text = info.get('avoiding', '')
        
        # Get final performance from tournament data
        final_balance = 'Unknown'
        win_rate = 'Unknown'
        
        # Find this strategy's final performance
        for tournament in reversed(tournament_data):
            evolution_details = tournament.get('evolutionDetails', {})
            
            # Check survivors
            for survivor in evolution_details.get('survivors', []):
                if survivor['id'] == strategy_id:
                    final_balance = survivor['balance']
                    win_rate = f"{survivor['winRate']}%"
                    break
            
            # Check eliminated
            for eliminated in evolution_details.get('eliminated', []):
                if eliminated['id'] == strategy_id:
                    final_balance = f"{eliminated['finalBalance']} (eliminated)"
                    win_rate = f"{eliminated['winRate']}%"
                    break
        
        table_data.append([
            name,
            'Core' if is_core else f'Gen {generation}',
            archetype,
            strategy_text,
            parents_text,
            avoiding_text,
            str(final_balance),
            str(win_rate)
        ])
    
    # Sort by generation then by name
    table_data.sort(key=lambda x: (0 if x[1] == 'Core' else int(x[1].split()[1]), x[0]))
    
    # Create table
    columns = ['Strategy Name', 'Generation', 'Archetype', 'Strategy Description', 
               'Based On (Weight)', 'Avoiding', 'Final Balance', 'Win Rate']
    
    table = ax.table(cellText=table_data,
                     colLabels=columns,
                     cellLoc='left',
                     loc='center',
                     bbox=[0, 0, 1, 1])
    
    # Style the table
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 2)
    
    # Color code rows
    for i, row in enumerate(table_data):
        generation = row[1]
        if generation == 'Core':
            color = 'lightblue'
        else:
            color = 'lightgreen'
        
        for j in range(len(columns)):
            table[(i+1, j)].set_facecolor(color)
            table[(i+1, j)].set_alpha(0.3)
    
    # Style headers
    for j in range(len(columns)):
        table[(0, j)].set_facecolor('gray')
        table[(0, j)].set_alpha(0.5)
        table[(0, j)].set_text_props(weight='bold')
    
    plt.title('📋 Complete Strategy Evolution Details\n'
              'Blue = Core Strategies, Green = Evolved Strategies', 
              fontsize=16, fontweight='bold', pad=20)
    
    return fig

def visualize_evolution_comprehensive(json_file):
    """Create comprehensive evolution visualization"""
    
    data, balance_timeline, tournament_data, tournaments_completed = load_evolution_data(json_file)
    timestamp = data.get('timestamp', 'Unknown')
    
    if not balance_timeline or not tournament_data:
        print("❌ Insufficient data for visualization")
        return None
    
    results = []
    
    # 1. Balance Evolution Chart
    print("📈 Creating balance evolution chart...")
    df, color_map = create_balance_evolution_chart(balance_timeline, tournaments_completed, timestamp)
    
    if df is not None:
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        balance_file = f'balance_evolution_with_tree_{timestamp_str}.png'
        plt.savefig(balance_file, dpi=300, bbox_inches='tight')
        results.append(balance_file)
        print(f"✅ Balance chart saved: {balance_file}")
    
    # 2. Evolution Family Tree
    print("🧬 Creating evolution family tree...")
    G, all_strategies = create_evolution_tree(tournament_data, color_map)
    
    tree_file = f'strategy_evolution_tree_{timestamp_str}.png'
    plt.savefig(tree_file, dpi=300, bbox_inches='tight')
    results.append(tree_file)
    print(f"✅ Evolution tree saved: {tree_file}")
    
    # 3. Strategy Details Table
    print("📋 Creating strategy details table...")
    fig = create_strategy_details_table(all_strategies, tournament_data)
    
    details_file = f'strategy_details_table_{timestamp_str}.png'
    plt.savefig(details_file, dpi=300, bbox_inches='tight')
    results.append(details_file)
    print(f"✅ Strategy details saved: {details_file}")
    
    # Print summary
    print(f"\n🏆 EVOLUTION SUMMARY:")
    print(f"   📊 Tournaments completed: {tournaments_completed}")
    print(f"   🧬 Total strategies tracked: {len(all_strategies)}")
    
    core_strategies = sum(1 for s in all_strategies.values() if s.get('is_core', False))
    evolved_strategies = len(all_strategies) - core_strategies
    print(f"   💎 Core strategies: {core_strategies}")
    print(f"   🌱 Evolved strategies: {evolved_strategies}")
    
    # Show final standings
    if df is not None:
        final_standings = []
        strategies = df['Strategy'].unique()
        for strategy in strategies:
            strategy_data = df[df['Strategy'] == strategy].sort_values('GameNumber')
            if len(strategy_data) > 0:
                final_balance = strategy_data.iloc[-1]['Balance']
                profit = final_balance - 500
                final_standings.append({
                    'Strategy': strategy,
                    'Final_Balance': final_balance,
                    'Profit': profit
                })
        
        final_standings.sort(key=lambda x: x['Final_Balance'], reverse=True)
        
        print(f"\n🥇 FINAL STANDINGS:")
        for i, standing in enumerate(final_standings[:6]):  # Top 6
            rank = ['🥇', '🥈', '🥉', '📍', '📍', '📍'][i]
            profit_icon = '💰' if standing['Profit'] >= 0 else '💸'
            profit_str = f"+{standing['Profit']}" if standing['Profit'] >= 0 else str(standing['Profit'])
            
            print(f"   {rank} {standing['Strategy']}: {standing['Final_Balance']} coins ({profit_icon}{profit_str})")
    
    return results

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 visualize_evolution_tree.py <evolution_data.json>")
        print("Example: python3 visualize_evolution_tree.py enhanced_evolution_2025-01-01T12-00-00-000Z.json")
        sys.exit(1)
    
    json_file = sys.argv[1]
    results = visualize_evolution_comprehensive(json_file)
    
    if results:
        print(f"\n🎉 Evolution visualization complete!")
        print(f"📁 Generated files:")
        for file in results:
            print(f"   • {file}")
        print(f"\nOpen these files to see the complete evolution story! 🚀")
    else:
        print("❌ Visualization failed.")
        sys.exit(1) 