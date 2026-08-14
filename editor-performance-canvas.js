/** Canvas renderer for every ERD view. DOM/SVG stays as a legacy fallback only. */
(() => {
  'use strict';

  const W = 360;
  const HEADER = 52;
  const ROW = 34;
  const BOTTOM = 12;
  const GAP = 60;
  const CELL = 520;
  const LARGE_SCHEMA_THRESHOLD = 80;
  const NORMAL_MIN_SCALE = 0.4;
  const LARGE_MIN_SCALE = 0.05;
  const DRAG_DEPTH = 2;
  const DRAG_MOVES = 32;
  const SETTLE_DEPTH = 6;
  const SETTLE_MOVES = 120;

  const workspace = document.getElementById('workspace');
  const domLayer = document.getElementById('canvas-layer');
  const zoomText = document.getElementById('zoom-text');
  const searchInput = document.getElementById('search-input');
  if (!workspace || !domLayer) return;

  const baseRenderView = window.renderView;
  const baseUpdateConnections = window.updateConnections;
  const baseHandleSearch = window.handleSearch;
  const baseApplyLayout = window.applyLayout;

  const canvas = document.createElement('canvas');
  canvas.id = 'erd-canvas';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: '15',
    display: 'none',
    cursor: 'grab'
  });
  workspace.appendChild(canvas);

  const hud = document.createElement('div');
  hud.id = 'canvas-performance-hud';
  Object.assign(hud.style, {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: '70',
    display: 'none',
    padding: '6px 9px',
    borderRadius: '7px',
    border: '1px solid var(--panel-border)',
    background: 'var(--panel-bg)',
    color: 'var(--text-muted)',
    font: "600 11px 'Fira Code', monospace",
    pointerEvents: 'none'
  });
  workspace.appendChild(hud);

  const ctx = canvas.getContext('2d');
  let active = false;
  let raf = 0;
  let selected = null;
  let query = '';
  let index = null;
  let byId = new Map();
  let drag = null;
  let pan = null;
  let lastFrame = 0;
  let fps = 0;

  const idOf = table => table?.id || table?.name || '';
  const heightOf = table => HEADER + (table?.columns?.length || 0) * ROW + BOTTOM;
  const schema = () => schemaData?.[currentView];
  const isActive = () => active && !!schema();
  const rectOf = (table, gap = 0) => ({
    left: table.x - gap,
    top: table.y - gap,
    right: table.x + W + gap,
    bottom: table.y + heightOf(table) + gap
  });
  const intersects = (a, b) =>
    a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
  const css = (name, fallback) =>
    getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

  function colors() {
    return {
      card: css('--card-bg', '#111827'),
      panel: css('--panel-bg', '#0f172a'),
      border: css('--panel-border', '#334155'),
      text: css('--text-main', '#e5e7eb'),
      muted: css('--text-muted', '#94a3b8'),
      accent: css('--accent-blue', '#38bdf8'),
      rose: css('--accent-rose', '#fb7185'),
      line: css('--line-color', css('--accent-blue', '#38bdf8'))
    };
  }

  function cells(rect) {
    const out = [];
    const minX = Math.floor(rect.left / CELL);
    const maxX = Math.floor(rect.right / CELL);
    const minY = Math.floor(rect.top / CELL);
    const maxY = Math.floor(rect.bottom / CELL);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) out.push(`${x}:${y}`);
    }
    return out;
  }

  function makeIndex(tables) {
    const buckets = new Map();
    const memberships = new Map();

    function insert(table) {
      const keys = cells(rectOf(table, GAP));
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

    tables.forEach(insert);
    return {
      update(table) {
        remove(table);
        insert(table);
      },
      query(rect) {
        const found = new Set();
        cells(rect).forEach(key => buckets.get(key)?.forEach(table => found.add(table)));
        return [...found];
      }
    };
  }

  function normalizeTables(view) {
    const colsPerRow = Math.max(1, Math.ceil(Math.sqrt(view.tables.length || 1)));
    view.tables.forEach((table, idx) => {
      table.id = table.id || table.name;
      if (!Number.isFinite(table.x) || !Number.isFinite(table.y)) {
        table.x = 60 + (idx % colsPerRow) * 450;
        table.y = 80 + Math.floor(idx / colsPerRow) * 360;
      }
    });
  }

  function rebuildIndex() {
    const view = schema();
    if (!view) return;
    normalizeTables(view);
    byId = new Map(view.tables.map(table => [idOf(table), table]));
    index = makeIndex(view.tables);
  }

  function separate(source, other, anchorId) {
    if (!other || source === other || idOf(other) === anchorId) return false;
    const a = rectOf(source);
    const b = rectOf(other);
    const dx = (b.left + b.right - a.left - a.right) / 2;
    const dy = (b.top + b.bottom - a.top - a.bottom) / 2;
    const overlapX = W + GAP - Math.abs(dx);
    const overlapY = (heightOf(source) + heightOf(other)) / 2 + GAP - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) return false;

    if (overlapX < overlapY) {
      other.x += (dx === 0 ? 1 : Math.sign(dx)) * overlapX;
    } else {
      other.y += (dy === 0 ? 1 : Math.sign(dy)) * overlapY;
    }
    return true;
  }

  function collisionWave(seeds, maxDepth, maxMoves, anchorId) {
    const queue = seeds.filter(Boolean).map(table => ({ table, depth: 0 }));
    const seen = new Map(queue.map(item => [idOf(item.table), 0]));
    const touched = new Set();
    let moves = 0;

    while (queue.length && moves < maxMoves) {
      const { table: source, depth } = queue.shift();
      for (const other of index.query(rectOf(source, GAP))) {
        if (moves >= maxMoves) break;
        if (!separate(source, other, anchorId)) continue;

        index.update(other);
        const otherId = idOf(other);
        touched.add(otherId);
        moves += 1;

        if (depth >= maxDepth) continue;
        const nextDepth = depth + 1;
        const priorDepth = seen.get(otherId);
        if (priorDepth !== undefined && priorDepth <= nextDepth) continue;
        seen.set(otherId, nextDepth);
        queue.push({ table: other, depth: nextDepth });
      }
    }
    return touched;
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

  function viewport() {
    const rect = workspace.getBoundingClientRect();
    const margin = 240 / Math.max(scale, 0.05);
    return {
      left: -panX / scale - margin,
      top: -panY / scale - margin,
      right: (rect.width - panX) / scale + margin,
      bottom: (rect.height - panY) / scale + margin
    };
  }

  function rounded(x, y, width, height, radius = 12) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function columnY(table, column) {
    const name = Array.isArray(column) ? column[0] : column;
    const idx = table.columns?.findIndex(col => col.name === name) ?? -1;
    return idx >= 0
      ? table.y + HEADER + idx * ROW + ROW / 2
      : table.y + heightOf(table) / 2;
  }

  function drawRelation(rel, colorSet, visibleRect) {
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
    }, visibleRect)) {
      return false;
    }

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
    ctx.strokeStyle = colorSet.line;
    ctx.globalAlpha = scale < 0.16 ? 0.42 : 0.72;
    ctx.lineWidth = Math.max(1 / scale, 1.7);
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
    ctx.fillStyle = colorSet.line;
    ctx.fill();
    ctx.globalAlpha = 1;
    return true;
  }

  function matches(table) {
    return !query
      || table.name.toLowerCase().includes(query)
      || (table.desc || '').toLowerCase().includes(query)
      || table.columns.some(col => col.name.toLowerCase().includes(query));
  }

  function drawTable(table, colorSet) {
    const height = heightOf(table);
    const lod = scale < 0.16 ? 0 : scale < 0.34 ? 1 : 2;
    const match = matches(table);
    const isSelected = idOf(table) === selected;

    ctx.globalAlpha = match ? 1 : 0.22;
    rounded(table.x, table.y, W, height);
    ctx.fillStyle = colorSet.card;
    ctx.fill();
    ctx.strokeStyle = isSelected ? colorSet.accent : colorSet.border;
    ctx.lineWidth = (isSelected ? 3 : 1.2) / Math.max(scale, 0.1);
    ctx.stroke();

    ctx.save();
    rounded(table.x, table.y, W, HEADER);
    ctx.clip();
    ctx.fillStyle = colorSet.panel;
    ctx.fillRect(table.x, table.y, W, HEADER + 8);
    ctx.restore();

    ctx.textBaseline = 'middle';
    ctx.fillStyle = colorSet.accent;

    if (lod === 0) {
      if (scale >= 0.1) {
        ctx.font = "700 40px 'Fira Code', monospace";
        ctx.fillText(table.name, table.x + 16, table.y + HEADER / 2);
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (lod === 1) {
      ctx.font = "650 24px 'Fira Code', monospace";
      ctx.fillText(table.name, table.x + 16, table.y + 19);
      ctx.fillStyle = colorSet.muted;
      ctx.font = "500 16px 'Fira Code', monospace";
      ctx.fillText(`${table.columns.length} cols`, table.x + 16, table.y + 39);
      ctx.globalAlpha = 1;
      return;
    }

    ctx.font = "600 14px 'Fira Code', monospace";
    ctx.fillText(table.name, table.x + 16, table.y + 19);
    ctx.fillStyle = colorSet.muted;
    ctx.font = "500 10px 'Inter', sans-serif";
    ctx.fillText(table.desc || '', table.x + 16, table.y + 39);

    table.columns.forEach((col, idx) => {
      const cy = table.y + HEADER + idx * ROW + ROW / 2;

      if (col.pk || col.fk) {
        ctx.fillStyle = col.pk ? colorSet.rose : colorSet.accent;
        ctx.globalAlpha = match ? 0.18 : 0.08;
        rounded(table.x + 16, cy - 8, 25, 16, 3);
        ctx.fill();

        ctx.globalAlpha = match ? 1 : 0.22;
        ctx.fillStyle = col.pk ? colorSet.rose : colorSet.accent;
        ctx.font = "700 9px 'Fira Code', monospace";
        ctx.fillText(col.pk ? 'PK' : 'FK', table.x + 21, cy);
      }

      ctx.fillStyle = colorSet.text;
      ctx.font = "500 12px 'Fira Code', monospace";
      ctx.fillText(col.name, table.x + 52, cy);

      ctx.fillStyle = colorSet.muted;
      ctx.font = "500 10px 'Fira Code', monospace";
      const typeWidth = ctx.measureText(col.type).width;
      ctx.fillText(col.type, table.x + W - 16 - typeWidth, cy);
    });

    ctx.globalAlpha = 1;
  }

  function draw() {
    raf = 0;
    if (!isActive()) return;

    resize();
    const rect = workspace.getBoundingClientRect();
    const dpr = Number(canvas.dataset.dpr) || 1;
    const view = schema();
    const visibleRect = viewport();
    const colorSet = colors();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    let lineCount = 0;
    (view.relations || []).forEach(rel => {
      if (drawRelation(rel, colorSet, visibleRect)) lineCount += 1;
    });

    const visibleTables = index.query(visibleRect)
      .filter(table => intersects(rectOf(table), visibleRect));
    visibleTables.forEach(table => drawTable(table, colorSet));
    ctx.restore();

    if (zoomText) zoomText.innerText = `${Math.round(scale * 100)}%`;

    if (view.tables.length >= LARGE_SCHEMA_THRESHOLD) {
      const now = performance.now();
      if (lastFrame) {
        const currentFps = 1000 / Math.max(1, now - lastFrame);
        fps = fps ? fps * 0.82 + currentFps * 0.18 : currentFps;
      }
      lastFrame = now;
      hud.style.display = 'block';
      hud.textContent =
        `CANVAS · ${visibleTables.length}/${view.tables.length} tables · `
        + `${lineCount}/${(view.relations || []).length} lines · `
        + `${Math.min(99, Math.round(fps || 0))} fps`;
    } else {
      hud.style.display = 'none';
      lastFrame = 0;
      fps = 0;
    }
  }

  function requestDraw() {
    if (isActive() && !raf) raf = requestAnimationFrame(draw);
  }

  function center() {
    const view = schema();
    const rect = workspace.getBoundingClientRect();
    if (!view?.tables?.length) {
      scale = 1;
      panX = 0;
      panY = 0;
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    view.tables.forEach(table => {
      minX = Math.min(minX, table.x);
      minY = Math.min(minY, table.y);
      maxX = Math.max(maxX, table.x + W);
      maxY = Math.max(maxY, table.y + heightOf(table));
    });

    scale = 1;
    panX = rect.width / 2 - (minX + maxX) / 2;
    panY = rect.height / 2 - (minY + maxY) / 2;
  }

  function enter(viewKey) {
    currentView = viewKey;
    active = true;
    selected = null;
    selectedTableId = null;
    query = (searchInput?.value || '').toLowerCase().trim();

    document.getElementById('cards-container').innerHTML = '';
    canvas.style.display = 'block';
    domLayer.style.display = 'none';

    rebuildIndex();
    center();
    requestDraw();
  }

  function leave() {
    active = false;
    canvas.style.display = 'none';
    hud.style.display = 'none';
    domLayer.style.display = '';
    drag = null;
    pan = null;
  }

  function inspect(table) {
    const inspector = document.getElementById('inspector');
    const tableId = idOf(table);
    const sameOpen = selected === tableId && inspector?.classList.contains('open');

    selected = tableId;
    selectedTableId = tableId;
    if (sameOpen) {
      inspector?.classList.remove('open');
      requestDraw();
      return;
    }

    document.getElementById('drawer-table-name').innerText = table.name;
    document.getElementById('drawer-table-desc').innerText = table.desc || '';

    const maxName = Math.max(...table.columns.map(col => col.name.length), 22);
    let ddl = `CREATE TABLE ${table.name} (\n`;
    table.columns.forEach((col, idx) => {
      ddl += `    ${col.name.padEnd(maxName + 4)}${col.type}${col.pk ? ' PRIMARY KEY' : ''}`
        + `${idx === table.columns.length - 1 ? '' : ','}\n`;
    });
    ddl += ');';
    document.getElementById('ddl-text').innerText = ddl;

    let mock = `INSERT INTO ${table.name} (\n`;
    table.columns.forEach((col, idx) => {
      mock += `    ${col.name}${idx === table.columns.length - 1 ? '' : ','}\n`;
    });
    mock += ') VALUES (\n';
    table.columns.forEach((col, idx) => {
      const value = col.type.includes('VARCHAR')
        ? "'STD_VALUE'"
        : col.type === 'DATE'
          ? 'SYSDATE'
          : '100';
      mock += `    ${value}${idx === table.columns.length - 1 ? '' : ','}\n`;
    });
    mock += ');';
    document.getElementById('mock-text').innerText = mock;

    inspector?.classList.add('open');
    requestDraw();
  }

  function hit(x, y) {
    if (!index) return null;
    for (const table of index.query({ left: x, top: y, right: x, bottom: y }).reverse()) {
      const rect = rectOf(table);
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return table;
      }
    }
    return null;
  }

  function world(clientX, clientY) {
    const rect = workspace.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / scale,
      y: (clientY - rect.top - panY) / scale
    };
  }

  function minScale() {
    return (schema()?.tables?.length || 0) >= LARGE_SCHEMA_THRESHOLD
      ? LARGE_MIN_SCALE
      : NORMAL_MIN_SCALE;
  }

  function zoomAt(factor, anchorX, anchorY) {
    if (!isActive()) return false;

    const oldScale = Math.max(scale, 0.0001);
    const nextScale = Math.min(2.5, Math.max(minScale(), oldScale * factor));
    if (Math.abs(nextScale - oldScale) < 0.000001) return true;

    const worldX = (anchorX - panX) / oldScale;
    const worldY = (anchorY - panY) / oldScale;
    scale = nextScale;
    panX = anchorX - worldX * nextScale;
    panY = anchorY - worldY * nextScale;
    requestDraw();
    return true;
  }

  function resetView() {
    if (!isActive()) return false;
    center();
    requestDraw();
    return true;
  }

  canvas.addEventListener('mousedown', event => {
    if (!isActive() || event.button !== 0) return;
    event.preventDefault();

    const point = world(event.clientX, event.clientY);
    const table = hit(point.x, point.y);
    canvas.style.cursor = 'grabbing';

    if (table) {
      drag = {
        table,
        id: idOf(table),
        startX: event.clientX,
        startY: event.clientY,
        offsetX: point.x - table.x,
        offsetY: point.y - table.y,
        moved: false,
        touched: new Set()
      };
    } else {
      pan = {
        startX: event.clientX,
        startY: event.clientY,
        panX,
        panY
      };
    }
  });

  window.addEventListener('mousemove', event => {
    if (!isActive()) return;

    if (drag) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) >= 5) drag.moved = true;

      const point = world(event.clientX, event.clientY);
      drag.table.x = point.x - drag.offsetX;
      drag.table.y = point.y - drag.offsetY;
      index.update(drag.table);

      collisionWave(
        [drag.table],
        DRAG_DEPTH,
        DRAG_MOVES,
        drag.id
      ).forEach(id => drag.touched.add(id));

      requestDraw();
      return;
    }

    if (pan) {
      panX = pan.panX + event.clientX - pan.startX;
      panY = pan.panY + event.clientY - pan.startY;
      requestDraw();
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isActive()) return;

    if (drag) {
      const finished = drag;
      drag = null;
      canvas.style.cursor = 'grab';

      if (!finished.moved) {
        inspect(finished.table);
        return;
      }

      const seeds = [
        finished.table,
        ...[...finished.touched]
          .slice(-48)
          .map(id => byId.get(id))
          .filter(Boolean)
      ];
      collisionWave(seeds, SETTLE_DEPTH, SETTLE_MOVES, finished.id);
      requestDraw();
      return;
    }

    if (pan) {
      pan = null;
      canvas.style.cursor = 'grab';
    }
  });

  window.addEventListener('wheel', event => {
    if (!isActive() || !workspace.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const rect = workspace.getBoundingClientRect();
    zoomAt(
      event.deltaY < 0 ? 1.1 : 0.9,
      event.clientX - rect.left,
      event.clientY - rect.top
    );
  }, { capture: true, passive: false });

  window.addEventListener('resize', requestDraw);

  window.renderView = function(viewKey) {
    if (!schemaData?.[viewKey]) {
      leave();
      return baseRenderView?.call(this, viewKey);
    }
    enter(viewKey);
  };

  window.updateConnections = function(...args) {
    if (isActive()) return requestDraw();
    return baseUpdateConnections?.apply(this, args);
  };

  window.handleSearch = function(...args) {
    if (!isActive()) return baseHandleSearch?.apply(this, args);
    query = (searchInput?.value || '').toLowerCase().trim();
    requestDraw();
  };

  window.applyLayout = function(type, ...args) {
    if (!isActive() || type !== 'grid') {
      return baseApplyLayout?.call(this, type, ...args);
    }

    const view = schema();
    const cols = Math.ceil(Math.sqrt(view.tables.length));
    view.tables.forEach((table, idx) => {
      table.x = 100 + (idx % cols) * 450;
      table.y = 100 + Math.floor(idx / cols) * 450;
    });
    rebuildIndex();
    center();
    requestDraw();
  };

  window.ERDCanvasRenderer = {
    isActive,
    requestDraw,
    zoomAt,
    resetView,
    rebuildIndex
  };
  window.ERDPerformanceCanvas = window.ERDCanvasRenderer;

  window.addEventListener('load', () => {
    const fallbackZoom = window.zoomCanvas;
    const fallbackReset = window.resetZoom;
    const fallbackApply = window.applyTransform;

    window.zoomCanvas = function(factor, anchorX, anchorY) {
      if (!isActive()) return fallbackZoom?.call(this, factor, anchorX, anchorY);
      const rect = workspace.getBoundingClientRect();
      return zoomAt(
        factor,
        Number.isFinite(anchorX) ? anchorX : rect.width / 2,
        Number.isFinite(anchorY) ? anchorY : rect.height / 2
      );
    };

    window.resetZoom = function(...args) {
      return isActive() ? resetView() : fallbackReset?.apply(this, args);
    };

    window.applyTransform = function(...args) {
      if (isActive()) return requestDraw();
      return fallbackApply?.apply(this, args);
    };
  });
})();
