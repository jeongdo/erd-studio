/** Local collision reaction + Canvas-identical color normalization for RAW 100k WebGL. */
(() => {
  'use strict';

  const VIEW = 'performance_100000_raw';
  const W = 360;
  const HEADER = 52;
  const ROW = 34;
  const BOTTOM = 12;
  const GAP = 60;
  const CELL = 840;
  const DRAG_SCALE = 0.16;
  const DRAG_DEPTH = 2;
  const DRAG_MOVES = 32;

  const workspace = document.getElementById('workspace');
  if (!workspace || typeof schemaData === 'undefined') return;

  const rawCanvas = [...workspace.children].find(el =>
    el.tagName === 'CANVAS' && el.style.zIndex === '18' && !el.id
  );
  const gl = rawCanvas?.getContext('webgl2');
  if (!rawCanvas || !gl) return;

  let boundArrayBuffer = null;
  let instanceBuffer = null;
  let borderUniform = null;
  let tables = [];
  let index = null;
  let gpuIndex = new Map();
  let signature = '';
  let anchor = null;

  const idOf = table => table?.id || table?.name || '';
  const heightOf = table => HEADER + (table?.columns?.length || 0) * ROW + BOTTOM;
  const rectOf = (table, gap = 0) => ({
    left: table.x - gap,
    top: table.y - gap,
    right: table.x + W + gap,
    bottom: table.y + heightOf(table) + gap
  });

  function css(name, fallback = '') {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
  }

  function parseColor(value, fallback = [0.2, 0.25, 0.33]) {
    const raw = String(value || '').trim();
    if (raw.startsWith('#')) {
      const hex = raw.slice(1);
      if (hex.length === 3) return hex.split('').map(ch => parseInt(ch + ch, 16) / 255);
      if (hex.length >= 6) return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    }
    const match = raw.match(/rgba?\(([^)]+)\)/i);
    if (match) {
      const parts = match[1].split(',').slice(0, 3).map(Number);
      if (parts.every(Number.isFinite)) return parts.map(part => part / 255);
    }
    return fallback;
  }

  // RAW originally uses accent-blue as every table border. Replace only that uniform
  // with the same --panel-border used by the normal Canvas renderer.
  const nativeGetUniformLocation = gl.getUniformLocation.bind(gl);
  const nativeUniform3fv = gl.uniform3fv.bind(gl);
  gl.getUniformLocation = function(program, name) {
    const location = nativeGetUniformLocation(program, name);
    if (name === 'border') borderUniform = location;
    return location;
  };
  gl.uniform3fv = function(location, value) {
    if (borderUniform && location === borderUniform && currentView === VIEW) {
      return nativeUniform3fv(
        location,
        new Float32Array(parseColor(css('--panel-border', '#334155')))
      );
    }
    return nativeUniform3fv(location, value);
  };

  // Capture the RAW rectangle instance buffer so moved neighbours can be updated
  // individually instead of re-uploading all 100k instances.
  const nativeBindBuffer = gl.bindBuffer.bind(gl);
  const nativeBufferData = gl.bufferData.bind(gl);
  gl.bindBuffer = function(target, buffer) {
    if (target === gl.ARRAY_BUFFER) boundArrayBuffer = buffer;
    return nativeBindBuffer(target, buffer);
  };
  gl.bufferData = function(target, data, usage) {
    if (target === gl.ARRAY_BUFFER && data instanceof Float32Array && data.length > 1000) {
      instanceBuffer = boundArrayBuffer;
    }
    return nativeBufferData(target, data, usage);
  };

  function cells(rect) {
    const out = [];
    for (let x = Math.floor(rect.left / CELL); x <= Math.floor(rect.right / CELL); x += 1) {
      for (let y = Math.floor(rect.top / CELL); y <= Math.floor(rect.bottom / CELL); y += 1) {
        out.push(`${x}:${y}`);
      }
    }
    return out;
  }

  function makeIndex(items) {
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

    items.forEach(insert);
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

  function ensureData() {
    const view = schemaData[VIEW];
    if (!view) return false;
    const next = view.tables || [];
    const nextSignature = `${next.length}:${idOf(next[0])}:${idOf(next[next.length - 1])}`;
    if (nextSignature === signature && index) return true;

    tables = next;
    index = makeIndex(tables);
    gpuIndex = new Map(tables.map((table, i) => [idOf(table), i]));
    signature = nextSignature;
    return true;
  }

  function world(clientX, clientY) {
    const rect = workspace.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / scale,
      y: (clientY - rect.top - panY) / scale
    };
  }

  function hitTable(x, y) {
    if (!index || scale < DRAG_SCALE) return null;
    const candidates = index.query({ left: x, top: y, right: x, bottom: y });
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const table = candidates[i];
      const rect = rectOf(table);
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return table;
    }
    return null;
  }

  function updateGpuTable(table) {
    const i = gpuIndex.get(idOf(table));
    if (i === undefined || !instanceBuffer) return;

    nativeBindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      i * 16,
      new Float32Array([table.x, table.y, W, heightOf(table)])
    );
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

  function collisionWave(seed, anchorId) {
    const queue = [{ table: seed, depth: 0 }];
    const seen = new Map([[idOf(seed), 0]]);
    const touched = new Set();
    let moves = 0;

    while (queue.length && moves < DRAG_MOVES) {
      const { table: source, depth } = queue.shift();

      for (const other of index.query(rectOf(source, GAP))) {
        if (moves >= DRAG_MOVES) break;
        if (!separate(source, other, anchorId)) continue;

        index.update(other);
        updateGpuTable(other);

        const otherId = idOf(other);
        touched.add(otherId);
        moves += 1;

        if (depth >= DRAG_DEPTH) continue;
        const nextDepth = depth + 1;
        const previousDepth = seen.get(otherId);
        if (previousDepth !== undefined && previousDepth <= nextDepth) continue;

        seen.set(otherId, nextDepth);
        queue.push({ table: other, depth: nextDepth });
      }
    }

    return touched.size;
  }

  // Capture before the existing RAW drag handler stops propagation.
  window.addEventListener('mousedown', event => {
    if (currentView !== VIEW || event.button !== 0 || !rawCanvas.contains(event.target) || !ensureData()) {
      return;
    }

    const point = world(event.clientX, event.clientY);
    const table = hitTable(point.x, point.y);
    anchor = table ? { table, id: idOf(table) } : null;
  }, true);

  // Runs after the existing RAW drag handler: the anchor has already moved and its
  // own GPU slot has already been updated. Only neighbours are handled here.
  window.addEventListener('mousemove', () => {
    if (currentView !== VIEW || !anchor || !ensureData()) return;

    index.update(anchor.table);
    const moved = collisionWave(anchor.table, anchor.id);
    if (moved > 0) {
      window.ERDUltraWebGLRaw?.requestDraw?.();
    }
  });

  window.addEventListener('mouseup', () => {
    if (currentView !== VIEW) return;
    anchor = null;
  });
})();