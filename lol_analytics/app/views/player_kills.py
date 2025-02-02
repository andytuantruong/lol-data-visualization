import os
import pandas as pd
import plotly.graph_objects as go
from dash import Dash, dcc, html, Input, Output

PLAYER_DATA_DIR = "../../data/processed/players"

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
    df = df.sort_values("date")
    df = df.dropna(subset=["kills", "deaths", "assists"])
    df["datetime_formatted"] = df["date"].dt.strftime("%m/%d/%Y %H:%M")

    max_y = df["kills"].max() * 1.2  # Adjust max y-axis for visibility

    fig = go.Figure()

    # Main visible bars (Kills)
    fig.add_trace(go.Bar(
        x=df["datetime_formatted"],
        y=df["kills"],
        name="Kills",
        text=df["kills"],
        textposition="outside",
        marker=dict(color="blue"),
        customdata=df[["kills", "deaths", "assists"]].values,
        hovertemplate="<br>".join([
            "Date & Time: %{x}",
            "Kills: %{customdata[0]}",
            "Deaths: %{customdata[1]}",
            "Assists: %{customdata[2]}",
            "<extra></extra>"
        ])
    ))

    # Transparent overlay bars extending to top with neon yellow border
    fig.add_trace(go.Bar(
        x=df["datetime_formatted"],
        y=[max_y] * len(df),  # Bars extend to top of graph
        marker=dict(
            color="rgba(0,0,0,0)",  # Invisible fill
            line=dict(  # Visible border
                width=2,  # Increased width for visibility
                color="rgba(255,255,0,1)"  # Fully opaque neon yellow
            )
        ),
        customdata=df[["kills", "deaths", "assists"]].values,
        hovertemplate="<br>".join([
            "Date & Time: %{x}",
            "Kills: %{customdata[0]}",
            "Deaths: %{customdata[1]}",
            "Assists: %{customdata[2]}",
            "<extra></extra>"
        ]),
        showlegend=False,
        width=0.8  # Match width with the blue bars
    ))

    fig.update_layout(
        title=f"{player_name} - Kills",
        xaxis_title="Date",
        yaxis_title="Kills",
        showlegend=False,
        xaxis=dict(
            type="category",
            tickmode="array",
            tickvals=df["datetime_formatted"],
            tickangle=-45,
            fixedrange=True  # Disable zoom/pan on x-axis
        ),
        yaxis=dict(
            range=[0, max_y],
            fixedrange=True  # Disable zoom/pan on y-axis
        ),
        margin=dict(b=100),
        hoverlabel=dict(
            bgcolor="white",
            font_size=12,
            font_family="Arial"
        ),
        autosize=True,  # Enable responsive sizing
        dragmode=False,  # Disable all dragging interactions
        barmode='overlay'  # Ensure bars overlay each other
    )

    # Update bar spacing using update_traces for the blue bars only
    fig.update_traces(
        marker_line_width=0,  # Remove bar borders
        selector=dict(marker_color="blue")  # Only apply to blue bars
    )

    return fig

app = Dash(__name__)

players = get_player_list()
if not players:
    raise SystemExit("No player data found")

app.layout = html.Div([
    html.H1("League of Legends Player Kills", style={'textAlign': 'center'}),
    html.Div([
        dcc.Dropdown(
            id="player-dropdown",
            options=[{"label": player, "value": player} for player in players],
            value=players[0],
            placeholder="Select a player",
            style={'width': '50%', 'margin': '0 auto', 'marginBottom': '20px'}
        ),
        dcc.Graph(
            id="kills-graph",
            config={'displayModeBar': False},  # Hide the mode bar with zoom and other controls
            style={
                'width': '80vw',  # 80% of viewport width
                'height': '70vh',  # 70% of viewport height
                'margin': '0 auto',  # Center the graph
                'border': '1px solid #ddd',  # Add a subtle border
                'borderRadius': '8px',  # Rounded corners
                'padding': '20px',  # Add some padding
                'boxShadow': '0 2px 4px rgba(0,0,0,0.1)'  # Add a subtle shadow
            }
        )
    ], style={'display': 'flex', 'flexDirection': 'column', 'alignItems': 'center'})
])

@app.callback(
    Output("kills-graph", "figure"),
    Input("player-dropdown", "value")
)
def update_graph(selected_player):
    try:
        df = pd.read_csv(f"{PLAYER_DATA_DIR}/{selected_player}.csv")
        return create_figure(df, selected_player)
    except Exception as e:
        print(f"Error creating graph for {selected_player}: {e}")
        return go.Figure()

if __name__ == "__main__":
    app.run_server(debug=True)
