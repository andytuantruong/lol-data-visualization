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
    this.propValues = new Map(); //Prop values from player_prop_lines.csv

    // Pagination properties
    this.currentPage = 1;
    const savedPageSize = localStorage.getItem('performanceTablePageSize');
    this.pageSize = savedPageSize ? parseInt(savedPageSize) : 10;
    this.totalPages = 1;
  }

  // Initialize the performance table with player data and set up event listeners
  async initialize() {
    try {
      console.log('Initializing Performance Table...');

      // Load prop values from CSV
      await this.loadPropValues();

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

      for (const player of allPlayers) {
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

              // Calculate average for this metric
              entry.avg = this.calculateAverage(playerData, metric);

              // Get prop value if available
              const propKey = `${player.toLowerCase()}_${metric}`;
              if (this.propValues.has(propKey)) {
                entry.propValue = this.propValues.get(propKey);
              } else {
                entry.propValue = null;
              }

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
      }

      this.originalData = [...this.data];

      console.log(
        `Completed processing ${processedCount} players with ${this.data.length} metric entries`
      );

      // Make sure we have data to display
      if (this.data.length === 0) {
        console.error('No player data was processed successfully');
        throw new Error('Failed to process player data');
      }

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
      this.container.html(`
        <div class="error-message">
          <h3>Error Loading Players</h3>
          <p>${error.message}</p>
          <p>Please check the console for more details.</p>
        </div>
      `);
      throw error;
    }
  }

  // Load prop values from player_kill_lines.csv
  async loadPropValues() {
    try {
      console.log('Loading prop values from CSV...');

      // Try multiple possible paths for the CSV file for scaling purposes
      const possiblePaths = [
        'scripts/player_kill_lines.csv',
        'd3_lol/scripts/player_kill_lines.csv',
        '../scripts/player_kill_lines.csv',
      ];

      let csvText = null;
      let loadedPath = null;

      // Try each path until one works
      for (const path of possiblePaths) {
        try {
          console.log(`Attempting to load prop values from: ${path}`);
          const response = await fetch(path);

          if (response.ok) {
            csvText = await response.text();
            loadedPath = path;
            console.log(`Successfully loaded prop values from: ${path}`);
            break;
          }
        } catch (e) {
          console.warn(`Failed to load from ${path}: ${e.message}`);
        }
      }

      if (!csvText) {
        console.warn('Failed to load prop values CSV from any path');
        return;
      }

      // Parse the CSV data
      const propData = d3.csvParse(csvText);
      console.log(
        `Loaded ${propData.length} prop value entries from ${loadedPath}`
      );

      // Store prop values in a map for quick lookup
      propData.forEach((row) => {
        if (!row.player_name || !row.stat_type || !row.prop_value) {
          console.warn('Skipping invalid prop value row:', row);
          return;
        }

        const playerName = row.player_name.toLowerCase();
        const statType = row.stat_type.toLowerCase();
        const propValue = parseFloat(row.prop_value);

        if (!isNaN(propValue)) {
          const key = `${playerName}_${statType}`;
          this.propValues.set(key, propValue);
          console.log(
            `Loaded prop value for ${playerName} (${statType}): ${propValue}`
          );
        } else {
          console.warn(
            `Invalid prop value for ${row.player_name} (${row.stat_type}): ${row.prop_value}`
          );
        }
      });

      console.log(`Successfully loaded ${this.propValues.size} prop values`);
    } catch (error) {
      console.error('Error loading prop values:', error);
      // Continue without prop values rather than failing completely
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
      .attr('title', 'Average value across all games')
      .classed('sortable', true)
      .attr('data-column', 'average');
    headerRow
      .append('th')
      .text('Prop')
      .attr('title', 'Prop value from player_kill_lines.csv')
      .classed('sortable', true)
      .attr('data-column', 'propValue');
    headerRow
      .append('th')
      .text('L3 +/-')
      .attr('title', 'Performance compared to Prop in Last 3 Games')
      .classed('sortable', true)
      .attr('data-column', 'l3Diff');
    headerRow
      .append('th')
      .text('L5 +/-')
      .attr('title', 'Performance compared to Prop in Last 5 Games')
      .classed('sortable', true)
      .attr('data-column', 'l5Diff');
    headerRow
      .append('th')
      .text('L10 +/-')
      .attr('title', 'Performance compared to Prop in Last 10 Games')
      .classed('sortable', true)
      .attr('data-column', 'l10Diff');
    headerRow
      .append('th')
      .text(`${this.currentYear}`)
      .attr('title', `Performance difference in ${this.currentYear}`)
      .classed('sortable', true)
      .attr('data-column', 'currentYearDiff');
    headerRow
      .append('th')
      .text('All-Time')
      .attr('title', 'All-time performance difference')
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
  calculateAverage(data, metric) {
    if (!data || data.length === 0) return 0;

    // Sum all values for the given metric
    const sum = data.reduce((total, match) => total + match[metric], 0);
    const average = sum / data.length;
    // Return the average rounded to 2 decimal places
    return parseFloat(average.toFixed(2));
  }

  // Calculate percentage of games over prop line for the last N games
  calculateLastNGamesOverProp(playerData, metric, propValue, n) {
    if (!playerData || playerData.length === 0 || propValue === null) {
      return { text: '-', value: null };
    }

    // Sort data by date (most recent first)
    const sortedData = [...playerData].sort((a, b) => b.date - a.date);

    // Take only the last N games
    const lastNGames = sortedData.slice(0, n);

    if (lastNGames.length === 0) {
      return { text: '-', value: null };
    }

    // Count games where player exceeded prop line
    const gamesOverProp = lastNGames.filter(
      (game) => game[metric] > propValue
    ).length;

    const percentOverProp = (gamesOverProp / lastNGames.length) * 100;

    return {
      text: this.formatPercentage(percentOverProp),
      value: percentOverProp,
    };
  }

  // Render the table with current data, applying filters and sorting
  renderTable() {
    try {
      console.log(`Rendering table with ${this.data.length} entries`);

      // Make a copy of the data for filtering
      let filteredData = [...this.data];

      // Apply metric filter if not set to "all"
      if (this.metricFilter !== 'all') {
        filteredData = filteredData.filter(
          (d) => d.metric === this.metricFilter
        );
        console.log(
          `Filtered to ${filteredData.length} rows with metric: ${this.metricFilter}`
        );
      } else {
        console.log(`Showing all metrics (${filteredData.length} rows)`);
      }

      // Store filtered data for sorting
      this.filteredData = filteredData;

      // Apply sorting if needed
      if (this.sortColumn && this.sortDirection) {
        this.sortData();
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
      const endIndex = Math.min(
        startIndex + this.pageSize,
        filteredData.length
      );
      const pageData = filteredData.slice(startIndex, endIndex);

      console.log(
        `Showing page ${this.currentPage} of ${this.totalPages} (${pageData.length} rows)`
      );

      // Clear existing table body
      this.tbody.html('');

      if (pageData.length === 0) {
        // Display a message if no data is available
        const emptyRow = this.tbody.append('tr');
        emptyRow
          .append('td')
          .attr('colspan', '10')
          .style('text-align', 'center')
          .text('No data available');
      } else {
        // Render each row for current page
        pageData.forEach((d) => {
          const row = this.tbody.append('tr').classed('data-row', true);
          this.populateRow(row, d.player, d.team, d.metric, d.rawData);
        });
      }

      this.updatePaginationControls(filteredData.length);

      // Set up player link listeners
      this.setupPlayerLinkListeners();
    } catch (error) {
      console.error('Error rendering table:', error);
      // Display error message in the table
      this.tbody.html('');
      const errorRow = this.tbody.append('tr');
      errorRow
        .append('td')
        .attr('colspan', '10')
        .style('text-align', 'center')
        .style('color', 'red')
        .text(`Error rendering table: ${error.message}`);
    }
  }

  // Populate a table row with player data
  populateRow(row, player, team, metric, playerData) {
    try {
      // Calculate the expected value (overall average for this metric)
      const expected = this.calculateAverage(playerData, metric);

      // Get prop value if available
      const propKey = `${player.toLowerCase()}_${metric}`;
      const propValue = this.propValues.has(propKey)
        ? this.propValues.get(propKey)
        : null;

      // Add player name with link
      const playerCell = row.append('td');
      playerCell
        .append('a')
        .attr('href', '#')
        .classed('player-link', true)
        .attr('data-player', player)
        .attr('data-metric', metric)
        .text(player);

      // Add team name
      row.append('td').text(team);

      // Add metric name
      row
        .append('td')
        .classed('metric-name', true)
        .text(this.formatMetricName(metric));

      // Add expected value (average)
      row.append('td').text(expected.toFixed(2));

      // Add prop value
      row
        .append('td')
        .classed('prop-value', true)
        .text(propValue !== null ? propValue.toFixed(2) : '-');

      // Calculate L3, L5, and L10 percentages using the new function
      const l3Result = this.calculateLastNGamesOverProp(
        playerData,
        metric,
        propValue,
        3
      );
      row.append('td').classed('l3-percentage', true).text(l3Result.text);

      const l5Result = this.calculateLastNGamesOverProp(
        playerData,
        metric,
        propValue,
        5
      );
      row.append('td').classed('l5-percentage', true).text(l5Result.text);

      const l10Result = this.calculateLastNGamesOverProp(
        playerData,
        metric,
        propValue,
        10
      );
      row.append('td').classed('l10-percentage', true).text(l10Result.text);

      // Add placeholder for Current Year column (no calculation)
      row.append('td').classed('current-year-percentage', true).text('-');

      // Add placeholder for All-time column (no calculation)
      row.append('td').classed('all-time-percentage', true).text('-');
    } catch (error) {
      console.error(`Error populating row for player ${player}:`, error);
      // Add error message to row
      row.html(''); // Clear any partial row content
      row
        .append('td')
        .attr('colspan', 10)
        .style('text-align', 'center')
        .style('color', 'red')
        .text(`Error loading data for ${player}: ${error.message}`);
    }
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
    if (value === null || value === undefined || isNaN(value)) return '-';

    // Round to 1 decimal place
    const rounded = parseFloat(value.toFixed(1));

    // Add + sign for positive values, - is automatically added for negative values
    const sign = rounded > 0 ? '+' : '';

    return `${sign}${rounded}%`;
  }

  // Format metric name with proper capitalization
  formatMetricName(metric) {
    return metric.charAt(0).toUpperCase() + metric.slice(1);
  }

  // Sort data based on current sort column and direction
  sortData() {
    if (!this.sortColumn || !this.sortDirection || !this.filteredData) {
      console.warn('Sort called without column, direction, or filtered data');
      return;
    }

    console.log(`Sorting by ${this.sortColumn} in ${this.sortDirection} order`);

    this.filteredData.sort((a, b) => {
      let valueA, valueB;

      switch (this.sortColumn) {
        case 'player':
          return this.sortDirection === 'asc'
            ? a.player.localeCompare(b.player)
            : b.player.localeCompare(a.player);

        case 'team':
          return this.sortDirection === 'asc'
            ? (a.team || '').localeCompare(b.team || '')
            : (b.team || '').localeCompare(a.team || '');

        case 'metric':
          return this.sortDirection === 'asc'
            ? a.metric.localeCompare(b.metric)
            : b.metric.localeCompare(a.metric);

        case 'average':
          valueA = a.avg || 0;
          valueB = b.avg || 0;
          break;

        case 'propValue':
          const propKeyA = `${a.player.toLowerCase()}_${a.metric}`;
          const propKeyB = `${b.player.toLowerCase()}_${b.metric}`;
          valueA = this.propValues.has(propKeyA)
            ? this.propValues.get(propKeyA)
            : -Infinity;
          valueB = this.propValues.has(propKeyB)
            ? this.propValues.get(propKeyB)
            : -Infinity;
          break;

        case 'l3Diff':
          // Calculate percentage of L3 games over prop line for sorting
          const propKeyL3A = `${a.player.toLowerCase()}_${a.metric}`;
          const propKeyL3B = `${b.player.toLowerCase()}_${b.metric}`;
          const propL3A = this.propValues.has(propKeyL3A)
            ? this.propValues.get(propKeyL3A)
            : null;
          const propL3B = this.propValues.has(propKeyL3B)
            ? this.propValues.get(propKeyL3B)
            : null;

          const l3ResultA = this.calculateLastNGamesOverProp(
            a.rawData,
            a.metric,
            propL3A,
            3
          );
          const l3ResultB = this.calculateLastNGamesOverProp(
            b.rawData,
            b.metric,
            propL3B,
            3
          );

          valueA = l3ResultA.value !== null ? l3ResultA.value : -Infinity;
          valueB = l3ResultB.value !== null ? l3ResultB.value : -Infinity;
          break;

        case 'l5Diff':
          // Calculate percentage of L5 games over prop line for sorting
          const propKeyL5A = `${a.player.toLowerCase()}_${a.metric}`;
          const propKeyL5B = `${b.player.toLowerCase()}_${b.metric}`;
          const propL5A = this.propValues.has(propKeyL5A)
            ? this.propValues.get(propKeyL5A)
            : null;
          const propL5B = this.propValues.has(propKeyL5B)
            ? this.propValues.get(propKeyL5B)
            : null;

          const l5ResultA = this.calculateLastNGamesOverProp(
            a.rawData,
            a.metric,
            propL5A,
            5
          );
          const l5ResultB = this.calculateLastNGamesOverProp(
            b.rawData,
            b.metric,
            propL5B,
            5
          );

          valueA = l5ResultA.value !== null ? l5ResultA.value : -Infinity;
          valueB = l5ResultB.value !== null ? l5ResultB.value : -Infinity;
          break;

        case 'l10Diff':
          // Calculate percentage of L10 games over prop line for sorting
          const propKeyL10A = `${a.player.toLowerCase()}_${a.metric}`;
          const propKeyL10B = `${b.player.toLowerCase()}_${b.metric}`;
          const propL10A = this.propValues.has(propKeyL10A)
            ? this.propValues.get(propKeyL10A)
            : null;
          const propL10B = this.propValues.has(propKeyL10B)
            ? this.propValues.get(propKeyL10B)
            : null;

          const l10ResultA = this.calculateLastNGamesOverProp(
            a.rawData,
            a.metric,
            propL10A,
            10
          );
          const l10ResultB = this.calculateLastNGamesOverProp(
            b.rawData,
            b.metric,
            propL10B,
            10
          );

          valueA = l10ResultA.value !== null ? l10ResultA.value : -Infinity;
          valueB = l10ResultB.value !== null ? l10ResultB.value : -Infinity;
          break;

        // Keep Current Year and All-time as placeholders
        case 'currentYearDiff':
        case 'percentOver':
          valueA = 0;
          valueB = 0;
          break;

        default:
          valueA = 0;
          valueB = 0;
      }

      return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });

    console.log(`Sorted ${this.filteredData.length} rows`);
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
      localStorage.setItem('performanceTablePageSize', this.pageSize);
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
