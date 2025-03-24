/**
 * SeriesChartManager class
 * Manages the Series Chart tab and its interactions
 */
class SeriesChartManager {
  constructor() {
    // DOM elements
    this.container = d3.select('#series-chart-container');
    this.leagueDropdown = document.getElementById('series-league-dropdown');
    this.teamDropdown = document.getElementById('series-team-dropdown');
    this.playerDropdown = document.getElementById('series-player-dropdown');
    this.errorElement = document.getElementById('series-error-message');

    // Current selections
    this.currentLeague = '';
    this.currentTeam = '';
    this.currentPlayer = '';
    this.currentMetric = 'kills';
    this.currentSeriesType = 'all';

    // Chart instance
    this.chart = null;

    // Data managers
    this.hierarchicalData = null;
    this.seriesManager = new SeriesManager();

    // Initialize the chart
    this.chart = new SeriesChart('#series-chart-container');
  }

  async initialize() {
    try {
      console.log('Initializing Series Chart Manager...');

      // Load hierarchical data
      this.hierarchicalData = await DataLoader.loadHierarchicalData();
      console.log('Hierarchical data loaded for Series Chart');

      // Populate dropdowns
      this.populateLeagueDropdown();

      // Set up event listeners
      this.setupEventListeners();

      // Load stored preferences
      this.loadStoredPreferences();

      console.log('Series Chart Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Series Chart Manager:', error);
      this.showError('Failed to initialize Series Chart: ' + error.message);
      return false;
    }
  }

  populateLeagueDropdown() {
    try {
      if (!this.hierarchicalData || !this.leagueDropdown) {
        console.warn(
          'Cannot populate league dropdown: missing data or element'
        );
        return;
      }

      // Clear existing options except the first one
      while (this.leagueDropdown.options.length > 1) {
        this.leagueDropdown.remove(1);
      }

      // Add league options
      this.hierarchicalData.leagues.forEach((league) => {
        const option = document.createElement('option');
        option.value = league;
        option.textContent = league;
        this.leagueDropdown.appendChild(option);
      });

      console.log(
        `Populated league dropdown with ${this.hierarchicalData.leagues.length} leagues`
      );
    } catch (error) {
      console.error('Error populating league dropdown:', error);
    }
  }

  populateTeamDropdown() {
    try {
      if (!this.hierarchicalData || !this.teamDropdown) {
        console.warn('Cannot populate team dropdown: missing data or element');
        return;
      }

      // Clear existing options except the first one
      while (this.teamDropdown.options.length > 1) {
        this.teamDropdown.remove(1);
      }

      // Disable if no league is selected
      if (!this.currentLeague) {
        this.teamDropdown.disabled = true;
        return;
      }

      // Get teams for the selected league
      const teams = this.hierarchicalData.getTeams(this.currentLeague);

      // Add team options
      teams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        this.teamDropdown.appendChild(option);
      });

      // Enable the dropdown
      this.teamDropdown.disabled = false;

      console.log(
        `Populated team dropdown with ${teams.length} teams for ${this.currentLeague}`
      );
    } catch (error) {
      console.error('Error populating team dropdown:', error);
    }
  }

  populatePlayerDropdown() {
    try {
      if (!this.hierarchicalData || !this.playerDropdown) {
        console.warn(
          'Cannot populate player dropdown: missing data or element'
        );
        return;
      }

      // Clear existing options except the first one
      while (this.playerDropdown.options.length > 1) {
        this.playerDropdown.remove(1);
      }

      // Disable if no league or team is selected
      if (!this.currentLeague || !this.currentTeam) {
        this.playerDropdown.disabled = true;
        return;
      }

      // Get players for the selected league and team
      const players = this.hierarchicalData.getPlayers(
        this.currentLeague,
        this.currentTeam
      );

      // Add player options
      players.forEach((player) => {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        this.playerDropdown.appendChild(option);
      });

      // Enable the dropdown
      this.playerDropdown.disabled = false;

      console.log(
        `Populated player dropdown with ${players.length} players for ${this.currentTeam}`
      );
    } catch (error) {
      console.error('Error populating player dropdown:', error);
    }
  }

  setupEventListeners() {
    try {
      // League dropdown change
      if (this.leagueDropdown) {
        this.leagueDropdown.addEventListener('change', () => {
          this.currentLeague = this.leagueDropdown.value;
          this.currentTeam = '';
          this.currentPlayer = '';

          // Update team dropdown
          this.populateTeamDropdown();

          // Reset player dropdown
          this.playerDropdown.value = '';
          this.playerDropdown.disabled = true;

          // Clear chart if no league is selected
          if (!this.currentLeague && this.chart) {
            this.chart.clear();
          }
        });
      }

      // Team dropdown change
      if (this.teamDropdown) {
        this.teamDropdown.addEventListener('change', () => {
          this.currentTeam = this.teamDropdown.value;
          this.currentPlayer = '';

          // Update player dropdown
          this.populatePlayerDropdown();

          // Clear chart if no team is selected
          if (!this.currentTeam && this.chart) {
            this.chart.clear();
          }
        });
      }

      // Player dropdown change
      if (this.playerDropdown) {
        this.playerDropdown.addEventListener('change', () => {
          this.currentPlayer = this.playerDropdown.value;

          // Update chart
          if (this.currentPlayer) {
            this.updateChart();
          } else if (this.chart) {
            this.chart.clear();
          }
        });
      }

      // Metric segmented control
      const metricSegments = document.querySelectorAll(
        '.series-metric-control .segment'
      );
      metricSegments.forEach((segment) => {
        segment.addEventListener('click', () => {
          // Remove active class from all segments
          metricSegments.forEach((s) => s.classList.remove('active'));

          // Add active class to clicked segment
          segment.classList.add('active');

          // Update metric
          this.currentMetric = segment.getAttribute('data-value');

          // Position slider
          this.positionSlider('.series-metric-control');

          // Update chart if player is selected
          if (this.currentPlayer) {
            this.updateChart();
          }
        });
      });

      // Series type segmented control
      const seriesTypeSegments = document.querySelectorAll(
        '.series-type-control .segment'
      );
      seriesTypeSegments.forEach((segment) => {
        segment.addEventListener('click', () => {
          // Remove active class from all segments
          seriesTypeSegments.forEach((s) => s.classList.remove('active'));

          // Add active class to clicked segment
          segment.classList.add('active');

          // Update series type
          this.currentSeriesType = segment.getAttribute('data-value');

          // Position slider
          this.positionSlider('.series-type-control');

          // Update chart if player is selected
          if (this.currentPlayer) {
            this.updateChart();
          }
        });
      });

      console.log('Series Chart Manager event listeners set up');
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  positionSlider(controlSelector) {
    try {
      const control = document.querySelector(controlSelector);
      if (!control) return;

      const activeSegment = control.querySelector('.segment.active');
      const slider = control.querySelector('.slider');

      if (activeSegment && slider) {
        slider.style.width = `${activeSegment.offsetWidth}px`;
        slider.style.left = `${activeSegment.offsetLeft}px`;
      }
    } catch (error) {
      console.error('Error positioning slider:', error);
    }
  }

  async updateChart() {
    try {
      if (!this.currentPlayer) {
        console.warn('No player selected, cannot update chart');
        return;
      }

      // Show loading state
      this.container.classed('loading', true);
      this.hideError();

      console.log(
        `Updating series chart for ${this.currentPlayer} with metric ${this.currentMetric}`
      );

      // Load player series data
      const seriesData = await this.seriesManager.loadPlayerSeries(
        this.currentPlayer
      );

      if (!seriesData || seriesData.length === 0) {
        this.container.classed('loading', false);
        this.showError(`No series data found for ${this.currentPlayer}`);
        return;
      }

      // Get the selected series type
      const seriesTypeControl = document.querySelector('.series-type-control');
      const seriesTypeButton =
        seriesTypeControl.querySelector('.segment.active');
      const seriesType = seriesTypeButton.getAttribute('data-value');

      // Filter series data by series type
      let filteredData = [...seriesData]; // Create a copy to avoid modifying the original
      if (seriesType !== 'all') {
        filteredData = filteredData.filter(
          (series) => series.seriesType === seriesType
        );
      }

      // Check if we have data after filtering
      if (filteredData.length === 0) {
        this.container.classed('loading', false);
        this.showError(
          `No ${seriesType} series found for ${this.currentPlayer}`
        );
        return;
      }

      // Update the chart with filtered data
      this.chart.update(filteredData, this.currentPlayer, this.currentMetric);

      // Update series stats with filtered data
      this.updateSeriesStats(filteredData, this.currentMetric);

      // Hide loading state
      this.container.classed('loading', false);

      console.log(`Series chart updated with ${filteredData.length} series`);
    } catch (error) {
      console.error('Error updating series chart:', error);
      this.container.classed('loading', false);
      this.showError('Failed to update chart. Please try again.');
    }
  }

  updateSeriesStats(seriesData, metric) {
    try {
      const avgElement = document.getElementById('series-avg-value');
      const maxElement = document.getElementById('series-max-value');
      const countElement = document.getElementById('series-count');

      if (!seriesData || seriesData.length === 0) {
        if (avgElement) avgElement.textContent = '--';
        if (maxElement) maxElement.textContent = '--';
        if (countElement) countElement.textContent = '--';
        return;
      }

      // Calculate average
      const avg = d3.mean(seriesData, (d) => d[metric]);
      if (avgElement) avgElement.textContent = avg ? avg.toFixed(2) : '--';

      // Calculate max
      const max = d3.max(seriesData, (d) => d[metric]);
      if (maxElement) maxElement.textContent = max ? max.toFixed(0) : '--';

      // Count
      if (countElement) countElement.textContent = seriesData.length;
    } catch (error) {
      console.error('Error updating series stats:', error);
    }
  }

  showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = message;
      this.errorElement.style.display = 'block';
    }
    console.error(message);
  }

  hideError() {
    if (this.errorElement) {
      this.errorElement.style.display = 'none';
    }
  }

  loadStoredPreferences() {
    try {
      // Check if we have stored preferences
      const storedLeague = localStorage.getItem('selectedLeague');
      const storedTeam = localStorage.getItem('selectedTeam');
      const storedPlayer = localStorage.getItem('selectedPlayer');
      const storedMetric = localStorage.getItem('selectedMetric');

      // Set league if stored
      if (storedLeague && this.leagueDropdown) {
        // Set with a timeout to ensure dropdown is populated
        setTimeout(() => {
          this.leagueDropdown.value = storedLeague;
          this.currentLeague = storedLeague;
          this.populateTeamDropdown();

          // Set team if stored
          if (storedTeam && this.teamDropdown) {
            setTimeout(() => {
              this.teamDropdown.value = storedTeam;
              this.currentTeam = storedTeam;
              this.populatePlayerDropdown();

              // Set player if stored
              if (storedPlayer && this.playerDropdown) {
                setTimeout(() => {
                  this.playerDropdown.value = storedPlayer;
                  this.currentPlayer = storedPlayer;

                  // Set metric if stored
                  if (storedMetric) {
                    const metricSegments = document.querySelectorAll(
                      '.series-metric-control .segment'
                    );
                    metricSegments.forEach((segment) => {
                      if (segment.getAttribute('data-value') === storedMetric) {
                        segment.click();
                      }
                    });
                  }

                  // Update chart
                  this.updateChart();
                }, 100);
              }
            }, 100);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading stored preferences:', error);
    }
  }

  reset() {
    try {
      // Reset selections
      this.currentLeague = '';
      this.currentTeam = '';
      this.currentPlayer = '';

      // Reset dropdowns
      if (this.leagueDropdown) this.leagueDropdown.value = '';
      if (this.teamDropdown) {
        this.teamDropdown.value = '';
        this.teamDropdown.disabled = true;
      }
      if (this.playerDropdown) {
        this.playerDropdown.value = '';
        this.playerDropdown.disabled = true;
      }

      // Reset metric to kills
      this.currentMetric = 'kills';
      const killsSegment = document.querySelector(
        '.series-metric-control .segment[data-value="kills"]'
      );
      if (killsSegment) {
        const metricSegments = document.querySelectorAll(
          '.series-metric-control .segment'
        );
        metricSegments.forEach((s) => s.classList.remove('active'));
        killsSegment.classList.add('active');
        this.positionSlider('.series-metric-control');
      }

      // Reset series type to all
      this.currentSeriesType = 'all';
      const allSegment = document.querySelector(
        '.series-type-control .segment[data-value="all"]'
      );
      if (allSegment) {
        const typeSegments = document.querySelectorAll(
          '.series-type-control .segment'
        );
        typeSegments.forEach((s) => s.classList.remove('active'));
        allSegment.classList.add('active');
        this.positionSlider('.series-type-control');
      }

      // Clear chart
      if (this.chart) {
        this.chart.clear();
      }

      // Hide error
      this.hideError();

      // Reset stats
      this.updateSeriesStats([], 'kills');

      console.log('Series Chart Manager reset');
    } catch (error) {
      console.error('Error resetting Series Chart Manager:', error);
    }
  }
}

// Create a global instance of the SeriesChartManager
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('Creating SeriesChartManager instance');
    window.seriesChartManagerInstance = new SeriesChartManager();

    // Initialize after a short delay to ensure all DOM elements are ready
    setTimeout(() => {
      if (window.seriesChartManagerInstance) {
        window.seriesChartManagerInstance.initialize();
        console.log('SeriesChartManager initialized successfully');
      } else {
        console.error('SeriesChartManager instance not created');
      }
    }, 500);
  } catch (error) {
    console.error('Error creating SeriesChartManager instance:', error);
  }
});
