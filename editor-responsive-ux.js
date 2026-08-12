/** Keep the same ERD world point centered when the browser viewport changes. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  if (!E || typeof window.applyTransform !== 'function') return;

  let previous = null;
  let resizeFrame = 0;
  let settleTimer = 0;

  function visibleSize() {
    const dock = document.getElementById('erd-project-dock');
    const inspector = document.getElementById('inspector');
    const dockHeight = dock
      ? Math.min(Math.max(0, workspace.clientHeight - 1), dock.getBoundingClientRect().height || 0)
      : 0;
    const inspectorWidth = inspector?.classList.contains('open')
      ? Math.min(Math.max(0, workspace.clientWidth - 1), inspector.getBoundingClientRect().width || 0)
      : 0;

    return {
      width: Math.max(1, workspace.clientWidth - inspectorWidth),
      height: Math.max(1, workspace.clientHeight - dockHeight)
    };
  }

  function syncTracker() {
    previous = visibleSize();
  }

  function syncAfterUiTransition() {
    requestAnimationFrame(syncTracker);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(syncTracker, 340);
  }

  function preserveViewportCenter() {
    const before = previous || visibleSize();
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const after = visibleSize();
      const widthChanged = Math.abs(after.width - before.width) > 0.5;
      const heightChanged = Math.abs(after.height - before.height) > 0.5;
      if (!widthChanged && !heightChanged) {
        previous = after;
        return;
      }

      const safeScale = Math.max(0.0001, scale || 1);
      const worldCenterX = (before.width / 2 - panX) / safeScale;
      const worldCenterY = (before.height / 2 - panY) / safeScale;

      panX = after.width / 2 - worldCenterX * safeScale;
      panY = after.height / 2 - worldCenterY * safeScale;
      previous = after;

      applyTransform();
      requestAnimationFrame(() => E.updateMinimap?.());
    });
  }

  window.addEventListener('resize', preserveViewportCenter, { passive: true });
  window.visualViewport?.addEventListener('resize', preserveViewportCenter, { passive: true });

  // Dock/inspector change the usable viewport without changing workspace size.
  // Update the baseline after their animation so the next browser resize starts
  // from the actual visible area instead of a stale measurement.
  document.addEventListener('click', event => {
    if (event.target.closest('[data-dock-toggle]') || event.target.closest('[onclick*="toggleInspector"]')) {
      syncAfterUiTransition();
    }
  }, true);

  requestAnimationFrame(syncTracker);
})();
