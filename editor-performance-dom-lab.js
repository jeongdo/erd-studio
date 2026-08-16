/** ARGUS renderer lab: explicit DOM + SVG baseline for 1,000 tables. */
(() => {
  'use strict';

  const VIEW = 'performance_lab_dom_1000';
  const W = 360, HEADER = 52, ROW = 34, BOTTOM = 12;
  const GAP = 60, CELL = 520;
  const DRAG_DEPTH = 2, DRAG_MOVES = 32;
  const SETTLE_DEPTH = 6, SETTLE_MOVES = 120;
  const workspace = document.getElementById('workspace');
  const legacyLayer = document.getElementById('canvas-layer');
  const zoomText = document.getElementById('zoom-text');
  if (!workspace || !legacyLayer || typeof schemaData === 'undefined') return;

  const fallbackRenderView = window.renderView;
  const fallbackUpdateConnections = window.updateConnections;
  const fallbackApplyLayout = window.applyLayout;

  const root = document.createElement('div');
  root.id = 'argus-dom-lab';
  Object.assign(root.style, {
    position: 'absolute', inset: '0', zIndex: '21', display: 'none', overflow: 'hidden', cursor: 'grab'
  });

  const scene = document.createElement('div');
  Object.assign(scene.style, {
    position: 'absolute', left: '0', top: '0', transformOrigin: '0 0', willChange: 'transform'
  });
  root.appendChild(scene);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(svg.style, {
    position: 'absolute', left: '0', top: '0', overflow: 'visible', pointerEvents: 'none'
  });
  scene.appendChild(svg);

  const cards = document.createElement('div');
  Object.assign(cards.style, { position: 'absolute', left: '0', top: '0' });
  scene.appendChild(cards);
  workspace.appendChild(root);

  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'absolute', top: '12px', left: '12px', zIndex: '82', display: 'none',
    padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--panel-border)',
    background: 'var(--panel-bg)', color: 'var(--text-muted)',
    font: "600 11px 'Fira Code', monospace", pointerEvents: 'none'
  });
  workspace.appendChild(hud);

  let active = false;
  let scaleLocal = 1;
  let panLocalX = 0;
  let panLocalY = 0;
  let bounds = null;
  let signature = '';
  let byId = new Map();
  let cardById = new Map();
  let relationByTable = new Map();
  let pathByRelation = new Map();
  let spatialIndex = null;
  let drag = null;
  let pan = null;
  let lastBuildMs = 0;

  const idOf = table => table?.id || table?.name || '';
  const heightOf = table => HEADER + (table?.columns?.length || 0) * ROW + BOTTOM;
  const rectOf = (table, gap = 0) => ({
    left: table.x - gap,
    top: table.y - gap,
    right: table.x + W + gap,
    bottom: table.y + heightOf(table) + gap
  });
  const view = () => schemaData?.[VIEW];
  const css = (name, fallback) => getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

  function relationKey(rel, index) {
    return `${index}:${rel.from}:${rel.to}`;
  }

  function cellKeys(rect) {
    const keys = [];
    for (let x = Math.floor(rect.left / CELL); x <= Math.floor(rect.right / CELL); x += 1) {
      for (let y = Math.floor(rect.top / CELL); y <= Math.floor(rect.bottom / CELL); y += 1) {
        keys.push(`${x}:${y}`);
      }
    }
    return keys;
  }

  function makeSpatialIndex(tables) {
    const buckets = new Map();
    const memberships = new Map();

    function insert(table) {
      const keys = cellKeys(rectOf(table, GAP));
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
        cellKeys(rect).forEach(key => buckets.get(key)?.forEach(table => found.add(table)));
        return [...found];
      }
    };
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
    if (!spatialIndex) return new Set();
    const queue = seeds.filter(Boolean).map(table => ({ table, depth: 0 }));
    const seen = new Map(queue.map(item => [idOf(item.table), 0]));
    const touched = new Set();
    let moves = 0;

    while (queue.length && moves < maxMoves) {
      const { table: source, depth } = queue.shift();
      for (const other of spatialIndex.query(rectOf(source, GAP))) {
        if (moves >= maxMoves) break;
        if (!separate(source, other, anchorId)) continue;

        spatialIndex.update(other);
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

  function geometry(rel) {
    const from = byId.get(rel.from);
    const to = byId.get(rel.to);
    if (!from || !to) return null;
    const fh = heightOf(from), th = heightOf(to);
    const fx = from.x + W / 2, fy = from.y + fh / 2;
    const tx = to.x + W / 2, ty = to.y + th / 2;
    const dx = tx - fx, dy = ty - fy;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      const y1 = dy > 0 ? from.y + fh + 8 : from.y - 8;
      const y2 = dy > 0 ? to.y - 8 : to.y + th + 8;
      const midX = (fx + tx) / 2;
      const arm = Math.abs(y2 - y1) * 0.5;
      return `M ${fx} ${y1} C ${midX} ${y1 + (dy > 0 ? arm : -arm)}, ${midX} ${y2 + (dy > 0 ? -arm : arm)}, ${tx} ${y2}`;
    }
    const x1 = dx > 0 ? from.x + W + 8 : from.x - 8;
    const x2 = dx > 0 ? to.x - 8 : to.x + W + 8;
    const arm = Math.max(Math.abs(x2 - x1) * 0.55, 40);
    return `M ${x1} ${fy} C ${x1 + (dx > 0 ? arm : -arm)} ${fy}, ${x2 + (dx > 0 ? -arm : arm)} ${ty}, ${x2} ${ty}`;
  }

  function computeBounds(tables) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    tables.forEach(table => {
      left = Math.min(left, table.x);
      top = Math.min(top, table.y);
      right = Math.max(right, table.x + W);
      bottom = Math.max(bottom, table.y + heightOf(table));
    });
    return { left, top, right, bottom };
  }

  function syncSceneBounds() {
    const data = view();
    if (!data?.tables?.length) return;
    bounds = computeBounds(data.tables);
    svg.setAttribute('width', String(Math.max(1, bounds.right + 200)));
    svg.setAttribute('height', String(Math.max(1, bounds.bottom + 200)));
  }

  function build() {
    const data = view();
    if (!data) return;
    const nextSignature = `${data.tables.length}:${data.relations.length}:${idOf(data.tables[0])}:${idOf(data.tables[data.tables.length - 1])}`;
    if (nextSignature === signature && cards.childElementCount) return;

    const started = performance.now();
    byId = new Map(data.tables.map(table => [idOf(table), table]));
    relationByTable = new Map();
    pathByRelation = new Map();
    cardById = new Map();
    spatialIndex = makeSpatialIndex(data.tables);
    cards.innerHTML = '';
    svg.innerHTML = '';
    bounds = computeBounds(data.tables);

    const frag = document.createDocumentFragment();
    const cardBg = css('--card-bg', '#111827');
    const panelBg = css('--panel-bg', '#0f172a');
    const border = css('--panel-border', '#334155');
    const text = css('--text-main', '#e5e7eb');
    const muted = css('--text-muted', '#94a3b8');
    const accent = css('--accent-blue', '#38bdf8');

    data.tables.forEach(table => {
      const id = idOf(table);
      const card = document.createElement('div');
      card.dataset.tableId = id;
      Object.assign(card.style, {
        position: 'absolute', left: `${table.x}px`, top: `${table.y}px`, width: `${W}px`,
        height: `${heightOf(table)}px`, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${border}`, borderRadius: '10px', background: cardBg,
        color: text, fontFamily: "'Fira Code', monospace", userSelect: 'none'
      });
      const rows = (table.columns || []).map(column =>
        `<div style="height:${ROW}px;display:flex;align-items:center;padding:0 14px;gap:8px;font-size:11px;border-top:1px solid ${border}33">`
        + `<b style="width:22px;color:${column.pk ? '#fb7185' : column.fk ? accent : muted}">${column.pk ? 'PK' : column.fk ? 'FK' : ''}</b>`
        + `<span style="flex:1">${column.name}</span><span style="color:${muted}">${column.type}</span></div>`
      ).join('');
      card.innerHTML = `<div style="height:${HEADER}px;background:${panelBg};padding:8px 14px;box-sizing:border-box">`
        + `<div style="font-size:13px;font-weight:700;color:${accent}">${table.name}</div>`
        + `<div style="font-size:10px;color:${muted};margin-top:4px">${table.desc || ''}</div></div>${rows}`;
      cardById.set(id, card);
      frag.appendChild(card);
    });
    cards.appendChild(frag);

    const lineColor = css('--line-color', accent);
    data.relations.forEach((rel, index) => {
      const key = relationKey(rel, index);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.dataset.relationKey = key;
      path.setAttribute('d', geometry(rel) || '');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', lineColor);
      path.setAttribute('stroke-width', '1.6');
      if (!rel.identifying) path.setAttribute('stroke-dasharray', '8 5');
      svg.appendChild(path);
      pathByRelation.set(key, { path, rel, index });
      [rel.from, rel.to].forEach(tableId => {
        if (!relationByTable.has(tableId)) relationByTable.set(tableId, []);
        relationByTable.get(tableId).push(key);
      });
    });

    syncSceneBounds();
    signature = nextSignature;
    lastBuildMs = performance.now() - started;
    updateHud();
  }

  function updateConnected(tableId) {
    (relationByTable.get(tableId) || []).forEach(key => {
      const entry = pathByRelation.get(key);
      if (entry) entry.path.setAttribute('d', geometry(entry.rel) || '');
    });
  }

  function syncTable(table) {
    const card = cardById.get(idOf(table));
    if (card) {
      card.style.left = `${table.x}px`;
      card.style.top = `${table.y}px`;
    }
    updateConnected(idOf(table));
  }

  function syncTouched(ids) {
    ids.forEach(id => {
      const table = byId.get(id);
      if (table) syncTable(table);
    });
  }

  function transform() {
    scene.style.transform = `translate(${panLocalX}px, ${panLocalY}px) scale(${scaleLocal})`;
    scale = scaleLocal;
    panX = panLocalX;
    panY = panLocalY;
    if (zoomText) zoomText.innerText = `${Math.round(scaleLocal * 100)}%`;
  }

  function center() {
    if (!bounds) return;
    const rect = workspace.getBoundingClientRect();
    const fit = Math.max(0.03, Math.min(1,
      (rect.width - 90) / Math.max(1, bounds.right - bounds.left),
      (rect.height - 90) / Math.max(1, bounds.bottom - bounds.top)
    ));
    scaleLocal = fit;
    panLocalX = rect.width / 2 - (bounds.left + bounds.right) / 2 * fit;
    panLocalY = rect.height / 2 - (bounds.top + bounds.bottom) / 2 * fit;
    transform();
  }

  function zoomAt(factor, x, y) {
    if (!active) return false;
    const old = Math.max(scaleLocal, 0.0001);
    const next = Math.max(0.03, Math.min(2.5, old * factor));
    const worldX = (x - panLocalX) / old;
    const worldY = (y - panLocalY) / old;
    scaleLocal = next;
    panLocalX = x - worldX * next;
    panLocalY = y - worldY * next;
    transform();
    return true;
  }

  function updateHud() {
    if (!active) return;
    const data = view();
    const nodeCount = scene.querySelectorAll('*').length;
    hud.textContent = `DOM/SVG · ${data.tables.length} tables · ${data.relations.length} paths · ${nodeCount} DOM nodes · build ${lastBuildMs.toFixed(1)} ms · collision d${DRAG_DEPTH}/${DRAG_MOVES}`;
  }

  function enter() {
    fallbackRenderView?.call(window, '__argus_dom_lab_off__');
    currentView = VIEW;
    active = true;
    root.style.display = 'block';
    legacyLayer.style.display = 'none';
    hud.style.display = 'block';
    build();
    center();
    updateHud();
  }

  function leave() {
    active = false;
    root.style.display = 'none';
    hud.style.display = 'none';
    drag = null;
    pan = null;
  }

  root.addEventListener('mousedown', event => {
    if (!active || event.button !== 0) return;
    event.preventDefault();
    const card = event.target.closest('[data-table-id]');
    if (card) {
      const table = byId.get(card.dataset.tableId);
      if (!table) return;
      const rect = workspace.getBoundingClientRect();
      const wx = (event.clientX - rect.left - panLocalX) / scaleLocal;
      const wy = (event.clientY - rect.top - panLocalY) / scaleLocal;
      drag = {
        table,
        id: idOf(table),
        ox: wx - table.x,
        oy: wy - table.y,
        touched: new Set()
      };
      root.style.cursor = 'grabbing';
    } else {
      pan = { x: event.clientX, y: event.clientY, px: panLocalX, py: panLocalY };
      root.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', event => {
    if (!active) return;
    if (drag) {
      const rect = workspace.getBoundingClientRect();
      drag.table.x = (event.clientX - rect.left - panLocalX) / scaleLocal - drag.ox;
      drag.table.y = (event.clientY - rect.top - panLocalY) / scaleLocal - drag.oy;
      spatialIndex.update(drag.table);
      syncTable(drag.table);

      collisionWave([drag.table], DRAG_DEPTH, DRAG_MOVES, drag.id).forEach(id => {
        drag.touched.add(id);
      });
      syncTouched(drag.touched);
      return;
    }
    if (pan) {
      panLocalX = pan.px + event.clientX - pan.x;
      panLocalY = pan.py + event.clientY - pan.y;
      transform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (!active) return;
    if (drag) {
      const finished = drag;
      drag = null;
      const seeds = [
        finished.table,
        ...[...finished.touched].slice(-48).map(id => byId.get(id)).filter(Boolean)
      ];
      const settled = collisionWave(seeds, SETTLE_DEPTH, SETTLE_MOVES, finished.id);
      syncTable(finished.table);
      syncTouched(new Set([...finished.touched, ...settled]));
      syncSceneBounds();
    }
    pan = null;
    root.style.cursor = 'grab';
  });

  window.addEventListener('wheel', event => {
    if (!active || !workspace.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const rect = workspace.getBoundingClientRect();
    zoomAt(event.deltaY < 0 ? 1.1 : 0.9, event.clientX - rect.left, event.clientY - rect.top);
  }, { capture: true, passive: false });

  window.renderView = function(viewKey) {
    if (viewKey === VIEW) return enter();
    leave();
    return fallbackRenderView?.call(this, viewKey);
  };

  window.updateConnections = function(...args) {
    if (active) return true;
    return fallbackUpdateConnections?.apply(this, args);
  };

  window.applyLayout = function(type, ...args) {
    if (active) {
      if (type === 'grid') center();
      return true;
    }
    return fallbackApplyLayout?.call(this, type, ...args);
  };

  window.ARGUSDomLab = { isActive: () => active, zoomAt, resetView: () => { center(); return true; } };

  window.addEventListener('load', () => {
    const fallbackZoom = window.zoomCanvas;
    const fallbackReset = window.resetZoom;
    const fallbackApply = window.applyTransform;
    window.zoomCanvas = function(factor, x, y) {
      if (!active) return fallbackZoom?.call(this, factor, x, y);
      const rect = workspace.getBoundingClientRect();
      return zoomAt(factor, Number.isFinite(x) ? x : rect.width / 2, Number.isFinite(y) ? y : rect.height / 2);
    };
    window.resetZoom = function(...args) {
      if (!active) return fallbackReset?.apply(this, args);
      center(); return true;
    };
    window.applyTransform = function(...args) {
      if (active) { transform(); return true; }
      return fallbackApply?.apply(this, args);
    };
  });
})();