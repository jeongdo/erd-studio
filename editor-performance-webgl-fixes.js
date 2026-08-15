/** Focused fixes for the 100k WebGL experiments: RAW drag + relation arrows. */
(() => {
  'use strict';

  const RAW = 'performance_100000_raw';
  const MAP = 'performance_100000';
  const W = 360, HEADER = 52, ROW = 34, BOTTOM = 12, CELL = 840;
  const DRAG_SCALE = 0.16;
  const RELATION_SCALE = 0.10;
  const workspace = document.getElementById('workspace');
  if (!workspace || typeof schemaData === 'undefined') return;

  const rawCanvas = [...workspace.children].find(el =>
    el.tagName === 'CANVAS' && el.style.zIndex === '18' && !el.id
  );
  const rawGl = rawCanvas?.getContext('webgl2');
  if (!rawCanvas || !rawGl) return;

  const legacyRawRelations = document.getElementById('erd-webgl-raw-relations');
  const liveRelations = document.createElement('canvas');
  liveRelations.id = 'erd-webgl-raw-live-relations';
  Object.assign(liveRelations.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    zIndex: '17', display: 'none', pointerEvents: 'none'
  });
  workspace.appendChild(liveRelations);
  const relationCtx = liveRelations.getContext('2d');
  if (!relationCtx) return;

  let instanceBuffer = null;
  let boundArrayBuffer = null;
  let tables = [];
  let relations = [];
  let byId = new Map();
  let relationByTable = new Map();
  let tableIndex = null;
  let gpuIndex = new Map();
  let dataSignature = '';
  let drag = null;
  let relationVersion = 0;
  let lastRelationFrame = '';

  const idOf = table => table?.id || table?.name || '';
  const heightOf = table => HEADER + (table?.columns?.length || 0) * ROW + BOTTOM;
  const rectOf = table => ({ left: table.x, top: table.y, right: table.x + W, bottom: table.y + heightOf(table) });
  const intersects = (a, b) => a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;

  // Capture the RAW renderer's instance buffer when it uploads the 100k rectangles.
  const nativeBindBuffer = rawGl.bindBuffer.bind(rawGl);
  const nativeBufferData = rawGl.bufferData.bind(rawGl);
  rawGl.bindBuffer = function(target, buffer) {
    if (target === rawGl.ARRAY_BUFFER) boundArrayBuffer = buffer;
    return nativeBindBuffer(target, buffer);
  };
  rawGl.bufferData = function(target, data, usage) {
    if (target === rawGl.ARRAY_BUFFER && data instanceof Float32Array && data.length > 1000) {
      instanceBuffer = boundArrayBuffer;
    }
    return nativeBufferData(target, data, usage);
  };

  function cells(rect) {
    const keys = [];
    for (let x = Math.floor(rect.left / CELL); x <= Math.floor(rect.right / CELL); x += 1) {
      for (let y = Math.floor(rect.top / CELL); y <= Math.floor(rect.bottom / CELL); y += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }

  function buildIndex(items) {
    const buckets = new Map();
    const memberships = new Map();
    function insert(table) {
      const keys = cells(rectOf(table));
      memberships.set(idOf(table), keys);
      keys.forEach(key => {
        if (!buckets.has(key)) buckets.set(key, new Set());
        buckets.get(key).add(table);
      });
    }
    function remove(table) {
      (memberships.get(idOf(table)) || []).forEach(key => {
        const bucket = buckets.get(key);
        bucket?.delete(table);
        if (bucket?.size === 0) buckets.delete(key);
      });
      memberships.delete(idOf(table));
    }
    items.forEach(insert);
    return {
      update(table) { remove(table); insert(table); },
      query(rect) {
        const found = new Set();
        cells(rect).forEach(key => buckets.get(key)?.forEach(table => found.add(table)));
        return [...found];
      }
    };
  }

  function ensureData() {
    const view = schemaData[RAW] || schemaData.performance_100000;
    if (!view) return false;
    const nextTables = view.tables || [];
    const nextRelations = view.relations || [];
    const signature = `${nextTables.length}:${nextRelations.length}:${idOf(nextTables[0])}:${idOf(nextTables[nextTables.length - 1])}`;
    if (signature === dataSignature && tableIndex) return true;
    tables = nextTables;
    relations = nextRelations;
    byId = new Map(tables.map(table => [idOf(table), table]));
    relationByTable = new Map();
    relations.forEach(rel => {
      [rel.from, rel.to].forEach(tableId => {
        if (!relationByTable.has(tableId)) relationByTable.set(tableId, []);
        relationByTable.get(tableId).push(rel);
      });
    });
    tableIndex = buildIndex(tables);
    gpuIndex = new Map(tables.map((table, index) => [idOf(table), index]));
    dataSignature = signature;
    relationVersion += 1;
    return true;
  }

  function world(clientX, clientY) {
    const rect = workspace.getBoundingClientRect();
    return { x: (clientX - rect.left - panX) / scale, y: (clientY - rect.top - panY) / scale };
  }

  function hitTable(x, y) {
    if (!tableIndex || scale < DRAG_SCALE) return null;
    const candidates = tableIndex.query({ left: x, top: y, right: x, bottom: y });
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const table = candidates[i], rect = rectOf(table);
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return table;
    }
    return null;
  }

  function updateGpuTable(table) {
    const index = gpuIndex.get(idOf(table));
    if (index === undefined || !instanceBuffer) return;
    nativeBindBuffer(rawGl.ARRAY_BUFFER, instanceBuffer);
    rawGl.bufferSubData(
      rawGl.ARRAY_BUFFER,
      index * 16,
      new Float32Array([table.x, table.y, W, heightOf(table)])
    );
  }

  function columnY(table, column) {
    const name = Array.isArray(column) ? column[0] : column;
    const idx = table.columns?.findIndex(item => item.name === name) ?? -1;
    return idx >= 0 ? table.y + HEADER + idx * ROW + ROW / 2 : table.y + heightOf(table) / 2;
  }

  function geometry(rel) {
    const from = byId.get(rel.from), to = byId.get(rel.to);
    if (!from || !to) return null;
    const fh = heightOf(from), th = heightOf(to);
    const fx = from.x + W / 2, fy = from.y + fh / 2;
    const tx = to.x + W / 2, ty = to.y + th / 2;
    const dx = tx - fx, dy = ty - fy;
    let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      x1 = fx; x2 = tx;
      y1 = dy > 0 ? from.y + fh + 8 : from.y - 8;
      y2 = dy > 0 ? to.y - 8 : to.y + th + 8;
      const arm = Math.abs(y2 - y1) * 0.5, midX = (x1 + x2) / 2;
      c1x = midX; c2x = midX;
      c1y = y1 + (dy > 0 ? arm : -arm);
      c2y = y2 + (dy > 0 ? -arm : arm);
    } else {
      y1 = columnY(from, rel.fromCol); y2 = columnY(to, rel.toCol);
      x1 = dx > 0 ? from.x + W + 8 : from.x - 8;
      x2 = dx > 0 ? to.x - 8 : to.x + W + 8;
      const arm = Math.max(Math.abs(x2 - x1) * 0.55, 40), midY = (y1 + y2) / 2;
      c1x = x1 + (dx > 0 ? arm : -arm);
      c2x = x2 + (dx > 0 ? -arm : arm);
      c1y = midY; c2y = midY;
    }
    return { x1, y1, x2, y2, c1x, c1y, c2x, c2y };
  }

  function resizeRelations() {
    const rect = workspace.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (liveRelations.width !== width || liveRelations.height !== height) {
      liveRelations.width = width;
      liveRelations.height = height;
    }
    return { rect, dpr };
  }

  function drawRelations() {
    const { rect, dpr } = resizeRelations();
    relationCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    relationCtx.clearRect(0, 0, rect.width, rect.height);
    if (currentView !== RAW || scale < RELATION_SCALE || !ensureData()) {
      liveRelations.style.display = 'none';
      return;
    }
    liveRelations.style.display = 'block';
    if (legacyRawRelations) legacyRawRelations.style.display = 'none';
    const margin = 140 / Math.max(scale, 0.01);
    const visible = {
      left: -panX / scale - margin,
      top: -panY / scale - margin,
      right: (rect.width - panX) / scale + margin,
      bottom: (rect.height - panY) / scale + margin
    };
    const visibleTables = tableIndex.query(visible).filter(table => intersects(rectOf(table), visible));
    const candidates = new Set();
    visibleTables.forEach(table => (relationByTable.get(idOf(table)) || []).forEach(rel => candidates.add(rel)));
    relationCtx.save();
    relationCtx.translate(panX, panY);
    relationCtx.scale(scale, scale);
    const style = getComputedStyle(document.body);
    const lineColor = style.getPropertyValue('--line-color').trim() || style.getPropertyValue('--accent-blue').trim() || '#38bdf8';
    candidates.forEach(rel => {
      const g = geometry(rel);
      if (!g) return;
      if (!intersects({
        left: Math.min(g.x1, g.x2) - 80, top: Math.min(g.y1, g.y2) - 80,
        right: Math.max(g.x1, g.x2) + 80, bottom: Math.max(g.y1, g.y2) + 80
      }, visible)) return;
      relationCtx.beginPath();
      relationCtx.moveTo(g.x1, g.y1);
      relationCtx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.x2, g.y2);
      relationCtx.strokeStyle = lineColor;
      relationCtx.globalAlpha = 0.74;
      relationCtx.lineWidth = Math.max(1.2 / scale, 1.7);
      relationCtx.setLineDash(rel.identifying ? [] : [8 / scale, 5 / scale]);
      relationCtx.stroke();
      relationCtx.setLineDash([]);
      const angle = Math.atan2(g.y2 - g.c2y, g.x2 - g.c2x);
      const arrow = 8 / Math.max(scale, 0.08);
      relationCtx.beginPath();
      relationCtx.moveTo(g.x2, g.y2);
      relationCtx.lineTo(g.x2 - Math.cos(angle - 0.55) * arrow, g.y2 - Math.sin(angle - 0.55) * arrow);
      relationCtx.lineTo(g.x2 - Math.cos(angle + 0.55) * arrow, g.y2 - Math.sin(angle + 0.55) * arrow);
      relationCtx.closePath();
      relationCtx.fillStyle = lineColor;
      relationCtx.fill();
    });
    relationCtx.globalAlpha = 1;
    relationCtx.restore();
  }

  // Capture-phase table drag wins over the RAW renderer's normal pan handler.
  rawCanvas.addEventListener('mousedown', event => {
    if (currentView !== RAW || event.button !== 0 || !ensureData()) return;
    const point = world(event.clientX, event.clientY);
    const table = hitTable(point.x, point.y);
    if (!table) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    drag = {
      table,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: point.x - table.x,
      offsetY: point.y - table.y,
      moved: false
    };
    selectedTableId = idOf(table);
    rawCanvas.style.cursor = 'grabbing';
  }, true);

  window.addEventListener('mousemove', event => {
    if (currentView !== RAW || !drag) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) >= 5) drag.moved = true;
    const point = world(event.clientX, event.clientY);
    drag.table.x = point.x - drag.offsetX;
    drag.table.y = point.y - drag.offsetY;
    tableIndex.update(drag.table);
    updateGpuTable(drag.table);
    relationVersion += 1;
    window.ERDUltraWebGLRaw?.requestDraw?.();
  });

  window.addEventListener('mouseup', () => {
    if (currentView !== RAW || !drag) return;
    drag = null;
    rawCanvas.style.cursor = 'grab';
    relationVersion += 1;
    window.ERDUltraWebGLRaw?.requestDraw?.();
  });

  // The clustered 100k renderer already draws Bézier lines; add arrowheads to that exact path.
  const mapOverlay = document.getElementById('erd-webgl-overlay');
  const mapCtx = mapOverlay?.getContext('2d');
  if (mapCtx) {
    const nativeBeginPath = mapCtx.beginPath.bind(mapCtx);
    const nativeBezier = mapCtx.bezierCurveTo.bind(mapCtx);
    const nativeStroke = mapCtx.stroke.bind(mapCtx);
    let tip = null;
    mapCtx.beginPath = function() {
      tip = null;
      return nativeBeginPath();
    };
    mapCtx.bezierCurveTo = function(c1x, c1y, c2x, c2y, x2, y2) {
      tip = { c2x, c2y, x2, y2 };
      return nativeBezier(c1x, c1y, c2x, c2y, x2, y2);
    };
    mapCtx.stroke = function(...args) {
      const currentTip = tip;
      const result = nativeStroke(...args);
      if (currentView === MAP && currentTip) {
        const angle = Math.atan2(currentTip.y2 - currentTip.c2y, currentTip.x2 - currentTip.c2x);
        const arrow = 8 / Math.max(scale, 0.08);
        mapCtx.save();
        nativeBeginPath();
        mapCtx.moveTo(currentTip.x2, currentTip.y2);
        mapCtx.lineTo(
          currentTip.x2 - Math.cos(angle - 0.55) * arrow,
          currentTip.y2 - Math.sin(angle - 0.55) * arrow
        );
        mapCtx.lineTo(
          currentTip.x2 - Math.cos(angle + 0.55) * arrow,
          currentTip.y2 - Math.sin(angle + 0.55) * arrow
        );
        mapCtx.closePath();
        mapCtx.fillStyle = mapCtx.strokeStyle;
        mapCtx.fill();
        mapCtx.restore();
      }
      return result;
    };
  }

  function frame() {
    if (currentView === RAW) {
      if (legacyRawRelations) legacyRawRelations.style.display = 'none';
      const key = `${scale}|${panX}|${panY}|${workspace.clientWidth}|${workspace.clientHeight}|${document.body.className}|${relationVersion}`;
      if (key !== lastRelationFrame) {
        lastRelationFrame = key;
        drawRelations();
      }
    } else {
      liveRelations.style.display = 'none';
      lastRelationFrame = '';
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
