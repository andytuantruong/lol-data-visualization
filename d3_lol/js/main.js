class ChartManager {
  constructor() {
    this.chart = null;
    this.currentPlayer = null;
    const metricDropdown = document.getElementById('metric-dropdown');
    this.currentMetric = metricDropdown ? metricDropdown.value : 'kills';

    const metricDisplay = document.getElementById('metric-display');
    if (metricDropdown && metricDisplay) {
      metricDisplay.textContent =
        metricDropdown.options[metricDropdown.selectedIndex].text;
    }

    this.filters = {
      minValue: {
        id: 'min-metric',
        getValue: (el) => parseInt(el.value) || 0,
        apply: (data, value) =>
          data.filter((d) => d[this.currentMetric] >= value),
      },
      // Adding filters example, modularity:
      // maxDeaths: {
      //   id: 'max-deaths',
      //   getValue: (el) => parseInt(el.value) || 999,
      //   apply: (data, value) => data.filter(d => d.deaths <= value)
      // }
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
    this.performanceTable = null;
  }

  async initialize() {
    try {
      console.log('Initializing ChartManager...');
      this.chart = new MetricsChart('#chart-container');

      const performanceTableContainer = document.querySelector(
        '#performance-table-container'
      );
      if (performanceTableContainer) {
        this.performanceTable = new PerformanceTable(
          '#performance-table-container'
        );
      }

      const teamDropdown = document.getElementById('team-dropdown');
      const playerDropdown = document.getElementById('player-dropdown');

      if (teamDropdown) teamDropdown.disabled = true;
      if (playerDropdown) playerDropdown.disabled = true;

      const savedMetric = localStorage.getItem('selectedMetric') || 'kills';
      const segments = document.querySelectorAll('.segment');
      const slider = document.querySelector('.slider');

      if (segments.length > 0 && slider) {
        segments.forEach((segment, index) => {
          if (segment.dataset.value === savedMetric) {
            segments.forEach((s) => s.classList.remove('active'));
            segment.classList.add('active');

            slider.style.transition = 'none';
            slider.style.transform = `translateX(${index * 100}%)`;

            setTimeout(() => {
              slider.style.transition = 'transform 0.3s ease';
            }, 0);

            this.currentMetric = savedMetric;
            const metricDisplay = document.getElementById('metric-display');
            if (metricDisplay) {
              metricDisplay.textContent = segment.textContent;
            }
          }
        });
      }

      console.log('Loading hierarchical data...');
      try {
        this.hierarchicalData = await DataLoader.loadHierarchicalData();
        console.log('Hierarchical data loaded:', this.hierarchicalData);

        this.populateLeagueDropdown();
        this.setupHierarchicalFilters();
        this.setupEventListeners();

        const savedLeague = localStorage.getItem('selectedLeague');
        const savedTeam = localStorage.getItem('selectedTeam');
        const savedPlayer = localStorage.getItem('selectedPlayer');

        console.log('Saved selections:', {
          savedLeague,
          savedTeam,
          savedPlayer,
        });

        if (savedLeague && savedTeam && savedPlayer) {
          const leagueDropdown = document.getElementById('league-dropdown');
          if (leagueDropdown) {
            console.log('Setting league dropdown to:', savedLeague);

            let leagueExists = false;
            for (let i = 0; i < leagueDropdown.options.length; i++) {
              if (leagueDropdown.options[i].value === savedLeague) {
                leagueExists = true;
                break;
              }
            }

            if (leagueExists) {
              leagueDropdown.value = savedLeague;
              leagueDropdown.dispatchEvent(new Event('change'));

              setTimeout(() => {
                if (teamDropdown) {
                  console.log('Setting team dropdown to:', savedTeam);

                  let teamExists = false;
                  for (let i = 0; i < teamDropdown.options.length; i++) {
                    if (teamDropdown.options[i].value === savedTeam) {
                      teamExists = true;
                      break;
                    }
                  }

                  if (teamExists) {
                    teamDropdown.value = savedTeam;
                    teamDropdown.dispatchEvent(new Event('change'));
                    setTimeout(() => {
                      if (playerDropdown) {
                        console.log('Setting player dropdown to:', savedPlayer);

                        let playerExists = false;
                        for (
                          let i = 0;
                          i < playerDropdown.options.length;
                          i++
                        ) {
                          if (playerDropdown.options[i].value === savedPlayer) {
                            playerExists = true;
                            break;
                          }
                        }

                        if (playerExists) {
                          playerDropdown.value = savedPlayer;
                          playerDropdown.dispatchEvent(new Event('change'));
                        } else {
                          console.warn(
                            'Saved player not found in dropdown:',
                            savedPlayer
                          );
                        }
                      }
                    }, 300);
                  } else {
                    console.warn(
                      'Saved team not found in dropdown:',
                      savedTeam
                    );
                  }
                }
              }, 300);
            } else {
              console.warn('Saved league not found in dropdown:', savedLeague);
            }
          }
        } else {
          this.resetChart();
        }
      } catch (dataError) {
        console.error('Error loading data:', dataError);
        document.getElementById('data-error').style.display = 'block';
        document
          .getElementById('data-error')
          .querySelector(
            'p'
          ).textContent = `Error loading data: ${dataError.message}. Please check that your CSV file exists and is properly formatted.`;
      }

      if (this.performanceTable) {
        try {
          await this.performanceTable.initialize();
        } catch (error) {
          console.error('Error initializing performance table:', error);
        }
      }

      const tabs = document.querySelectorAll('.tab');
      if (tabs.length > 0) {
        this.setupTabNavigation();
      }

      // Hide loading overlay when initialization completes
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
      }

      console.log('ChartManager initialization complete');
    } catch (error) {
      console.error('Error in initialize:', error);

      // Ensure loading overlay is hidden even if an error occurs
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
      }

      document.getElementById('data-error').style.display = 'block';
      document
        .getElementById('data-error')
        .querySelector(
          'p'
        ).textContent = `Error initializing application: ${error.message}. Please check the console for more details.`;
    }
  }

  populateLeagueDropdown() {
    const leagueDropdown = document.getElementById('league-dropdown');
    if (!leagueDropdown) return;

    // Clear existing options except the first one
    while (leagueDropdown.options.length > 1) {
      leagueDropdown.remove(1);
    }

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
  }

  updateTeamDropdown(league) {
    const teamDropdown = document.getElementById('team-dropdown');
    const playerDropdown = document.getElementById('player-dropdown');

    teamDropdown.innerHTML = '<option value="">Select Team...</option>';
    playerDropdown.innerHTML = '<option value="">Select Player...</option>';

    if (league) {
      const teams = this.hierarchicalData.getTeams(league);
      teams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamDropdown.appendChild(option);
      });
      teamDropdown.disabled = false;
      playerDropdown.disabled = true;
    } else {
      teamDropdown.disabled = true;
      playerDropdown.disabled = true;
    }
  }

  updatePlayerDropdown(league, team) {
    const playerDropdown = document.getElementById('player-dropdown');
    playerDropdown.innerHTML = '<option value="">Select Player...</option>';

    if (league && team) {
      const players = this.hierarchicalData.getPlayers(league, team);
      players.forEach((player) => {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        playerDropdown.appendChild(option);
      });
      playerDropdown.disabled = false;
    } else {
      playerDropdown.disabled = true;
    }
  }

  setupHierarchicalFilters() {
    const leagueDropdown = document.getElementById('league-dropdown');
    const teamDropdown = document.getElementById('team-dropdown');
    const playerDropdown = document.getElementById('player-dropdown');

    if (!leagueDropdown || !teamDropdown || !playerDropdown) return;

    // League change event
    leagueDropdown.addEventListener('change', () => {
      const selectedLeague = leagueDropdown.value;
      console.log('League selected:', selectedLeague);

      // Clear player and team dropdowns
      while (teamDropdown.options.length > 1) {
        teamDropdown.remove(1);
      }
      while (playerDropdown.options.length > 1) {
        playerDropdown.remove(1);
      }

      // Disable dropdowns if no league selected
      if (!selectedLeague) {
        teamDropdown.disabled = true;
        playerDropdown.disabled = true;
        return;
      }

      // Populate team dropdown
      const teams = this.hierarchicalData.getTeams(selectedLeague);
      teams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamDropdown.appendChild(option);
      });

      // Enable team dropdown
      teamDropdown.disabled = false;
      playerDropdown.disabled = true;

      console.log('Populated team dropdown with options:', teams);
    });

    // Team change event
    teamDropdown.addEventListener('change', () => {
      const selectedLeague = leagueDropdown.value;
      const selectedTeam = teamDropdown.value;
      console.log('Team selected:', selectedTeam);

      // Clear player dropdown
      while (playerDropdown.options.length > 1) {
        playerDropdown.remove(1);
      }

      if (!selectedTeam) {
        playerDropdown.disabled = true;
        return;
      }

      const players = this.hierarchicalData.getPlayers(
        selectedLeague,
        selectedTeam
      );
      players.forEach((player) => {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        playerDropdown.appendChild(option);
      });

      // Enable player dropdown
      playerDropdown.disabled = false;

      console.log('Populated player dropdown with options:', players);
    });
  }

  setupEventListeners() {
    document
      .getElementById('player-dropdown')
      .addEventListener('change', () => this.updateChart());

    Object.keys(this.filters).forEach((filterKey) => {
      const filter = this.filters[filterKey];
      const element = document.getElementById(filter.id);
      if (element) {
        element.addEventListener('input', () => this.updateChart());
      }
    });

    // Replace metric dropdown listener with segmented control
    const segmentedControl = document.querySelector('.segmented-control');
    const slider = segmentedControl.querySelector('.slider');
    const segments = segmentedControl.querySelectorAll('.segment');

    segments.forEach((segment, index) => {
      segment.addEventListener('click', () => {
        segments.forEach((s) => s.classList.remove('active'));
        segment.classList.add('active');
        // Move slider
        slider.style.transform = `translateX(${index * 100}%)`;
        this.currentMetric = segment.dataset.value; // Update metric
        document.getElementById('metric-display').textContent =
          segment.textContent;
        localStorage.setItem('selectedMetric', this.currentMetric);

        // Check if a player is selected before updating the chart
        const playerName = document.getElementById('player-dropdown').value;
        if (playerName) {
          this.updateChart();
        } else {
          // If no player is selected, just reset the chart
          this.resetChart();
        }
      });
    });
  }

  setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        tabs.forEach((t) => t.classList.remove('active'));
        tabContents.forEach((c) => c.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });
  }

  async updateChart() {
    try {
      const playerName = document.getElementById('player-dropdown').value;
      if (!playerName) {
        this.resetChart();
        return;
      }

      document.getElementById('player-name').textContent = playerName;

      // Load and process data
      let data = await DataLoader.loadPlayerData(playerName);
      if (!data || data.length === 0) {
        console.error('No data loaded for player:', playerName);
        this.resetChart();
        return;
      }

      data = this.applyFilters(data);
      this.updateStats(data);
      data.sort((a, b) => a.date - b.date); // Sort by date
      this.chart.update(data, playerName, this.currentMetric);
    } catch (error) {
      console.error('Error in updateChart:', error);
      this.resetChart();
    }
  }

  applyFilters(data) {
    return Object.values(this.filters).reduce((filteredData, filter) => {
      const element = document.getElementById(filter.id);
      if (element) {
        const value = filter.getValue(element);
        return filter.apply(filteredData, value);
      }
      return filteredData;
    }, data);
  }

  updateStats(data) {
    Object.values(this.stats).forEach((stat) => {
      const element = document.getElementById(stat.id);
      if (element) {
        const value = stat.calculate(data);
        element.textContent = stat.format(value);
      }
    });
  }

  resetChart() {
    document.getElementById('player-name').textContent = 'Select Player';
    document.getElementById('average-metric').textContent = '--';
    document.getElementById('median-metric').textContent = '--';
    if (this.chart) {
      this.chart.clear();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const manager = new ChartManager();
  window.chartManagerInstance = manager;
  manager.initialize();
});
