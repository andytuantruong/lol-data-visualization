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
  }

  async initialize() {
    try {
      this.chart = new MetricsChart('#chart-container');

      document.getElementById('team-dropdown').disabled = true;
      document.getElementById('player-dropdown').disabled = true;

      // Restore previously selected metric and set initial slider position
      const savedMetric = localStorage.getItem('selectedMetric');
      if (savedMetric) {
        const segments = document.querySelectorAll('.segment');
        const slider = document.querySelector('.slider');
        segments.forEach((segment, index) => {
          if (segment.dataset.value === savedMetric) {
            segments.forEach((s) => s.classList.remove('active'));
            segment.classList.add('active');
            // Set initial slider position without animation
            slider.style.transition = 'none';
            slider.style.transform = `translateX(${index * 100}%)`;

            // Re-enable transitions after initial position is set
            setTimeout(() => {
              slider.style.transition = 'transform 0.3s ease';
            }, 0);
            this.currentMetric = savedMetric;
            document.getElementById('metric-display').textContent =
              segment.textContent;
          }
        });
      }

      this.hierarchicalData = await DataLoader.loadHierarchicalData();
      this.populateLeagueDropdown();
      this.setupHierarchicalFilters();
      this.setupEventListeners();
      this.resetChart();
    } catch (error) {
      console.error('Error in initialize:', error);
    }
  }

  populateLeagueDropdown() {
    const dropdown = document.getElementById('league-dropdown');
    this.hierarchicalData.leagues.forEach((league) => {
      const option = document.createElement('option');
      option.value = league;
      option.textContent = league;
      dropdown.appendChild(option);
    });
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
    document
      .getElementById('league-dropdown')
      .addEventListener('change', (e) => {
        this.updateTeamDropdown(e.target.value);
        this.resetChart();
      });

    document.getElementById('team-dropdown').addEventListener('change', (e) => {
      const league = document.getElementById('league-dropdown').value;
      this.updatePlayerDropdown(league, e.target.value);
      this.resetChart();
    });

    document
      .getElementById('player-dropdown')
      .addEventListener('change', () => {
        this.updateChart();
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
        // Update metric
        this.currentMetric = segment.dataset.value;
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
  manager.initialize();
});
