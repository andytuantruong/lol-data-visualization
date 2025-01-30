import pandas as pd

def clean_data(input_path, output_path):
    try:
        # Load raw data, specifying dtype for certain columns to avoid mixed type warning
        dtype_spec = {
            'side': str, 
            'position': str
        }
        df = pd.read_csv(input_path, dtype=dtype_spec, low_memory=False)

        columns_to_keep = [
            "gameid", "date", "side", "position", "playername", "playerid", 
            "teamname", "teamid", "champion", "gamelength", "kills", "deaths", 
            "assists", "result", "league"
        ]
        df = df[columns_to_keep]

        # Drop rows with missing critical fields
        df.dropna(subset=["kills", "deaths", "assists", "date", "playername", "side", "position"], inplace=True)

        df["date"] = pd.to_datetime(df["date"])

        # Save cleaned data
        df.to_csv(output_path, index=False)
        print(f"Cleaned data saved to {output_path}")

    except Exception as e:
        print(f"Error cleaning data: {e}")


if __name__ == "__main__":
    input_path = "../data/raw/2025_LoL_esports_match_data_from_OraclesElixir.csv" 
    output_path = "../data/processed/cleaned_data.csv" 
    clean_data(input_path, output_path)
    print("Data cleaning complete.")