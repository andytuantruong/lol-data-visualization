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

      // Create table structure first
      this.createTableStructure();
      this.addMetricFilter();
      this.createTableHeader();
      this.addPaginationControls();

      // Set default sort to player name in ascending order
      this.sortColumn = 'player';
      this.sortDirection = 'asc';

      this.showTableLoadingAnimation();

      console.log('Loading all available prop values');
      await this.loadPropValues();

      console.log('Loading all player data for performance table...');
      const allPlayersData = await DataLoader.loadAllPlayersData();

      if (!allPlayersData || allPlayersData.size === 0) {
        console.error('No player data loaded');
        throw new Error('No player data available');
      }

      console.log(`Loaded data for ${allPlayersData.size} players`);

      // Process player data for the table
      this.processPlayerData(allPlayersData);

      // Set the metric filter to "all" by default
      this.metricFilter = 'all';
      const metricSegments = document.querySelectorAll(
        '.metric-filter-container .segmented-control .segment'
      );
      metricSegments.forEach((segment) => {
        segment.classList.remove('active');
        if (segment.getAttribute('data-value') === 'all') {
          segment.classList.add('active');
        }
      });
      this.positionMetricSlider();

      this.setupEventListeners();
      this.renderTable();

      // Update sort indicators for the default sort
      const playerHeader = this.thead.select('th:nth-child(1)').node();
      if (playerHeader) {
        this.updateSortIndicators(playerHeader);
      }

      console.timeEnd('initializePerformanceTable');
      console.log('Performance Table initialization complete');

      // Hide the loading overlay if it's still visible
      if (
        window.LoadingManager &&
        typeof window.LoadingManager.hide === 'function'
      ) {
        window.LoadingManager.hide();
      }
    } catch (error) {
      console.error('Error initializing performance table:', error);

      this.container.html('');
      this.container
        .append('div')
        .attr('class', 'data-error')
        .style('display', 'block')
        .html(
          `<h3>Error</h3><p>Error loading performance data: ${error.message}</p>`
        );

      if (
        window.LoadingManager &&
        typeof window.LoadingManager.hide === 'function'
      ) {
        window.LoadingManager.hide();
      }

      throw error;
    }
  }

  // Show a loading animation in the table itself
  showTableLoadingAnimation() {
    // Clear any existing content in the table body
    this.tbody.html('');

    // Create loading rows
    const loadingRows = [];
    for (let i = 0; i < 10; i++) {
      loadingRows.push(`
        <tr class="data-row">
          <td colspan="10" style="padding: 10px; text-align: center;">
            <div style="background: linear-gradient(90deg, #333, #444, #333); background-size: 200% 100%; animation: loading-pulse 1.5s infinite; height: 20px; border-radius: 4px;"></div>
          </td>
        </tr>
      `);
    }

    // Add a style for the loading animation
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes loading-pulse {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `;
    document.head.appendChild(styleElement);

    // Add the loading rows to the table
    this.tbody.html(loadingRows.join(''));

    // Update pagination text
    const itemRangeDisplay = document.getElementById('item-range-display');
    if (itemRangeDisplay) {
      itemRangeDisplay.textContent = 'Loading data...';
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
    try {
      console.log('Creating performance table structure...');

      // Clear any existing content first
      this.container.html('');

      // First add the metric filter container at the top
      this.container.append('div').attr('class', 'metric-filter-container');

      // Then add the table element
      this.table = this.container
        .append('table')
        .attr('class', 'performance-table');

      // Create table header and body
      this.thead = this.table.append('thead');
      this.tbody = this.table.append('tbody');
      console.log('Table structure created successfully');
    } catch (error) {
      console.error('Error creating table structure:', error);
    }
  }

  // Add pagination controls below the table
  addPaginationControls() {
    // Create pagination container
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';
    this.container.node().appendChild(paginationContainer);

    // Page size container (left side)
    const pageSizeContainer = document.createElement('div');
    pageSizeContainer.className = 'page-size-container';

    const pageSizeLabel = document.createElement('span');
    pageSizeLabel.textContent = 'Show entries:';
    pageSizeContainer.appendChild(pageSizeLabel);

    const pageSizeSelect = document.createElement('select');
    pageSizeSelect.className = 'page-size-select';

    [10, 25, 50, 100].forEach((size) => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      pageSizeSelect.appendChild(option);
    });

    pageSizeContainer.appendChild(pageSizeSelect);
    paginationContainer.appendChild(pageSizeContainer);

    // Page navigation container (center)
    const pageNavContainer = document.createElement('div');
    pageNavContainer.className = 'page-nav-container';

    const prevButton = document.createElement('button');
    prevButton.className = 'page-nav-button prev-page';
    prevButton.textContent = 'Previous';
    prevButton.disabled = true;
    pageNavContainer.appendChild(prevButton);

    const pageIndicator = document.createElement('div');
    pageIndicator.className = 'page-indicator';
    pageIndicator.textContent = 'Page 1 of 1';
    pageNavContainer.appendChild(pageIndicator);

    const nextButton = document.createElement('button');
    nextButton.className = 'page-nav-button next-page';
    nextButton.textContent = 'Next';
    nextButton.disabled = true;
    pageNavContainer.appendChild(nextButton);

    paginationContainer.appendChild(pageNavContainer);

    // Item range display (right side)
    const itemRangeDisplay = document.createElement('div');
    itemRangeDisplay.className = 'item-range-display';
    itemRangeDisplay.textContent = 'Showing 0 to 0 of 0 entries';
    paginationContainer.appendChild(itemRangeDisplay);

    // Store references to pagination elements
    this.paginationElements = {
      container: paginationContainer,
      pageSizeSelect: pageSizeSelect,
      itemRangeDisplay: itemRangeDisplay,
      prevButton: prevButton,
      nextButton: nextButton,
      pageIndicator: pageIndicator,
    };

    // Set initial page size
    this.pageSize = parseInt(pageSizeSelect.value);
  }

  // Create the table header with sortable columns
  createTableHeader() {
    const headerRow = this.thead.append('tr');

    headerRow
      .append('th')
      .text('Player')
      .classed('sortable', true)
      .attr('data-column', 'player');

    headerRow
      .append('th')
      .text('Team')
      .classed('sortable', true)
      .attr('data-column', 'team');

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
    try {
      console.log('Adding metric filter...');

      // Find the metric filter container
      const filterContainer = this.container.select('.metric-filter-container');

      // Clear any existing content
      filterContainer.html('');

      filterContainer.append('label').text('Filter by Metric:');

      // Create segmented control for metric filtering
      const segmentedControl = filterContainer
        .append('div')
        .attr('class', 'segmented-control metric-filter');

      // Add slider element
      segmentedControl.append('div').attr('class', 'slider');

      // Add segments for each metric option
      segmentedControl
        .append('button')
        .attr('class', 'segment active') // Make "All" active by default
        .attr('data-value', 'all')
        .text('All');

      segmentedControl
        .append('button')
        .attr('class', 'segment')
        .attr('data-value', 'kills')
        .text('Kills');

      segmentedControl
        .append('button')
        .attr('class', 'segment')
        .attr('data-value', 'deaths')
        .text('Deaths');

      segmentedControl
        .append('button')
        .attr('class', 'segment')
        .attr('data-value', 'assists')
        .text('Assists');

      // Set initial metric filter
      this.metricFilter = 'all';

      // Position the slider under the active segment
      setTimeout(() => {
        this.positionMetricSlider();
      }, 0);

      console.log('Metric filter added successfully');
    } catch (error) {
      console.error('Error adding metric filter:', error);
    }
  }

  positionMetricSlider() {
    try {
      const segmentedControl = this.container
        .select('.metric-filter-container .segmented-control')
        .node();
      if (!segmentedControl) {
        console.warn('Segmented control not found');
        return;
      }

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
    } catch (error) {
      console.error('Error positioning metric slider:', error);
    }
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
      console.log('Rendering performance table...');
      console.time('renderTable');

      // Filter data based on current metric filter
      this.filteredData = [];

      if (this.metricFilter === 'all') {
        // For "All" filter, include all metrics for all players
        this.data.forEach((player) => {
          this.metrics.forEach((metric) => {
            this.filteredData.push({
              player: player.name,
              team: player.team,
              metric: metric,
              data: player.data,
              preCalculated: player.metrics[metric],
            });
          });
        });
      } else {
        // For specific metric filter, only include that metric
        this.data.forEach((player) => {
          this.filteredData.push({
            player: player.name,
            team: player.team,
            metric: this.metricFilter,
            data: player.data,
            preCalculated: player.metrics[this.metricFilter],
          });
        });
      }

      console.log(`Filtered data: ${this.filteredData.length} rows`);

      // Sort the filtered data
      if (this.sortColumn) {
        this.sortData();
      }

      // Clear existing table body content
      this.tbody.html('');

      // Calculate pagination
      const totalItems = this.filteredData.length;
      const startIndex = (this.currentPage - 1) * this.pageSize;
      const endIndex = Math.min(startIndex + this.pageSize, totalItems);
      const pageData = this.filteredData.slice(startIndex, endIndex);

      this.totalPages = Math.ceil(totalItems / this.pageSize);

      console.log(
        `Pagination: Page ${this.currentPage}/${
          this.totalPages
        }, showing items ${startIndex + 1}-${endIndex} of ${totalItems}`
      );

      // Batch DOM operations for better performance
      const rowsHtml = [];

      // Render each row
      pageData.forEach((item) => {
        const rowHtml = this.createRowHtml(
          item.player,
          item.team,
          item.metric,
          item.preCalculated
        );
        rowsHtml.push(rowHtml);
      });

      // Apply all DOM changes at once
      this.tbody.html(rowsHtml.join(''));

      // Force a browser reflow to ensure the DOM is updated
      this.tbody.node().offsetHeight;

      // Add event listeners to player links
      this.tbody.selectAll('.player-link').on('click', (event) => {
        event.preventDefault();
        const playerName = event.target.getAttribute('data-player');
        const metric = event.target.getAttribute('data-metric');
        if (playerName && metric) {
          this.selectPlayerInDropdowns(playerName, metric);
        }
      });

      // Update pagination controls
      this.updatePaginationControls(totalItems);

      console.timeEnd('renderTable');
      console.log(`Rendered ${pageData.length} rows`);

      // Force another browser reflow to ensure everything is rendered
      this.container.node().offsetHeight;
    } catch (error) {
      console.error('Error rendering table:', error);

      // Display error in the table body
      this.tbody.html('');
      this.tbody
        .append('tr')
        .append('td')
        .attr('colspan', 10)
        .style('text-align', 'center')
        .style('color', 'red')
        .text(`Error rendering table: ${error.message}`);
    }
  }

  // Create HTML for a table row (faster than DOM manipulation)
  createRowHtml(player, team, metric, preCalculated) {
    try {
      const average = preCalculated.average;
      const propValue = preCalculated.propValue;
      const l3Result = preCalculated.l3;
      const l5Result = preCalculated.l5;
      const l10Result = preCalculated.l10;

      return `
        <tr class="data-row">
          <td><a href="#" class="player-link" data-player="${player}" data-metric="${metric}">${player}</a></td>
          <td>${team}</td>
          <td class="metric-name">${this.formatMetricName(metric)}</td>
          <td>${average.toFixed(2)}</td>
          <td class="prop-value">${
            propValue !== null ? propValue.toFixed(2) : '-'
          }</td>
          <td class="l3-percentage">${l3Result.text}</td>
          <td class="l5-percentage">${l5Result.text}</td>
          <td class="l10-percentage">${l10Result.text}</td>
          <td class="current-year-percentage">-</td>
          <td class="all-time-percentage">-</td>
        </tr>
      `;
    } catch (error) {
      console.error(`Error creating row HTML for player ${player}:`, error);
      return `
        <tr>
          <td colspan="10" style="text-align: center; color: red;">
            Error loading data for ${player}: ${error.message}
          </td>
        </tr>
      `;
    }
  }

  // Update pagination controls with current state
  updatePaginationControls(totalItems) {
    if (!this.paginationElements) return;

    const {
      pageSizeSelect,
      itemRangeDisplay,
      prevButton,
      nextButton,
      pageIndicator,
    } = this.paginationElements;

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / this.pageSize);

    // Update page indicator
    pageIndicator.textContent = `Page ${this.currentPage} of ${
      totalPages || 1
    }`;

    // Update item range display
    const start =
      totalItems === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, totalItems);
    itemRangeDisplay.textContent = `Showing ${start} to ${end} of ${totalItems} entries`;

    // Update button states
    prevButton.disabled = this.currentPage <= 1;
    nextButton.disabled = this.currentPage >= totalPages;

    // Add aria labels for accessibility
    prevButton.setAttribute('aria-label', 'Go to previous page');
    nextButton.setAttribute('aria-label', 'Go to next page');
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
    try {
      console.log(
        `Sorting by ${this.sortColumn} in ${this.sortDirection} order`
      );
      console.time('sortData');

      if (!this.filteredData || this.filteredData.length === 0) {
        console.warn('No data to sort');
        return;
      }

      this.filteredData.sort((a, b) => {
        let valueA, valueB;

        // Determine values to compare based on sort column
        switch (this.sortColumn) {
          case 'player':
            // For player name, use string comparison
            valueA = a.player || '';
            valueB = b.player || '';
            return this.sortDirection === 'asc'
              ? valueA.localeCompare(valueB)
              : valueB.localeCompare(valueA);
          case 'team':
            // For team name, use string comparison
            valueA = a.team || '';
            valueB = b.team || '';
            return this.sortDirection === 'asc'
              ? valueA.localeCompare(valueB)
              : valueB.localeCompare(valueA);
          case 'average':
            valueA = a.preCalculated.average;
            valueB = b.preCalculated.average;
            break;
          case 'propValue':
            valueA =
              a.preCalculated.propValue !== null
                ? a.preCalculated.propValue
                : -1;
            valueB =
              b.preCalculated.propValue !== null
                ? b.preCalculated.propValue
                : -1;
            break;
          case 'l3Diff':
            valueA =
              a.preCalculated.l3.value !== null ? a.preCalculated.l3.value : -1;
            valueB =
              b.preCalculated.l3.value !== null ? b.preCalculated.l3.value : -1;
            break;
          case 'l5Diff':
            valueA =
              a.preCalculated.l5.value !== null ? a.preCalculated.l5.value : -1;
            valueB =
              b.preCalculated.l5.value !== null ? b.preCalculated.l5.value : -1;
            break;
          case 'l10Diff':
            valueA =
              a.preCalculated.l10.value !== null
                ? a.preCalculated.l10.value
                : -1;
            valueB =
              b.preCalculated.l10.value !== null
                ? b.preCalculated.l10.value
                : -1;
            break;
          case 'currentYearDiff':
          case 'percentOver':
            // These are placeholders for now
            valueA = 0;
            valueB = 0;
            break;
          default:
            // Default to player name for any unknown column
            valueA = a.player || '';
            valueB = b.player || '';
            return this.sortDirection === 'asc'
              ? valueA.localeCompare(valueB)
              : valueB.localeCompare(valueA);
        }

        // For numeric values, use numeric comparison
        if (this.sortDirection === 'asc') {
          return valueA - valueB;
        } else {
          return valueB - valueA;
        }
      });

      console.timeEnd('sortData');
      console.log(`Sorted ${this.filteredData.length} rows`);
    } catch (error) {
      console.error('Error sorting data:', error);
    }
  }

  // Set up event listeners for sortable column headers
  setupEventListeners() {
    try {
      console.log('Setting up performance table event listeners...');

      // Set up metric filter event listeners
      const metricSegments = document.querySelectorAll(
        '.performance-table-container .metric-filter .segment'
      );

      // Remove any existing event listeners by cloning and replacing
      metricSegments.forEach((segment) => {
        const newSegment = segment.cloneNode(true);
        segment.parentNode.replaceChild(newSegment, segment);
      });

      // Add new event listeners
      const newMetricSegments = document.querySelectorAll(
        '.performance-table-container .metric-filter .segment'
      );

      newMetricSegments.forEach((segment) => {
        segment.addEventListener('click', (event) => {
          // Remove active class from all segments
          newMetricSegments.forEach((s) => s.classList.remove('active'));

          // Add active class to clicked segment
          segment.classList.add('active');

          // Update metric filter
          this.metricFilter = segment.getAttribute('data-value');
          console.log(`Metric filter changed to: ${this.metricFilter}`);

          // Position the slider
          this.positionMetricSlider();

          // Re-render the table with the new filter
          this.renderTable();
        });
      });

      // Set up sort column headers
      this.table.selectAll('th.sortable').on('click', (event) => {
        const column = event.currentTarget.getAttribute('data-column');

        // If clicking the same column, toggle direction
        if (column === this.sortColumn) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          // New column, set to appropriate default direction
          this.sortColumn = column;
          this.sortDirection = column === 'player' ? 'asc' : 'desc';
        }

        // Update sort indicators - pass the current header element
        this.updateSortIndicators(d3.select(event.currentTarget));

        // Sort and re-render the table
        this.sortData();
        this.renderTable();
      });

      // Set up pagination event listeners
      this.setupPaginationListeners();

      // Set up player link event listeners
      this.setupPlayerLinkListeners();

      console.log('Performance table event listeners set up successfully');
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  // Set up event listeners for pagination controls
  setupPaginationListeners() {
    if (!this.paginationElements) return;

    const { pageSizeSelect, prevButton, nextButton } = this.paginationElements;

    // Page size change handler
    pageSizeSelect.addEventListener('change', () => {
      this.pageSize = parseInt(pageSizeSelect.value);
      this.currentPage = 1; // Reset to first page when changing page size
      this.renderTable();
    });

    // Previous page button handler
    prevButton.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTable();
      }
    });

    // Next page button handler
    nextButton.addEventListener('click', () => {
      const totalItems = this.filteredData.length;
      const totalPages = Math.ceil(totalItems / this.pageSize);

      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderTable();
      }
    });

    // Add keyboard navigation for accessibility
    prevButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        prevButton.click();
      }
    });

    nextButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextButton.click();
      }
    });
  }

  // Update sort indicators (↑/↓) on column headers
  updateSortIndicators(currentHeader) {
    try {
      // First, remove ALL existing sort indicators from ALL headers
      this.table.selectAll('th .sort-icon').remove();

      // Then add the indicator only to the current sort column
      if (currentHeader) {
        const direction = this.sortDirection === 'asc' ? '↑' : '↓';

        // Create a new span for the sort icon
        currentHeader
          .append('span')
          .attr('class', 'sort-icon')
          .style('margin-left', '5px')
          .text(direction);
      }
    } catch (error) {
      console.error('Error updating sort indicators:', error);
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

  processPlayerData(allPlayersData) {
    try {
      console.log('Processing player data for performance table...');
      console.time('processPlayerData');

      // Reset data array
      this.data = [];

      // Pre-calculate metrics for each player to avoid recalculating during rendering
      allPlayersData.forEach((playerGames, playerName) => {
        if (!playerName || playerGames.length === 0) return;

        // Get the most recent team from player data
        const sortedGames = [...playerGames].sort((a, b) => b.date - a.date);
        const team = sortedGames[0].teamname;

        // Pre-calculate averages for each metric
        const preCalculatedMetrics = {};
        this.metrics.forEach((metric) => {
          // Calculate average
          const sum = playerGames.reduce(
            (total, match) => total + match[metric],
            0
          );
          const average = playerGames.length > 0 ? sum / playerGames.length : 0;

          // Get prop value if available
          const propKey = `${playerName.toLowerCase()}_${metric}`;
          const propValue = this.propValues.has(propKey)
            ? this.propValues.get(propKey)
            : null;

          // Calculate L3, L5, L10 percentages
          const l3Result = this.calculateLastNGamesOverProp(
            playerGames,
            metric,
            propValue,
            3
          );
          const l5Result = this.calculateLastNGamesOverProp(
            playerGames,
            metric,
            propValue,
            5
          );
          const l10Result = this.calculateLastNGamesOverProp(
            playerGames,
            metric,
            propValue,
            10
          );

          preCalculatedMetrics[metric] = {
            average: parseFloat(average.toFixed(2)),
            propValue: propValue,
            l3: l3Result,
            l5: l5Result,
            l10: l10Result,
          };
        });

        // Add player to data array with pre-calculated metrics
        this.data.push({
          name: playerName,
          team: team,
          data: playerGames,
          metrics: preCalculatedMetrics,
        });
      });

      // Store original data for filtering
      this.originalData = this.data;

      // Set default sort to player name in ascending order
      this.sortColumn = 'player';
      this.sortDirection = 'asc';

      console.timeEnd('processPlayerData');
      console.log(`Processed data for ${this.data.length} players`);
    } catch (error) {
      console.error('Error processing player data:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }
}
