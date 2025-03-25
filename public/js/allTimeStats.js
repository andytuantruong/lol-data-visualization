class AllTimeStats {
  constructor(containerId) {
    this.container = d3.select(containerId);
    this.data = [];
    this.sortColumn = 'winRate';
    this.sortDirection = 'desc';
    this.yearFilter = 'all';
    this.table = this.container.select('#all-time-table');
    this.tbody = this.table.select('tbody');
    this.availableYears = [];
  }

  async initialize() {
    try {
      console.log('Initializing All-Time Stats Table...');

      console.log('Loading hierarchical data...');
      const hierarchyData = await DataLoader.loadHierarchicalData();
      await this.processPlayerData(hierarchyData);
      this.populateYearFilter();
      this.renderTable();
      this.setupEventListeners();

      console.log('All-Time Stats Table initialization complete');
    } catch (error) {
      console.error('Error initializing all-time stats table:', error);
      throw error;
    }
  }

  populateYearFilter() {
    const yearFilter = document.getElementById('all-time-year-filter');
    if (!yearFilter) return;

    yearFilter.innerHTML = '<option value="all">All Years</option>';

    this.availableYears.sort((a, b) => b - a); // Descending order
    this.availableYears.forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearFilter.appendChild(option);
    });
  }

  async processPlayerData(hierarchyData) {
    this.data = [];
    const processedPlayers = new Set();
    const years = new Set();

    try {
      console.log('Loading all player data at once...');
      const allPlayersData = await DataLoader.loadAllPlayersData();
      console.log(`Loaded data for ${allPlayersData.size} players`);

      // Process all leagues
      for (const league of hierarchyData.leagues) {
        const teams = hierarchyData.getTeams(league);

        // Process all teams in the league
        for (const team of teams) {
          const players = hierarchyData.getPlayers(league, team);

          // Process all players in the team
          for (const player of players) {
            // Skip if already processed
            if (processedPlayers.has(player)) continue;
            processedPlayers.add(player);

            try {
              // Get player data from the all players data map
              const playerData = allPlayersData.get(player);

              if (playerData && playerData.length > 0) {
                playerData.forEach((game) => {
                  const year = game.date.getFullYear();
                  years.add(year);
                });

                // Calculate all-time stats
                const playerStats = this.calculatePlayerStats(
                  player,
                  playerData
                );
                this.data.push(playerStats);
              }
            } catch (error) {
              console.error(
                `Error processing data for player ${player}:`,
                error
              );
            }
          }
        }
      }
      this.availableYears = Array.from(years);
    } catch (error) {
      console.error('Error loading all player data:', error);
    }
  }

  calculatePlayerStats(player, playerData) {
    // Group data by year
    const yearData = d3.group(playerData, (d) => d.date.getFullYear());

    // Calculate overall stats
    const totalGames = playerData.length;
    const wins = playerData.filter((d) => d.result === 1).length;
    const winRate = (wins / totalGames) * 100;

    const totalKills = d3.sum(playerData, (d) => d.kills);
    const totalDeaths = d3.sum(playerData, (d) => d.deaths);
    const totalAssists = d3.sum(playerData, (d) => d.assists);

    const avgKills = totalKills / totalGames;
    const avgDeaths = totalDeaths / totalGames;
    const avgAssists = totalAssists / totalGames;

    const kda =
      totalDeaths > 0
        ? (totalKills + totalAssists) / totalDeaths
        : totalKills + totalAssists;

    // Get current team (from most recent game)
    const sortedData = [...playerData].sort((a, b) => b.date - a.date);
    const currentTeam = sortedData[0].teamname;

    // Calculate year-specific stats
    const yearStats = {};
    for (const [year, games] of yearData.entries()) {
      const yearGames = games.length;
      const yearWins = games.filter((d) => d.result === 1).length;
      const yearWinRate = (yearWins / yearGames) * 100;

      const yearKills = d3.sum(games, (d) => d.kills);
      const yearDeaths = d3.sum(games, (d) => d.deaths);
      const yearAssists = d3.sum(games, (d) => d.assists);

      const yearAvgKills = yearKills / yearGames;
      const yearAvgDeaths = yearDeaths / yearGames;
      const yearAvgAssists = yearAssists / yearGames;

      const yearKDA =
        yearDeaths > 0
          ? (yearKills + yearAssists) / yearDeaths
          : yearKills + yearAssists;

      yearStats[year] = {
        year,
        games: yearGames,
        wins: yearWins,
        winRate: yearWinRate,
        avgKills: yearAvgKills,
        avgDeaths: yearAvgDeaths,
        avgAssists: yearAvgAssists,
        kda: yearKDA,
      };
    }

    return {
      player,
      team: currentTeam,
      games: totalGames,
      wins,
      winRate,
      avgKills,
      avgDeaths,
      avgAssists,
      kda,
      yearStats,
      rawData: playerData,
    };
  }

  renderTable() {
    // Filter data by year if needed
    let filteredData = this.data;
    let displayData = [];

    if (this.yearFilter === 'all') {
      // For all years, use the overall stats
      displayData = filteredData.map((d) => ({
        player: d.player,
        team: d.team,
        year: 'All Time',
        games: d.games,
        winRate: d.winRate,
        avgKills: d.avgKills,
        avgDeaths: d.avgDeaths,
        avgAssists: d.avgAssists,
        kda: d.kda,
        rawData: d.rawData,
      }));
    } else {
      // For specific year, use that year's stats
      const year = parseInt(this.yearFilter);
      filteredData.forEach((d) => {
        if (d.yearStats && d.yearStats[year]) {
          displayData.push({
            player: d.player,
            team: d.team,
            year: year,
            games: d.yearStats[year].games,
            winRate: d.yearStats[year].winRate,
            avgKills: d.yearStats[year].avgKills,
            avgDeaths: d.yearStats[year].avgDeaths,
            avgAssists: d.yearStats[year].avgAssists,
            kda: d.yearStats[year].kda,
            rawData: d.rawData,
          });
        }
      });
    }

    // Sort data
    this.sortData(displayData);
    this.tbody.html('');
    displayData.forEach((d) => {
      this.createPlayerRow(d);
    });
  }

  createPlayerRow(playerData) {
    const row = this.tbody.append('tr').classed('data-row', true);

    // Add player name with link
    row
      .append('td')
      .append('a')
      .attr('href', '#')
      .classed('player-link', true)
      .attr('data-player', playerData.player)
      .text(playerData.player);

    row.append('td').text(playerData.team);
    row.append('td').text(playerData.year);
    row.append('td').text(playerData.games);
    row.append('td').text(`${playerData.winRate.toFixed(1)}%`);
    row.append('td').text(playerData.avgKills.toFixed(2));
    row.append('td').text(playerData.avgDeaths.toFixed(2));
    row.append('td').text(playerData.avgAssists.toFixed(2));
    row.append('td').text(playerData.kda.toFixed(2));
  }

  sortData(data) {
    data.sort((a, b) => {
      let valueA = a[this.sortColumn];
      let valueB = b[this.sortColumn];

      // Handle string comparison for player column
      if (this.sortColumn === 'player') {
        return this.sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      // Handle numeric comparison for other columns
      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  setupEventListeners() {
    try {
      const yearFilter = document.getElementById('all-time-year-filter');
      if (yearFilter) {
        // Remove any existing event listeners
        const newYearFilter = yearFilter.cloneNode(true);
        yearFilter.parentNode.replaceChild(newYearFilter, yearFilter);

        // Add new event listener
        newYearFilter.addEventListener('change', (event) => {
          this.yearFilter = event.target.value;
          this.renderTable();
        });
      }

      // Sort column headers - remove existing listeners first
      this.table.selectAll('th.sortable').on('click', null);

      // Add new sort listeners
      this.table.selectAll('th.sortable').on('click', (event) => {
        const column = event.currentTarget.getAttribute('data-column');

        // If clicking the same column, toggle direction
        if (column === this.sortColumn) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          // New column, set to appropriate default direction
          this.sortColumn = column;
          // Default to descending for numeric columns, ascending for text
          this.sortDirection = column === 'player' ? 'asc' : 'desc';
        }

        this.updateSortIndicators();
        this.renderTable();
      });

      // Player link clicks - remove existing listeners first
      this.table.on('click', '.player-link', null);

      // Add new player link listeners
      this.table.on('click', '.player-link', (event) => {
        event.preventDefault();

        const playerName = event.target.getAttribute('data-player');
        if (!playerName) {
          console.warn('Player link clicked but no player attribute found');
          return;
        }

        console.log(`All-time stats player link clicked: ${playerName}`);

        // Store selected values in localStorage
        localStorage.setItem('selectedPlayer', playerName);
        localStorage.setItem('selectedMetric', 'kills'); // Default to kills for all-time stats

        // Find player data to get league and team
        DataLoader.loadPlayerData(playerName)
          .then((playerData) => {
            if (playerData && playerData.length > 0) {
              const sampleGame = playerData[0];
              localStorage.setItem('selectedLeague', sampleGame.league);
              localStorage.setItem('selectedTeam', sampleGame.teamname);

              // Switch to player chart tab
              const playerChartTab = document.querySelector(
                '.tab[data-tab="player-chart"]'
              );
              if (playerChartTab) {
                playerChartTab.click();
              }

              // Update the chart if chart manager is available
              if (window.chartManagerInstance) {
                window.chartManagerInstance.selectPlayer(
                  playerName,
                  sampleGame.teamname,
                  sampleGame.league,
                  'kills'
                );
              }
            } else {
              console.error('Could not load player data for:', playerName);
            }
          })
          .catch((error) => {
            console.error('Error loading player data:', error);
          });
      });

      console.log('All-time stats event listeners set up successfully');
    } catch (error) {
      console.error('Error setting up all-time stats event listeners:', error);
    }
  }

  updateSortIndicators() {
    // Remove all existing indicators
    this.table.selectAll('th').each(function () {
      const th = d3.select(this);
      // Remove any existing sort indicators
      const existingIndicator = th.select('.sort-indicator');
      if (!existingIndicator.empty()) {
        existingIndicator.remove();
      }
    });

    // Add indicator to current sort column
    const th = this.table.select(`th[data-column="${this.sortColumn}"]`);
    const indicator = this.sortDirection === 'asc' ? '↑' : '↓';
    th.append('span')
      .attr('class', 'sort-indicator')
      .style('margin-left', '5px')
      .text(indicator);
  }
}
