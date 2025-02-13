class MetricsChart {
  constructor(containerId) {
    this.container = d3.select(containerId);
    this.margin = {
      top: 40,
      right: 20,
      bottom: 100,
      left: 40,
    };
    this.width = 0;
    this.height = 0;
    this.svg = null;
    this.tooltip = null;
    this.initialize();
  }

  initialize() {
    this.svg = this.container.append('svg');
    this.tooltip = this.container
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
      if (this.currentData && this.currentPlayerName) {
        this.update(this.currentData, this.currentPlayerName);
      }
    });
  }

  resize() {
    const containerRect = this.container.node().getBoundingClientRect();
    this.width = containerRect.width - this.margin.left - this.margin.right;
    this.height = Math.min(
      containerRect.height - this.margin.top - this.margin.bottom,
      window.innerWidth < 768 ? 300 : 500
    );

    this.svg
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom);
  }

  formatDate(date) {
    return d3.timeFormat('%m/%d/%y')(date);
  }

  getGameNumber(date, data) {
    const currentDate = this.formatDate(date);
    const gamesOnSameDay = data.filter(
      (d) => this.formatDate(d.date) === currentDate
    );
    const index = gamesOnSameDay.findIndex(
      (d) => d.date.getTime() === date.getTime()
    );
    return gamesOnSameDay.length > 1 ? ` (${index + 1})` : '';
  }

  update(data, playerName, metric) {
    this.currentData = data;
    this.currentPlayerName = playerName;
    this.currentMetric = metric;

    this.svg.selectAll('*').remove();

    const g = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    const x = d3.scaleBand().range([0, this.width]).padding(0.1);
    const y = d3.scaleLinear().range([this.height, 0]);

    // Sort data by date and time
    data.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Set domains
    x.domain(
      data.map(
        (d) => this.formatDate(d.date) + this.getGameNumber(d.date, data)
      )
    );
    const maxValue = d3.max(data, (d) => d[metric]);
    y.domain([0, maxValue + Math.max(3, maxValue * 0.2)]);

    // Add horizontal grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(y.ticks(Math.min(maxValue + 1, 10)))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', this.width)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .style('stroke', 'rgba(255, 255, 255, 0.3)')
      .style('stroke-dasharray', '3,3');

    const xAxis = g
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height})`);

    xAxis.call(d3.axisBottom(x));

    xAxis
      .selectAll('text')
      .style('text-anchor', 'middle')
      .style('font-size', window.innerWidth < 768 ? '10px' : '12px')
      .style('fill', '#fff');

    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).ticks(Math.min(maxValue + 1, 10)));

    // Update bar positions
    const bars = g
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) =>
        x(this.formatDate(d.date) + this.getGameNumber(d.date, data))
      )
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d[metric]))
      .attr('height', (d) => this.height - y(d[metric]))
      .style('fill', (d) => (d.result ? '#4CAF50' : '#FF5252'));

    // Update kill label above bar datapoints
    g.selectAll('.metric-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'metric-label')
      .attr(
        'x',
        (d) =>
          x(this.formatDate(d.date) + this.getGameNumber(d.date, data)) +
          x.bandwidth() / 2
      )
      .attr('y', (d) => y(d[metric]) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#fff')
      .text((d) => d[metric]);

    // Update tooltip
    const tooltip = this.tooltip;
    const containerRect = this.container.node().getBoundingClientRect();
    const self = this;

    bars
      .on('mouseover', function (event, d) {
        const bar = d3.select(this);
        const barX = parseFloat(bar.attr('x'));
        const barY = parseFloat(bar.attr('y'));

        const tooltipX = containerRect.left + barX + x.bandwidth() / 2;
        const tooltipY = containerRect.top + barY;

        tooltip.transition().duration(200).style('opacity', 0.9);

        tooltip
          .html(
            `Date: ${self.formatDate(d.date)}${self.getGameNumber(
              d.date,
              data
            )}<br/>
             Champion: ${d.champion}<br/>
             Kills: ${d.kills}<br/>
             Deaths: ${d.deaths}<br/>
             Assists: ${d.assists}<br/>
             Team: ${d.teamname}<br/>
             Result: ${d.result ? 'Win' : 'Loss'}`
          )
          .style('left', `${tooltipX}px`)
          .style('top', `${tooltipY - 10}px`)
          .style('transform', 'translate(-50%, -100%)');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Update overlay rectangles
    g.selectAll('.bar-overlay')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar-overlay')
      .attr('x', (d) =>
        x(this.formatDate(d.date) + this.getGameNumber(d.date, data))
      )
      .attr('width', x.bandwidth())
      .attr('y', 0)
      .attr('height', this.height)
      .style('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('mouseover', function (event, d) {
        const barX = parseFloat(d3.select(this).attr('x'));
        const tooltipX = containerRect.left + barX + x.bandwidth() / 2;
        const tooltipY = containerRect.top + y(d[metric]);

        tooltip.transition().duration(200).style('opacity', 0.9);

        tooltip
          .html(
            `Date: ${self.formatDate(d.date)}${self.getGameNumber(
              d.date,
              data
            )}<br/>
             Champion: ${d.champion}<br/>
             Opponent: ${d.opponent}<br/>
             Kills: ${d.kills}<br/>
             Deaths: ${d.deaths}<br/>
             Assists: ${d.assists}<br/>
             Team: ${d.teamname}<br/>
             Result: ${d.result ? 'Win' : 'Loss'}`
          )
          .style('left', `${tooltipX}px`)
          .style('top', `${tooltipY - 10}px`)
          .style('transform', 'translate(-50%, -100%)');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Update title
    g.append('text')
      .attr('x', this.width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .style('font-size', '16px')
      .text(
        `${playerName}'s ${
          metric.charAt(0).toUpperCase() + metric.slice(1)
        } by Match`
      );
  }
}
