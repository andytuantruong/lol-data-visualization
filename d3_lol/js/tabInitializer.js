document.addEventListener('DOMContentLoaded', async function () {
  try {
    console.log('DOM loaded, initializing application...');

    // Set up tab navigation first so UI is responsive
    setupTabNavigation();

    // Update loading message
    const loadingMessage = document.querySelector('.loading-message');
    if (loadingMessage) {
      loadingMessage.textContent = 'Loading Player Data...';
    }

    // Pre-load data needed by both tables
    console.log('Pre-loading CSV data...');
    const csvData = await DataLoader.fetchCSVData();

    console.log('Pre-loading hierarchical data...');
    const hierarchicalData = await DataLoader.loadHierarchicalData();

    const allPlayers = await DataLoader.loadPlayerList();
    console.log(`Found ${allPlayers.length} unique players in the dataset`);

    if (allPlayers.length === 0) {
      throw new Error('No player data found. Please check the data source.');
    }

    // Initialize the active tab first
    const activeTab = document.querySelector('.tab.active');
    const activeTabId = activeTab
      ? activeTab.getAttribute('data-tab')
      : 'recent-performance';

    console.log(`Active tab is: ${activeTabId}`);

    if (activeTabId === 'recent-performance') {
      // Initialize Performance Table first
      console.log('Initializing Performance Table...');
      const performanceTable = new PerformanceTable(
        '#performance-table-container'
      );
      await performanceTable.initialize();

      // Hide loading overlay once the first table is ready
      document.getElementById('loading-overlay').style.display = 'none';

      // Then initialize All Time Stats in the background
      console.log('Initializing All Time Stats in the background...');
      const allTimeStats = new AllTimeStats('#all-time-stats-container');
      allTimeStats.initialize().catch((error) => {
        console.error('Error initializing All Time Stats:', error);
      });
    } else {
      // Initialize All Time Stats first
      console.log('Initializing All Time Stats...');
      const allTimeStats = new AllTimeStats('#all-time-stats-container');
      await allTimeStats.initialize();

      // Hide loading overlay once the first table is ready
      document.getElementById('loading-overlay').style.display = 'none';

      // Then initialize Performance Table in the background
      console.log('Initializing Performance Table in the background...');
      const performanceTable = new PerformanceTable(
        '#performance-table-container'
      );
      performanceTable.initialize().catch((error) => {
        console.error('Error initializing Performance Table:', error);
      });
    }

    console.log('Application initialization complete');
  } catch (error) {
    // Handle initialization errors
    console.error('Error initializing application:', error);

    // Always hide the loading overlay on error
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
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

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach((t) => t.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}
