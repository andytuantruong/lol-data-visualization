class DataLoader {
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
