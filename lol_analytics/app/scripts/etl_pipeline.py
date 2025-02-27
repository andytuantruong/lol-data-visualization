import pandas as pd
from pathlib import Path
import os
import glob

# Get the absolute path to the project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent

def extract(input_paths):
    try:
        # Convert single path to list for consistent processing
        if isinstance(input_paths, (str, Path)):
            input_paths = [input_paths]
        
        # Specify dtype for certain columns to avoid mixed type warning
        dtype_spec = {
            'side': str, 
            'position': str,
            'playername': str
        }
        
        # List to store individual dataframes
        dfs = []
        
        # Process each input file
        for input_path in input_paths:
            print(f"Extracting data from {input_path}")
            df = pd.read_csv(input_path, dtype=dtype_spec, low_memory=False)
            dfs.append(df)
            print(f"  - Found {len(df)} rows")
        
        # Combine all dataframes
        if len(dfs) > 1:
            combined_df = pd.concat(dfs, ignore_index=True)
            print(f"Combined {len(dfs)} files into a dataset with {len(combined_df)} rows")
        else:
            combined_df = dfs[0]
            print(f"Extracted {len(combined_df)} rows from single file")
            
        return combined_df
    except Exception as e:
        print(f"Error extracting data: {e}")
        return None

def transform(df):
    try:
        # Select relevant columns
        columns_to_keep = [
            "gameid", "league", "year", "date", "side", "playername", "playerid", 
            "teamname", "teamid", "champion", "gamelength", "kills", 
            "deaths", "assists", "result"
        ]
        df = df[columns_to_keep]

        # Drop rows with missing critical fields
        df = df.dropna(subset=["kills", "deaths", "assists", "date", "playername", "playerid"])

        df["date"] = pd.to_datetime(df["date"])
        df = df.drop_duplicates()
        df = add_opponent_info(df)

        # Verify no duplicates after opponent mapping
        df = df.drop_duplicates(subset=[
            'gameid', 'date', 'playername', 'teamname', 'kills', 'deaths', 'assists'
        ])

        print("Data transformation complete.")
        return df
    except Exception as e:
        print(f"Error transforming data: {e}")
        return None

def add_opponent_info(df):
    # Filter out rows with missing team information
    df_with_teams = df[df["teamname"].notna() & (df["teamname"] != "unknown team")].copy()
    
    # Create a copy of relevant columns for merging
    opponent_info = df_with_teams[["gameid", "side", "teamname", "teamid"]].copy()
    
    # Map Blue->Red and Red->Blue for joining
    opponent_info["opponent_side"] = opponent_info["side"].map({"Blue": "Red", "Red": "Blue"})
    
    # Rename columns to approproiate names
    opponent_info = opponent_info.rename(columns={
        "teamname": "opponent_teamname",
        "teamid": "opponent_teamid",
        "side": "opponent_side_original"
    })
    
    # Merge the opponent information based on gameid and opposite side
    df = df.merge(
        opponent_info[["gameid", "opponent_side", "opponent_teamname", "opponent_teamid"]],
        left_on=["gameid", "side"],
        right_on=["gameid", "opponent_side"],
        how="left"
    )
    
    # For rows without opponent info (like unknown teams), set a default value
    df["opponent_teamname"] = df["opponent_teamname"].fillna("Unknown Opponent")
    
    # Drop the temporary merge column
    df = df.drop("opponent_side", axis=1)
    
    return df

def load(df, output_path):
    try:
        # Save cleaned data
        df.to_csv(output_path, index=False)
        print(f"Cleaned data saved to {output_path}")
    except Exception as e:
        print(f"Error loading data: {e}")

def organize_by_player(df, output_dir):
    try:
        # Ensure the output directory exists
        output_dir.mkdir(parents=True, exist_ok=True)

        # Group data by player
        for player_name, player_data in df.groupby("playername"):
            # Save each player's data to a separate CSV file
            player_file = output_dir / f"{player_name}.csv"
            player_data.to_csv(player_file, index=False)
            print(f"Saved data for {player_name} to {player_file}")

        print("Data organized by player.")
    except Exception as e:
        print(f"Error organizing data by player: {e}")

def etl_pipeline(input_paths, output_path, player_output_dir=None):
    # Handle glob patterns
    if isinstance(input_paths, (str, Path)) and ('*' in str(input_paths)):
        input_paths = glob.glob(str(input_paths))
        print(f"Found {len(input_paths)} files matching pattern")
    
    df = extract(input_paths)
    if df is None:
        return

    cleaned_df = transform(df)
    if cleaned_df is None:
        return

    load(cleaned_df, output_path)

    # Organize by player
    if player_output_dir:
        organize_by_player(cleaned_df, player_output_dir)

if __name__ == "__main__":
    # Define input and output paths using absolute paths
    input_pattern = PROJECT_ROOT / "data" / "raw" / "*_LoL_esports_match_data_from_OraclesElixir.csv"
    output_path = PROJECT_ROOT / "data" / "processed" / "cleaned_data.csv"
    player_output_dir = PROJECT_ROOT / "data" / "processed" / "players"

    etl_pipeline(input_pattern, output_path, player_output_dir)
    print("ETL pipeline complete.")