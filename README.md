# LoL Esports Performance Dashboard

A responsive web dashboard for visualizing League of Legends professional player statistics using D3.js.

## Features

- Interactive player performance visualizations
- Sortable stats tables with filtering capabilities
- Series and match analysis for individual players
- Responsive design for all device sizes
- Historical data analysis with year-by-year filtering

## Description

This interactive tool allows users to analyze player performance through various metrics, including kills, deaths, and assists. <br> The dashboard features multiple views: Player Chart, Series Chart, Recent Performance, and All-Time Stats, enabling comprehensive analysis of player data across different timeframes and match formats.

## Usage

To run the dashboard locally:

1. Open [lol-data-visualization.vercel.app](https://lol-data-visualization.vercel.app/) in your browser

2. Navigate through the tabs to access different views:
   - **Player Chart**: Visualize individual player performance over time
   - **Series Chart**: Analyze player statistics across tournament series
   - **Recent Performance**: View current player statistics in a sortable table (not complete)
   - **All-Time Stats**: Explore historical player data with year-by-year breakdowns

## Data

The dashboard uses League of Legends esports match data formatted as CSV. The ETL pipeline in `lol_analytics/app/scripts/etl_pipeline.py` processes raw match data into the required format.

## License

Game statistics are the property of Riot Games, and any usage of such data must follow [Riot Games' terms and policies](https://developer.riotgames.com/policies/general). <br> The data used in this project is sourced from [Oracles Elixir](https://oracleselixir.com).

## Contact

- **Email**: andytuantruong@gmail.com
- **Website**: [andytuantruong.github.io](https://andytuantruong.github.io/)
