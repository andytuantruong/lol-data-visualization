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

      // Use previously selected metric on refresh
      const savedMetric = localStorage.getItem('selectedMetric');
      if (savedMetric) {
        const metricDropdown = document.getElementById('metric-dropdown');
        metricDropdown.value = savedMetric;
        this.currentMetric = savedMetric;
        document.getElementById('metric-display').textContent =
          metricDropdown.options[metricDropdown.selectedIndex].text;
      }

      this.hierarchicalData = await DataLoader.loadHierarchicalData();
      this.populateLeagueDropdown();
      this.setupHierarchicalFilters();
      this.setupEventListeners();
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
      });

    document.getElementById('team-dropdown').addEventListener('change', (e) => {
      const league = document.getElementById('league-dropdown').value;
      this.updatePlayerDropdown(league, e.target.value);
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

    document
      .getElementById('metric-dropdown')
      .addEventListener('change', (e) => {
        this.currentMetric = e.target.value;
        document.getElementById('metric-display').textContent =
          e.target.options[e.target.selectedIndex].text;
        localStorage.setItem('selectedMetric', this.currentMetric); // Save metric on refresh
        this.updateChart();
      });
  }

  async updateChart() {
    try {
      const playerName = document.getElementById('player-dropdown').value;
      if (!playerName) return;

      document.getElementById('player-name').textContent = playerName;

      // Load and process data
      let data = await DataLoader.loadPlayerData(playerName);
      if (!data || data.length === 0) {
        console.error('No data loaded for player:', playerName);
        return;
      }

      data = this.applyFilters(data);
      this.updateStats(data);
      data.sort((a, b) => a.date - b.date); // Sort by date
      this.chart.update(data, playerName, this.currentMetric);
    } catch (error) {
      console.error('Error in updateChart:', error);
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const manager = new ChartManager();
  manager.initialize();
});
