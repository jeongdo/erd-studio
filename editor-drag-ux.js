/** Keep table drag and Inspector clicks from interfering with each other. */
(() => {
  'use strict';

  const DRAG_THRESHOLD_PX = 5;
  const CLICK_SUPPRESS_MS = 120;
  const originalStartDrag = window.startDragCard;
  const originalSelectTable = window.selectTable;
  let suppressTableClickUntil = 0;

  if (typeof originalStartDrag === 'function') {
    window.startDragCard = function(event, tableId) {
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;

      const trackMove = moveEvent => {
        if (moved) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) moved = true;
      };

      const finishDrag = () => {
        window.removeEventListener('mousemove', trackMove, true);
        window.removeEventListener('mouseup', finishDrag, true);
        if (moved) suppressTableClickUntil = performance.now() + CLICK_SUPPRESS_MS;
      };

      window.addEventListener('mousemove', trackMove, true);
      window.addEventListener('mouseup', finishDrag, true);
      return originalStartDrag.call(this, event, tableId);
    };
  }

  if (typeof originalSelectTable === 'function') {
    window.selectTable = function(table) {
      const tableId = table?.id || table?.name;
      const card = tableId ? document.getElementById(`card-${tableId}`) : null;
      const inspector = document.getElementById('inspector');
      const shouldClose = !!card?.classList.contains('selected') && !!inspector?.classList.contains('open');

      const result = originalSelectTable.call(this, table);
      if (shouldClose) inspector?.classList.remove('open');
      return result;
    };
  }

  window.addEventListener('click', event => {
    if (performance.now() > suppressTableClickUntil) return;
    if (!event.target.closest?.('.table-card')) return;
    suppressTableClickUntil = 0;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
})();
