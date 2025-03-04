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

  setupEventListeners() {
    try {
      console.log('Setting up chart event listeners...');

      // Set up league dropdown change event
      const leagueDropdown = document.getElementById('league-dropdown');
      if (leagueDropdown) {
        leagueDropdown.addEventListener('change', (event) => {
          const league = event.target.value;
          this.updateTeamDropdown(league);
        });
      }

      // Set up team dropdown change event
      const teamDropdown = document.getElementById('team-dropdown');
      if (teamDropdown) {
        teamDropdown.addEventListener('change', (event) => {
          const league = leagueDropdown ? leagueDropdown.value : '';
          const team = event.target.value;
          this.updatePlayerDropdown(league, team);
        });
      }

      // Set up player dropdown change event
      const playerDropdown = document.getElementById('player-dropdown');
      if (playerDropdown) {
        playerDropdown.addEventListener('change', (event) => {
          const playerName = event.target.value;
          if (playerName) {
            const league = leagueDropdown ? leagueDropdown.value : '';
            const team = teamDropdown ? teamDropdown.value : '';
            this.selectPlayer(playerName, team, league, this.currentMetric);
          }
        });
      }

      // Set up metric segmented control
      const metricSegments = document.querySelectorAll(
        '.segmented-control:not(.game-count-control) .segment'
      );
      if (metricSegments.length > 0) {
        // Initialize slider position on page load
        this.positionSlider();

        metricSegments.forEach((segment) => {
          segment.addEventListener('click', (event) => {
            // Remove active class from all segments in this control
            const parentControl = event.target.closest('.segmented-control');
            parentControl
              .querySelectorAll('.segment')
              .forEach((s) => s.classList.remove('active'));

            event.target.classList.add('active');
            this.positionSlider(parentControl);
            const metric = event.target.getAttribute('data-value');
            this.currentMetric = metric;
            const metricDisplay = document.getElementById('metric-display');
            if (metricDisplay) {
              metricDisplay.textContent = this.formatMetric(metric);
            }

            this.updateChart();
          });
        });
      }

      // Set up game count segmented control
      const gameCountSegments = document.querySelectorAll(
        '.game-count-control .segment'
      );
      if (gameCountSegments.length > 0) {
        this.positionSlider(document.querySelector('.game-count-control'));

        gameCountSegments.forEach((segment) => {
          segment.addEventListener('click', (event) => {
            // Remove active class from all segments in this control
            const parentControl = event.target.closest('.segmented-control');
            parentControl
              .querySelectorAll('.segment')
              .forEach((s) => s.classList.remove('active'));

            event.target.classList.add('active');
            this.positionSlider(parentControl);
            const gameCount = event.target.getAttribute('data-value');
            this.currentGameCount = gameCount;

            // Save preference to localStorage
            localStorage.setItem('selectedGameCount', gameCount);

            this.updateChart();
          });
        });

        // Check if there's a saved preference
        const savedGameCount = localStorage.getItem('selectedGameCount');
        if (savedGameCount) {
          const savedSegment = document.querySelector(
            `.game-count-control .segment[data-value="${savedGameCount}"]`
          );
          if (savedSegment) {
            // Simulate a click on the saved segment
            savedSegment.click();
          }
        }
      }

      // Set up min metric input
      const minMetricInput = document.getElementById('min-metric');
      if (minMetricInput) {
        minMetricInput.addEventListener('change', () => {
          this.updateChart();
        });
      }

      // Add window resize event to reposition sliders
      window.addEventListener('resize', () => {
        this.positionSlider();
        this.positionSlider(document.querySelector('.game-count-control'));
      });

      console.log('Chart event listeners set up successfully');
    } catch (error) {
      console.error('Error setting up chart event listeners:', error);
    }
  }

  // Helper method to position the slider correctly
  positionSlider(controlElement) {
    try {
      // If no specific control is provided, default to the metric control
      const control =
        controlElement ||
        document.querySelector('.segmented-control:not(.game-count-control)');
      if (!control) {
        console.warn('No segmented control found for positioning slider');
        return;
      }

      // Find the active segment and slider in the provided control
      const activeSegment = control.querySelector('.segment.active');
      const slider = control.querySelector('.slider');

      if (activeSegment && slider) {
        // Get the position and dimensions of the active segment
        const rect = activeSegment.getBoundingClientRect();
        const parentRect = control.getBoundingClientRect();

        // Calculate the left position relative to the parent
        const leftPosition = rect.left - parentRect.left;

        // Set the slider position and width
        slider.style.width = `${rect.width}px`;
        slider.style.left = `${leftPosition}px`;

        // Ensure the slider is visible by adding a small transition
        slider.style.transition = 'left 0.2s ease, width 0.2s ease';

        const isGameCountControl =
          control.classList.contains('game-count-control');
        console.log(
          `Slider positioned successfully for ${
            isGameCountControl ? 'game count' : 'metric'
          } control`
        );
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
    const playerNameElement = document.getElementById('player-name');
    if (playerNameElement) {
      playerNameElement.textContent = 'Select Player';
    }

    const averageMetric = document.getElementById('average-metric');
    if (averageMetric) {
      averageMetric.textContent = '--';
    }

    const medianMetric = document.getElementById('median-metric');
    if (medianMetric) {
      medianMetric.textContent = '--';
    }

    if (this.chart) {
      this.chart.clear();
    }

    this.currentPlayer = null;
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
          leagueDropdown.value = league;

          // Update team dropdown
          this.updateTeamDropdown(league);

          // Set team
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
              teamDropdown.value = team;

              // Update player dropdown
              this.updatePlayerDropdown(league, team);

              // Set player
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
                  playerDropdown.value = playerName;
                  this.currentPlayer = playerName;

                  // Set metric
                  const segments = document.querySelectorAll(
                    '.segmented-control:not(.game-count-control) .segment'
                  );

                  segments.forEach((segment) => {
                    if (segment.dataset.value === metric) {
                      // Find the parent control
                      const parentControl =
                        segment.closest('.segmented-control');

                      // Remove active class from all segments in this control
                      parentControl
                        .querySelectorAll('.segment')
                        .forEach((s) => s.classList.remove('active'));

                      // Add active class to this segment
                      segment.classList.add('active');

                      // Position the slider
                      this.positionSlider(parentControl);

                      this.currentMetric = metric;

                      if (this.metricDisplay) {
                        this.metricDisplay.textContent =
                          this.formatMetric(metric);
                      }

                      localStorage.setItem('selectedMetric', metric);
                    }
                  });

                  // Update chart
                  setTimeout(() => {
                    this.updateChart();
                  }, 100);
                } else {
                  console.warn('Player not found in dropdown:', playerName);
                }
              }
            } else {
              console.warn('Team not found in dropdown:', team);
            }
          }
        } else {
          console.warn('League not found in dropdown:', league);
        }
      }
    } catch (error) {
      console.error('Error in selectPlayer:', error);
    }
  }
}
window.ChartManager = ChartManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing ChartManager...');

  console.log(
    'On performance.html, ChartManager will be initialized by tabInitializer.js'
  );
});
