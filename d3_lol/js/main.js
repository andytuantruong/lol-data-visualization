class ChartManager {
  constructor() {
    this.chart = null;
    this.currentPlayer = null;
    this.filters = {
      minKills: {
        id: 'min-kills',
        getValue: (el) => parseInt(el.value) || 0,
        apply: (data, value) => data.filter((d) => d.kills >= value),
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
        id: 'average-kills',
        calculate: (data) =>
          data.reduce((sum, d) => sum + d.kills, 0) / data.length,
        format: (value) => value.toFixed(1),
      },
      median: {
        id: 'median-kills',
        calculate: (data) => {
          const sorted = [...data].sort((a, b) => a.kills - b.kills);
          return sorted[Math.floor(sorted.length / 2)].kills;
        },
        format: (value) => `${value}`,
      },
    };
  }

  async initialize() {
    try {
      this.chart = new KillsChart('#chart-container');
      const players = await DataLoader.loadPlayerList();
      console.log('Loaded players:', players);

      if (players.length === 0) {
        console.error('No players loaded - check data path');
        return;
      }

      // Players dropdown
      this.populatePlayerDropdown(players);
      this.setupEventListeners();
    } catch (error) {
      console.error('Error in initialize:', error);
    }
  }

  populatePlayerDropdown(players) {
    const dropdown = document.getElementById('player-dropdown');
    players.forEach((player) => {
      const option = document.createElement('option');
      option.value = player;
      option.textContent = player;
      dropdown.appendChild(option);
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
      this.chart.update(data, playerName);
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
