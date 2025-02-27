class DataLoader {
  // Cache for loaded data to avoid repeated fetches
  static csvData = null;
  static usedPath = '';
  static hierarchicalData = null;
  static processedPlayerData = {};
  static playerList = null;
  static allPlayersData = null;

  // Fetch CSV data from the specified path, using cache if available
  static async fetchCSVData() {
    if (this.csvData) {
      console.log('Using cached CSV data from:', this.usedPath);
      return this.csvData;
    }

    const cleanedData = '../../lol_analytics/data/processed/cleaned_data.csv';

    try {
      console.log(`Attempting to load CSV from: ${cleanedData}`);
      const response = await fetch(cleanedData);

      if (response.ok) {
        this.csvData = await response.text();
        this.usedPath = cleanedData;
        console.log(`Successfully loaded CSV from: ${cleanedData}`);
        return this.csvData;
      } else {
        console.error(
          `Failed to load CSV: ${response.status} ${response.statusText}`
        );
        throw new Error(
          `Failed to load data from ${cleanedData}. Server returned: ${response.status} ${response.statusText}`
        );
      }
    } catch (e) {
      console.error(`Error loading CSV from ${cleanedData}:`, e.message);
      throw new Error(
        `Failed to load data from ${cleanedData}. Please check that the file exists and is accessible.`
      );
    }
  }

  // Load and organize data into hierarchical structure (leagues, teams, players)
  static async loadHierarchicalData() {
    if (this.hierarchicalData) {
      console.log('Using cached hierarchical data');
      return this.hierarchicalData;
    }

    try {
      const csvData = await this.fetchCSVData();
      const allData = d3.csvParse(csvData);

      console.log(`Loaded ${allData.length} rows from ${this.usedPath}`);

      const leagues = [...new Set(allData.map((d) => d.league))]
        .filter(Boolean)
        .sort();

      const teams = {};
      const players = {};

      leagues.forEach((league) => {
        const leagueData = allData.filter((d) => d.league === league);
        teams[league] = [...new Set(leagueData.map((d) => d.teamname))]
          .filter(Boolean)
          .sort();
      });

      leagues.forEach((league) => {
        players[league] = {};
        teams[league].forEach((team) => {
          const teamData = allData.filter(
            (d) => d.league === league && d.teamname === team
          );
          players[league][team] = [
            ...new Set(teamData.map((d) => d.playername)),
          ]
            .filter(Boolean)
            .sort();
        });
      });

      this.hierarchicalData = {
        leagues,
        teams,
        players,
        getTeams: (league) => teams[league] || [],
        getPlayers: (league, team) =>
          (players[league] && players[league][team]) || [],
      };

      console.log('Hierarchical data loaded successfully');
      return this.hierarchicalData;
    } catch (error) {
      console.error('Error loading hierarchical data:', error);
      console.error('Error details:', error.message);
      throw error;
    }
  }

  // Get a list of all unique player names
  static async loadPlayerList() {
    if (this.playerList) {
      console.log('Using cached player list');
      return this.playerList;
    }

    try {
      const csvData = await this.fetchCSVData();
      const data = d3.csvParse(csvData);

      this.playerList = [...new Set(data.map((d) => d.playername))]
        .filter(Boolean)
        .sort();
      console.log(`Found ${this.playerList.length} players`);
      return this.playerList;
    } catch (error) {
      console.error('Error loading player list:', error);
      console.error('Error details:', error.message);
      throw error;
    }
  }

  // Load data for all players at once
  static async loadAllPlayersData() {
    if (this.allPlayersData) {
      console.log('Using cached all players data');
      return this.allPlayersData;
    }

    try {
      console.log('Loading data for all players at once...');
      const csvData = await this.fetchCSVData();
      const allData = d3.csvParse(csvData);

      const loadingMessage = document.querySelector('.loading-message');
      if (loadingMessage) {
        loadingMessage.textContent = 'Parsing player data...';
      }

      // Group data by player name
      const playerDataMap = d3.group(allData, (d) => d.playername);

      // Process each player's data
      const processedData = new Map();
      let processedCount = 0;
      const totalPlayers = playerDataMap.size;
      const updateInterval = Math.max(1, Math.floor(totalPlayers / 10));

      playerDataMap.forEach((playerRows, playerName) => {
        if (!playerName) return; // Skip empty player names

        const processedRows = playerRows.map((d) => ({
          date: new Date(d.date),
          kills: +d.kills,
          deaths: +d.deaths,
          assists: +d.assists,
          result: +d.result,
          champion: d.champion,
          teamname: d.teamname,
          opponent: d.opponent_teamname,
          league: d.league,
        }));

        processedData.set(playerName, processedRows);

        // Also cache in the individual player cache
        this.processedPlayerData[playerName] = processedRows;

        processedCount++;

        // Update progress periodically
        if (
          processedCount % updateInterval === 0 ||
          processedCount === totalPlayers
        ) {
          const progressPercent = Math.round(
            (processedCount / totalPlayers) * 100
          );
          console.log(
            `Processed data for ${processedCount}/${totalPlayers} players (${progressPercent}%)`
          );

          if (loadingMessage) {
            loadingMessage.textContent = `Processing player data (${progressPercent}%)...`;
          }
        }
      });

      this.allPlayersData = processedData;
      console.log(`Processed data for ${processedData.size} players`);

      return processedData;
    } catch (error) {
      console.error('Error loading all players data:', error);
      throw error;
    }
  }

  // Load and process data for a specific player
  static async loadPlayerData(playerName) {
    if (!playerName) {
      console.error('No player name provided');
      throw new Error('Player name is required');
    }

    // Check if we already have this player's data in cache
    if (this.processedPlayerData[playerName]) {
      console.log(`Using cached data for player: ${playerName}`);
      return this.processedPlayerData[playerName];
    }

    // If we have all players data loaded, use that instead of making a new request
    if (this.allPlayersData && this.allPlayersData.has(playerName)) {
      console.log(`Using data from all players cache for: ${playerName}`);
      return this.allPlayersData.get(playerName);
    }

    try {
      const csvData = await this.fetchCSVData();
      const allData = d3.csvParse(csvData);

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
          league: d.league,
        }));

      console.log(
        `Found ${playerData.length} matches for player: ${playerName}`
      );

      if (playerData.length === 0) {
        console.warn(`No data found for player: ${playerName}`);
      }

      this.processedPlayerData[playerName] = playerData;

      return playerData;
    } catch (error) {
      console.error(`Error loading data for player ${playerName}:`, error);
      console.error('Error details:', error.message);
      throw error;
    }
  }
}
