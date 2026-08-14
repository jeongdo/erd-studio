/** Prevent table drag release from being treated as an inspect click. */
(() => {
  'use strict';

  const DRAG_THRESHOLD_PX = 5;
  const CLICK_SUPPRESS_MS = 120;
  const originalStartDrag = window.startDragCard;
  let suppressTableClickUntil = 0;

  if (typeof originalStartDrag !== 'function') return;

  window.startDragCard = function(event, tableId) {
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    window.isDraggingCard = true;
    if (window.ERDEditor) window.ERDEditor.isDraggingCard = true;

    const trackMove = moveEvent => {
      window.isDraggingCard = true;
      if (window.ERDEditor) window.ERDEditor.isDraggingCard = true;
      if (moved) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) moved = true;
    };

    const finishDrag = () => {
      window.removeEventListener('mousemove', trackMove, true);
      window.removeEventListener('mouseup', finishDrag, true);
      window.isDraggingCard = false;
      if (window.ERDEditor) window.ERDEditor.isDraggingCard = false;
      if (moved) {
        suppressTableClickUntil = performance.now() + CLICK_SUPPRESS_MS;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => window.updateConnections?.());
        } else {
          window.updateConnections?.();
        }
      }
    };

    window.addEventListener('mousemove', trackMove, true);
    window.addEventListener('mouseup', finishDrag, true);
    return originalStartDrag.call(this, event, tableId);
  };

  // Capture at window level so legacy/card click handlers never see the
  // synthetic click that browsers dispatch immediately after a drag mouseup.
  window.addEventListener('click', event => {
    if (performance.now() > suppressTableClickUntil) return;
    if (!event.target.closest?.('.table-card')) return;
    suppressTableClickUntil = 0;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
})();
