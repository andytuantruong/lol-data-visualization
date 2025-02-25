class PerformanceTable {
  constructor(containerId) {
    this.container = d3.select(containerId);
    this.data = [];
    this.originalData = [];
    this.sortColumn = null;
    this.sortDirection = null;
    this.expandedRows = new Set();
    this.metrics = ['kills', 'deaths', 'assists'];
    this.charts = {};
    this.metricFilter = null;
    this.currentYear = new Date().getFullYear();
  }

  // Initialize the performance table with player data and set up event listeners
  async initialize() {
    try {
      console.log('Initializing Performance Table...');

      this.createTableStructure();
      this.addMetricFilter();

      console.log('Loading player list...');
      const allPlayers = await DataLoader.loadPlayerList();
      console.log(`Found ${allPlayers.length} players in dataset`);

      if (allPlayers.length === 0) {
        throw new Error('No players found in the dataset');
      }

      console.log('Rendering loading table...');
      this.renderLoadingTable(allPlayers.slice(0, 10));

      console.log('Processing player data for all metrics...');
      this.data = [];

      let processedCount = 0;
      const totalPlayers = allPlayers.length;
      const updateInterval = Math.max(1, Math.floor(totalPlayers / 10));

      for (const player of allPlayers) {
        try {
          const playerData = await DataLoader.loadPlayerData(player);

          if (playerData && playerData.length > 0) {
            const team = playerData[0].teamname;

            for (const metric of this.metrics) {
              const entry = {
                player: player,
                team: team,
                metric: metric,
                rawData: playerData,
              };

              entry.avg = this.calculateExpected(playerData, metric);
              entry.l3 = this.calculateLastN(playerData, metric, 3);
              entry.l5 = this.calculateLastN(playerData, metric, 5);
              entry.l10 = this.calculateLastN(playerData, metric, 10);
              entry.h2h = this.calculateH2H(playerData, metric);
              entry.currentYearDiff = this.calculatePercentOver(
                playerData.filter(
                  (d) => d.date.getFullYear() === this.currentYear
                ),
                metric
              );
              entry.percentOver = this.calculatePercentOver(playerData, metric);

              this.data.push(entry);
            }
          } else {
            console.warn(`No data found for player: ${player}`);
          }

          processedCount++;

          if (
            processedCount % updateInterval === 0 ||
            processedCount === totalPlayers
          ) {
            const progressPercent = Math.round(
              (processedCount / totalPlayers) * 100
            );
            console.log(
              `Processed ${processedCount}/${totalPlayers} players (${progressPercent}%)`
            );

            const loadingMessage = document.querySelector('.loading-message');
            if (loadingMessage) {
              loadingMessage.textContent = `Loading player data (${progressPercent}%)...`;
            }

            this.renderTable();
          }
        } catch (error) {
          console.error(`Error processing player ${player}:`, error);
        }
      }

      this.originalData = [...this.data];

      console.log(
        `Completed processing ${processedCount} players with ${this.data.length} metric entries`
      );
      this.renderTable();

      this.setupEventListeners();
      this.setupPlayerLinkListeners();

      console.log('Performance Table initialization complete');
    } catch (error) {
      console.error('Error initializing performance table:', error);
      throw error;
    }
  }

  // Create the basic table structure with header and body
  createTableStructure() {
    this.container.html('');

    this.container
      .append('div')
      .attr('class', 'table-controls')
      .html(
        '<div class="metric-filter-container"><label>Filter by Metric: </label></div>'
      );

    this.table = this.container
      .append('table')
      .attr('class', 'performance-table');

    this.thead = this.table.append('thead');
    this.createTableHeader();

    this.tbody = this.table.append('tbody');
  }

  // Create the table header with sortable columns
  createTableHeader() {
    const headerRow = this.thead.append('tr');

    headerRow
      .append('th')
      .text('Player')
      .classed('sortable', true)
      .attr('data-column', 'player');
    headerRow.append('th').text('Team');
    headerRow
      .append('th')
      .text('Metric')
      .classed('sortable', true)
      .attr('data-column', 'metric');
    headerRow
      .append('th')
      .text('Avg')
      .classed('sortable', true)
      .attr('data-column', 'expected');
    headerRow
      .append('th')
      .text('L3 +/-')
      .classed('sortable', true)
      .attr('data-column', 'l3Diff');
    headerRow
      .append('th')
      .text('L5 +/-')
      .classed('sortable', true)
      .attr('data-column', 'l5Diff');
    headerRow
      .append('th')
      .text('L10 +/-')
      .classed('sortable', true)
      .attr('data-column', 'l10Diff');
    headerRow
      .append('th')
      .text('H2H +/-')
      .classed('sortable', true)
      .attr('data-column', 'h2hDiff');
    headerRow
      .append('th')
      .text(`${this.currentYear} %`)
      .classed('sortable', true)
      .attr('data-column', 'currentYearDiff');
    headerRow
      .append('th')
      .text('All-Time %')
      .classed('sortable', true)
      .attr('data-column', 'percentOver');
  }

  // Add metric filter buttons (All, Kills, Deaths, Assists)
  addMetricFilter() {
    const filterContainer = this.container.select('.metric-filter-container');

    const segmentedControl = filterContainer
      .append('div')
      .attr('class', 'segmented-control metric-filter');

    const slider = segmentedControl.append('div').attr('class', 'slider');
    slider.style('width', '25%');

    const allButton = segmentedControl
      .append('button')
      .attr('class', 'segment active')
      .attr('data-value', 'all')
      .text('All');

    this.metrics.forEach((metric) => {
      segmentedControl
        .append('button')
        .attr('class', 'segment')
        .attr('data-value', metric)
        .text(metric.charAt(0).toUpperCase() + metric.slice(1));
    });

    const segments = segmentedControl.selectAll('.segment');

    segments.nodes().forEach((segment, index) => {
      segment.addEventListener('click', () => {
        segments.nodes().forEach((s) => s.classList.remove('active'));
        segment.classList.add('active');

        slider.style('transform', `translateX(${index * 100}%)`);

        const metricValue = segment.getAttribute('data-value');
        this.metricFilter = metricValue === 'all' ? null : metricValue;

        this.renderTable();
      });
    });

    this.metricFilter = null;
  }

  // Calculate the average value for a metric
  calculateExpected(data, metric) {
    if (!data || data.length === 0) return 0;
    return parseFloat(
      (data.reduce((sum, d) => sum + d[metric], 0) / data.length).toFixed(2)
    );
  }

  // Calculate percentage of games where player exceeds their average
  calculatePercentOver(data, metric) {
    if (!data || data.length === 0) return 0;

    const avg = this.calculateExpected(data, metric);
    const gamesOver = data.filter((d) => d[metric] > avg).length;

    return parseFloat(((gamesOver / data.length) * 100).toFixed(1));
  }

  // Calculate average for the last N games
  calculateLastN(data, metric, n) {
    if (!data || data.length === 0) return 0;

    const sortedData = [...data].sort((a, b) => b.date - a.date);
    const lastN = sortedData.slice(0, Math.min(n, sortedData.length));

    return parseFloat(
      (lastN.reduce((sum, d) => sum + d[metric], 0) / lastN.length).toFixed(2)
    );
  }

  // Calculate head-to-head performance against opponents
  calculateH2H(data, metric) {
    if (!data || data.length === 0) return 0;

    const opponents = [...new Set(data.map((d) => d.opponent))].filter(Boolean);
    if (opponents.length === 0) return 0;

    const overallAvg = this.calculateExpected(data, metric);
    let totalGamesOverAvg = 0;
    let totalGames = 0;

    opponents.forEach((opponent) => {
      const opponentGames = data.filter((d) => d.opponent === opponent);

      if (opponentGames.length > 0) {
        const gamesOverAvg = opponentGames.filter(
          (d) => d[metric] > overallAvg
        ).length;

        totalGamesOverAvg += gamesOverAvg;
        totalGames += opponentGames.length;
      }
    });

    const percentOverAvg =
      totalGames > 0 ? (totalGamesOverAvg / totalGames) * 100 : 0;

    return parseFloat(percentOverAvg.toFixed(1));
  }

  // Render the table with current data, applying filters and sorting
  renderTable() {
    console.log(`Rendering table with ${this.data.length} entries`);

    if (this.sortColumn && this.sortDirection) {
      this.sortData();
    }

    let filteredData = this.data;
    if (this.metricFilter) {
      console.log(`Filtering by metric: ${this.metricFilter}`);
      filteredData = this.data.filter((d) => d.metric === this.metricFilter);
    }

    console.log(`Displaying ${filteredData.length} rows after filtering`);

    this.tbody.html('');

    filteredData.forEach((d) => {
      this.createPlayerRow(d.player, d.team, d.metric, d.rawData);
    });

    this.setupPlayerLinkListeners();
  }

  // Create a table row for a player-metric combination
  createPlayerRow(player, team, metric, playerData) {
    const row = this.tbody.append('tr').classed('data-row', true);

    if (!playerData || playerData.length === 0) {
      console.warn(`No data available for player ${player}, metric ${metric}`);
      return;
    }

    const average = this.calculateExpected(playerData, metric);

    const sortedData = [...playerData].sort((a, b) => b.date - a.date);
    const last3Games = sortedData.slice(0, Math.min(3, sortedData.length));
    const last5Games = sortedData.slice(0, Math.min(5, sortedData.length));
    const last10Games = sortedData.slice(0, Math.min(10, sortedData.length));

    const l3Average =
      last3Games.length > 0
        ? d3.mean(last3Games.map((d) => d[metric])) || 0
        : 0;
    const l5Average =
      last5Games.length > 0
        ? d3.mean(last5Games.map((d) => d[metric])) || 0
        : 0;
    const l10Average =
      last10Games.length > 0
        ? d3.mean(last10Games.map((d) => d[metric])) || 0
        : 0;

    const l3Diff = average > 0 ? ((l3Average - average) / average) * 100 : 0;
    const l5Diff = average > 0 ? ((l5Average - average) / average) * 100 : 0;
    const l10Diff = average > 0 ? ((l10Average - average) / average) * 100 : 0;

    const currentYearData = playerData.filter(
      (d) => d.date.getFullYear() === this.currentYear
    );

    const currentYearOverAvg =
      currentYearData.length > 0
        ? (currentYearData.filter((d) => d[metric] > average).length /
            currentYearData.length) *
          100
        : 0;

    const allTimePercentOver = this.calculatePercentOver(playerData, metric);
    const h2hPercentOver = this.calculateH2H(playerData, metric);
    const h2hDiff = h2hPercentOver - 50;

    const rowData = {
      player,
      team,
      metric,
      expected: average,
      l3Diff,
      l5Diff,
      l10Diff,
      h2hDiff,
      h2hPercentOver,
      currentYearOverAvg,
      percentOver: allTimePercentOver,
      rawData: playerData,
    };

    row.datum(rowData);

    row
      .append('td')
      .append('a')
      .attr('href', '#')
      .classed('player-link', true)
      .attr('data-player', player)
      .attr('data-metric', metric)
      .text(player);

    row.append('td').text(team || 'Unknown');

    row
      .append('td')
      .html(
        `<span class="metric-name">${this.formatMetricName(metric)}</span>`
      );

    row.append('td').classed('player-metric', true).text(average.toFixed(1));

    row
      .append('td')
      .classed('l3-percentage', true)
      .classed('over-performance', l3Diff > 0)
      .classed('under-performance', l3Diff < 0)
      .html(this.formatPercentage(l3Diff));

    row
      .append('td')
      .classed('l5-percentage', true)
      .classed('over-performance', l5Diff > 0)
      .classed('under-performance', l5Diff < 0)
      .html(this.formatPercentage(l5Diff));

    row
      .append('td')
      .classed('l10-percentage', true)
      .classed('over-performance', l10Diff > 0)
      .classed('under-performance', l10Diff < 0)
      .html(this.formatPercentage(l10Diff));

    row
      .append('td')
      .classed('h2h-percentage', true)
      .classed('over-performance', h2hDiff > 0)
      .classed('under-performance', h2hDiff < 0)
      .html(this.formatPercentage(h2hDiff));

    row
      .append('td')
      .classed('current-year-percentage', true)
      .classed('over-performance', currentYearOverAvg > 50)
      .classed('under-performance', currentYearOverAvg < 50)
      .html(
        currentYearData.length > 0 ? `${currentYearOverAvg.toFixed(1)}%` : 'N/A'
      );

    row
      .append('td')
      .classed('all-time-percentage', true)
      .classed('over-performance', allTimePercentOver > 50)
      .classed('under-performance', allTimePercentOver < 50)
      .text(`${allTimePercentOver.toFixed(1)}%`);
  }

  // Format percentage with + or - sign
  formatPercentage(value) {
    const rounded = Math.round(value);
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded}%`;
  }

  // Format metric name with proper capitalization
  formatMetricName(metric) {
    return metric.charAt(0).toUpperCase() + metric.slice(1);
  }

  // Sort data based on current sort column and direction
  sortData() {
    if (!this.sortColumn || !this.sortDirection) {
      this.data = [...this.originalData];
      return;
    }

    console.log(`Sorting by ${this.sortColumn} in ${this.sortDirection} order`);

    this.data.sort((a, b) => {
      let valueA, valueB;

      switch (this.sortColumn) {
        case 'player':
          valueA = a.player;
          valueB = b.player;
          break;
        case 'team':
          valueA = a.team || '';
          valueB = b.team || '';
          break;
        case 'metric':
          valueA = a.metric;
          valueB = b.metric;
          break;
        case 'expected':
          valueA = a.avg || 0;
          valueB = b.avg || 0;
          break;
        case 'l3Diff':
          const l3DataA = [...a.rawData]
            .sort((x, y) => y.date - x.date)
            .slice(0, 3);
          const l3DataB = [...b.rawData]
            .sort((x, y) => y.date - x.date)
            .slice(0, 3);
          const l3AvgA =
            l3DataA.length > 0
              ? d3.mean(l3DataA.map((d) => d[a.metric])) || 0
              : 0;
          const l3AvgB =
            l3DataB.length > 0
              ? d3.mean(l3DataB.map((d) => d[b.metric])) || 0
              : 0;
          valueA = a.avg > 0 ? ((l3AvgA - a.avg) / a.avg) * 100 : 0;
          valueB = b.avg > 0 ? ((l3AvgB - b.avg) / b.avg) * 100 : 0;
          break;
        case 'l5Diff':
          const l5DataA = [...a.rawData]
            .sort((x, y) => y.date - x.date)
            .slice(0, 5);
          const l5DataB = [...b.rawData]
            .sort((x, y) => y.date - x.date)
            .slice(0, 5);
          const l5AvgA =
            l5DataA.length > 0
              ? d3.mean(l5DataA.map((d) => d[a.metric])) || 0
              : 0;
          const l5AvgB =
            l5DataB.length > 0
              ? d3.mean(l5DataB.map((d) => d[b.metric])) || 0
              : 0;
          valueA = a.avg > 0 ? ((l5AvgA - a.avg) / a.avg) * 100 : 0;
          valueB = b.avg > 0 ? ((l5AvgB - b.avg) / b.avg) * 100 : 0;
          break;
        case 'l10Diff':
          const l10DataA = [...a.rawData]
            .sort((x, y) => y.date - x.date)
            .slice(0, 10);
          const l10DataB = [...b.rawData]
            .sort((x, y) => y.date - x.date)
            .slice(0, 10);
          const l10AvgA =
            l10DataA.length > 0
              ? d3.mean(l10DataA.map((d) => d[a.metric])) || 0
              : 0;
          const l10AvgB =
            l10DataB.length > 0
              ? d3.mean(l10DataB.map((d) => d[b.metric])) || 0
              : 0;
          valueA = a.avg > 0 ? ((l10AvgA - a.avg) / a.avg) * 100 : 0;
          valueB = b.avg > 0 ? ((l10AvgB - b.avg) / b.avg) * 100 : 0;
          break;
        case 'h2hDiff':
          valueA = a.h2h - 50;
          valueB = b.h2h - 50;
          break;
        case 'currentYearDiff':
          valueA = a.currentYearDiff;
          valueB = b.currentYearDiff;
          break;
        case 'percentOver':
          valueA = a.percentOver;
          valueB = b.percentOver;
          break;
        default:
          valueA = a[this.sortColumn] || 0;
          valueB = b[this.sortColumn] || 0;
      }

      if (typeof valueA === 'string') {
        return this.sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  // Set up event listeners for sortable column headers
  setupEventListeners() {
    this.thead.selectAll('th.sortable').on('click', (event) => {
      const headerElement = event.currentTarget;
      const headerText = headerElement.textContent
        .replace(/[↑↓]\s*$/, '')
        .trim();

      console.log(`Column clicked: "${headerText}"`);

      const columnMap = {
        Player: 'player',
        Team: 'team',
        Metric: 'metric',
        Avg: 'expected',
        'L3 +/-': 'l3Diff',
        'L5 +/-': 'l5Diff',
        'L10 +/-': 'l10Diff',
        'H2H +/-': 'h2hDiff',
        [`${this.currentYear} %`]: 'currentYearDiff',
        'All-Time %': 'percentOver',
      };

      let column = headerElement.getAttribute('data-column');

      if (!column) {
        column = columnMap[headerText];
      }

      console.log(`Mapped to property: ${column}`);

      if (!column) {
        console.error(`No mapping found for column: "${headerText}"`);
        return;
      }

      console.log(
        `Before click - sortColumn: ${this.sortColumn}, sortDirection: ${this.sortDirection}`
      );

      // Three-state sorting: descending -> ascending -> no sort
      if (column === this.sortColumn) {
        if (this.sortDirection === 'desc') {
          console.log('Changing from desc to asc');
          this.sortDirection = 'asc';
        } else if (this.sortDirection === 'asc') {
          console.log('Changing from asc to null (no sort)');
          this.sortColumn = null;
          this.sortDirection = null;
        }
      } else {
        this.sortColumn = column;

        if (column === 'player' || column === 'team' || column === 'metric') {
          console.log('New text column - setting to asc');
          this.sortDirection = 'asc';
        } else {
          console.log('New numeric column - setting to desc');
          this.sortDirection = 'desc';
        }
      }

      console.log(
        `After click - sortColumn: ${this.sortColumn}, sortDirection: ${this.sortDirection}`
      );

      this.updateSortIndicators(headerElement);
      this.renderTable();
    });
  }

  // Update sort indicators (↑/↓) on column headers
  updateSortIndicators(currentHeader) {
    this.thead.selectAll('th').each(function () {
      const text = d3.select(this).text();
      if (text.includes('↑') || text.includes('↓')) {
        d3.select(this).text(text.replace(/[↑↓]\s*$/, '').trim());
      }
    });

    if (this.sortColumn && this.sortDirection) {
      const icon = this.sortDirection === 'asc' ? '↑' : '↓';
      console.log(
        `Adding sort indicator: ${icon} for column: ${this.sortColumn}`
      );

      let headerElement = currentHeader;

      if (
        !headerElement ||
        headerElement.getAttribute('data-column') !== this.sortColumn
      ) {
        headerElement = this.thead
          .select(`th[data-column="${this.sortColumn}"]`)
          .node();
      }

      if (headerElement) {
        const currentText = d3.select(headerElement).text();
        d3.select(headerElement).text(`${currentText} ${icon}`);
      } else {
        console.warn(
          `Could not find header element for column: ${this.sortColumn}`
        );
      }
    } else {
      console.log('No sort indicators added - sorting is inactive');
    }
  }

  // Set up click event listeners for player links
  setupPlayerLinkListeners() {
    this.table.selectAll('.player-link').on('click', (event) => {
      event.preventDefault();

      const player = event.target.getAttribute('data-player');
      const metric = event.target.getAttribute('data-metric');

      const playerData = this.data.find(
        (d) => d.player === player && d.metric === metric
      );
      if (!playerData || !playerData.rawData || playerData.rawData.length === 0)
        return;

      const sampleGame = playerData.rawData[0];
      const league = sampleGame.league;
      const team = sampleGame.teamname;

      localStorage.setItem('selectedLeague', league);
      localStorage.setItem('selectedTeam', team);
      localStorage.setItem('selectedPlayer', player);
      localStorage.setItem('selectedMetric', metric);

      window.location.href = 'index.html';
    });
  }

  // Select a player in the dropdowns on the player chart page
  selectPlayerInDropdowns(playerName, metric) {
    const playerData = this.data.find((d) => d.player === playerName);
    if (!playerData || !playerData.rawData || playerData.rawData.length === 0)
      return;

    const sampleGame = playerData.rawData[0];
    const league = sampleGame.league;
    const team = sampleGame.teamname;

    const leagueDropdown = document.getElementById('league-dropdown');
    if (leagueDropdown) {
      leagueDropdown.value = league;
      leagueDropdown.dispatchEvent(new Event('change'));

      setTimeout(() => {
        const teamDropdown = document.getElementById('team-dropdown');
        if (teamDropdown) {
          teamDropdown.value = team;
          teamDropdown.dispatchEvent(new Event('change'));

          setTimeout(() => {
            const playerDropdown = document.getElementById('player-dropdown');
            if (playerDropdown) {
              playerDropdown.value = playerName;
              playerDropdown.dispatchEvent(new Event('change'));

              setTimeout(() => {
                const segments = document.querySelectorAll(
                  '.segmented-control:not(.metric-filter) .segment'
                );
                const slider = document.querySelector(
                  '.segmented-control:not(.metric-filter) .slider'
                );

                segments.forEach((segment, index) => {
                  if (segment.dataset.value === metric) {
                    segments.forEach((s) => s.classList.remove('active'));
                    segment.classList.add('active');

                    if (slider) {
                      slider.style.transform = `translateX(${index * 100}%)`;
                    }

                    const chartManager = window.chartManagerInstance;
                    if (chartManager) {
                      chartManager.currentMetric = metric;
                      document.getElementById('metric-display').textContent =
                        segment.textContent;
                      localStorage.setItem('selectedMetric', metric);
                      chartManager.updateChart();
                    } else {
                      segment.click();
                    }
                  }
                });
              }, 100);
            }
          }, 100);
        }
      }, 100);
    }
  }

  // Render a placeholder table while data is loading
  renderLoadingTable(players) {
    this.tbody.html('');

    const displayCount = Math.min(20, players.length);
    for (let i = 0; i < displayCount; i++) {
      const row = this.tbody.append('tr').classed('data-row', true);

      row.append('td').text(players[i]);
      row.append('td').text('Loading...');

      for (let j = 0; j < 8; j++) {
        row.append('td').text('...');
      }
    }
  }
}
