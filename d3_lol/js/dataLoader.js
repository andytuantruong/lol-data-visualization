class DataLoader {
  static async loadHierarchicalData() {
    try {
      const response = await fetch(
        '../../lol_analytics/data/processed/cleaned_data.csv'
      );
      const csvData = await response.text();
      const data = d3.csvParse(csvData);

      // Create hierarchical structure
      const hierarchy = data.reduce((acc, row) => {
        const league = row.league;
        const team = row.teamname;
        const player = row.playername;

        // Initializes league and team
        if (!acc[league]) {
          acc[league] = { teams: {} };
        }
        if (!acc[league].teams[team]) {
          acc[league].teams[team] = { players: new Set() };
        }

        // Add player to team
        acc[league].teams[team].players.add(player);

        return acc;
      }, {});

      // Sort in arrays
      return {
        leagues: Object.keys(hierarchy).sort(),
        getTeams: (league) =>
          league ? Object.keys(hierarchy[league].teams).sort() : [],
        getPlayers: (league, team) =>
          league && team
            ? Array.from(hierarchy[league].teams[team].players).sort()
            : [],
      };
    } catch (error) {
      console.error('Error loading hierarchical data:', error);
      return { leagues: [], getTeams: () => [], getPlayers: () => [] };
    }
  }

  static async loadPlayerList() {
    try {
      const response = await fetch(
        '../../lol_analytics/data/processed/cleaned_data.csv'
      );
      const csvData = await response.text();
      const data = d3.csvParse(csvData);

      // Get unique player names
      const players = [...new Set(data.map((d) => d.playername))].sort();
      console.log('Found players:', players);
      return players;
    } catch (error) {
      console.error('Error loading player list:', error);
      console.error('Error details:', error.message);
      return [];
    }
  }

  static async loadPlayerData(playerName) {
    try {
      const response = await fetch(
        '../../lol_analytics/data/processed/cleaned_data.csv'
      );
      const csvData = await response.text();
      const allData = d3.csvParse(csvData);

      // Filter data for selected player and transform
      const playerData = allData
        .filter((d) => d.playername === playerName)
        .map((d) => ({
          date: new Date(d.date),
          kills: +d.kills,
          deaths: +d.deaths,
          assists: +d.assists,
          result: +d.result,
          champion: d.champion,
          teamname: d.teamname,
          opponent: d.opponent_teamname,
        }));

      console.log(`Found ${playerData.length} matches for player:`, playerName);
      return playerData;
    } catch (error) {
      console.error('Error loading player data:', error);
      console.error('Error details:', error.message);
      return [];
    }
  }
}
