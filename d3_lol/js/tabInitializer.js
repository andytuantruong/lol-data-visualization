document.addEventListener('DOMContentLoaded', async function () {
  try {
    console.log('DOM loaded, initializing application...');

    // Set up tab navigation first so UI is responsive
    setupTabNavigation();

    // Initialize sliders for all segmented controls
    initializeSliders();

    // Show loading overlay
    if (LoadingManager && typeof LoadingManager.show === 'function') {
      LoadingManager.show('Loading Esports data...');
    }

    // Check if ChartManager is defined
    if (typeof ChartManager === 'undefined') {
      console.error(
        'ChartManager class is not defined. Make sure main.js is loaded properly.'
      );
      throw new Error(
        'ChartManager is not defined. Please check that main.js is loaded correctly.'
      );
    }

    // Pre-load data needed by all components
    console.log('Pre-loading CSV data...');
    const csvData = await DataLoader.fetchCSVData();

    console.log('Pre-loading hierarchical data...');
    const hierarchicalData = await DataLoader.loadHierarchicalData();

    const allPlayers = await DataLoader.loadPlayerList();
    console.log(`Found ${allPlayers.length} unique players in the dataset`);

    if (allPlayers.length === 0) {
      throw new Error('No player data found. Please check the data source.');
    }

    // Load all player data at once to improve performance
    console.log('Pre-loading all player data...');
    if (LoadingManager) {
      LoadingManager.updateMessage(
        'Loading all player data (this may take a moment)...'
      );
    }

    // Pre-load the data but don't wait for it to finish processing
    DataLoader.loadAllPlayersData().catch((error) => {
      console.error('Error loading all player data:', error);
    });

    // Hide loading overlay now - the table will show its own loading animation
    if (LoadingManager && typeof LoadingManager.hide === 'function') {
      LoadingManager.hide();
    }

    // Clear player selection data on page refresh to reset the player chart
    localStorage.removeItem('selectedPlayer');
    localStorage.removeItem('selectedLeague');
    localStorage.removeItem('selectedTeam');
    localStorage.removeItem('selectedMetric');

    // Restore the active tab from localStorage if available
    restoreActiveTab();

    // Initialize the active tab first
    const activeTab = document.querySelector('.tab.active');
    const activeTabId = activeTab
      ? activeTab.getAttribute('data-tab')
      : 'recent-performance';

    console.log(`Active tab is: ${activeTabId}`);

    // Initialize components sequentially to avoid race conditions
    console.log('Initializing components...');

    // Initialize Chart Manager first to ensure it's available for other components
    console.log('Initializing Chart Manager...');
    if (!window.chartManagerInstance) {
      window.chartManagerInstance = new ChartManager();
      await window.chartManagerInstance.initialize().catch((error) => {
        console.error('Error initializing Chart Manager:', error);
      });
    }

    console.log('Initializing Series Chart Manager...');
    try {
      // Create a new instance if one doesn't exist
      if (!window.seriesChartManagerInstance) {
        window.seriesChartManagerInstance = new SeriesChartManager();
      }

      // Initialize the instance
      await window.seriesChartManagerInstance.initialize();
      console.log('Series Chart Manager initialized successfully');
    } catch (error) {
      console.error('Error initializing Series Chart Manager:', error);
      // Create a new instance as a fallback
      window.seriesChartManagerInstance = new SeriesChartManager();
      await window.seriesChartManagerInstance
        .initialize()
        .catch((innerError) => {
          console.error(
            'Error initializing fallback Series Chart Manager:',
            innerError
          );
        });
    }

    // Initialize Performance Table
    console.log('Initializing Performance Table...');
    const performanceTable = new PerformanceTable(
      '#performance-table-container'
    );
    await performanceTable.initialize().catch((error) => {
      console.error('Error initializing Performance Table:', error);
    });

    // Initialize All Time Stats
    console.log('Initializing All Time Stats...');
    const allTimeStats = new AllTimeStats('#all-time-stats-container');
    await allTimeStats.initialize().catch((error) => {
      console.error('Error initializing All Time Stats:', error);
    });

    // Set up player link handlers
    setupPlayerLinkHandlers();

    // Clear the player chart on page refresh
    if (window.chartManagerInstance && window.chartManagerInstance.resetChart) {
      window.chartManagerInstance.resetChart();
    }

    // Clear the series chart on page refresh
    if (
      window.seriesChartManagerInstance &&
      window.seriesChartManagerInstance.reset
    ) {
      window.seriesChartManagerInstance.reset();
    }

    console.log('Application initialization complete');
  } catch (error) {
    // Handle initialization errors
    console.error('Error initializing application:', error);

    // Always hide the loading overlay on error
    if (LoadingManager && typeof LoadingManager.hide === 'function') {
      LoadingManager.hide();
    } else {
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
      }
    }

    // Display error message
    const container = document.querySelector('.container');
    if (container) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'data-error';
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `<h3>Error</h3><p>Error initializing application: ${error.message}</p>`;
      container.appendChild(errorDiv);
    }
  }
});

/**
 * Restore the active tab from localStorage
 */
function restoreActiveTab() {
  try {
    const activeTab = localStorage.getItem('activeTab');
    if (activeTab) {
      const tabElement = document.querySelector(
        `.tab[data-tab="${activeTab}"]`
      );
      if (tabElement) {
        tabElement.click();
      }
    }
  } catch (error) {
    console.error('Error restoring active tab:', error);
  }
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
  try {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        // Get the tab ID
        const tabId = tab.getAttribute('data-tab');

        // Remove active class from all tabs and contents
        tabs.forEach((t) => t.classList.remove('active'));
        tabContents.forEach((content) => content.classList.remove('active'));

        // Add active class to current tab and content
        tab.classList.add('active');
        const content = document.getElementById(tabId);
        if (content) {
          content.classList.add('active');
        }

        // Store active tab in localStorage
        localStorage.setItem('activeTab', tabId);

        // Position sliders for the active tab
        setTimeout(() => {
          positionSliders(tabId);
        }, 100);

        // Special handling for player chart tab
        if (tabId === 'player-chart' && window.chartManagerInstance) {
          // Resize chart when tab becomes active
          setTimeout(() => {
            if (window.chartManagerInstance.chart) {
              window.chartManagerInstance.chart.resize();
            }
          }, 100);
        }

        // Special handling for series chart tab
        if (tabId === 'series-chart') {
          // Ensure SeriesChartManager is initialized
          if (window.seriesChartManagerInstance) {
            // Resize chart when tab becomes active
            setTimeout(() => {
              if (window.seriesChartManagerInstance.chart) {
                window.seriesChartManagerInstance.chart.resize();
              }

              // Position sliders for series chart
              const metricControl = document.querySelector(
                '#series-chart .segmented-control'
              );
              const seriesTypeControl = document.querySelector(
                '.series-type-control'
              );

              if (metricControl) {
                positionSliders('#series-chart');
              }
            }, 100);
          } else {
            console.warn('SeriesChartManager instance not found');
          }
        }
      });
    });

    console.log('Tab navigation setup complete');
  } catch (error) {
    console.error('Error setting up tab navigation:', error);
  }
}

/**
 * Initialize sliders for all segmented controls
 */
function initializeSliders() {
  try {
    const segmentedControls = document.querySelectorAll('.segmented-control');

    segmentedControls.forEach((control) => {
      const segments = control.querySelectorAll('.segment');
      const slider = control.querySelector('.slider');

      if (segments.length > 0 && slider) {
        // Find active segment
        let activeSegment = control.querySelector('.segment.active');

        // If no active segment, set first one as active
        if (!activeSegment && segments.length > 0) {
          segments[0].classList.add('active');
          activeSegment = segments[0];
        }

        // Position slider based on active segment
        if (activeSegment) {
          slider.style.width = `${activeSegment.offsetWidth}px`;
          slider.style.left = `${activeSegment.offsetLeft}px`;
        }
      }
    });

    console.log('Sliders initialized');
  } catch (error) {
    console.error('Error initializing sliders:', error);
  }
}

/**
 * Position sliders for segmented controls
 * @param {string} tabId - Optional tab ID to position sliders for a specific tab
 */
function positionSliders(tabId = null) {
  try {
    // If tabId is provided, only position sliders in that tab
    // Otherwise, position sliders in all active tabs
    const containers = tabId
      ? [document.getElementById(tabId)]
      : document.querySelectorAll('.tab-content.active');

    containers.forEach((container) => {
      if (!container) return;

      const segmentedControls =
        container.querySelectorAll('.segmented-control');

      segmentedControls.forEach((control) => {
        const activeSegment = control.querySelector('.segment.active');
        const slider = control.querySelector('.slider');

        if (activeSegment && slider) {
          slider.style.width = `${activeSegment.offsetWidth}px`;
          slider.style.left = `${activeSegment.offsetLeft}px`;
        }
      });
    });

    console.log(`Updated segments for ${tabId || 'all active tabs'}`);

    // Special handling for series chart
    if (
      (tabId === 'series-chart' || !tabId) &&
      document.getElementById('series-chart').classList.contains('active')
    ) {
      if (window.seriesChartManagerInstance) {
        // Position sliders for series chart
        window.seriesChartManagerInstance.positionSlider(
          '.series-metric-control'
        );
        window.seriesChartManagerInstance.positionSlider(
          '.series-type-control'
        );
      }
    }
  } catch (error) {
    console.error('Error positioning sliders:', error);
  }
}

/**
 * Setup handlers for player links
 */
function setupPlayerLinkHandlers() {
  try {
    // Add click handler for player links
    document.addEventListener('click', (event) => {
      // Check if the clicked element is a player link
      if (event.target.classList.contains('player-link')) {
        event.preventDefault();

        const playerName = event.target.getAttribute('data-player');
        const metric = event.target.getAttribute('data-metric') || 'kills';
        const targetTab =
          event.target.getAttribute('data-target-tab') || 'player-chart';

        if (!playerName) {
          console.warn('Player link clicked but no player attribute found');
          return;
        }

        console.log(
          `Player link clicked: ${playerName}, metric: ${metric}, target tab: ${targetTab}`
        );

        // Find player data from DataLoader directly
        DataLoader.loadPlayerData(playerName)
          .then((playerData) => {
            if (playerData && playerData.length > 0) {
              const sampleGame = playerData[0];
              const league = sampleGame.league;
              const team = sampleGame.teamname;

              // Store selected values
              localStorage.setItem('selectedLeague', league);
              localStorage.setItem('selectedTeam', team);
              localStorage.setItem('selectedPlayer', playerName);
              localStorage.setItem('selectedMetric', metric);

              // Switch to target tab
              const targetTabElement = document.querySelector(
                `.tab[data-tab="${targetTab}"]`
              );
              if (targetTabElement) {
                targetTabElement.click();
              }

              // Update chart based on target tab
              if (targetTab === 'player-chart' && window.chartManagerInstance) {
                // Give the DOM time to update
                setTimeout(() => {
                  window.chartManagerInstance.selectPlayer(
                    playerName,
                    team,
                    league,
                    metric
                  );
                }, 100);
              } else if (
                targetTab === 'series-chart' &&
                window.seriesChartManagerInstance
              ) {
                // Handle series chart selection
                setTimeout(() => {
                  // Set league dropdown
                  if (window.seriesChartManagerInstance.leagueDropdown) {
                    window.seriesChartManagerInstance.leagueDropdown.value =
                      league;
                    window.seriesChartManagerInstance.currentLeague = league;
                    window.seriesChartManagerInstance.populateTeamDropdown();

                    // Set team dropdown after a short delay to ensure teams are populated
                    setTimeout(() => {
                      if (window.seriesChartManagerInstance.teamDropdown) {
                        window.seriesChartManagerInstance.teamDropdown.value =
                          team;
                        window.seriesChartManagerInstance.currentTeam = team;
                        window.seriesChartManagerInstance.populatePlayerDropdown();

                        // Set player dropdown after a short delay to ensure players are populated
                        setTimeout(() => {
                          if (
                            window.seriesChartManagerInstance.playerDropdown
                          ) {
                            window.seriesChartManagerInstance.playerDropdown.value =
                              playerName;
                            window.seriesChartManagerInstance.currentPlayer =
                              playerName;

                            // Set metric if applicable
                            const metricSegments = document.querySelectorAll(
                              '.series-metric-control .segment'
                            );
                            metricSegments.forEach((segment) => {
                              if (
                                segment.getAttribute('data-value') === metric
                              ) {
                                segment.click();
                              }
                            });

                            // Update chart
                            window.seriesChartManagerInstance.updateChart();
                          }
                        }, 100);
                      }
                    }, 100);
                  }
                }, 200);
              }
            } else {
              console.error('Could not load player data for:', playerName);
            }
          })
          .catch((error) => {
            console.error('Error loading player data:', error);
          });
      }
    });

    console.log('Player link handlers set up');
  } catch (error) {
    console.error('Error setting up player link handlers:', error);
  }
}

// Add window resize event listener to reposition sliders
window.addEventListener('resize', () => {
  // Debounce the resize event to avoid excessive calculations
  if (window.resizeTimeout) {
    clearTimeout(window.resizeTimeout);
  }

  window.resizeTimeout = setTimeout(() => {
    console.log('Window resized, repositioning sliders');

    // Reposition all sliders
    positionSliders();

    // If ChartManager is available, use its method too
    if (
      window.chartManagerInstance &&
      window.chartManagerInstance.positionSlider
    ) {
      window.chartManagerInstance.positionSlider();
    }
  }, 100);
});

// Ensure sliders are positioned after a short delay when the page loads
setTimeout(() => {
  positionSliders();
}, 300);
