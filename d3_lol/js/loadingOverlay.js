const LoadingManager = {
  overlay: null,
  message: null,
  timeoutId: null,
  maxWaitTime: 10000, // 10 seconds max wait time

  init() {
    this.overlay = document.getElementById('loading-overlay');
    this.message = document.querySelector('.loading-message');

    if (!this.overlay) {
      console.warn('Loading overlay element not found');
      return;
    }

    if (!this.message) {
      console.warn('Loading message element not found');
    }

    // Add escape key handler to hide overlay in case it gets stuck
    document.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        this.overlay &&
        this.overlay.style.display !== 'none'
      ) {
        console.log('Loading overlay closed with ESC key');
        this.hide();
      }
    });

    // Set a fallback timeout to hide the overlay if it gets stuck
    this.timeoutId = setTimeout(() => {
      if (this.overlay && this.overlay.style.display !== 'none') {
        console.warn('Loading overlay timed out after', this.maxWaitTime, 'ms');
        this.hide();
      }
    }, this.maxWaitTime);
  },

  show(msg = 'Loading...') {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      if (this.message) {
        this.message.textContent = msg;
      }
    }

    // Reset timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Set new timeout
    this.timeoutId = setTimeout(() => {
      if (this.overlay && this.overlay.style.display !== 'none') {
        console.warn('Loading overlay timed out after', this.maxWaitTime, 'ms');
        this.hide();
      }
    }, this.maxWaitTime);
  },

  hide() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  },

  updateMessage(msg) {
    if (this.message) {
      this.message.textContent = msg;
    }
  },
};

// Initialize the loading manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  LoadingManager.init();
});

// Ensure the loading overlay is hidden when the page is fully loaded
window.addEventListener('load', () => {
  // Give a small delay to ensure all resources are loaded
  setTimeout(() => {
    LoadingManager.hide();
  }, 500);
});
