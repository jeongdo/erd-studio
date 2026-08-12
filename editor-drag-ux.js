/** Drag UX: suppress drag-clicks and resolve large-ERD drops without moving neighboring tables. */
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
  const SEARCH_STEP = 80;
  const MAX_SEARCH_RINGS = 12;
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

  function rectsOverlap(a, b) {
    return a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top;
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

  function positionIsFree(table, index) {
    const ownRect = tableRect(table, MIN_GAP / 2);
    const nearby = index.query(tableRect(table, MIN_GAP));
    return !nearby.some(other => rectsOverlap(ownRect, tableRect(other, MIN_GAP / 2)));
  }

  function perimeterOffsets(ring) {
    const offsets = [];
    for (let x = -ring; x <= ring; x += 1) {
      offsets.push([x, -ring], [x, ring]);
    }
    for (let y = -ring + 1; y <= ring - 1; y += 1) {
      offsets.push([-ring, y], [ring, y]);
    }
    return offsets;
  }

  function findNearestFreePosition(dragged, index, fallback = null) {
    const desired = { x: Number(dragged.x) || 0, y: Number(dragged.y) || 0 };
    if (positionIsFree(dragged, index)) return { ...desired, adjusted: false };

    const probe = { ...dragged };
    for (let ring = 1; ring <= MAX_SEARCH_RINGS; ring += 1) {
      const offsets = perimeterOffsets(ring);
      for (const [ox, oy] of offsets) {
        probe.x = desired.x + ox * SEARCH_STEP;
        probe.y = desired.y + oy * SEARCH_STEP;
        if (positionIsFree(probe, index)) {
          return { x: probe.x, y: probe.y, adjusted: true };
        }
      }
    }

    if (fallback) {
      probe.x = fallback.x;
      probe.y = fallback.y;
      if (positionIsFree(probe, index)) {
        return { x: probe.x, y: probe.y, adjusted: true, reverted: true };
      }
    }

    // Imported layouts should normally be repaired before interaction. If no
    // nearby free slot exists, preserve the user's requested drop rather than
    // mutating any neighboring table.
    return { ...desired, adjusted: false, unresolved: true };
  }

  function isLargeSchema(view) {
    return (view?.tables?.length || 0) >= LARGE_SCHEMA_THRESHOLD;
  }

  function trackLegacyDrag(event, tableIdValue) {
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
    return originalStartDrag.call(this, event, tableIdValue);
  }

  function startLargeDrag(event, tableIdValue, view) {
    event.stopPropagation();
    const dragged = (view.tables || []).find(table => tableId(table) === tableIdValue);
    const card = document.getElementById(`card-${tableIdValue}`);
    if (!dragged || !card) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = { x: Number(dragged.x) || 0, y: Number(dragged.y) || 0 };
    const dragOffX = (event.clientX - panX) / scale - startPosition.x;
    const dragOffY = (event.clientY - panY) / scale - startPosition.y;
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

      const resolved = findNearestFreePosition(dragged, index, startPosition);
      dragged.x = resolved.x;
      dragged.y = resolved.y;
      card.style.left = `${dragged.x}px`;
      card.style.top = `${dragged.y}px`;

      E.persist?.();
      E.Performance?.invalidateSpatialIndex?.();
      E.Performance?.scheduleCull?.();
      E.updateMinimap?.();
      window.updateConnections?.();
      document.dispatchEvent(new CustomEvent('erd:table-position-changed', {
        detail: {
          tableId: tableIdValue,
          schemaKey: currentView,
          collisionAdjusted: !!resolved.adjusted,
          collisionUnresolved: !!resolved.unresolved
        }
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
    rectsOverlap,
    cellKeys,
    createSpatialIndex,
    positionIsFree,
    findNearestFreePosition,
    isLargeSchema
  };
})();
