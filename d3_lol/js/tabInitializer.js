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
 * Restores the active tab from localStorage
 */
function restoreActiveTab() {
  // First check if there's a saved tab
  const savedTabId = localStorage.getItem('activeTab');

  if (savedTabId) {
    const savedTab = document.querySelector(`.tab[data-tab="${savedTabId}"]`);
    if (savedTab) {
      // Remove active class from all tabs and contents
      const tabs = document.querySelectorAll('.tab');
      const tabContents = document.querySelectorAll('.tab-content');

      tabs.forEach((t) => t.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      // Activate the saved tab
      savedTab.classList.add('active');
      const tabContent = document.getElementById(savedTabId);
      if (tabContent) {
        tabContent.classList.add('active');
      }

      console.log(`Restored active tab: ${savedTabId}`);
      return;
    }
  }

  // If no saved tab or saved tab not found, default to Recent Performance
  const defaultTab = document.querySelector(
    '.tab[data-tab="recent-performance"]'
  );
  if (defaultTab) {
    // Remove active class from all tabs and contents
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((c) => c.classList.remove('active'));

    // Activate the default tab
    defaultTab.classList.add('active');
    const tabContent = document.getElementById('recent-performance');
    if (tabContent) {
      tabContent.classList.add('active');
    }

    // Save this as the active tab
    localStorage.setItem('activeTab', 'recent-performance');
    console.log('No saved tab found, defaulted to Recent Performance');
  }
}

/**
 * Sets up tab navigation and ensures the active tab content is visible
 */
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Make sure the active tab content is visible
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    const tabId = activeTab.getAttribute('data-tab');
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
      tabContent.classList.add('active');
    }
  }

  // Remove existing event listeners
  tabs.forEach((tab) => {
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);
  });

  // Add new event listeners
  const newTabs = document.querySelectorAll('.tab');
  newTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      newTabs.forEach((t) => t.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      const tabContent = document.getElementById(tabId);
      if (tabContent) {
        tabContent.classList.add('active');
      }

      // Save the active tab to localStorage
      localStorage.setItem('activeTab', tabId);
      console.log(`Saved active tab: ${tabId}`);

      // Reposition sliders in the newly active tab
      setTimeout(() => {
        positionSliders(tabId);
      }, 50);

      // If switching to player chart tab, ensure chart is properly sized and stats are updated
      if (tabId === 'player-chart' && window.chartManagerInstance) {
        setTimeout(() => {
          if (
            window.chartManagerInstance.chart &&
            window.chartManagerInstance.chart.resize
          ) {
            window.chartManagerInstance.chart.resize();
          }

          // If a player is already selected, update the chart and stats
          if (window.chartManagerInstance.currentPlayer) {
            window.chartManagerInstance.updateChart();

            // Ensure stats are updated even if chart data is cached
            const playerName = window.chartManagerInstance.currentPlayer;
            const metric = window.chartManagerInstance.currentMetric;

            if (playerName) {
              console.log(
                `Updating stats for ${playerName} with metric ${metric}`
              );

              // Reload player data to ensure fresh stats calculation
              DataLoader.loadPlayerData(playerName)
                .then((playerData) => {
                  if (playerData && playerData.length > 0) {
                    window.chartManagerInstance.updateStats(playerData);
                  }
                })
                .catch((error) => {
                  console.error('Error updating stats on tab change:', error);
                });
            }
          }

          // Reposition slider in the player chart tab
          if (window.chartManagerInstance.positionSlider) {
            window.chartManagerInstance.positionSlider();
          }
        }, 100);
      }
    });
  });
}

/**
 * Initialize sliders for all segmented controls on page load
 */
function initializeSliders() {
  try {
    const segmentedControls = document.querySelectorAll('.segmented-control');

    segmentedControls.forEach((control) => {
      const activeSegment = control.querySelector('.segment.active');
      const slider = control.querySelector('.slider');

      if (activeSegment && slider) {
        // Set initial slider position and width
        const rect = activeSegment.getBoundingClientRect();
        const parentRect = control.getBoundingClientRect();

        slider.style.width = rect.width + 'px';
        slider.style.left = rect.left - parentRect.left + 'px';
      }
    });

    console.log('All sliders initialized successfully');
  } catch (error) {
    console.error('Error initializing sliders:', error);
  }
}

/**
 * Position sliders in a specific tab or all tabs
 */
function positionSliders(tabId = null) {
  try {
    let containers = [];

    if (tabId) {
      // Position sliders in the specified tab
      const tabContent = document.getElementById(tabId);
      if (tabContent) {
        containers = [tabContent];
      }
    } else {
      // Position sliders in all active tab contents
      containers = document.querySelectorAll('.tab-content.active');
    }

    containers.forEach((container) => {
      const segmentedControls =
        container.querySelectorAll('.segmented-control');

      segmentedControls.forEach((control) => {
        const activeSegment = control.querySelector('.segment.active');
        if (activeSegment) {
          // Make sure only one segment is active
          control.querySelectorAll('.segment').forEach((segment) => {
            if (segment !== activeSegment) {
              segment.classList.remove('active');
            }
          });
          activeSegment.classList.add('active');
        }
      });
    });

    console.log(`Segments updated for ${tabId || 'all active tabs'}`);
  } catch (error) {
    console.error('Error updating segments:', error);
  }
}

/**
 * Sets up player link handlers to switch to chart tab when clicked
 */
function setupPlayerLinkHandlers() {
  document.addEventListener('click', (event) => {
    // Check if the clicked element is a player link
    if (event.target && event.target.classList.contains('player-link')) {
      event.preventDefault();

      const playerName = event.target.getAttribute('data-player');
      const metric = event.target.getAttribute('data-metric') || 'kills';

      if (!playerName) {
        console.warn('Player link clicked but no player attribute found');
        return;
      }

      console.log(`Player link clicked: ${playerName}, metric: ${metric}`);

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

            // Switch to player chart tab
            const playerChartTab = document.querySelector(
              '.tab[data-tab="player-chart"]'
            );
            if (playerChartTab) {
              playerChartTab.click();
            }

            // Update chart if chart manager is available
            if (window.chartManagerInstance) {
              // Give the DOM time to update
              setTimeout(() => {
                window.chartManagerInstance.selectPlayer(
                  playerName,
                  team,
                  league,
                  metric
                );

                // Reposition slider after player selection
                if (window.chartManagerInstance.positionSlider) {
                  window.chartManagerInstance.positionSlider();
                } else {
                  positionSliders('player-chart');
                }
              }, 200);
            } else {
              console.error('ChartManager instance not available');
            }
          } else {
            console.error('Could not load player data:', playerName);
          }
        })
        .catch((error) => {
          console.error('Error loading player data:', error);
        });
    }
  });
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
