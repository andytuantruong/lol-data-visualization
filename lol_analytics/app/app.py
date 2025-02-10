import os
from dash import Dash, Input, Output
import pandas as pd
import plotly.graph_objects as go
from views.player_kills import create_layout, create_figure, PLAYER_DATA_DIR
import dash_bootstrap_components as dbc

app = Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])
app.layout = create_layout()

@app.callback(
    Output("kills-graph", "figure"),
    [Input("player-dropdown", "value"),
     Input("min-kills", "value")]
)
def update_graph(selected_player, min_kills):
    try:
        df = pd.read_csv(f"{PLAYER_DATA_DIR}/{selected_player}.csv")
        
        if min_kills is not None and min_kills > 0:
            df = df[df["kills"] >= min_kills]
            
        return create_figure(df, selected_player)
    except Exception as e:
        print(f"Error creating graph for {selected_player}: {e}")
        return go.Figure()

if __name__ == "__main__":
    app.run_server(debug=True)
