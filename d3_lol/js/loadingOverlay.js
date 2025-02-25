window.addEventListener('load', function () {
  setTimeout(function () {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
      loadingOverlay.style.display = 'none';
    }
  }, 5000);
});
