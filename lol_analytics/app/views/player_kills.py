import os
import pandas as pd
import plotly.graph_objects as go
from dash import html, dcc

# Get absolute path to the data directory
PLAYER_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "processed", "players")

def get_player_list():
    try:
        return [f.replace(".csv", "") for f in os.listdir(PLAYER_DATA_DIR) if f.endswith(".csv")]
    except FileNotFoundError:
        print(f"Error: Directory '{PLAYER_DATA_DIR}' not found.")
        return []
    except Exception as e:
        print(f"Error reading player files: {e}")
        return []

def create_figure(df, player_name):
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")  # Sort by full datetime
    df = df.dropna(subset=["kills"])
    
    # Create display formats
    df["date_display"] = df["date"].dt.strftime("%m/%d/%Y")
    df["datetime_full"] = df["date"].dt.strftime("%m/%d/%Y %H:%M")
    
    # Make sure dates are unique based on time match is played
    df = df.reset_index(drop=True)
    df["x_position"] = df.groupby("date_display").cumcount()
    df["x_display"] = df.apply(lambda row: 
        f"{row['date_display']} (1)" if row["x_position"] == 0 
        else f"{row['date_display']} ({row['x_position'] + 1})", axis=1)

    max_y = df["kills"].max() * 1.2

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=df["x_display"], 
        y=df["kills"],
        text=df["kills"],
        textposition="outside",
        marker=dict(color="blue"),
        customdata=df["datetime_full"],
        hovertemplate="<br>".join([
            "Date & Time: %{customdata}",
            "Kills: %{y}",
            "<extra></extra>"
        ])
    ))

    fig.update_layout(
        title=f"{player_name} - Kills",
        title_x=0.5,
        title_font=dict(size=20),
        xaxis_title="Date",
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
            range=[0, max_y],
            fixedrange=True,
            tickfont=dict(color='black'),
            zeroline=False,
            title_font=dict(size=14)
        ),
        margin=dict(
            l=50,
            r=20,
            t=40,
            b=80
        ),
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

def create_layout():
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
