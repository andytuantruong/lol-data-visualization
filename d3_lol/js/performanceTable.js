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
    this.metricFilter = 'all';
    this.currentYear = new Date().getFullYear();

    // Pagination properties
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 1;
  }

  // Initialize the performance table with player data and set up event listeners
  async initialize() {
    try {
      console.log('Initializing Performance Table...');

      this.createTableStructure();
      this.addMetricFilter();

      // Ensure the "All" button is highlighted and slider is positioned immediately after adding the filter
      setTimeout(() => {
        this.ensureAllButtonHighlighted();
      }, 50);

      console.log('Loading player list...');
      const allPlayers = await DataLoader.loadPlayerList();
      console.log(`Found ${allPlayers.length} players in dataset`);

      if (allPlayers.length === 0) {
        throw new Error('No players found in the dataset');
      }

      const loadingMessage = document.querySelector('.loading-message');
      if (loadingMessage) {
        loadingMessage.textContent = 'Loading player data...';
      }

      console.log('Loading all player data at once...');
      this.data = [];

      // Load all player data in a single request
      const allPlayersData = await DataLoader.loadAllPlayersData();

      // Process the data for each player
      let processedCount = 0;
      const totalPlayers = allPlayers.length;
      const updateInterval = Math.max(1, Math.floor(totalPlayers / 10));

      allPlayers.forEach((player) => {
        try {
          const playerData = allPlayersData.get(player);

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

              // Get current year data
              const currentYearData = playerData.filter(
                (d) => d.date.getFullYear() === this.currentYear
              );

              entry.currentYearDiff =
                currentYearData.length > 0
                  ? this.calculatePeriodDiff(
                      currentYearData,
                      playerData,
                      metric
                    )
                  : 0;

              entry.percentOver = this.calculatePeriodDiff(
                playerData,
                playerData,
                metric
              );

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

            if (loadingMessage) {
              loadingMessage.textContent = `Processing player data (${progressPercent}%)...`;
            }
          }
        } catch (error) {
          console.error(`Error processing player ${player}:`, error);
        }
      });

      this.originalData = [...this.data];

      console.log(
        `Completed processing ${processedCount} players with ${this.data.length} metric entries`
      );
      this.renderTable();

      this.setupEventListeners();
      this.setupPlayerLinkListeners();

      // Final check to ensure "All" button is highlighted and slider is positioned
      setTimeout(() => {
        this.ensureAllButtonHighlighted();
      }, 100);

      console.log('Performance Table initialization complete');
    } catch (error) {
      console.error('Error initializing performance table:', error);
      throw error;
    }
  }

  // Create the basic table structure with header and body
  createTableStructure() {
    this.container.html('');

    // Create table controls container without the label
    this.container.append('div').attr('class', 'table-controls');

    this.table = this.container
      .append('table')
      .attr('class', 'performance-table');

    this.thead = this.table.append('thead');
    this.createTableHeader();

    this.tbody = this.table.append('tbody');

    this.addPaginationControls();
  }

  // Add pagination controls below the table
  addPaginationControls() {
    const paginationContainer = this.container
      .append('div')
      .attr('class', 'pagination-controls');

    // Page size selector
    const pageSizeContainer = paginationContainer
      .append('div')
      .attr('class', 'page-size-container');

    pageSizeContainer.append('span').text('Rows per page: ');

    const pageSizeSelect = pageSizeContainer
      .append('select')
      .attr('class', 'page-size-select');

    [10, 20, 50, 100].forEach((size) => {
      pageSizeSelect
        .append('option')
        .attr('value', size)
        .property('selected', size === this.pageSize)
        .text(size);
    });

    // Item range display
    paginationContainer
      .append('div')
      .attr('class', 'item-range-display')
      .text('Showing 0-0 of 0 items');

    // Page navigation
    const pageNavContainer = paginationContainer
      .append('div')
      .attr('class', 'page-nav-container');

    pageNavContainer
      .append('button')
      .attr('class', 'page-nav-button first-page')
      .attr('title', 'First Page')
      .html('&laquo;');

    pageNavContainer
      .append('button')
      .attr('class', 'page-nav-button prev-page')
      .attr('title', 'Previous Page')
      .html('&lsaquo;');

    pageNavContainer
      .append('span')
      .attr('class', 'page-indicator')
      .html(
        'Page <span class="current-page">1</span> of <span class="total-pages">1</span>'
      );

    pageNavContainer
      .append('button')
      .attr('class', 'page-nav-button next-page')
      .attr('title', 'Next Page')
      .html('&rsaquo;');

    pageNavContainer
      .append('button')
      .attr('class', 'page-nav-button last-page')
      .attr('title', 'Last Page')
      .html('&raquo;');
  }

  // Create the table header with sortable columns
  createTableHeader() {
    const headerRow = this.thead.append('tr');

    headerRow.append('th').text('Player');
    headerRow.append('th').text('Team');
    headerRow.append('th').text('Metric');
    headerRow
      .append('th')
      .text('Avg')
      .classed('sortable', true)
      .attr('data-column', 'average');
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
      .text(`${this.currentYear} +/-`)
      .classed('sortable', true)
      .attr('data-column', 'currentYearDiff');
    headerRow
      .append('th')
      .text('All-Time +/-')
      .classed('sortable', true)
      .attr('data-column', 'percentOver');
  }

  // Add metric filter buttons (Kills, Deaths, Assists)
  addMetricFilter() {
    // Create a container for the metric filter
    const filterContainer = document.createElement('div');
    filterContainer.className = 'metric-filter-container';

    // Add a label
    const label = document.createElement('label');
    label.textContent = 'Filter by Metric:';
    filterContainer.appendChild(label);

    // Create a segmented control for the metric filter
    const segmentedControl = document.createElement('div');
    segmentedControl.className = 'segmented-control';

    // Create a slider element
    const slider = document.createElement('div');
    slider.className = 'slider';
    segmentedControl.appendChild(slider);

    // Create "All" button and set it as active by default
    const allButton = document.createElement('button');
    allButton.className = 'segment active';
    allButton.setAttribute('data-value', 'all');
    allButton.textContent = 'All';
    segmentedControl.appendChild(allButton);

    // Create buttons for each metric
    const metrics = ['kills', 'deaths', 'assists'];
    metrics.forEach((metric) => {
      const button = document.createElement('button');
      button.className = 'segment';
      button.setAttribute('data-value', metric);
      button.textContent = this.formatMetricName(metric);
      segmentedControl.appendChild(button);
    });

    // Add the segmented control to the filter container
    filterContainer.appendChild(segmentedControl);

    // Add the filter container to the table container
    this.container.node().prepend(filterContainer);

    // Set the current metric filter to "all" by default
    this.metricFilter = 'all';

    // Add event listeners for all buttons
    const buttons = segmentedControl.querySelectorAll('.segment');
    buttons.forEach((button) => {
      button.addEventListener('click', (event) => {
        // Remove active class from all buttons
        buttons.forEach((btn) => btn.classList.remove('active'));

        // Add active class to clicked button
        button.classList.add('active');

        // Update metric filter
        this.metricFilter = button.getAttribute('data-value');
        this.positionMetricSlider();

        // Reset to first page when changing filter
        this.currentPage = 1;

        // Render the table with the new filter
        this.renderTable();
      });
    });
  }

  positionMetricSlider() {
    const segmentedControl = this.container.select('.segmented-control').node();
    if (!segmentedControl) return;

    const activeSegment = segmentedControl.querySelector('.segment.active');
    const slider = segmentedControl.querySelector('.slider');

    if (activeSegment && slider) {
      const rect = activeSegment.getBoundingClientRect();
      const parentRect = segmentedControl.getBoundingClientRect();

      // Position the slider under the active segment
      slider.style.width = rect.width + 'px';
      slider.style.left = rect.left - parentRect.left + 'px';

      console.log(
        `Positioned slider under "${activeSegment.textContent}" button`
      );
    } else {
      console.warn(
        'Could not position slider: active segment or slider not found'
      );

      // If no active segment is found, default to the "All" button
      const allButton = segmentedControl.querySelector(
        '.segment[data-value="all"]'
      );
      if (allButton && slider) {
        allButton.classList.add('active');
        this.metricFilter = 'all';

        // Position the slider after the button has been made active
        setTimeout(() => {
          const rect = allButton.getBoundingClientRect();
          const parentRect = segmentedControl.getBoundingClientRect();
          slider.style.width = rect.width + 'px';
          slider.style.left = rect.left - parentRect.left + 'px';

          console.log('Defaulted to "All" button and positioned slider');
        }, 0);
      }
    }
  }

  // Add a method to ensure the "All" button is highlighted on initialization
  ensureAllButtonHighlighted() {
    const segmentedControl = this.container.select('.segmented-control').node();
    if (!segmentedControl) {
      console.warn(
        'Could not find segmented control to highlight "All" button'
      );
      return;
    }

    // Find the "All" button
    const allButton = segmentedControl.querySelector(
      '.segment[data-value="all"]'
    );

    if (!allButton) {
      console.warn('Could not find "All" button in segmented control');
      return;
    }

    // Remove active class from all buttons
    segmentedControl.querySelectorAll('.segment').forEach((segment) => {
      segment.classList.remove('active');
    });

    // Add active class to the "All" button
    allButton.classList.add('active');

    // Update the metric filter
    this.metricFilter = 'all';

    // Get the slider element
    const slider = segmentedControl.querySelector('.slider');
    if (!slider) {
      console.warn('Could not find slider element in segmented control');
      return;
    }

    // Position the slider directly
    const rect = allButton.getBoundingClientRect();
    const parentRect = segmentedControl.getBoundingClientRect();

    slider.style.width = rect.width + 'px';
    slider.style.left = rect.left - parentRect.left + 'px';

    console.log('Successfully highlighted "All" button and positioned slider');
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

    const lastNAverage =
      lastN.reduce((sum, d) => sum + d[metric], 0) / lastN.length;
    const overallAverage = this.calculateExpected(data, metric);
    const percentDiff =
      overallAverage > 0
        ? ((lastNAverage - overallAverage) / overallAverage) * 100
        : 0;

    return parseFloat(percentDiff.toFixed(1));
  }

  // Calculate percentage difference for a specific period compared to overall average
  calculatePeriodDiff(periodData, allData, metric) {
    if (!periodData || periodData.length === 0) return 0;

    // Calculate the average for the period
    const periodAverage = this.calculateExpected(periodData, metric);

    // Calculate the overall average
    const overallAverage = this.calculateExpected(allData, metric);

    // Calculate percentage difference between the two averages
    const percentDiff =
      overallAverage > 0
        ? ((periodAverage - overallAverage) / overallAverage) * 100
        : 0;

    return parseFloat(percentDiff.toFixed(1));
  }

  // Render the table with current data, applying filters and sorting
  renderTable() {
    console.log(`Rendering table with ${this.data.length} entries`);

    // Apply sorting if needed
    if (this.sortColumn && this.sortDirection) {
      this.sortData();
    }

    // Filter data based on metric filter
    let filteredData = this.data;

    // Apply metric filter if not set to "all"
    if (this.metricFilter !== 'all') {
      filteredData = this.data.filter((d) => d.metric === this.metricFilter);
      console.log(
        `Filtered to ${filteredData.length} rows with metric: ${this.metricFilter}`
      );
    } else {
      console.log(`Showing all metrics (${filteredData.length} rows)`);
    }

    // Calculate total pages
    this.totalPages = Math.max(
      1,
      Math.ceil(filteredData.length / this.pageSize)
    );

    // Ensure current page is valid
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    // Get data for current page
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    console.log(
      `Showing page ${this.currentPage} of ${this.totalPages} (${pageData.length} rows)`
    );

    // Clear existing table body
    this.tbody.html('');

    // Render each row for current page
    const fragment = document.createDocumentFragment();
    const tbody = document.createElement('tbody');

    // Use a more efficient approach for creating rows
    pageData.forEach((d) => {
      const row = document.createElement('tr');
      row.className = 'data-row';

      this.populateRow(row, d.player, d.team, d.metric, d.rawData);
      tbody.appendChild(row);
    });

    fragment.appendChild(tbody);
    this.tbody
      .node()
      .parentNode.replaceChild(fragment.firstChild, this.tbody.node());
    this.tbody = d3.select(tbody);

    // Update pagination controls
    this.updatePaginationControls(filteredData.length);

    // Set up player link listeners
    this.setupPlayerLinkListeners();
  }

  // Populate a table row with player data
  populateRow(row, player, team, metric, playerData) {
    // Sort data by date (most recent first) to ensure we're using the latest games
    const sortedData = [...playerData].sort((a, b) => b.date - a.date);

    // Get the most recent games for calculations
    const recentGames = sortedData.slice(0, 5);

    // Calculate the expected value (overall average for this metric)
    const expected = this.calculateExpected(playerData, metric);

    // Calculate the actual value (average of most recent 5 games)
    const actual =
      recentGames.length > 0
        ? recentGames.reduce((sum, d) => sum + d[metric], 0) /
          recentGames.length
        : 0;

    // Calculate the last 3, 5, 10 game averages
    const last3Games = sortedData.slice(0, 3);
    const last5Games = sortedData.slice(0, 5);
    const last10Games = sortedData.slice(0, 10);

    const l3Avg =
      last3Games.length > 0
        ? last3Games.reduce((sum, d) => sum + d[metric], 0) / last3Games.length
        : 0;

    const l5Avg =
      last5Games.length > 0
        ? last5Games.reduce((sum, d) => sum + d[metric], 0) / last5Games.length
        : 0;

    const l10Avg =
      last10Games.length > 0
        ? last10Games.reduce((sum, d) => sum + d[metric], 0) /
          last10Games.length
        : 0;

    // Calculate percentage differences from expected
    const l3Diff = expected > 0 ? ((l3Avg - expected) / expected) * 100 : 0;
    const l5Diff = expected > 0 ? ((l5Avg - expected) / expected) * 100 : 0;
    const l10Diff = expected > 0 ? ((l10Avg - expected) / expected) * 100 : 0;

    // Calculate current year data
    const currentYear = new Date().getFullYear();
    const currentYearData = playerData.filter(
      (d) => d.date.getFullYear() === currentYear
    );

    // Calculate the current year average
    const currentYearAvg =
      currentYearData.length > 0
        ? currentYearData.reduce((sum, d) => sum + d[metric], 0) /
          currentYearData.length
        : 0;

    // Calculate percentage difference between current year average and overall average
    const currentYearDiff =
      expected > 0 && currentYearData.length > 0
        ? ((currentYearAvg - expected) / expected) * 100
        : 0;

    // For all-time, this should be 0 or very close to 0 since all data is from 2025
    const allTimeAvg = this.calculateExpected(playerData, metric);
    const allTimeDiff =
      expected > 0 ? ((allTimeAvg - expected) / expected) * 100 : 0;

    // Add player name with link
    let cell = document.createElement('td');
    let link = document.createElement('a');
    link.href = '#';
    link.className = 'player-link';
    link.setAttribute('data-player', player);
    link.setAttribute('data-metric', metric);
    link.textContent = player;
    cell.appendChild(link);
    row.appendChild(cell);

    // Add team name
    cell = document.createElement('td');
    cell.textContent = team;
    row.appendChild(cell);

    // Add metric name
    cell = document.createElement('td');
    cell.className = 'metric-name';
    cell.textContent = this.formatMetricName(metric);
    row.appendChild(cell);

    // Add expected value
    cell = document.createElement('td');
    cell.textContent = expected.toFixed(2);
    row.appendChild(cell);

    // Add L3 average with performance indicators
    cell = document.createElement('td');
    cell.className = 'l3-percentage';
    if (l3Diff > 0) cell.classList.add('over-performance');
    if (l3Diff < 0) cell.classList.add('under-performance');
    cell.innerHTML = this.formatPercentage(l3Diff);
    row.appendChild(cell);

    // Add L5 average with performance indicators
    cell = document.createElement('td');
    cell.className = 'l5-percentage';
    if (l5Diff > 0) cell.classList.add('over-performance');
    if (l5Diff < 0) cell.classList.add('under-performance');
    cell.innerHTML = this.formatPercentage(l5Diff);
    row.appendChild(cell);

    // Add L10 average with performance indicators
    cell = document.createElement('td');
    cell.className = 'l10-percentage';
    if (l10Diff > 0) cell.classList.add('over-performance');
    if (l10Diff < 0) cell.classList.add('under-performance');
    cell.innerHTML = this.formatPercentage(l10Diff);
    row.appendChild(cell);

    // Add current year percentage with performance indicators
    cell = document.createElement('td');
    cell.className = 'current-year-percentage';
    if (currentYearDiff > 0) cell.classList.add('over-performance');
    if (currentYearDiff < 0) cell.classList.add('under-performance');
    cell.innerHTML =
      currentYearData.length > 0
        ? this.formatPercentage(currentYearDiff)
        : 'N/A';
    row.appendChild(cell);

    // Add all-time percentage with performance indicators
    cell = document.createElement('td');
    cell.className = 'all-time-percentage';
    if (allTimeDiff > 0) cell.classList.add('over-performance');
    if (allTimeDiff < 0) cell.classList.add('under-performance');
    cell.innerHTML = this.formatPercentage(allTimeDiff);
    row.appendChild(cell);
  }

  // Update pagination controls with current state
  updatePaginationControls(totalItems) {
    // Update page indicator
    this.container.select('.current-page').text(this.currentPage);
    this.container.select('.total-pages').text(this.totalPages);

    // Calculate item range being displayed
    const startItem = Math.min(
      totalItems,
      (this.currentPage - 1) * this.pageSize + 1
    );
    const endItem = Math.min(totalItems, this.currentPage * this.pageSize);

    this.container
      .select('.item-range-display')
      .text(`Showing ${startItem}-${endItem} of ${totalItems} items`);

    // Enable/disable navigation buttons
    this.container
      .select('.first-page')
      .property('disabled', this.currentPage === 1);

    this.container
      .select('.prev-page')
      .property('disabled', this.currentPage === 1);

    this.container
      .select('.next-page')
      .property('disabled', this.currentPage === this.totalPages);

    this.container
      .select('.last-page')
      .property('disabled', this.currentPage === this.totalPages);
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
      return;
    }

    console.log(`Sorting by ${this.sortColumn} in ${this.sortDirection} order`);

    this.data.sort((a, b) => {
      let valueA, valueB;

      // For each player-metric combination, calculate the sort value on demand
      if (
        a.player &&
        a.metric &&
        a.rawData &&
        b.player &&
        b.metric &&
        b.rawData
      ) {
        const metricA = a.metric;
        const metricB = b.metric;
        const playerDataA = a.rawData;
        const playerDataB = b.rawData;

        // Sort by date (most recent first)
        const sortedDataA = [...playerDataA].sort((x, y) => y.date - x.date);
        const sortedDataB = [...playerDataB].sort((x, y) => y.date - x.date);

        // Calculate values based on sort column
        switch (this.sortColumn) {
          case 'average':
            valueA = this.calculateExpected(playerDataA, metricA);
            valueB = this.calculateExpected(playerDataB, metricB);
            break;

          case 'l3Diff':
            const last3GamesA = sortedDataA.slice(0, 3);
            const last3GamesB = sortedDataB.slice(0, 3);

            const l3AvgA =
              last3GamesA.length > 0
                ? last3GamesA.reduce((sum, d) => sum + d[metricA], 0) /
                  last3GamesA.length
                : 0;

            const l3AvgB =
              last3GamesB.length > 0
                ? last3GamesB.reduce((sum, d) => sum + d[metricB], 0) /
                  last3GamesB.length
                : 0;

            const expectedA = this.calculateExpected(playerDataA, metricA);
            const expectedB = this.calculateExpected(playerDataB, metricB);

            valueA =
              expectedA > 0 ? ((l3AvgA - expectedA) / expectedA) * 100 : 0;
            valueB =
              expectedB > 0 ? ((l3AvgB - expectedB) / expectedB) * 100 : 0;
            break;

          case 'l5Diff':
            const last5GamesA = sortedDataA.slice(0, 5);
            const last5GamesB = sortedDataB.slice(0, 5);

            const l5AvgA =
              last5GamesA.length > 0
                ? last5GamesA.reduce((sum, d) => sum + d[metricA], 0) /
                  last5GamesA.length
                : 0;

            const l5AvgB =
              last5GamesB.length > 0
                ? last5GamesB.reduce((sum, d) => sum + d[metricB], 0) /
                  last5GamesB.length
                : 0;

            const expected5A = this.calculateExpected(playerDataA, metricA);
            const expected5B = this.calculateExpected(playerDataB, metricB);

            valueA =
              expected5A > 0 ? ((l5AvgA - expected5A) / expected5A) * 100 : 0;
            valueB =
              expected5B > 0 ? ((l5AvgB - expected5B) / expected5B) * 100 : 0;
            break;

          case 'l10Diff':
            const last10GamesA = sortedDataA.slice(0, 10);
            const last10GamesB = sortedDataB.slice(0, 10);

            const l10AvgA =
              last10GamesA.length > 0
                ? last10GamesA.reduce((sum, d) => sum + d[metricA], 0) /
                  last10GamesA.length
                : 0;

            const l10AvgB =
              last10GamesB.length > 0
                ? last10GamesB.reduce((sum, d) => sum + d[metricB], 0) /
                  last10GamesB.length
                : 0;

            const expected10A = this.calculateExpected(playerDataA, metricA);
            const expected10B = this.calculateExpected(playerDataB, metricB);

            valueA =
              expected10A > 0
                ? ((l10AvgA - expected10A) / expected10A) * 100
                : 0;
            valueB =
              expected10B > 0
                ? ((l10AvgB - expected10B) / expected10B) * 100
                : 0;
            break;

          case 'currentYearDiff':
            const currentYear = new Date().getFullYear();

            const currentYearDataA = playerDataA.filter(
              (d) => d.date.getFullYear() === currentYear
            );

            const currentYearDataB = playerDataB.filter(
              (d) => d.date.getFullYear() === currentYear
            );

            // Calculate the current year average
            const currentYearAvgA =
              currentYearDataA.length > 0
                ? currentYearDataA.reduce((sum, d) => sum + d[metricA], 0) /
                  currentYearDataA.length
                : 0;

            const currentYearAvgB =
              currentYearDataB.length > 0
                ? currentYearDataB.reduce((sum, d) => sum + d[metricB], 0) /
                  currentYearDataB.length
                : 0;

            const expectedYearA = this.calculateExpected(playerDataA, metricA);
            const expectedYearB = this.calculateExpected(playerDataB, metricB);

            // Calculate percentage difference between current year average and overall average
            valueA =
              expectedYearA > 0 && currentYearDataA.length > 0
                ? ((currentYearAvgA - expectedYearA) / expectedYearA) * 100
                : 0;

            valueB =
              expectedYearB > 0 && currentYearDataB.length > 0
                ? ((currentYearAvgB - expectedYearB) / expectedYearB) * 100
                : 0;
            break;

          case 'percentOver':
            // For all-time, this should be 0 or very close to 0 since all data is from 2025
            const allTimeAvgA = this.calculateExpected(playerDataA, metricA);
            const allTimeAvgB = this.calculateExpected(playerDataB, metricB);

            const expectedAllTimeA = this.calculateExpected(
              playerDataA,
              metricA
            );
            const expectedAllTimeB = this.calculateExpected(
              playerDataB,
              metricB
            );

            valueA =
              expectedAllTimeA > 0
                ? ((allTimeAvgA - expectedAllTimeA) / expectedAllTimeA) * 100
                : 0;
            valueB =
              expectedAllTimeB > 0
                ? ((allTimeAvgB - expectedAllTimeB) / expectedAllTimeB) * 100
                : 0;
            break;

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

          default:
            valueA = a[this.sortColumn] || 0;
            valueB = b[this.sortColumn] || 0;
        }
      } else {
        // Fallback if data is incomplete
        valueA = a[this.sortColumn] || 0;
        valueB = b[this.sortColumn] || 0;
      }

      // Handle string comparison
      if (typeof valueA === 'string') {
        return this.sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      // Handle numeric comparison
      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });

    console.log(`Sorted ${this.data.length} rows`);
  }

  // Set up event listeners for sortable column headers
  setupEventListeners() {
    try {
      // Set up sort listeners
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

        // Reset to first page when sorting changes
        this.currentPage = 1;

        this.updateSortIndicators(event.currentTarget);
        this.renderTable();
      });

      // Set up player link listeners
      this.setupPlayerLinkListeners();

      // Add window resize event listener for metric slider
      window.addEventListener('resize', () => {
        // Debounce the resize event
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
          const filterContainer = this.container
            .select('.metric-filter-container')
            .node();
          if (filterContainer) {
            this.positionMetricSlider(filterContainer);
          }
        }, 100);
      });

      // Set up pagination event listeners
      this.setupPaginationListeners();

      console.log('Performance table event listeners set up successfully');
    } catch (error) {
      console.error(
        'Error setting up performance table event listeners:',
        error
      );
    }
  }

  // Set up event listeners for pagination controls
  setupPaginationListeners() {
    // Page size selector
    this.container.select('.page-size-select').on('change', (event) => {
      this.pageSize = parseInt(event.target.value);
      this.currentPage = 1; // Reset to first page when changing page size
      this.renderTable();
    });

    this.container.select('.first-page').on('click', () => {
      if (this.currentPage > 1) {
        this.currentPage = 1;
        this.renderTable();
      }
    });

    this.container.select('.prev-page').on('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTable();
      }
    });

    this.container.select('.next-page').on('click', () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.renderTable();
      }
    });

    this.container.select('.last-page').on('click', () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage = this.totalPages;
        this.renderTable();
      }
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
    try {
      // Use event delegation for player links
      this.container.on('click', '.player-link', (event) => {
        event.preventDefault();
        const playerName = event.target.getAttribute('data-player');
        const metric =
          event.target.getAttribute('data-metric') || this.currentMetric;

        if (!playerName) {
          console.warn('Player link clicked but no player name found');
          return;
        }

        console.log(`Player link clicked: ${playerName}, metric: ${metric}`);

        // Store selected values in localStorage
        localStorage.setItem('selectedPlayer', playerName);
        localStorage.setItem('selectedMetric', metric);

        // Find player data to get league and team
        DataLoader.loadPlayerData(playerName)
          .then((playerData) => {
            if (playerData && playerData.length > 0) {
              // Get the most recent game to determine current team and league
              const sortedData = [...playerData].sort(
                (a, b) => b.date - a.date
              );
              const recentGame = sortedData[0];

              localStorage.setItem('selectedLeague', recentGame.league);
              localStorage.setItem('selectedTeam', recentGame.teamname);

              // Switch to player chart tab
              const playerChartTab = document.querySelector(
                '.tab[data-tab="player-chart"]'
              );
              if (playerChartTab) {
                playerChartTab.click();
              }

              // Update the chart if chart manager is available
              if (window.chartManagerInstance) {
                // Give the DOM time to update
                setTimeout(() => {
                  window.chartManagerInstance.selectPlayer(
                    playerName,
                    recentGame.teamname,
                    recentGame.league,
                    metric
                  );

                  // Ensure stats are updated
                  window.chartManagerInstance.updateStats(playerData);

                  // Log confirmation
                  console.log(
                    `Updated chart and stats for ${playerName} with metric ${metric}`
                  );
                }, 200);
              } else {
                console.error('ChartManager instance not available');
              }
            } else {
              console.error('Could not load player data for:', playerName);
            }
          })
          .catch((error) => {
            console.error('Error loading player data:', error);
          });
      });

      console.log('Player link listeners set up successfully');
    } catch (error) {
      console.error('Error setting up player link listeners:', error);
    }
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
}
