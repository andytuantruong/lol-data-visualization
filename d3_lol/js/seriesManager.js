/**
 * SeriesManager class
 * Handles grouping games into series and calculating series statistics
 */
class SeriesManager {
  constructor() {
    this.seriesData = new Map(); // Cache for player series data
  }

  /**
   * Load series data for a player
   * @param {string} playerName - The player name
   * @returns {Promise<Array>} - Promise resolving to array of series data
   */
  async loadPlayerSeries(playerName) {
    try {
      console.log(`Loading series data for player: ${playerName}`);

      // Check cache first
      if (this.seriesData.has(playerName)) {
        console.log(`Using cached series data for ${playerName}`);
        return this.seriesData.get(playerName);
      }

      // Load player data from DataLoader
      const playerData = await DataLoader.loadPlayerData(playerName);

      if (!playerData || playerData.length === 0) {
        console.log(`No matches found for player: ${playerName}`);
        return [];
      }

      console.log(
        `Found ${playerData.length} matches for player: ${playerName}`
      );

      // Sort matches by date
      playerData.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Group games into series
      const series = this.groupGamesIntoSeries(playerData);

      // Calculate series statistics
      const seriesWithStats = this.calculateSeriesStats(series);

      // Cache the result
      this.seriesData.set(playerName, seriesWithStats);

      return seriesWithStats;
    } catch (error) {
      console.error(`Error loading series data for ${playerName}:`, error);
      throw new Error(
        `Failed to load series data for ${playerName}: ${error.message}`
      );
    }
  }

  /**
   * Group games into series based on consecutive games against the same opponent
   * @param {Array} matches - Array of matches
   * @returns {Array} - Array of series
   */
  groupGamesIntoSeries(matches) {
    try {
      const series = [];
      let currentSeries = null;

      matches.forEach((match) => {
        // Determine opponent team
        const playerTeam = match.teamname;
        const opponent = match.opponent;

        if (!opponent) {
          console.warn('Match missing opponent information:', match);
          return; // Skip this match
        }

        // Check if this match continues the current series
        if (currentSeries && currentSeries.opponent === opponent) {
          // Add game to current series
          currentSeries.games.push({
            date: match.date,
            kills: match.kills || 0,
            deaths: match.deaths || 0,
            assists: match.assists || 0,
            isWin: match.result === 1,
            gameId: match.gameid,
          });

          // Update end date
          currentSeries.endDate = match.date;
        } else {
          // If there was a previous series, finalize it
          if (currentSeries) {
            // Determine series type and result
            currentSeries.seriesType = this.determineSeriesType(
              currentSeries.games.length
            );

            // Add to series array
            series.push(currentSeries);
          }

          // Start a new series
          currentSeries = {
            opponent: opponent,
            team: playerTeam,
            startDate: match.date,
            endDate: match.date,
            games: [
              {
                date: match.date,
                kills: match.kills || 0,
                deaths: match.deaths || 0,
                assists: match.assists || 0,
                isWin: match.result === 1,
                gameId: match.gameid,
              },
            ],
          };
        }
      });

      // Add the last series if it exists
      if (currentSeries) {
        // Determine series type
        currentSeries.seriesType = this.determineSeriesType(
          currentSeries.games.length
        );

        // Add to series array
        series.push(currentSeries);
      }

      console.log(
        `Grouped ${matches.length} matches into ${series.length} series`
      );
      return series;
    } catch (error) {
      console.error('Error grouping games into series:', error);
      return [];
    }
  }

  /**
   * Determine the series type based on game count
   * @param {number} gameCount - Number of games in the series
   * @returns {string} - Series type (bo1, bo3, bo5, other)
   */
  determineSeriesType(gameCount) {
    if (gameCount === 1) {
      return 'bo1';
    } else if (gameCount === 2 || gameCount === 3) {
      return 'bo3';
    } else if (gameCount >= 4 && gameCount <= 5) {
      return 'bo5';
    } else {
      return 'other';
    }
  }

  /**
   * Calculate statistics for each series
   * @param {Array} series - Array of series
   * @returns {Array} - Array of series with calculated statistics
   */
  calculateSeriesStats(series) {
    try {
      return series.map((s) => {
        // Count wins and losses
        const wins = s.games.filter((game) => game.isWin).length;
        const losses = s.games.length - wins;

        // Determine series result
        let seriesResult = false;
        if (s.seriesType === 'bo3') {
          seriesResult = wins >= 2;
        } else if (s.seriesType === 'bo5') {
          seriesResult = wins >= 3;
        } else {
          seriesResult = wins > losses;
        }

        // Calculate total stats
        const totalKills = s.games.reduce((sum, game) => sum + game.kills, 0);
        const totalDeaths = s.games.reduce((sum, game) => sum + game.deaths, 0);
        const totalAssists = s.games.reduce(
          (sum, game) => sum + game.assists,
          0
        );

        // Calculate average stats
        const avgKills = totalKills / s.games.length;
        const avgDeaths = totalDeaths / s.games.length;
        const avgAssists = totalAssists / s.games.length;

        return {
          opponent: s.opponent,
          team: s.team,
          startDate: s.startDate,
          endDate: s.endDate,
          seriesType: s.seriesType,
          seriesResult: seriesResult,
          gameCount: s.games.length,
          wins: wins,
          losses: losses,
          kills: totalKills,
          deaths: totalDeaths,
          assists: totalAssists,
          avgKills: parseFloat(avgKills.toFixed(2)),
          avgDeaths: parseFloat(avgDeaths.toFixed(2)),
          avgAssists: parseFloat(avgAssists.toFixed(2)),
          games: s.games,
        };
      });
    } catch (error) {
      console.error('Error calculating series stats:', error);
      return [];
    }
  }
}
