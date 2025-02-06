import pandas as pd
from pathlib import Path
import os

# Get the absolute path to the project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent

def extract(input_path):
    try:
        # Load raw data, specifying dtype for certain columns to avoid mixed type warning
        dtype_spec = {
            'side': str, 
            'position': str
        }
        df = pd.read_csv(input_path, dtype=dtype_spec, low_memory=False)
        print(f"Data extracted from {input_path}")
        return df
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
        df = df.loc[~df[["kills", "deaths", "assists", "date", "playername", "playerid"]].isnull().any(axis=1)]

        # Convert date to datetime
        df["date"] = pd.to_datetime(df["date"], errors='coerce')

        print("Data transformation complete.")
        return df
    except Exception as e:
        print(f"Error transforming data: {e}")
        return None

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

def etl_pipeline(input_path, output_path, player_output_dir=None):
    df = extract(input_path)
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
    input_path = PROJECT_ROOT / "data" / "raw" / "2025_LoL_esports_match_data_from_OraclesElixir.csv"
    output_path = PROJECT_ROOT / "data" / "processed" / "cleaned_data.csv"
    player_output_dir = PROJECT_ROOT / "data" / "processed" / "players"

    etl_pipeline(input_path, output_path, player_output_dir)
    print("ETL pipeline complete.")