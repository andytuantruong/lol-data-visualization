/**
 * SeriesChart class
 * Creates a bar chart showing series data for a player
 */
class SeriesChart {
  constructor(containerId) {
    this.container = d3.select(containerId);
    this.setMargins();
    this.width = 0;
    this.height = 0;
    this.svg = null;
    this.tooltip = null;
    this.currentData = null;
    this.currentPlayerName = null;
    this.currentMetric = null;
    this.initialized = false;
    this.initialize();
  }

  setMargins() {
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

    this.margin = {
      top: 40,
      right: isMobile ? 10 : 20,
      bottom: isMobile ? 80 : 100,
      left: isMobile ? 30 : isTablet ? 35 : 40,
    };
  }

  initialize() {
    try {
      console.log('Initializing series chart...');

      this.svg = this.container
        .append('svg')
        .attr('preserveAspectRatio', 'xMidYMid meet');

      // Create tooltip as a div in the body instead of the container
      // This prevents clipping issues when the tooltip is near container edges
      this.tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('z-index', 1000);

      // Add resize event listener with debouncing
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.setMargins();
          this.resize();
        }, 250);
      });

      // Add tab change listener to handle visibility changes
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const tabId = tab.getAttribute('data-tab');
          if (tabId === 'series-chart') {
            // Give the DOM time to update visibility
            setTimeout(() => this.resize(), 100);
          }
        });
      });

      this.resize();
      this.initialized = true;
      console.log('Series chart initialization complete');
    } catch (error) {
      console.error('Error initializing series chart:', error);
    }
  }

  resize() {
    try {
      console.log('Resizing series chart...');

      // Check if container is visible
      const containerNode = this.container.node();
      if (!containerNode) {
        console.warn('Series chart container not found, skipping resize');
        return;
      }

      const containerRect = containerNode.getBoundingClientRect();

      // Check if container has width and height
      if (containerRect.width === 0 || containerRect.height === 0) {
        console.warn(
          'Series chart container has zero width or height, skipping resize'
        );
        return;
      }

      this.width = containerRect.width - this.margin.left - this.margin.right;

      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const baseHeight = isMobile ? 300 : isTablet ? 400 : 500;

      this.height = Math.min(
        containerRect.height - this.margin.top - this.margin.bottom,
        baseHeight
      );

      this.svg
        .attr(
          'viewBox',
          `0 0 ${this.width + this.margin.left + this.margin.right} ${
            this.height + this.margin.top + this.margin.bottom
          }`
        )
        .attr('width', '100%')
        .attr('height', '100%');

      console.log('Series chart resized:', {
        width: this.width,
        height: this.height,
      });

      // If we have current data, update the chart
      if (this.currentData && this.currentPlayerName && this.currentMetric) {
        console.log('Updating series chart after resize with existing data');
        this.update(
          this.currentData,
          this.currentPlayerName,
          this.currentMetric
        );
      }
    } catch (error) {
      console.error('Error resizing series chart:', error);
    }
  }

  formatDate(date) {
    return d3.timeFormat('%m/%d/%y')(date);
  }

  update(data, playerName, metric) {
    try {
      console.log(
        `Updating series chart for ${playerName} with metric ${metric}`
      );

      // Store current data for potential resize
      this.currentData = data;
      this.currentPlayerName = playerName;
      this.currentMetric = metric;

      // Check if container is visible
      const containerNode = this.container.node();
      if (!containerNode) {
        console.warn('Series chart container not found, skipping update');
        return;
      }

      const containerRect = containerNode.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) {
        console.warn('Series chart container not visible, skipping update');
        return;
      }

      // Check if we need to resize first
      if (this.width === 0 || this.height === 0) {
        this.resize();
      }

      let g = this.svg.select('g');
      const isFirstRender = g.empty();

      if (isFirstRender) {
        // Create new svg group for chart
        this.svg.selectAll('*').remove();
        this.svg
          .append('g')
          .attr(
            'transform',
            `translate(${this.margin.left},${this.margin.top})`
          );
        g = this.svg.select('g');
      }

      const x = d3.scaleBand().range([0, this.width]).padding(0.2); // Increased padding for better separation
      const y = d3.scaleLinear().range([this.height, 0]);

      // Sort chart data by date (oldest first)
      data.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      // Format dates for x-axis labels
      const formatDate = d3.timeFormat('%m/%d/%y');

      // Create x-axis labels with date, opponent name and game count
      const xLabels = data.map((d) => {
        const date = formatDate(new Date(d.startDate));
        return `${date}: ${d.opponent} (${d.gameCount})`;
      });

      x.domain(xLabels);
      const maxValue = d3.max(data, (d) => d[metric]);
      y.domain([0, Math.ceil(maxValue + 1)]);

      // Adjust font sizes based on screen width
      const fontSize = window.innerWidth < 768 ? 10 : 12;

      // X-axis update
      const xAxis = g.selectAll('.x-axis').data([null]);
      const xAxisEnter = xAxis
        .enter()
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${this.height})`);

      xAxis
        .merge(xAxisEnter)
        .transition()
        .duration(750)
        .attr('transform', `translate(0,${this.height})`)
        .call(d3.axisBottom(x));

      g.selectAll('.x-axis text')
        .style('text-anchor', 'end')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('font-size', `${fontSize}px`);

      // Y-axis update
      const yAxis = g.selectAll('.y-axis').data([null]);
      const yAxisEnter = yAxis.enter().append('g').attr('class', 'y-axis');

      yAxis
        .merge(yAxisEnter)
        .transition()
        .duration(750)
        .call(
          d3
            .axisLeft(y)
            .ticks(Math.ceil(maxValue + 1))
            .tickFormat(d3.format('d'))
        );

      g.selectAll('.y-axis text').style('font-size', `${fontSize}px`);

      // Update grid lines
      const gridLines = g.selectAll('.grid-lines').data([null]);
      const gridLinesEnter = gridLines
        .enter()
        .append('g')
        .attr('class', 'grid-lines');

      gridLines
        .merge(gridLinesEnter)
        .transition()
        .duration(750)
        .call(
          d3
            .axisLeft(y)
            .ticks(Math.ceil(maxValue + 1))
            .tickSize(-this.width)
            .tickFormat('')
        );

      g.selectAll('.grid-lines line')
        .style('stroke', 'rgba(255, 255, 255, 0.1)')
        .style('stroke-dasharray', '2,2');

      g.selectAll('.grid-lines path').style('display', 'none');

      // Animated bars
      const bars = g
        .selectAll('.bar')
        .data(data, (d, i) => `${d.opponent}-${i}`);

      bars
        .exit()
        .transition()
        .duration(500)
        .attr('y', this.height)
        .attr('height', 0)
        .remove();

      // Bottom -> top bars
      const newBars = bars
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d, i) => {
          const date = formatDate(new Date(d.startDate));
          return x(`${date}: ${d.opponent} (${d.gameCount})`);
        })
        .attr('width', x.bandwidth())
        .attr('y', this.height) // Bottom
        .attr('height', 0)
        .style('fill', (d) => (d.seriesResult ? '#4CAF50' : '#FF5252'));

      // Update all bars with animation
      bars
        .merge(newBars)
        .transition()
        .duration(750)
        .attr('x', (d, i) => {
          const date = formatDate(new Date(d.startDate));
          return x(`${date}: ${d.opponent} (${d.gameCount})`);
        })
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(d[metric]))
        .attr('height', (d) => this.height - y(d[metric]))
        .style('fill', (d) => (d.seriesResult ? '#4CAF50' : '#FF5252'));

      const labels = g
        .selectAll('.metric-label')
        .data(data, (d, i) => `${d.opponent}-${i}`);
      labels.exit().transition().duration(500).style('opacity', 0).remove();

      const newLabels = labels
        .enter()
        .append('text')
        .attr('class', 'metric-label')
        .attr('text-anchor', 'middle')
        .style('opacity', 0)
        .attr('x', (d, i) => {
          const date = formatDate(new Date(d.startDate));
          return (
            x(`${date}: ${d.opponent} (${d.gameCount})`) + x.bandwidth() / 2
          );
        })
        .attr('y', this.height);

      // Update metric labels with responsive font size
      labels
        .merge(newLabels)
        .transition()
        .duration(750)
        .attr('x', (d, i) => {
          const date = formatDate(new Date(d.startDate));
          return (
            x(`${date}: ${d.opponent} (${d.gameCount})`) + x.bandwidth() / 2
          );
        })
        .attr('y', (d) => y(d[metric]) - 5)
        .style('opacity', 1)
        .style('font-size', `${fontSize}px`)
        .text((d) => d[metric]);

      // Update title with responsive positioning
      const title = g.selectAll('.chart-title').data([null]);

      title
        .enter()
        .append('text')
        .attr('class', 'chart-title')
        .merge(title)
        .attr('x', this.width / 2)
        .attr('y', -this.margin.top / 2) // Position halfway up in the margin space
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle') // Vertically center the text
        .style('fill', '#fff')
        .style('font-size', window.innerWidth < 768 ? '14px' : '16px')
        .transition()
        .duration(750)
        .text(
          `${playerName}'s ${
            metric.charAt(0).toUpperCase() + metric.slice(1)
          } by Series`
        );

      // Tooltip positioning
      const self = this;

      // Remove existing overlays
      g.selectAll('.bar-overlay').remove();

      // Add new overlays
      g.selectAll('.bar-overlay')
        .data(data, (d, i) => `${d.opponent}-${i}`)
        .join('rect')
        .attr('class', 'bar-overlay')
        .attr('x', (d, i) => {
          const date = formatDate(new Date(d.startDate));
          return x(`${date}: ${d.opponent} (${d.gameCount})`);
        })
        .attr('width', x.bandwidth())
        .attr('y', 0)
        .attr('height', this.height)
        .style('fill', 'transparent')
        .style('pointer-events', 'all')
        .on('mouseover', function (event, d) {
          // Highlight the bar datapoints on hover
          d3.select(this)
            .transition()
            .duration(200)
            .style('fill', 'rgba(255, 255, 255, 0.1)');

          self.tooltip.transition().duration(200).style('opacity', 0.9);

          // Format date
          const startDate = new Date(d.startDate);
          const formattedDate = d3.timeFormat('%m/%d/%y')(startDate);

          // Create tooltip content
          let tooltipContent = `
            <div class="tooltip-header">${d.opponent}</div>
            <div class="tooltip-date">${formattedDate}</div>
            <div class="tooltip-series">${d.seriesType.toUpperCase()} (${
            d.wins
          }-${d.losses}) - ${d.gameCount} games</div>
            <div class="tooltip-stats">
              <div>Total ${metric}: ${d[metric]}</div>
              <div>Kills: ${d.kills}</div>
              <div>Deaths: ${d.deaths}</div>
              <div>Assists: ${d.assists}</div>
              <div>Avg KDA: ${d.avgKills.toFixed(1)}/${d.avgDeaths.toFixed(
            1
          )}/${d.avgAssists.toFixed(1)}</div>
              <div>Result: ${d.seriesResult ? 'Win' : 'Loss'}</div>
            </div>
          `;

          // Position tooltip to follow cursor
          self.tooltip
            .html(tooltipContent)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);
        })
        .on('mousemove', function (event) {
          // Update tooltip position as mouse moves
          self.tooltip
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);
        })
        .on('mouseout', function () {
          d3.select(this)
            .transition()
            .duration(200)
            .style('fill', 'transparent');
          self.tooltip.transition().duration(500).style('opacity', 0);
        });

      console.log('Series chart update complete');
    } catch (error) {
      console.error('Error updating series chart:', error);
    }
  }

  clear() {
    try {
      console.log('Clearing series chart');
      this.currentData = null;
      this.currentPlayerName = null;
      this.currentMetric = null;

      let g = this.svg.select('g');

      if (!g.empty()) {
        // Remove all elements immediately w/out animation
        g.selectAll('*').remove();
      }
    } catch (error) {
      console.error('Error clearing series chart:', error);
    }
  }
}
