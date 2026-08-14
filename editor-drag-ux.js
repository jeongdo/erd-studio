/** Keep table drag responsive on large ERDs and Inspector clicks predictable. */
(() => {
  'use strict';

  const DRAG_THRESHOLD_PX = 5;
  const CLICK_SUPPRESS_MS = 120;
  const LARGE_SCHEMA_THRESHOLD = 80;
  const SPATIAL_CELL = 520;
  const CARD_WIDTH = 360;
  const HEADER_HEIGHT = 60;
  const COLUMN_HEIGHT = 34;
  const MIN_GAP = 60;

  // Large ERDs need bounded collision propagation:
  // drag stays shallow/responsive, mouseup gets a deeper local settle pass.
  const DRAG_PROPAGATION_DEPTH = 2;   // A -> B -> C -> D (3 hops)
  const DRAG_MAX_MOVES = 32;
  const SETTLE_PROPAGATION_DEPTH = 6;
  const SETTLE_MAX_MOVES = 120;
  const SETTLE_MAX_SEEDS = 48;

  const originalStartDrag = window.startDragCard;
  const originalSelectTable = window.selectTable;
  let suppressTableClickUntil = 0;

  function idOf(table) {
    return table?.id || table?.name || '';
  }

  function estimatedHeight(table) {
    return HEADER_HEIGHT + (table?.columns?.length || 0) * COLUMN_HEIGHT;
  }

  function tableRect(table, gap = 0) {
    const x = Number(table?.x) || 0;
    const y = Number(table?.y) || 0;
    return {
      left: x - gap,
      top: y - gap,
      right: x + CARD_WIDTH + gap,
      bottom: y + estimatedHeight(table) + gap
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

  function createSpatialIndex(tables, excludedId) {
    const buckets = new Map();
    const memberships = new Map();

    function insert(table) {
      const id = idOf(table);
      if (!id || id === excludedId) return;
      const keys = cellKeys(tableRect(table, MIN_GAP));
      memberships.set(id, keys);
      keys.forEach(key => {
        if (!buckets.has(key)) buckets.set(key, new Set());
        buckets.get(key).add(table);
      });
    }

    function remove(table) {
      const id = idOf(table);
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
    return { update, query };
  }

  function createRelationIndex(relations = []) {
    const byTable = new Map();
    relations.forEach(rel => {
      [rel.from, rel.to].forEach(tableId => {
        if (!byTable.has(tableId)) byTable.set(tableId, []);
        byTable.get(tableId).push(rel);
      });
    });
    return byTable;
  }

  function moveBadge(path, mx, my) {
    const badge = path?.nextElementSibling;
    if (!badge || badge.tagName?.toLowerCase() !== 'g') return;

    const rect = badge.querySelector('rect');
    const text = badge.querySelector('text');
    if (rect) {
      const width = Number(rect.getAttribute('width')) || 0;
      const height = Number(rect.getAttribute('height')) || 0;
      rect.setAttribute('x', mx - width / 2);
      rect.setAttribute('y', my - height / 2);
    }
    if (text) {
      text.setAttribute('x', mx);
      text.setAttribute('y', my + 3.5);
    }
  }

  function updateRelationGeometry(rel, canvasRect, safeScale) {
    const firstFromCol = Array.isArray(rel.fromCol) ? rel.fromCol[0] : rel.fromCol;
    const firstToCol = Array.isArray(rel.toCol) ? rel.toCol[0] : rel.toCol;
    const fromColElem = document.getElementById(`col-${rel.from}-${firstFromCol}`);
    const toColElem = document.getElementById(`col-${rel.to}-${firstToCol}`);
    const fromCard = document.getElementById(`card-${rel.from}`);
    const toCard = document.getElementById(`card-${rel.to}`);
    const path = document.getElementById(`line-${rel.from}-${rel.to}`);
    if (!fromColElem || !toColElem || !fromCard || !toCard || !path) return;

    const fromRect = fromColElem.getBoundingClientRect();
    const toRect = toColElem.getBoundingClientRect();
    const fromCardRect = fromCard.getBoundingClientRect();
    const toCardRect = toCard.getBoundingClientRect();
    const cardDx = (toCardRect.left + toCardRect.width / 2)
      - (fromCardRect.left + fromCardRect.width / 2);
    const cardDy = (toCardRect.top + toCardRect.height / 2)
      - (fromCardRect.top + fromCardRect.height / 2);
    const offset = 8 / safeScale;

    let x1, y1, x2, y2, pathData, mx, my;

    if (Math.abs(cardDy) > Math.abs(cardDx) * 1.2) {
      x1 = (fromRect.left + fromRect.width / 2 - canvasRect.left) / safeScale;
      x2 = (toRect.left + toRect.width / 2 - canvasRect.left) / safeScale;

      if (cardDy > 0) {
        y1 = (fromCardRect.bottom - canvasRect.top) / safeScale + offset;
        y2 = (toCardRect.top - canvasRect.top) / safeScale - offset;
      } else {
        y1 = (fromCardRect.top - canvasRect.top) / safeScale - offset;
        y2 = (toCardRect.bottom - canvasRect.top) / safeScale + offset;
      }

      const distY = Math.abs(y2 - y1);
      const cdy = distY * 0.5;
      const midX = (x1 + x2) / 2;
      const cy1 = y1 + (cardDy > 0 ? cdy : -cdy);
      const cy2 = y2 + (cardDy > 0 ? -cdy : cdy);

      pathData = `M ${x1} ${y1} C ${midX} ${cy1}, ${midX} ${cy2}, ${x2} ${y2}`;
      mx = 0.125 * x1 + 0.375 * midX + 0.375 * midX + 0.125 * x2;
      my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
    } else {
      y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top) / safeScale;
      y2 = (toRect.top + toRect.height / 2 - canvasRect.top) / safeScale;

      const rawX1 = (fromRect.right - canvasRect.left) / safeScale;
      const rawX2 = (toRect.left - canvasRect.left) / safeScale;
      if (rawX1 < rawX2) {
        x1 = rawX1 + offset;
        x2 = rawX2 - offset;
      } else {
        x1 = (fromRect.left - canvasRect.left) / safeScale - offset;
        x2 = (toRect.right - canvasRect.left) / safeScale + offset;
      }

      const distX = Math.abs(x2 - x1);
      const cdx = Math.max(distX * 0.6, 40 / safeScale);
      const midY = (y1 + y2) / 2;
      const cx1 = x1 + (rawX1 < rawX2 ? cdx : -cdx);
      const cx2 = x2 + (rawX1 < rawX2 ? -cdx : cdx);

      pathData = `M ${x1} ${y1} C ${cx1} ${midY}, ${cx2} ${midY}, ${x2} ${y2}`;
      mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
      my = 0.125 * y1 + 0.375 * midY + 0.375 * midY + 0.125 * y2;
    }

    path.setAttribute('d', pathData);
    moveBadge(path, mx, my);
  }

  function updateConnectedRelations(tableIds, relationIndex) {
    if (!tableIds?.size) return;
    const canvasLayer = document.getElementById('canvas-layer');
    if (!canvasLayer) return;

    const relations = new Set();
    tableIds.forEach(tableId => {
      (relationIndex.get(tableId) || []).forEach(rel => relations.add(rel));
    });
    if (!relations.size) return;

    const canvasRect = canvasLayer.getBoundingClientRect();
    const safeScale = Math.max(Number(scale) || 1, 0.05);
    relations.forEach(rel => updateRelationGeometry(rel, canvasRect, safeScale));
  }

  function moveCardDom(table) {
    const card = document.getElementById(`card-${idOf(table)}`);
    if (!card) return;
    card.style.left = `${table.x}px`;
    card.style.top = `${table.y}px`;
  }

  function separate(source, other) {
    if (!source || !other || source === other) return false;

    const sourceWidth = CARD_WIDTH;
    const sourceHeight = estimatedHeight(source);
    const otherWidth = CARD_WIDTH;
    const otherHeight = estimatedHeight(other);

    const sourceCenterX = (Number(source.x) || 0) + sourceWidth / 2;
    const sourceCenterY = (Number(source.y) || 0) + sourceHeight / 2;
    const otherCenterX = (Number(other.x) || 0) + otherWidth / 2;
    const otherCenterY = (Number(other.y) || 0) + otherHeight / 2;
    const dx = otherCenterX - sourceCenterX;
    const dy = otherCenterY - sourceCenterY;
    const overlapX = (sourceWidth / 2 + otherWidth / 2 + MIN_GAP) - Math.abs(dx);
    const overlapY = (sourceHeight / 2 + otherHeight / 2 + MIN_GAP) - Math.abs(dy);

    if (overlapX <= 0 || overlapY <= 0) return false;

    if (overlapX < overlapY) {
      other.x = (Number(other.x) || 0) + (dx === 0 ? 1 : Math.sign(dx)) * overlapX;
    } else {
      other.y = (Number(other.y) || 0) + (dy === 0 ? 1 : Math.sign(dy)) * overlapY;
    }
    return true;
  }

  function resolveCollisionWave(seeds, index, options = {}) {
    const maxDepth = Math.max(0, Number(options.maxDepth) || 0);
    const maxMoves = Math.max(1, Number(options.maxMoves) || 1);
    const touched = new Set();
    const queue = [];
    const propagatedAtDepth = new Map();

    (seeds || []).forEach(table => {
      if (!table) return;
      queue.push({ table, depth: 0 });
      propagatedAtDepth.set(idOf(table), 0);
    });

    let moveCount = 0;

    while (queue.length && moveCount < maxMoves) {
      const { table: source, depth } = queue.shift();
      const nearby = index.query(tableRect(source, MIN_GAP));

      for (const other of nearby) {
        if (moveCount >= maxMoves) break;
        if (!separate(source, other)) continue;

        index.update(other);
        moveCardDom(other);

        const otherId = idOf(other);
        touched.add(otherId);
        moveCount += 1;

        if (depth >= maxDepth) continue;
        const nextDepth = depth + 1;
        const priorDepth = propagatedAtDepth.get(otherId);
        if (priorDepth !== undefined && priorDepth <= nextDepth) continue;

        propagatedAtDepth.set(otherId, nextDepth);
        queue.push({ table: other, depth: nextDepth });
      }
    }

    return touched;
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

  function startLargeDrag(event, tableId, view) {
    event.stopPropagation();

    const dragged = view.tables.find(table => idOf(table) === tableId);
    const card = document.getElementById(`card-${tableId}`);
    if (!dragged || !card) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const dragOffX = (event.clientX - panX) / scale - (Number(dragged.x) || 0);
    const dragOffY = (event.clientY - panY) / scale - (Number(dragged.y) || 0);
    const spatialIndex = createSpatialIndex(view.tables, tableId);
    const relationIndex = createRelationIndex(view.relations || []);
    const touchedDuringDrag = new Set();
    const touchedOrder = [];

    function rememberTouched(tableIds) {
      tableIds.forEach(id => {
        if (id === tableId || touchedDuringDrag.has(id)) return;
        touchedDuringDrag.add(id);
        touchedOrder.push(id);
        if (touchedOrder.length <= SETTLE_MAX_SEEDS) return;
        const expired = touchedOrder.shift();
        touchedDuringDrag.delete(expired);
      });
    }

    let latestMove = null;
    let moveFrame = 0;
    let moved = false;

    function renderMove() {
      moveFrame = 0;
      const moveEvent = latestMove;
      latestMove = null;
      if (!moveEvent) return;

      dragged.x = (moveEvent.clientX - panX) / scale - dragOffX;
      dragged.y = (moveEvent.clientY - panY) / scale - dragOffY;
      card.style.left = `${dragged.x}px`;
      card.style.top = `${dragged.y}px`;

      const changedTableIds = resolveCollisionWave([dragged], spatialIndex, {
        maxDepth: DRAG_PROPAGATION_DEPTH,
        maxMoves: DRAG_MAX_MOVES
      });
      rememberTouched(changedTableIds);
      changedTableIds.add(tableId);

      // Only relations attached to moved tables stay live during the gesture.
      updateConnectedRelations(changedTableIds, relationIndex);
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

      const settleSeeds = [dragged];
      touchedDuringDrag.forEach(id => {
        if (id === tableId) return;
        const table = view.tables.find(item => idOf(item) === id);
        if (table) settleSeeds.push(table);
      });

      // Deeper but still bounded local settle after mouseup. The dragged table
      // remains the anchor because it is excluded from the spatial index.
      resolveCollisionWave(settleSeeds, spatialIndex, {
        maxDepth: SETTLE_PROPAGATION_DEPTH,
        maxMoves: SETTLE_MAX_MOVES
      });

      // One full redraw after settle guarantees final line/badge consistency.
      requestAnimationFrame(() => window.updateConnections?.());
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', finishDrag);
  }

  if (typeof originalStartDrag === 'function') {
    window.startDragCard = function(event, tableId) {
      const view = schemaData?.[currentView];
      if ((view?.tables?.length || 0) < LARGE_SCHEMA_THRESHOLD) {
        return trackLegacyDrag.call(this, event, tableId);
      }
      return startLargeDrag(event, tableId, view);
    };
  }

  if (typeof originalSelectTable === 'function') {
    window.selectTable = function(table) {
      const tableId = idOf(table);
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
