/** Relation-line compatibility layer for the raw 100k WebGL benchmark. */
(() => {
  'use strict';

  const VIEW = 'performance_100000_raw';
  const SOURCE = 'performance_100000';
  const W = 360;
  const HEADER = 52;
  const ROW = 34;
  const BOTTOM = 12;
  const CELL = 840;
  const MIN_SCALE = 0.10;

  const workspace = document.getElementById('workspace');
  if (!workspace || typeof schemaData === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.id = 'erd-webgl-raw-relations';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: '17',
    display: 'none',
    pointerEvents: 'none'
  });
  workspace.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let tableIndex = null;
  let byId = new Map();
  let relationByTable = new Map();
  let dataSignature = '';
  let lastFrameSignature = '';

  const idOf = table => table?.id || table?.name || '';
  const heightOf = table => HEADER + (table?.columns?.length || 0) * ROW + BOTTOM;
  const rectOf = table => ({
    left: table.x,
    top: table.y,
    right: table.x + W,
    bottom: table.y + heightOf(table)
  });
  const intersects = (a, b) =>
    a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;

  function cells(rect) {
    const keys = [];
    for (let x = Math.floor(rect.left / CELL); x <= Math.floor(rect.right / CELL); x += 1) {
      for (let y = Math.floor(rect.top / CELL); y <= Math.floor(rect.bottom / CELL); y += 1) {
        keys.push(`${x}:${y}`);
      }
    }
    return keys;
  }

  function buildTableIndex(tables) {
    const buckets = new Map();
    tables.forEach(table => {
      cells(rectOf(table)).forEach(key => {
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(table);
      });
    });
    return {
      query(rect) {
        const found = new Set();
        cells(rect).forEach(key => (buckets.get(key) || []).forEach(table => found.add(table)));
        return [...found];
      }
    };
  }

  function ensureData() {
    const view = schemaData[VIEW] || schemaData[SOURCE];
    if (!view) return false;

    const tables = view.tables || [];
    const relations = view.relations || [];
    const signature = `${tables.length}:${relations.length}:${idOf(tables[0])}:${idOf(tables[tables.length - 1])}`;
    if (signature === dataSignature && tableIndex) return true;

    byId = new Map(tables.map(table => [idOf(table), table]));
    relationByTable = new Map();
    relations.forEach(rel => {
      [rel.from, rel.to].forEach(tableId => {
        if (!relationByTable.has(tableId)) relationByTable.set(tableId, []);
        relationByTable.get(tableId).push(rel);
      });
    });
    tableIndex = buildTableIndex(tables);
    dataSignature = signature;
    return true;
  }

  function resize() {
    const rect = workspace.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    canvas.dataset.dpr = dpr;
  }

  function viewportWorld() {
    const rect = workspace.getBoundingClientRect();
    const safeScale = Math.max(scale, 0.01);
    const margin = 140 / safeScale;
    return {
      left: -panX / scale - margin,
      top: -panY / scale - margin,
      right: (rect.width - panX) / scale + margin,
      bottom: (rect.height - panY) / scale + margin
    };
  }

  function columnY(table, column) {
    const name = Array.isArray(column) ? column[0] : column;
    const idx = table.columns?.findIndex(item => item.name === name) ?? -1;
    return idx >= 0
      ? table.y + HEADER + idx * ROW + ROW / 2
      : table.y + heightOf(table) / 2;
  }

  function drawRelation(rel, visibleRect, lineColor) {
    const from = byId.get(rel.from);
    const to = byId.get(rel.to);
    if (!from || !to) return false;

    const fromHeight = heightOf(from);
    const toHeight = heightOf(to);
    const fromCenterX = from.x + W / 2;
    const fromCenterY = from.y + fromHeight / 2;
    const toCenterX = to.x + W / 2;
    const toCenterY = to.y + toHeight / 2;

    if (!intersects({
      left: Math.min(fromCenterX, toCenterX) - 80,
      top: Math.min(fromCenterY, toCenterY) - 80,
      right: Math.max(fromCenterX, toCenterX) + 80,
      bottom: Math.max(fromCenterY, toCenterY) + 80
    }, visibleRect)) return false;

    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    let x1;
    let y1;
    let x2;
    let y2;
    let c1x;
    let c1y;
    let c2x;
    let c2y;

    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      x1 = fromCenterX;
      x2 = toCenterX;
      y1 = dy > 0 ? from.y + fromHeight + 8 : from.y - 8;
      y2 = dy > 0 ? to.y - 8 : to.y + toHeight + 8;
      const arm = Math.abs(y2 - y1) * 0.5;
      const midX = (x1 + x2) / 2;
      c1x = midX;
      c2x = midX;
      c1y = y1 + (dy > 0 ? arm : -arm);
      c2y = y2 + (dy > 0 ? -arm : arm);
    } else {
      y1 = columnY(from, rel.fromCol);
      y2 = columnY(to, rel.toCol);
      x1 = dx > 0 ? from.x + W + 8 : from.x - 8;
      x2 = dx > 0 ? to.x - 8 : to.x + W + 8;
      const arm = Math.max(Math.abs(x2 - x1) * 0.55, 40);
      const midY = (y1 + y2) / 2;
      c1x = x1 + (dx > 0 ? arm : -arm);
      c2x = x2 + (dx > 0 ? -arm : arm);
      c1y = midY;
      c2y = midY;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = 0.74;
    ctx.lineWidth = Math.max(1.2 / scale, 1.7);
    ctx.setLineDash(rel.identifying ? [] : [8 / scale, 5 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(y2 - c2y, x2 - c2x);
    const arrow = 8 / Math.max(scale, 0.08);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - Math.cos(angle - 0.55) * arrow,
      y2 - Math.sin(angle - 0.55) * arrow
    );
    ctx.lineTo(
      x2 - Math.cos(angle + 0.55) * arrow,
      y2 - Math.sin(angle + 0.55) * arrow
    );
    ctx.closePath();
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.globalAlpha = 1;
    return true;
  }

  function clear() {
    resize();
    const rect = workspace.getBoundingClientRect();
    const dpr = Number(canvas.dataset.dpr) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
  }

  function draw() {
    if (currentView !== VIEW || scale < MIN_SCALE || !ensureData()) {
      canvas.style.display = 'none';
      clear();
      return;
    }

    canvas.style.display = 'block';
    clear();
    const visibleRect = viewportWorld();
    const visibleTables = tableIndex.query(visibleRect)
      .filter(table => intersects(rectOf(table), visibleRect));
    const relations = new Set();
    visibleTables.forEach(table => {
      (relationByTable.get(idOf(table)) || []).forEach(rel => relations.add(rel));
    });

    const dpr = Number(canvas.dataset.dpr) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);
    const lineColor = getComputedStyle(document.body).getPropertyValue('--line-color').trim()
      || getComputedStyle(document.body).getPropertyValue('--accent-blue').trim()
      || '#38bdf8';
    relations.forEach(rel => drawRelation(rel, visibleRect, lineColor));
    ctx.restore();
  }

  function frame() {
    const rect = workspace.getBoundingClientRect();
    const signature = `${currentView}|${scale}|${panX}|${panY}|${rect.width}|${rect.height}|${document.body.className}`;
    if (signature !== lastFrameSignature) {
      lastFrameSignature = signature;
      draw();
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
