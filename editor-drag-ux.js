/** Drag UX: suppress drag-clicks and use local spatial collision checks for large ERDs. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const DRAG_THRESHOLD_PX = 5;
  const CLICK_SUPPRESS_MS = 120;
  const LARGE_SCHEMA_THRESHOLD = 80;
  const SPATIAL_CELL = 520;
  const CARD_WIDTH = 360;
  const HEADER_HEIGHT = 60;
  const COLUMN_HEIGHT = 34;
  const MIN_GAP = 60;
  const MAX_LOCAL_ITERATIONS = 2;
  const originalStartDrag = window.startDragCard;
  let suppressTableClickUntil = 0;

  if (!E || typeof originalStartDrag !== 'function') return;

  function tableId(table) {
    return E.tableId?.(table) || table?.id || table?.name || '';
  }

  function tableHeight(table) {
    return HEADER_HEIGHT + (table?.columns?.length || 0) * COLUMN_HEIGHT;
  }

  function tableRect(table, gap = 0) {
    const x = Number(table?.x) || 0;
    const y = Number(table?.y) || 0;
    return {
      left: x - gap,
      top: y - gap,
      right: x + CARD_WIDTH + gap,
      bottom: y + tableHeight(table) + gap
    };
  }

  function cellKeys(rect) {
    const minX = Math.floor(rect.left / SPATIAL_CELL);
    const maxX = Math.floor(rect.right / SPATIAL_CELL);
    const minY = Math.floor(rect.top / SPATIAL_CELL);
    const maxY = Math.floor(rect.bottom / SPATIAL_CELL);
    const keys = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }

  function createSpatialIndex(tables = [], excludedId = '') {
    const buckets = new Map();
    const memberships = new Map();

    function insert(table) {
      const id = tableId(table);
      if (!id || id === excludedId) return;
      const keys = cellKeys(tableRect(table, MIN_GAP));
      memberships.set(id, keys);
      keys.forEach(key => {
        if (!buckets.has(key)) buckets.set(key, new Set());
        buckets.get(key).add(table);
      });
    }

    function remove(table) {
      const id = tableId(table);
      const keys = memberships.get(id) || [];
      keys.forEach(key => {
        const bucket = buckets.get(key);
        bucket?.delete(table);
        if (bucket?.size === 0) buckets.delete(key);
      });
      memberships.delete(id);
    }

    function update(table) {
      remove(table);
      insert(table);
    }

    function query(rect) {
      const found = new Set();
      cellKeys(rect).forEach(key => {
        buckets.get(key)?.forEach(table => found.add(table));
      });
      return [...found];
    }

    tables.forEach(insert);
    return { buckets, memberships, insert, remove, update, query };
  }

  function resolveLocalCollisions(dragged, index) {
    const touched = new Set();
    for (let iteration = 0; iteration < MAX_LOCAL_ITERATIONS; iteration += 1) {
      const dragWidth = CARD_WIDTH;
      const dragHeight = tableHeight(dragged);
      const dragCenterX = (Number(dragged.x) || 0) + dragWidth / 2;
      const dragCenterY = (Number(dragged.y) || 0) + dragHeight / 2;
      const nearby = index.query(tableRect(dragged, MIN_GAP));
      let movedAny = false;

      nearby.forEach(other => {
        if (!other || other === dragged) return;
        const otherWidth = CARD_WIDTH;
        const otherHeight = tableHeight(other);
        const otherCenterX = (Number(other.x) || 0) + otherWidth / 2;
        const otherCenterY = (Number(other.y) || 0) + otherHeight / 2;
        const dx = otherCenterX - dragCenterX;
        const dy = otherCenterY - dragCenterY;
        const overlapX = (dragWidth / 2 + otherWidth / 2 + MIN_GAP) - Math.abs(dx);
        const overlapY = (dragHeight / 2 + otherHeight / 2 + MIN_GAP) - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) return;

        if (overlapX < overlapY) {
          other.x = (Number(other.x) || 0) + (dx === 0 ? 1 : Math.sign(dx)) * overlapX;
        } else {
          other.y = (Number(other.y) || 0) + (dy === 0 ? 1 : Math.sign(dy)) * overlapY;
        }

        index.update(other);
        touched.add(tableId(other));
        const otherCard = document.getElementById(`card-${tableId(other)}`);
        if (otherCard) {
          otherCard.style.left = `${other.x}px`;
          otherCard.style.top = `${other.y}px`;
        }
        movedAny = true;
      });

      if (!movedAny) break;
    }
    return touched;
  }

  function isLargeSchema(view) {
    return (view?.tables?.length || 0) >= LARGE_SCHEMA_THRESHOLD;
  }

  function trackLegacyDrag(event, tableId) {
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
  }

  function startLargeDrag(event, tableIdValue, view) {
    event.stopPropagation();
    const dragged = (view.tables || []).find(table => tableId(table) === tableIdValue);
    const card = document.getElementById(`card-${tableIdValue}`);
    if (!dragged || !card) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const dragOffX = (event.clientX - panX) / scale - (Number(dragged.x) || 0);
    const dragOffY = (event.clientY - panY) / scale - (Number(dragged.y) || 0);
    const index = createSpatialIndex(view.tables, tableIdValue);
    let latestMove = null;
    let moveFrame = 0;
    let moved = false;
    let undoCaptured = false;

    function renderMove() {
      moveFrame = 0;
      const moveEvent = latestMove;
      latestMove = null;
      if (!moveEvent) return;

      if (!undoCaptured) {
        E.pushUndo?.();
        undoCaptured = true;
      }

      dragged.x = (moveEvent.clientX - panX) / scale - dragOffX;
      dragged.y = (moveEvent.clientY - panY) / scale - dragOffY;
      card.style.left = `${dragged.x}px`;
      card.style.top = `${dragged.y}px`;

      resolveLocalCollisions(dragged, index);
      window.updateConnections?.();
    }

    function onMouseMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) moved = true;
      latestMove = moveEvent;
      if (!moveFrame) moveFrame = requestAnimationFrame(renderMove);
    }

    function finishDrag() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', finishDrag);
      if (moveFrame) {
        cancelAnimationFrame(moveFrame);
        renderMove();
      }

      if (!moved) return;
      suppressTableClickUntil = performance.now() + CLICK_SUPPRESS_MS;
      E.persist?.();
      E.Performance?.invalidateSpatialIndex?.();
      E.Performance?.scheduleCull?.();
      E.updateMinimap?.();
      document.dispatchEvent(new CustomEvent('erd:table-position-changed', {
        detail: { tableId: tableIdValue, schemaKey: currentView }
      }));
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', finishDrag);
  }

  window.startDragCard = function(event, tableIdValue) {
    const view = schemaData?.[currentView];
    if (!isLargeSchema(view)) return trackLegacyDrag.call(this, event, tableIdValue);
    return startLargeDrag(event, tableIdValue, view);
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

  E.LargeDragUX = {
    threshold: LARGE_SCHEMA_THRESHOLD,
    tableRect,
    cellKeys,
    createSpatialIndex,
    resolveLocalCollisions,
    isLargeSchema
  };
})();
