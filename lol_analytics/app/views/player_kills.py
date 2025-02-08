import os
import pandas as pd
import plotly.graph_objects as go
from dash import html, dcc

# Get absolute path to the data directory
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
PLAYER_DATA_DIR = os.path.join(DATA_DIR, "processed", "players")

def load_match_data():
    """Load and prepare the match data with team name mappings"""
    try:
        # Load the main match data
        df = pd.read_csv(os.path.join(DATA_DIR, "processed", "cleaned_data.csv"), 
                        dtype={'playername': str})  # Ensure playername is read as string
        return df
    except Exception as e:
        print(f"Error loading match data: {e}")
        return None

def get_player_list():
    try:
        # Remove .csv extension and ensure player names are treated as strings
        players = [str(f).replace(".csv", "") for f in os.listdir(PLAYER_DATA_DIR) 
                  if f.endswith(".csv")]
        return sorted(players)  # Sort the list for consistent display
    except FileNotFoundError:
        print(f"Error: Directory '{PLAYER_DATA_DIR}' not found.")
        return []
    except Exception as e:
        print(f"Error reading player files: {e}")
        return []

def create_figure(df, player_name):
    # Filter data for the selected player
    player_df = df[df["playername"].astype(str) == str(player_name)].copy()
    
    # Convert date and sort
    player_df["date"] = pd.to_datetime(player_df["date"])
    player_df = player_df.sort_values("date")
    
    # Create display formats
    player_df["date_display"] = player_df["date"].dt.strftime("%m/%d/%Y")
    player_df["datetime_full"] = player_df["date"].dt.strftime("%m/%d/%Y %H:%M")
    
    # Create unique match identifiers
    player_df["x_position"] = player_df.groupby("date_display").cumcount()
    player_df["x_display"] = player_df.apply(
        lambda row: f"{row['date_display']} (1)" if row["x_position"] == 0 
        else f"{row['date_display']} ({row['x_position'] + 1})", 
        axis=1
    )

    # Create the figure
    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=player_df["x_display"],
        y=player_df["kills"],
        text=player_df["kills"],
        textposition="outside",
        marker=dict(color="blue"),
        customdata=player_df[["datetime_full", "opponent_teamname", "league"]],
        hovertemplate="<br>".join([
            "Date & Time: %{customdata[0]}",
            "Opponent: %{customdata[1]}",
            "League: %{customdata[2]}",
            "Kills: %{y}",
            "<extra></extra>"
        ])
    ))

    fig.update_layout(
        title=f"{player_name} - Kills by Match",
        title_x=0.5,
        title_font=dict(size=20),
        xaxis_title="Match Date",
        yaxis_title="Kills",
        showlegend=False,
        plot_bgcolor='white',
        paper_bgcolor='white',
        xaxis=dict(
            showgrid=True,
            gridcolor='rgba(128, 128, 128, 0.1)',
            tickangle=-45,
            fixedrange=True,
            tickfont=dict(color='black'),
            title_font=dict(size=14)
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor='rgba(128, 128, 128, 0.1)',
            range=[0, player_df["kills"].max() * 1.3],
            fixedrange=True,
            tickfont=dict(color='black'),
            zeroline=False,
            title_font=dict(size=14)
        ),
        margin=dict(l=50, r=20, t=40, b=80),
        height=400,
        width=800,
        autosize=False,
        hoverlabel=dict(
            bgcolor='white',
            font_size=12,
            font_color='black'
        )
    )

    return fig

def get_opponent_team(df, gameid, teamid):
    """Get the opponent's team name based on gameid and teamid"""
    # Find the opponent's team info (same game, different team)
    opponent_data = df[
        (df["gameid"] == gameid) & 
        (df["teamid"] != teamid)
    ]["teamname"].iloc[0] if not df[
        (df["gameid"] == gameid) & 
        (df["teamid"] != teamid)
    ].empty else "Unknown Team"
    
    return opponent_data

def create_layout():
    # Load the match data
    df = load_match_data()
    if df is None:
        raise SystemExit("Failed to load match data")

    players = get_player_list()
    if not players:
        raise SystemExit("No player data found")

    return html.Div([
        html.H1("League of Legends Player Kills", className='page-title'),
        html.Div([
            dcc.Dropdown(
                id="player-dropdown",
                options=[{"label": player, "value": player} for player in players],
                value=players[0],
                placeholder="Select a player",
                className='dropdown-container'
            ),
            dcc.Graph(
                id="kills-graph",
                config={'displayModeBar': False},
                className='graph-container'
            )
        ], className='content-container')
    ], className='body-container')
