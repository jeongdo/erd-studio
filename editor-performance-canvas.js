/** Canvas-only renderer for the 1000-table performance view. Normal views stay DOM/SVG. */
(() => {
  'use strict';

  const VIEW = 'performance_1000';
  const W = 360, HEADER = 52, ROW = 34, BOTTOM = 12, GAP = 60, CELL = 520;
  const DRAG_DEPTH = 2, DRAG_MOVES = 32, SETTLE_DEPTH = 6, SETTLE_MOVES = 120;
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
  canvas.id = 'performance-canvas';
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '15', display: 'none', cursor: 'grab' });
  workspace.appendChild(canvas);

  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'absolute', top: '12px', left: '12px', zIndex: '70', display: 'none',
    padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--panel-border)',
    background: 'var(--panel-bg)', color: 'var(--text-muted)',
    font: "600 11px 'Fira Code', monospace", pointerEvents: 'none'
  });
  workspace.appendChild(hud);

  const ctx = canvas.getContext('2d');
  let active = false, raf = 0, selected = null, query = '', index = null, byId = new Map();
  let drag = null, pan = null, lastFrame = 0, fps = 0;

  const idOf = t => t?.id || t?.name || '';
  const heightOf = t => HEADER + (t?.columns?.length || 0) * ROW + BOTTOM;
  const schema = () => schemaData?.[VIEW];
  const isActive = () => active && currentView === VIEW;
  const rectOf = (t, gap = 0) => ({ left: t.x - gap, top: t.y - gap, right: t.x + W + gap, bottom: t.y + heightOf(t) + gap });
  const intersects = (a, b) => a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
  const css = (name, fallback) => getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

  function colors() {
    return {
      card: css('--card-bg', '#111827'), panel: css('--panel-bg', '#0f172a'), border: css('--panel-border', '#334155'),
      text: css('--text-main', '#e5e7eb'), muted: css('--text-muted', '#94a3b8'), accent: css('--accent-blue', '#38bdf8'),
      rose: css('--accent-rose', '#fb7185'), line: css('--line-color', css('--accent-blue', '#38bdf8'))
    };
  }

  function cells(r) {
    const out = [];
    for (let x = Math.floor(r.left / CELL); x <= Math.floor(r.right / CELL); x++) {
      for (let y = Math.floor(r.top / CELL); y <= Math.floor(r.bottom / CELL); y++) out.push(`${x}:${y}`);
    }
    return out;
  }

  function makeIndex(tables) {
    const buckets = new Map(), memberships = new Map();
    const insert = t => {
      const keys = cells(rectOf(t, GAP)); memberships.set(idOf(t), keys);
      keys.forEach(k => { if (!buckets.has(k)) buckets.set(k, new Set()); buckets.get(k).add(t); });
    };
    const remove = t => {
      (memberships.get(idOf(t)) || []).forEach(k => { const b = buckets.get(k); b?.delete(t); if (b?.size === 0) buckets.delete(k); });
      memberships.delete(idOf(t));
    };
    tables.forEach(insert);
    return {
      update(t) { remove(t); insert(t); },
      query(r) { const found = new Set(); cells(r).forEach(k => buckets.get(k)?.forEach(t => found.add(t))); return [...found]; }
    };
  }

  function rebuildIndex() {
    const tables = schema()?.tables || [];
    byId = new Map(tables.map(t => [idOf(t), t]));
    index = makeIndex(tables);
  }

  function separate(source, other, anchorId) {
    if (!other || source === other || idOf(other) === anchorId) return false;
    const a = rectOf(source), b = rectOf(other);
    const dx = (b.left + b.right - a.left - a.right) / 2;
    const dy = (b.top + b.bottom - a.top - a.bottom) / 2;
    const overlapX = W + GAP - Math.abs(dx);
    const overlapY = (heightOf(source) + heightOf(other)) / 2 + GAP - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) return false;
    if (overlapX < overlapY) other.x += (dx === 0 ? 1 : Math.sign(dx)) * overlapX;
    else other.y += (dy === 0 ? 1 : Math.sign(dy)) * overlapY;
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
        index.update(other); touched.add(idOf(other)); moves++;
        if (depth >= maxDepth) continue;
        const next = depth + 1, prior = seen.get(idOf(other));
        if (prior !== undefined && prior <= next) continue;
        seen.set(idOf(other), next); queue.push({ table: other, depth: next });
      }
    }
    return touched;
  }

  function resize() {
    const r = workspace.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    canvas.dataset.dpr = dpr;
  }

  function viewport() {
    const r = workspace.getBoundingClientRect(), m = 240 / Math.max(scale, .05);
    return { left: -panX / scale - m, top: -panY / scale - m, right: (r.width - panX) / scale + m, bottom: (r.height - panY) / scale + m };
  }

  function rounded(x, y, w, h, r = 12) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }

  function drawRelation(rel, c, vp) {
    const from = byId.get(rel.from), to = byId.get(rel.to); if (!from || !to) return false;
    const fh = heightOf(from), th = heightOf(to), fx = from.x + W / 2, fy = from.y + fh / 2, tx = to.x + W / 2, ty = to.y + th / 2;
    if (!intersects({ left: Math.min(fx, tx) - 80, top: Math.min(fy, ty) - 80, right: Math.max(fx, tx) + 80, bottom: Math.max(fy, ty) + 80 }, vp)) return false;
    const dx = tx - fx, dy = ty - fy; let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      x1 = fx; x2 = tx; y1 = dy > 0 ? from.y + fh + 8 : from.y - 8; y2 = dy > 0 ? to.y - 8 : to.y + th + 8;
      const arm = Math.abs(y2 - y1) * .5, mid = (x1 + x2) / 2;
      c1x = c2x = mid; c1y = y1 + (dy > 0 ? arm : -arm); c2y = y2 + (dy > 0 ? -arm : arm);
    } else {
      y1 = fy; y2 = ty; x1 = dx > 0 ? from.x + W + 8 : from.x - 8; x2 = dx > 0 ? to.x - 8 : to.x + W + 8;
      const arm = Math.max(Math.abs(x2 - x1) * .55, 40), mid = (y1 + y2) / 2;
      c1x = x1 + (dx > 0 ? arm : -arm); c2x = x2 + (dx > 0 ? -arm : arm); c1y = c2y = mid;
    }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
    ctx.strokeStyle = c.line; ctx.globalAlpha = scale < .16 ? .42 : .72; ctx.lineWidth = Math.max(1 / scale, 1.7);
    ctx.setLineDash(rel.identifying ? [] : [8 / scale, 5 / scale]); ctx.stroke(); ctx.setLineDash([]);
    const angle = Math.atan2(y2 - c2y, x2 - c2x), arrow = 8 / Math.max(scale, .08);
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(angle - .55) * arrow, y2 - Math.sin(angle - .55) * arrow); ctx.lineTo(x2 - Math.cos(angle + .55) * arrow, y2 - Math.sin(angle + .55) * arrow); ctx.closePath(); ctx.fillStyle = c.line; ctx.fill();
    ctx.globalAlpha = 1; return true;
  }

  function matches(t) {
    return !query || t.name.toLowerCase().includes(query) || (t.desc || '').toLowerCase().includes(query) || t.columns.some(col => col.name.toLowerCase().includes(query));
  }

  function drawTable(t, c) {
    const h = heightOf(t), lod = scale < .16 ? 0 : scale < .34 ? 1 : 2, match = matches(t), isSelected = idOf(t) === selected;
    ctx.globalAlpha = match ? 1 : .22;
    rounded(t.x, t.y, W, h); ctx.fillStyle = c.card; ctx.fill(); ctx.strokeStyle = isSelected ? c.accent : c.border; ctx.lineWidth = (isSelected ? 3 : 1.2) / Math.max(scale, .1); ctx.stroke();
    ctx.save(); rounded(t.x, t.y, W, HEADER); ctx.clip(); ctx.fillStyle = c.panel; ctx.fillRect(t.x, t.y, W, HEADER + 8); ctx.restore();
    ctx.textBaseline = 'middle'; ctx.fillStyle = c.accent;
    if (lod === 0) { if (scale >= .1) { ctx.font = "700 40px 'Fira Code', monospace"; ctx.fillText(t.name, t.x + 16, t.y + HEADER / 2); } ctx.globalAlpha = 1; return; }
    if (lod === 1) { ctx.font = "650 24px 'Fira Code', monospace"; ctx.fillText(t.name, t.x + 16, t.y + 19); ctx.fillStyle = c.muted; ctx.font = "500 16px 'Fira Code', monospace"; ctx.fillText(`${t.columns.length} cols`, t.x + 16, t.y + 39); ctx.globalAlpha = 1; return; }
    ctx.font = "600 14px 'Fira Code', monospace"; ctx.fillText(t.name, t.x + 16, t.y + 19); ctx.fillStyle = c.muted; ctx.font = "500 10px 'Inter', sans-serif"; ctx.fillText(t.desc || '', t.x + 16, t.y + 39);
    t.columns.forEach((col, i) => {
      const cy = t.y + HEADER + i * ROW + ROW / 2;
      if (col.pk || col.fk) { ctx.fillStyle = col.pk ? c.rose : c.accent; ctx.globalAlpha = match ? .18 : .08; rounded(t.x + 16, cy - 8, 25, 16, 3); ctx.fill(); ctx.globalAlpha = match ? 1 : .22; ctx.fillStyle = col.pk ? c.rose : c.accent; ctx.font = "700 9px 'Fira Code', monospace"; ctx.fillText(col.pk ? 'PK' : 'FK', t.x + 21, cy); }
      ctx.fillStyle = c.text; ctx.font = "500 12px 'Fira Code', monospace"; ctx.fillText(col.name, t.x + 52, cy);
      ctx.fillStyle = c.muted; ctx.font = "500 10px 'Fira Code', monospace"; const tw = ctx.measureText(col.type).width; ctx.fillText(col.type, t.x + W - 16 - tw, cy);
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    raf = 0; if (!isActive()) return; resize();
    const r = workspace.getBoundingClientRect(), dpr = Number(canvas.dataset.dpr) || 1, view = schema(), vp = viewport(), c = colors();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height); ctx.save(); ctx.translate(panX, panY); ctx.scale(scale, scale);
    let lines = 0; view.relations.forEach(rel => { if (drawRelation(rel, c, vp)) lines++; });
    const visible = view.tables.filter(t => intersects(rectOf(t), vp)); visible.forEach(t => drawTable(t, c)); ctx.restore();
    if (zoomText) zoomText.innerText = `${Math.round(scale * 100)}%`;
    const now = performance.now(); if (lastFrame) { const current = 1000 / Math.max(1, now - lastFrame); fps = fps ? fps * .82 + current * .18 : current; } lastFrame = now;
    hud.textContent = `CANVAS · ${visible.length}/${view.tables.length} tables · ${lines}/${view.relations.length} lines · ${Math.min(99, Math.round(fps || 0))} fps`;
  }

  function requestDraw() { if (isActive() && !raf) raf = requestAnimationFrame(draw); }

  function center() {
    const view = schema(), r = workspace.getBoundingClientRect(); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    view.tables.forEach(t => { minX = Math.min(minX, t.x); minY = Math.min(minY, t.y); maxX = Math.max(maxX, t.x + W); maxY = Math.max(maxY, t.y + heightOf(t)); });
    scale = 1; panX = r.width / 2 - (minX + maxX) / 2; panY = r.height / 2 - (minY + maxY) / 2;
  }

  function enter() { active = true; canvas.style.display = 'block'; hud.style.display = 'block'; domLayer.style.display = 'none'; selected = null; query = (searchInput?.value || '').toLowerCase().trim(); rebuildIndex(); center(); requestDraw(); }
  function leave() { active = false; canvas.style.display = 'none'; hud.style.display = 'none'; domLayer.style.display = ''; drag = pan = null; }

  function inspect(t) {
    const inspector = document.getElementById('inspector'), sameOpen = selected === idOf(t) && inspector?.classList.contains('open'); selected = idOf(t); selectedTableId = selected;
    if (sameOpen) { inspector?.classList.remove('open'); requestDraw(); return; }
    document.getElementById('drawer-table-name').innerText = t.name; document.getElementById('drawer-table-desc').innerText = t.desc || '';
    const max = Math.max(...t.columns.map(c => c.name.length), 22);
    let ddl = `CREATE TABLE ${t.name} (\n`; t.columns.forEach((c, i) => { ddl += `    ${c.name.padEnd(max + 4)}${c.type}${c.pk ? ' PRIMARY KEY' : ''}${i === t.columns.length - 1 ? '' : ','}\n`; }); ddl += ');'; document.getElementById('ddl-text').innerText = ddl;
    let mock = `INSERT INTO ${t.name} (\n`; t.columns.forEach((c, i) => { mock += `    ${c.name}${i === t.columns.length - 1 ? '' : ','}\n`; }); mock += ') VALUES (\n'; t.columns.forEach((c, i) => { const v = c.type.includes('VARCHAR') ? "'STD_VALUE'" : c.type === 'DATE' ? 'SYSDATE' : '100'; mock += `    ${v}${i === t.columns.length - 1 ? '' : ','}\n`; }); mock += ');'; document.getElementById('mock-text').innerText = mock;
    inspector?.classList.add('open'); requestDraw();
  }

  function hit(x, y) {
    for (const t of index.query({ left: x, top: y, right: x, bottom: y }).reverse()) { const r = rectOf(t); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t; }
    return null;
  }

  function world(clientX, clientY) { const r = workspace.getBoundingClientRect(); return { x: (clientX - r.left - panX) / scale, y: (clientY - r.top - panY) / scale }; }
  function zoomAt(factor, ax, ay) { if (!isActive()) return false; const old = Math.max(scale, .0001), next = Math.min(2.5, Math.max(.05, old * factor)); const wx = (ax - panX) / old, wy = (ay - panY) / old; scale = next; panX = ax - wx * next; panY = ay - wy * next; requestDraw(); return true; }
  function resetView() { if (!isActive()) return false; center(); requestDraw(); return true; }

  canvas.addEventListener('mousedown', e => {
    if (!isActive() || e.button !== 0) return; e.preventDefault(); const p = world(e.clientX, e.clientY), t = hit(p.x, p.y); canvas.style.cursor = 'grabbing';
    if (t) drag = { table: t, id: idOf(t), sx: e.clientX, sy: e.clientY, ox: p.x - t.x, oy: p.y - t.y, moved: false, touched: new Set() };
    else pan = { sx: e.clientX, sy: e.clientY, px: panX, py: panY };
  });

  window.addEventListener('mousemove', e => {
    if (!isActive()) return;
    if (drag) { const d = drag, deltaX = e.clientX - d.sx, deltaY = e.clientY - d.sy; if (!d.moved && Math.hypot(deltaX, deltaY) >= 5) d.moved = true; const p = world(e.clientX, e.clientY); d.table.x = p.x - d.ox; d.table.y = p.y - d.oy; index.update(d.table); collisionWave([d.table], DRAG_DEPTH, DRAG_MOVES, d.id).forEach(id => d.touched.add(id)); requestDraw(); return; }
    if (pan) { panX = pan.px + e.clientX - pan.sx; panY = pan.py + e.clientY - pan.sy; requestDraw(); }
  });

  window.addEventListener('mouseup', () => {
    if (!isActive()) return;
    if (drag) { const d = drag; drag = null; canvas.style.cursor = 'grab'; if (!d.moved) return inspect(d.table); const seeds = [d.table, ...[...d.touched].slice(-48).map(id => byId.get(id)).filter(Boolean)]; collisionWave(seeds, SETTLE_DEPTH, SETTLE_MOVES, d.id); requestDraw(); return; }
    if (pan) { pan = null; canvas.style.cursor = 'grab'; }
  });

  window.addEventListener('wheel', e => {
    if (!isActive() || !workspace.contains(e.target)) return; e.preventDefault(); e.stopImmediatePropagation(); const r = workspace.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.1 : .9, e.clientX - r.left, e.clientY - r.top);
  }, { capture: true, passive: false });
  window.addEventListener('resize', requestDraw);

  window.renderView = function(viewKey) {
    if (viewKey !== VIEW) { leave(); return baseRenderView.call(this, viewKey); }
    currentView = viewKey; selectedTableId = null; document.getElementById('cards-container').innerHTML = ''; enter();
  };
  window.updateConnections = function(...args) { if (isActive()) return requestDraw(); return baseUpdateConnections?.apply(this, args); };
  window.handleSearch = function(...args) { if (!isActive()) return baseHandleSearch?.apply(this, args); query = (searchInput?.value || '').toLowerCase().trim(); requestDraw(); };
  window.applyLayout = function(type, ...args) {
    if (!isActive() || type !== 'grid') return baseApplyLayout?.call(this, type, ...args);
    const view = schema(), cols = Math.ceil(Math.sqrt(view.tables.length)); view.tables.forEach((t, i) => { t.x = 100 + i % cols * 450; t.y = 100 + Math.floor(i / cols) * 450; }); rebuildIndex(); requestDraw();
  };

  window.ERDPerformanceCanvas = { isActive, requestDraw, zoomAt, resetView };

  window.addEventListener('load', () => {
    const domZoom = window.zoomCanvas, domReset = window.resetZoom, domApply = window.applyTransform;
    window.zoomCanvas = function(factor, ax, ay) { if (!isActive()) return domZoom?.call(this, factor, ax, ay); const r = workspace.getBoundingClientRect(); return zoomAt(factor, Number.isFinite(ax) ? ax : r.width / 2, Number.isFinite(ay) ? ay : r.height / 2); };
    window.resetZoom = function(...args) { return isActive() ? resetView() : domReset?.apply(this, args); };
    window.applyTransform = function(...args) { if (isActive()) return requestDraw(); return domApply?.apply(this, args); };
  });
})();