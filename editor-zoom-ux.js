/** Stable cursor-anchored pan/zoom for both small and very large ERDs. */
(() => {
  'use strict';

  const LARGE_SCHEMA_THRESHOLD = 80;
  const NORMAL_MIN_SCALE = 0.4;
  const LARGE_MIN_SCALE = 0.08;
  const MAX_SCALE = 2.5;
  const CONNECTION_IDLE_MS = 120;

  const workspace = document.getElementById('workspace');
  const canvas = document.getElementById('canvas-layer');
  const zoomText = document.getElementById('zoom-text');
  if (!workspace || !canvas) return;

  let refreshTimer = 0;

  function minScaleForCurrentView() {
    const tableCount = schemaData?.[currentView]?.tables?.length || 0;
    return tableCount >= LARGE_SCHEMA_THRESHOLD ? LARGE_MIN_SCALE : NORMAL_MIN_SCALE;
  }

  function renderTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    if (zoomText) zoomText.innerText = `${Math.round(scale * 100)}%`;
  }

  function scheduleConnectionRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      requestAnimationFrame(() => window.updateConnections?.());
    }, CONNECTION_IDLE_MS);
  }

  function zoomAt(factor, anchorX, anchorY) {
    const oldScale = Math.max(Number(scale) || 1, 0.0001);
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(minScaleForCurrentView(), oldScale * factor)
    );
    if (Math.abs(nextScale - oldScale) < 0.000001) return;

    const worldX = (anchorX - panX) / oldScale;
    const worldY = (anchorY - panY) / oldScale;

    scale = nextScale;
    panX = anchorX - worldX * nextScale;
    panY = anchorY - worldY * nextScale;

    renderTransform();
    scheduleConnectionRefresh();
  }

  // Existing pan handlers call applyTransform() on every mousemove. Replacing
  // it with a transform-only fast path avoids rebuilding every SVG relation.
  window.applyTransform = function() {
    renderTransform();
    scheduleConnectionRefresh();
  };

  // Toolbar +/- buttons zoom around the workspace center.
  window.zoomCanvas = function(factor, anchorX, anchorY) {
    const rect = workspace.getBoundingClientRect();
    const x = Number.isFinite(anchorX) ? anchorX : rect.width / 2;
    const y = Number.isFinite(anchorY) ? anchorY : rect.height / 2;
    zoomAt(factor, x, y);
  };

  // Capture wheel before the legacy bubble listener so the mouse position is
  // available as a stable zoom anchor.
  workspace.addEventListener('wheel', event => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const rect = workspace.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    zoomAt(factor, anchorX, anchorY);
  }, { capture: true, passive: false });

  window.ERDZoomUX = {
    zoomAt,
    minScaleForCurrentView,
    renderTransform,
    scheduleConnectionRefresh
  };
})();
