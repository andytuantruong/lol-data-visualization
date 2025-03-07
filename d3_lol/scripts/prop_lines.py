import re
import csv
import os

def extract_pp_data(input_file):
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Updated pattern to handle different stat types (Kills, Deaths, Assists)
    pp_pattern = re.compile(r'([A-Za-z]+)\n([A-Z]+) - ([A-Z]+)\n\1\n(?:vs|@) ([A-Z]+) (?:MAP 1|MAPS 1-\d+).+?\n([0-9.]+)\n(?:MAP 1|MAPS 1-\d+) (Kills|Deaths|Assists)', re.DOTALL)
    
    players = []
    for match in pp_pattern.finditer(content):
        player_name = match.group(1)
        team = match.group(2)
        position = match.group(3)
        opponent = match.group(4)
        prop_value = float(match.group(5))
        stat_type = match.group(6)
        
        players.append({
            'player_name': player_name,
            'team': team,
            'position': position,
            'opponent': opponent,
            'stat_type': stat_type,
            'prop_value': prop_value
        })
    
    return players

def save_to_csv(players, output_file):
    fieldnames = ['player_name', 'team', 'position', 'opponent', 'stat_type', 'prop_value']
    
    with open(output_file, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(players)

def main():
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    input_file = os.path.join(script_dir, 'pp_input.txt')
    output_file = os.path.join(script_dir, 'player_prop_lines.csv')
    players = extract_pp_data(input_file)
    save_to_csv(players, output_file)
    
    print(f"Processed {len(players)} players. Data saved to {output_file}")

if __name__ == "__main__":
    main()
