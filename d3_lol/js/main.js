// Define ChartManager class
class ChartManager {
  constructor() {
    this.chart = null;
    this.currentPlayer = null;
    this.currentMetric = 'kills';
    this.currentGameCount = 'all';
    this.metricDisplay = document.getElementById('metric-display');

    if (this.metricDisplay) {
      this.metricDisplay.textContent = 'Kills';
    }

    this.filters = {
      minValue: {
        id: 'min-metric',
        getValue: (el) => parseInt(el.value) || 0,
        apply: (data, value) =>
          data.filter((d) => d[this.currentMetric] >= value),
      },
      gameCount: {
        id: 'game-count-control',
        getValue: (el) => {
          const activeSegment = el.querySelector('.segment.active');
          return activeSegment
            ? activeSegment.getAttribute('data-value')
            : 'all';
        },
        apply: (data, value) => {
          if (value === 'all') return data;

          // Parse the count from the value lastN -> N
          const count = parseInt(value.replace('last', ''));
          if (isNaN(count) || count <= 0) return data;

          // Sort by date (most recent first), take only the last N games, then re-sort by date ascending
          return [...data]
            .sort((a, b) => b.date - a.date)
            .slice(0, count)
            .sort((a, b) => a.date - b.date);
        },
      },
    };

    this.stats = {
      average: {
        id: 'average-metric',
        calculate: (data) =>
          data.reduce((sum, d) => sum + d[this.currentMetric], 0) / data.length,
        format: (value) => value.toFixed(1),
      },
      median: {
        id: 'median-metric',
        calculate: (data) => {
          const sorted = [...data].sort(
            (a, b) => a[this.currentMetric] - b[this.currentMetric]
          );
          return sorted[Math.floor(sorted.length / 2)][this.currentMetric];
        },
        format: (value) => `${value}`,
      },
    };

    this.hierarchicalData = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('Initializing ChartManager...');

      // Create chart instance
      this.chart = new MetricsChart('#chart-container');

      // Load hierarchical data
      console.log('Loading hierarchical data for chart...');
      this.hierarchicalData = await DataLoader.loadHierarchicalData();
      console.log('Hierarchical data loaded:', this.hierarchicalData);

      // Set up UI components
      this.populateLeagueDropdown();
      this.setupHierarchicalFilters();
      this.setupEventListeners();

      // Check for saved selections
      const savedLeague = localStorage.getItem('selectedLeague');
      const savedTeam = localStorage.getItem('selectedTeam');
      const savedPlayer = localStorage.getItem('selectedPlayer');
      const savedMetric = localStorage.getItem('selectedMetric');

      console.log('Saved selections:', {
        savedLeague,
        savedTeam,
        savedPlayer,
        savedMetric,
      });

      // Apply saved selections if available
      if (savedLeague && savedTeam && savedPlayer) {
        setTimeout(() => {
          this.selectPlayer(
            savedPlayer,
            savedTeam,
            savedLeague,
            savedMetric || 'kills'
          );
        }, 100);
      } else {
        this.resetChart();
      }

      // Add tab change listener to handle visibility changes
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const tabId = tab.getAttribute('data-tab');
          if (tabId === 'player-chart' && this.chart && this.currentPlayer) {
            // Give the DOM time to update visibility
            setTimeout(() => {
              if (this.chart.resize) {
                this.chart.resize();
              }
              this.updateChart();
            }, 100);
          }
        });
      });

      this.isInitialized = true;
      console.log('ChartManager initialization complete');
      return true;
    } catch (error) {
      console.error('Error in ChartManager initialize:', error);

      // Show error message
      const dataError = document.getElementById('data-error');
      if (dataError) {
        dataError.style.display = 'block';
        const errorMsg = dataError.querySelector('p');
        if (errorMsg) {
          errorMsg.textContent = `Error initializing chart: ${error.message}. Please check the console for more details.`;
        }
      }

      throw error;
    }
  }

  populateLeagueDropdown() {
    try {
      const leagueDropdown = document.getElementById('league-dropdown');
      if (!leagueDropdown) {
        console.warn('League dropdown not found');
        return;
      }

      // Clear existing options except the first one
      while (leagueDropdown.options.length > 1) {
        leagueDropdown.remove(1);
      }

      // Add league options
      if (this.hierarchicalData && this.hierarchicalData.leagues) {
        this.hierarchicalData.leagues.forEach((league) => {
          const option = document.createElement('option');
          option.value = league;
          option.textContent = league;
          leagueDropdown.appendChild(option);
        });

        console.log(
          'Populated league dropdown with options:',
          this.hierarchicalData.leagues
        );
      } else {
        console.warn('No leagues found in hierarchical data');
      }
    } catch (error) {
      console.error('Error populating league dropdown:', error);
    }
  }

  updateTeamDropdown(league) {
    try {
      const teamDropdown = document.getElementById('team-dropdown');
      const playerDropdown = document.getElementById('player-dropdown');

      if (!teamDropdown || !playerDropdown) {
        console.warn('Team or player dropdown not found');
        return;
      }

      // Reset team dropdown
      teamDropdown.innerHTML = '<option value="">Select Team...</option>';
      playerDropdown.innerHTML = '<option value="">Select Player...</option>';

      if (league) {
        // Get teams for selected league
        const teams = this.hierarchicalData.getTeams(league);

        if (teams && teams.length > 0) {
          // Add team options
          teams.forEach((team) => {
            const option = document.createElement('option');
            option.value = team;
            option.textContent = team;
            teamDropdown.appendChild(option);
          });

          // Enable/disable dropdowns
          teamDropdown.disabled = false;
          playerDropdown.disabled = true;

          console.log(
            `Populated team dropdown with ${teams.length} teams for league: ${league}`
          );
        } else {
          console.warn(`No teams found for league: ${league}`);
          teamDropdown.disabled = true;
          playerDropdown.disabled = true;
        }
      } else {
        // Disable both dropdowns if no league selected
        teamDropdown.disabled = true;
        playerDropdown.disabled = true;
      }
    } catch (error) {
      console.error('Error updating team dropdown:', error);
    }
  }

  updatePlayerDropdown(league, team) {
    try {
      const playerDropdown = document.getElementById('player-dropdown');
      if (!playerDropdown) {
        console.warn('Player dropdown not found');
        return;
      }

      // Reset player dropdown
      playerDropdown.innerHTML = '<option value="">Select Player...</option>';

      if (league && team) {
        // Get players for selected team
        const players = this.hierarchicalData.getPlayers(league, team);

        if (players && players.length > 0) {
          // Add player options
          players.forEach((player) => {
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            playerDropdown.appendChild(option);
          });

          // Enable player dropdown
          playerDropdown.disabled = false;

          console.log(
            `Populated player dropdown with ${players.length} players for team: ${team}`
          );
        } else {
          console.warn(
            `No players found for team: ${team} in league: ${league}`
          );
          playerDropdown.disabled = true;
        }
      } else {
        // Disable player dropdown if no team selected
        playerDropdown.disabled = true;
      }
    } catch (error) {
      console.error('Error updating player dropdown:', error);
    }
  }

  setupHierarchicalFilters() {
    try {
      const leagueDropdown = document.getElementById('league-dropdown');
      const teamDropdown = document.getElementById('team-dropdown');
      const playerDropdown = document.getElementById('player-dropdown');

      if (!leagueDropdown || !teamDropdown || !playerDropdown) {
        console.warn('One or more dropdowns not found');
        return;
      }

      // Remove existing event listeners
      const newLeagueDropdown = leagueDropdown.cloneNode(true);
      leagueDropdown.parentNode.replaceChild(newLeagueDropdown, leagueDropdown);

      const newTeamDropdown = teamDropdown.cloneNode(true);
      teamDropdown.parentNode.replaceChild(newTeamDropdown, teamDropdown);

      // League change event
      newLeagueDropdown.addEventListener('change', () => {
        const selectedLeague = newLeagueDropdown.value;
        console.log('League selected:', selectedLeague);
        this.updateTeamDropdown(selectedLeague);
      });

      // Team change event
      newTeamDropdown.addEventListener('change', () => {
        const selectedLeague = newLeagueDropdown.value;
        const selectedTeam = newTeamDropdown.value;
        console.log('Team selected:', selectedTeam);
        this.updatePlayerDropdown(selectedLeague, selectedTeam);
      });

      console.log('Hierarchical filters set up successfully');
    } catch (error) {
      console.error('Error setting up hierarchical filters:', error);
    }
  }

  /* Used for the player chart:
     League dropdown change -> update team dropdown
     Team dropdown change -> update player dropdown
     Metric segmented control -> update chart with new metric
     Game count segmented control -> update chart with new game count filter
     Slider -> update chart with new position
  */
  setupEventListeners() {
    try {
      console.log('Setting up event listeners...');

      // League dropdown change
      const leagueDropdown = document.getElementById('league-dropdown');
      if (leagueDropdown) {
        leagueDropdown.addEventListener('change', (event) => {
          const league = event.target.value;
          this.updateTeamDropdown(league);
          this.currentLeague = league;
          localStorage.setItem('selectedLeague', league);
        });
      }

      // Team dropdown change
      const teamDropdown = document.getElementById('team-dropdown');
      if (teamDropdown) {
        teamDropdown.addEventListener('change', (event) => {
          const team = event.target.value;
          const league = leagueDropdown.value;
          this.updatePlayerDropdown(league, team);
          this.currentTeam = team;
          localStorage.setItem('selectedTeam', team);
        });
      }

      // Player dropdown change
      const playerDropdown = document.getElementById('player-dropdown');
      if (playerDropdown) {
        playerDropdown.addEventListener('change', (event) => {
          this.updateChart();
        });
      }

      // Metric segmented control
      const metricSegments = document.querySelectorAll(
        '#player-chart .segmented-control:not(.game-count-control) .segment'
      );

      metricSegments.forEach((segment) => {
        segment.addEventListener('click', (event) => {
          // Remove active class from all segments in this control
          const control = segment.closest('.segmented-control');
          control.querySelectorAll('.segment').forEach((s) => {
            s.classList.remove('active');
          });

          // Add active class to clicked segment
          segment.classList.add('active');

          // Position the slider
          this.positionSlider(control);

          // Update the chart with the new metric
          this.currentMetric = segment.getAttribute('data-value');
          localStorage.setItem('selectedMetric', this.currentMetric);
          this.updateChart();
        });
      });

      // Game count segmented control
      const gameCountSegments = document.querySelectorAll(
        '#player-chart .game-count-control .segment'
      );

      gameCountSegments.forEach((segment) => {
        segment.addEventListener('click', (event) => {
          // Remove active class from all segments in this control
          const control = segment.closest('.segmented-control');
          control.querySelectorAll('.segment').forEach((s) => {
            s.classList.remove('active');
          });

          // Add active class to clicked segment
          segment.classList.add('active');

          // Position the slider
          this.positionSlider(control);

          // Update the chart with the new game count filter
          this.gameCountFilter = segment.getAttribute('data-value');
          localStorage.setItem('gameCountFilter', this.gameCountFilter);
          this.updateChart();
        });
      });

      // Initialize sliders
      const segmentedControls = document.querySelectorAll(
        '#player-chart .segmented-control'
      );
      segmentedControls.forEach((control) => {
        this.positionSlider(control);
      });

      console.log('Event listeners set up successfully');
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  positionSlider(controlElement) {
    try {
      if (!controlElement) {
        // If no specific control is provided, position all sliders in player chart
        const controls = document.querySelectorAll(
          '#player-chart .segmented-control'
        );
        controls.forEach((control) => this.positionSlider(control));
        return;
      }

      const activeSegment = controlElement.querySelector('.segment.active');
      const slider = controlElement.querySelector('.slider');

      if (activeSegment && slider) {
        const segmentRect = activeSegment.getBoundingClientRect();
        const controlRect = controlElement.getBoundingClientRect();

        // Calculate the left position relative to the control
        const left = segmentRect.left - controlRect.left;

        // Set the slider position and width
        slider.style.width = `${segmentRect.width}px`;
        slider.style.left = `${left}px`;
        slider.style.display = 'block';
      } else if (!activeSegment && slider) {
        // If no active segment, default to first one
        const firstSegment = controlElement.querySelector('.segment');
        if (firstSegment) {
          firstSegment.classList.add('active');
          this.positionSlider(controlElement);
        }
      }
    } catch (error) {
      console.error('Error positioning slider:', error);
    }
  }

  formatMetric(metric) {
    return metric.charAt(0).toUpperCase() + metric.slice(1);
  }

  async updateChart() {
    try {
      const playerDropdown = document.getElementById('player-dropdown');
      if (!playerDropdown) {
        console.warn('Player dropdown not found');
        return;
      }

      const playerName = playerDropdown.value || this.currentPlayer;
      if (!playerName) {
        this.resetChart();
        return;
      }

      // Update player name display
      const playerNameElement = document.getElementById('player-name');
      if (playerNameElement) {
        playerNameElement.textContent = playerName;
      }

      console.log(`Loading data for player: ${playerName}`);
      let data = await DataLoader.loadPlayerData(playerName);

      if (!data || data.length === 0) {
        console.error('No data loaded for player:', playerName);
        this.resetChart();
        return;
      }

      data = this.applyFilters(data);
      this.updateStats(data);

      // Sort data by date
      data.sort((a, b) => a.date - b.date);

      // Update chart
      if (this.chart) {
        // Check if player chart tab is active
        const playerChartTab = document.getElementById('player-chart');

        if (playerChartTab && playerChartTab.classList.contains('active')) {
          this.chart.update(data, playerName, this.currentMetric);
        } else {
          console.log('Player chart tab not active, storing data for later');
          // Store data for when tab becomes active
          this.chart.currentData = data;
          this.chart.currentPlayerName = playerName;
          this.chart.currentMetric = this.currentMetric;
        }
      }

      // Store current player
      this.currentPlayer = playerName;
    } catch (error) {
      console.error('Error in updateChart:', error);
      this.resetChart();
    }
  }

  applyFilters(data) {
    return Object.values(this.filters).reduce((filteredData, filter) => {
      const element =
        filter.id === 'game-count-control'
          ? document.querySelector(`.${filter.id}`)
          : document.getElementById(filter.id);

      if (element) {
        const value = filter.getValue(element);
        return filter.apply(filteredData, value);
      }
      return filteredData;
    }, data);
  }

  updateStats(data) {
    try {
      if (!data || data.length === 0) {
        console.warn('No data available to update stats');
        return;
      }

      const metric = this.currentMetric;
      if (!metric) {
        console.warn('No metric selected for stats calculation');
        return;
      }

      // Calculate average
      const sum = data.reduce((acc, d) => acc + d[metric], 0);
      const avg = sum / data.length;

      // Calculate median
      const sortedValues = [...data]
        .map((d) => d[metric])
        .sort((a, b) => a - b);
      let median;
      const mid = Math.floor(sortedValues.length / 2);
      if (sortedValues.length % 2 === 0) {
        median = (sortedValues[mid - 1] + sortedValues[mid]) / 2;
      } else {
        median = sortedValues[mid];
      }

      console.log(
        `Stats for ${metric} (${
          this.currentGameCount
        }): Average = ${avg.toFixed(2)}, Median = ${median.toFixed(2)}`
      );

      // Update stats in the UI - handle performance.html
      const avgMetricElement = document.getElementById('average-metric');
      const medianMetricElement = document.getElementById('median-metric');
      const avgValueElement = document.getElementById('avg-value');
      const medianValueElement = document.getElementById('median-value');

      // Update the elements if they exist
      if (avgMetricElement) {
        avgMetricElement.textContent = avg.toFixed(2);
      }

      if (medianMetricElement) {
        medianMetricElement.textContent = median.toFixed(2);
      }

      if (avgValueElement) {
        avgValueElement.textContent = avg.toFixed(2);
      }

      if (medianValueElement) {
        medianValueElement.textContent = median.toFixed(2);
      }

      // Update metric display if it exists
      const metricDisplay = document.getElementById('metric-display');
      if (metricDisplay) {
        metricDisplay.textContent = this.formatMetric(metric);
      }
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  resetChart() {
    console.log('Resetting chart...');

    // Clear current player and metric
    this.currentPlayer = null;
    this.currentTeam = null;
    this.currentLeague = null;
    this.currentMetric = 'kills'; // Default to kills
    this.gameCount = 'all';

    // Reset dropdowns
    const leagueDropdown = document.getElementById('league-dropdown');
    const teamDropdown = document.getElementById('team-dropdown');
    const playerDropdown = document.getElementById('player-dropdown');

    if (leagueDropdown) {
      leagueDropdown.value = '';
      if (this.leagueChoices) {
        this.leagueChoices.setChoiceByValue('');
      }
    }

    if (teamDropdown) {
      teamDropdown.value = '';
      teamDropdown.disabled = true;
      if (this.teamChoices) {
        this.teamChoices.setChoiceByValue('');
      }
    }

    if (playerDropdown) {
      playerDropdown.value = '';
      playerDropdown.disabled = true;
      if (this.playerChoices) {
        this.playerChoices.setChoiceByValue('');
      }
    }

    // Reset metric buttons
    const metricButtons = document.querySelectorAll(
      '#player-chart .segmented-control .segment'
    );
    metricButtons.forEach((button) => {
      button.classList.remove('active');
      if (button.getAttribute('data-value') === 'kills') {
        button.classList.add('active');
      }
    });

    // Reset game count buttons
    const gameCountButtons = document.querySelectorAll(
      '.game-count-control .segment'
    );
    gameCountButtons.forEach((button) => {
      button.classList.remove('active');
      if (button.getAttribute('data-value') === 'all') {
        button.classList.add('active');
      }
    });

    this.positionSlider();

    // Reset stats display
    document.getElementById('avg-value').textContent = '--';
    document.getElementById('median-value').textContent = '--';

    if (this.chart) {
      this.chart.clear();
    }

    console.log('Chart reset complete');
  }

  /**
   * Selects a player in the dropdowns and updates the chart
   * @param {string} playerName - The player name
   * @param {string} team - The team name
   * @param {string} league - The league name
   * @param {string} metric - The metric to display
   */
  selectPlayer(playerName, team, league, metric = 'kills') {
    if (!this.hierarchicalData) {
      console.error('Hierarchical data not loaded yet');
      return;
    }

    console.log(
      `Selecting player: ${playerName}, team: ${team}, league: ${league}, metric: ${metric}`
    );

    try {
      // Set league
      const leagueDropdown = document.getElementById('league-dropdown');
      if (leagueDropdown) {
        // Check if league exists in dropdown
        let leagueExists = false;
        for (let i = 0; i < leagueDropdown.options.length; i++) {
          if (leagueDropdown.options[i].value === league) {
            leagueExists = true;
            break;
          }
        }

        if (leagueExists) {
          // Set league dropdown value
          leagueDropdown.value = league;

          // Update team dropdown
          this.updateTeamDropdown(league);

          // Set team dropdown value
          const teamDropdown = document.getElementById('team-dropdown');
          if (teamDropdown) {
            // Check if team exists in dropdown
            let teamExists = false;
            for (let i = 0; i < teamDropdown.options.length; i++) {
              if (teamDropdown.options[i].value === team) {
                teamExists = true;
                break;
              }
            }

            if (teamExists) {
              // Set team dropdown value
              teamDropdown.value = team;

              // Update player dropdown
              this.updatePlayerDropdown(league, team);

              // Set player dropdown value
              const playerDropdown = document.getElementById('player-dropdown');
              if (playerDropdown) {
                // Check if player exists in dropdown
                let playerExists = false;
                for (let i = 0; i < playerDropdown.options.length; i++) {
                  if (playerDropdown.options[i].value === playerName) {
                    playerExists = true;
                    break;
                  }
                }

                if (playerExists) {
                  // Set player dropdown value
                  playerDropdown.value = playerName;

                  // Set metric
                  const metricSegments = document.querySelectorAll(
                    '#player-chart .segmented-control:not(.game-count-control) .segment'
                  );
                  metricSegments.forEach((segment) => {
                    if (segment.getAttribute('data-value') === metric) {
                      // Remove active class from all segments
                      metricSegments.forEach((s) =>
                        s.classList.remove('active')
                      );
                      // Add active class to selected segment
                      segment.classList.add('active');
                      // Update slider position
                      this.positionSlider();
                    }
                  });

                  // Store current selections
                  this.currentLeague = league;
                  this.currentTeam = team;
                  this.currentPlayer = playerName;
                  this.currentMetric = metric;

                  this.updateChart();

                  // Load and display series data if available
                  this.loadSeriesData(playerName, metric);
                } else {
                  console.warn(`Player ${playerName} not found in dropdown`);
                }
              }
            } else {
              console.warn(`Team ${team} not found in dropdown`);
            }
          }
        } else {
          console.warn(`League ${league} not found in dropdown`);
        }
      }
    } catch (error) {
      console.error('Error selecting player:', error);
    }
  }

  /**
   * Load and display series data for a player
   * @param {string} playerName - Player name
   * @param {string} metric - Metric to display
   */
  async loadSeriesData(playerName, metric) {
    try {
      console.log(
        `Loading series data for ${playerName} with metric ${metric}`
      );

      // Check if SeriesManager is available
      if (typeof SeriesManager === 'undefined') {
        console.warn('SeriesManager not available, skipping series data');
        return;
      }

      // Create series manager if not already created
      if (!this.seriesManager) {
        this.seriesManager = new SeriesManager();
      }

      // Load player data
      const playerData = await DataLoader.loadPlayerData(playerName);

      if (!playerData || playerData.length === 0) {
        console.warn(`No data found for player ${playerName}`);
        return;
      }

      // Load series data
      const seriesStats = await this.seriesManager.loadPlayerSeries(
        playerName,
        playerData
      );

      console.log(`Found ${seriesStats.length} series for ${playerName}`);

      // Update series chart if available
      if (window.seriesChartManagerInstance) {
        window.seriesChartManagerInstance.updateChart(
          playerName,
          seriesStats,
          metric
        );
      }

      // Update series stats
      this.updateSeriesStats(seriesStats, metric);
    } catch (error) {
      console.error('Error loading series data:', error);
    }
  }

  /**
   * Update series stats display
   * @param {Array} seriesStats - Series statistics
   * @param {string} metric - Metric to display
   */
  updateSeriesStats(seriesStats, metric) {
    try {
      // Check if series stats container exists
      let seriesStatsContainer = document.getElementById(
        'series-stats-container'
      );

      if (!seriesStatsContainer) {
        // Create series stats container
        seriesStatsContainer = document.createElement('div');
        seriesStatsContainer.id = 'series-stats-container';
        seriesStatsContainer.className = 'stats-summary';
        seriesStatsContainer.style.marginTop = '20px';

        // Add container to the page
        const seriesChartContainer = document.getElementById(
          'series-chart-container'
        );
        if (seriesChartContainer) {
          seriesChartContainer.appendChild(seriesStatsContainer);
        }
      }

      // Calculate average and max series stats
      const avgSeriesMetric = d3.mean(seriesStats, (d) => d[metric]);
      const maxSeriesMetric = d3.max(seriesStats, (d) => d[metric]);

      // Create stats HTML
      const statsHtml = `
        <div class="stat">
          <span>Avg ${metric} per series:</span>
          <span class="highlight">${
            avgSeriesMetric ? avgSeriesMetric.toFixed(1) : '--'
          }</span>
        </div>
        <div class="stat">
          <span>Max ${metric} in a series:</span>
          <span class="highlight">${
            maxSeriesMetric ? maxSeriesMetric.toFixed(0) : '--'
          }</span>
        </div>
        <div class="stat">
          <span>Total series:</span>
          <span class="highlight">${seriesStats.length}</span>
        </div>
      `;

      // Update container
      seriesStatsContainer.innerHTML = statsHtml;

      // Show container
      seriesStatsContainer.style.display = 'flex';
    } catch (error) {
      console.error('Error updating series stats:', error);
    }
  }
}
window.ChartManager = ChartManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing application...');

    // Show loading overlay
    if (window.LoadingManager) {
      LoadingManager.show('Loading LoL Esports data...');
    }

    // Use DataLoader directly instead of loadMatchData
    await DataLoader.fetchCSVData();
    console.log('CSV data loaded successfully');

    // Initialize chart manager
    window.chartManagerInstance = new ChartManager();
    await window.chartManagerInstance.initialize();

    // Initialize performance table
    const performanceTable = new PerformanceTable(
      '#performance-table-container'
    );
    await performanceTable.initialize();

    // Initialize all-time stats
    const allTimeStats = new AllTimeStats('#all-time-stats-container');
    await allTimeStats.initialize();

    // Hide loading overlay
    if (window.LoadingManager) {
      LoadingManager.hide();
    }

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);

    // Hide loading overlay and show error
    if (window.LoadingManager) {
      LoadingManager.hide();
    }

    // Show error message
    const errorElement = document.createElement('div');
    errorElement.className = 'data-error';
    errorElement.innerHTML = `
      <h3>Error Loading Data</h3>
      <p>${error.message || 'An unexpected error occurred'}</p>
    `;

    document.body.appendChild(errorElement);
  }
});
