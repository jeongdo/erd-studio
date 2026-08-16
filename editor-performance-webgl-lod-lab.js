/**
 * ARGUS WebGL culling candidate.
 * Same 100K source and editor interactions as the prior LOD candidate,
 * but semantic cluster/tile replacement is intentionally disabled so RAW
 * and viewport-culling behavior can be compared directly.
 */
(() => {
  'use strict';

  const VIEW = 'performance_lab_webgl_lod_100000';
  const W = 360, HEADER = 52, ROW = 34, BOTTOM = 12, GAP = 60, CELL = 840;
  const RELATION_SCALE = 0.10;
  const DRAG_DEPTH = 2, DRAG_MOVES = 32, SETTLE_DEPTH = 6, SETTLE_MOVES = 120;

  const workspace = document.getElementById('workspace');
  const legacy = document.getElementById('canvas-layer');
  const zoomText = document.getElementById('zoom-text');
  const searchInput = document.getElementById('search-input');
  if (!workspace || !legacy || typeof schemaData === 'undefined') return;

  const previousRender = window.renderView;
  const previousUpdate = window.updateConnections;
  const previousSearch = window.handleSearch;
  const previousLayout = window.applyLayout;

  const canvas = document.createElement('canvas');
  canvas.id = 'argus-cull-webgl';
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    zIndex: '22', display: 'none', pointerEvents: 'none'
  });
  workspace.appendChild(canvas);

  const overlay = document.createElement('canvas');
  overlay.id = 'argus-cull-overlay';
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    zIndex: '23', display: 'none', cursor: 'grab'
  });
  workspace.appendChild(overlay);

  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'absolute', top: '12px', left: '12px', zIndex: '83', display: 'none',
    padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--panel-border)',
    background: 'var(--panel-bg)', color: 'var(--text-muted)',
    font: "600 11px 'Fira Code', monospace", pointerEvents: 'none'
  });
  workspace.appendChild(hud);

  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false
  });
  const ctx = overlay.getContext('2d');
  const available = !!gl && !!ctx;
  if (!available) return;

  let active = false, raf = 0, gpu = null, bounds = null, index = null;
  let tables = [], byId = new Map(), relationByTable = new Map();
  let selected = null, query = '', matchedIds = null;
  let pan = null, drag = null;
  let prep = 0, lastFrame = 0, fps = 0;

  const idOf = t => t?.id || t?.name || '';
  const heightOf = t => HEADER + (t?.columns?.length || 0) * ROW + BOTTOM;
  const rectOf = (t, gap = 0) => ({
    left: t.x - gap,
    top: t.y - gap,
    right: t.x + W + gap,
    bottom: t.y + heightOf(t) + gap
  });
  const intersects = (a, b) =>
    a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
  const css = (name, fallback) =>
    getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

  function parseColor(value, fallback) {
    const raw = String(value || '').trim();
    if (raw.startsWith('#')) {
      let hex = raw.slice(1);
      if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
      if (hex.length >= 6) {
        const out = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        if (out.every(Number.isFinite)) return out;
      }
    }
    const match = raw.match(/rgba?\(([^)]+)\)/i);
    if (match) {
      const parts = match[1].split(/[, ]+/).filter(Boolean).slice(0, 3).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) return parts.map(v => v / 255);
    }
    return fallback;
  }

  function colors() {
    return {
      card: parseColor(css('--card-bg', '#111827'), [0.067, 0.094, 0.153]),
      panel: parseColor(css('--panel-bg', '#0f172a'), [0.059, 0.090, 0.165]),
      panelCss: css('--panel-bg', '#0f172a'),
      border: parseColor(css('--panel-border', '#334155'), [0.20, 0.255, 0.333]),
      accent: parseColor(css('--accent-blue', '#38bdf8'), [0.22, 0.74, 0.97]),
      text: css('--text-main', '#e5e7eb'),
      muted: css('--text-muted', '#94a3b8'),
      line: css('--line-color', css('--accent-blue', '#38bdf8')),
      rose: css('--accent-rose', '#fb7185')
    };
  }

  function mix(a, b, amount) {
    return a.map((v, i) => v + (b[i] - v) * amount);
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed');
    }
    return shader;
  }

  function initGpu() {
    if (gpu) return;
    const vs = `#version 300 es
      precision highp float;
      in vec2 p; in vec4 r; in vec3 fill; in vec3 border;
      uniform vec2 viewport; uniform vec2 pan; uniform float scale;
      out vec2 uv; flat out vec3 vFill; flat out vec3 vBorder;
      void main() {
        vec2 s = (r.xy + p * r.zw) * scale + pan;
        gl_Position = vec4(s.x / viewport.x * 2.0 - 1.0, 1.0 - s.y / viewport.y * 2.0, 0, 1);
        uv = p; vFill = fill; vBorder = border;
      }`;
    const fs = `#version 300 es
      precision mediump float;
      in vec2 uv; flat in vec3 vFill; flat in vec3 vBorder; out vec4 outColor;
      void main() {
        float e = min(min(uv.x, 1.0-uv.x), min(uv.y, 1.0-uv.y));
        outColor = vec4(mix(vBorder, vFill, smoothstep(.008, .03, e)), .96);
      }`;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]), gl.STATIC_DRAW);
    let loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const instances = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    const stride = 40;
    loc = gl.getAttribLocation(program, 'r');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(loc, 1);
    loc = gl.getAttribLocation(program, 'fill');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(loc, 1);
    loc = gl.getAttribLocation(program, 'border');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, stride, 28);
    gl.vertexAttribDivisor(loc, 1);
    gl.bindVertexArray(null);

    gpu = {
      program, vao, instances,
      viewport: gl.getUniformLocation(program, 'viewport'),
      pan: gl.getUniformLocation(program, 'pan'),
      scale: gl.getUniformLocation(program, 'scale')
    };
  }

  function cells(r) {
    const keys = [];
    for (let x = Math.floor(r.left / CELL); x <= Math.floor(r.right / CELL); x += 1) {
      for (let y = Math.floor(r.top / CELL); y <= Math.floor(r.bottom / CELL); y += 1) {
        keys.push(`${x}:${y}`);
      }
    }
    return keys;
  }

  function makeIndex(items) {
    const buckets = new Map(), membership = new Map();

    function insert(table) {
      const keys = cells(rectOf(table, GAP));
      membership.set(idOf(table), keys);
      keys.forEach(key => {
        if (!buckets.has(key)) buckets.set(key, new Set());
        buckets.get(key).add(table);
      });
    }

    function remove(table) {
      (membership.get(idOf(table)) || []).forEach(key => {
        const bucket = buckets.get(key);
        bucket?.delete(table);
        if (bucket?.size === 0) buckets.delete(key);
      });
      membership.delete(idOf(table));
    }

    items.forEach(insert);
    return {
      update(table) {
        remove(table);
        insert(table);
      },
      query(r) {
        const out = new Set();
        cells(r).forEach(key => buckets.get(key)?.forEach(t => out.add(t)));
        return [...out];
      }
    };
  }

  function computeBounds() {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    tables.forEach(t => {
      const r = rectOf(t);
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    bounds = { left, top, right, bottom };
  }

  function prepare() {
    const t0 = performance.now();
    const view = schemaData[VIEW];
    tables = view.tables || [];
    byId = new Map(tables.map(t => [idOf(t), t]));
    index = makeIndex(tables);
    relationByTable = new Map();
    (view.relations || []).forEach(rel => {
      [rel.from, rel.to].forEach(id => {
        if (!relationByTable.has(id)) relationByTable.set(id, []);
        relationByTable.get(id).push(rel);
      });
    });
    computeBounds();
    initGpu();
    prep = performance.now() - t0;
    center();
  }

  function resize() {
    const r = workspace.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(r.width * dpr));
    const height = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }
    canvas.dataset.dpr = dpr;
    overlay.dataset.dpr = dpr;
    return { r };
  }

  function center() {
    const r = workspace.getBoundingClientRect();
    scale = Math.max(.0035, Math.min(1,
      (r.width - 100) / Math.max(1, bounds.right - bounds.left),
      (r.height - 100) / Math.max(1, bounds.bottom - bounds.top)
    ));
    panX = r.width / 2 - (bounds.left + bounds.right) / 2 * scale;
    panY = r.height / 2 - (bounds.top + bounds.bottom) / 2 * scale;
    requestDraw();
  }

  function world(clientX, clientY) {
    const r = workspace.getBoundingClientRect();
    return {
      x: (clientX - r.left - panX) / scale,
      y: (clientY - r.top - panY) / scale
    };
  }

  function viewportWorld() {
    const r = workspace.getBoundingClientRect();
    const margin = 180 / Math.max(scale, .0035);
    return {
      left: -panX / scale - margin,
      top: -panY / scale - margin,
      right: (r.width - panX) / scale + margin,
      bottom: (r.height - panY) / scale + margin
    };
  }

  function scene() {
    const visible = viewportWorld();
    const items = index.query(visible).filter(t => intersects(rectOf(t), visible));
    return { items, visible };
  }

  function instance(r, fill, border) {
    return [r.left, r.top, r.right-r.left, r.bottom-r.top, ...fill, ...border];
  }

  function drawGpu(instances) {
    const { r } = resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(gpu.program);
    gl.bindVertexArray(gpu.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.instances);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instances.flat()), gl.DYNAMIC_DRAW);
    gl.uniform2f(gpu.viewport, r.width, r.height);
    gl.uniform2f(gpu.pan, panX, panY);
    gl.uniform1f(gpu.scale, scale);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances.length);
    gl.bindVertexArray(null);
  }

  function clearOverlay() {
    const r = workspace.getBoundingClientRect();
    const dpr = Number(overlay.dataset.dpr) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);
  }

  function tableMatches(t) {
    return !query || matchedIds?.has(idOf(t));
  }

  function drawTable(t, c) {
    if (W * scale < 42) return;
    const h = heightOf(t), match = tableMatches(t);
    ctx.globalAlpha = match ? 1 : .20;
    ctx.fillStyle = c.panelCss;
    ctx.fillRect(t.x, t.y, W, HEADER);
    if (selected === idOf(t)) {
      ctx.strokeStyle = css('--accent-blue', '#38bdf8');
      ctx.lineWidth = 3 / Math.max(scale, .08);
      ctx.strokeRect(t.x, t.y, W, h);
    }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css('--accent-blue', '#38bdf8');
    if (scale < .16) {
      ctx.font = "700 30px 'Fira Code', monospace";
      ctx.fillText(t.name, t.x + 14, t.y + HEADER/2);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.font = "600 14px 'Fira Code', monospace";
    ctx.fillText(t.name, t.x + 16, t.y + 18);
    ctx.fillStyle = c.muted;
    ctx.font = "500 10px 'Inter', sans-serif";
    ctx.fillText(t.desc || '', t.x + 16, t.y + 38);
    if (scale >= .34) {
      (t.columns || []).forEach((col, i) => {
        const y = t.y + HEADER + i * ROW + ROW/2;
        if (col.pk || col.fk) {
          ctx.fillStyle = col.pk ? c.rose : css('--accent-blue', '#38bdf8');
          ctx.font = "700 9px 'Fira Code', monospace";
          ctx.fillText(col.pk ? 'PK' : 'FK', t.x + 18, y);
        }
        ctx.fillStyle = c.text;
        ctx.font = "500 12px 'Fira Code', monospace";
        ctx.fillText(col.name, t.x + 52, y);
        ctx.fillStyle = c.muted;
        ctx.font = "500 10px 'Fira Code', monospace";
        const tw = ctx.measureText(col.type).width;
        ctx.fillText(col.type, t.x + W - 16 - tw, y);
      });
    }
    ctx.globalAlpha = 1;
  }

  function columnY(t, col) {
    const name = Array.isArray(col) ? col[0] : col;
    const i = t.columns?.findIndex(x => x.name === name) ?? -1;
    return i >= 0 ? t.y + HEADER + i * ROW + ROW/2 : t.y + heightOf(t)/2;
  }

  function relationCandidates(visibleTables) {
    const out = new Set();
    visibleTables.forEach(t => {
      (relationByTable.get(idOf(t)) || []).forEach(rel => out.add(rel));
    });
    return [...out];
  }

  function drawRelation(rel, c, visible) {
    const from = byId.get(rel.from), to = byId.get(rel.to);
    if (!from || !to) return false;
    const fh = heightOf(from), th = heightOf(to);
    const fx = from.x + W/2, fy = from.y + fh/2;
    const tx = to.x + W/2, ty = to.y + th/2;
    if (!intersects({
      left: Math.min(fx, tx)-80,
      top: Math.min(fy, ty)-80,
      right: Math.max(fx, tx)+80,
      bottom: Math.max(fy, ty)+80
    }, visible)) return false;

    const dx = tx-fx, dy = ty-fy;
    let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      x1=fx; x2=tx;
      y1=dy>0 ? from.y+fh+8 : from.y-8;
      y2=dy>0 ? to.y-8 : to.y+th+8;
      const arm=Math.abs(y2-y1)*.5, mid=(x1+x2)/2;
      c1x=mid; c2x=mid;
      c1y=y1+(dy>0?arm:-arm); c2y=y2+(dy>0?-arm:arm);
    } else {
      y1=columnY(from, rel.fromCol); y2=columnY(to, rel.toCol);
      x1=dx>0 ? from.x+W+8 : from.x-8;
      x2=dx>0 ? to.x-8 : to.x+W+8;
      const arm=Math.max(Math.abs(x2-x1)*.55,40), mid=(y1+y2)/2;
      c1x=x1+(dx>0?arm:-arm); c2x=x2+(dx>0?-arm:arm);
      c1y=mid; c2y=mid;
    }
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);
    ctx.strokeStyle = c.line;
    ctx.globalAlpha=.7;
    ctx.lineWidth=Math.max(1.2/scale,1.6);
    ctx.setLineDash(rel.identifying ? [] : [8/scale,5/scale]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha=1;
    return true;
  }

  function draw() {
    raf = 0;
    if (!active) return;
    resize();
    const current = schemaData[VIEW], s = scene(), c = colors(), instances = [];
    let relationCount = 0;

    clearOverlay();
    s.items.forEach(t => {
      const fill = tableMatches(t) ? c.card : mix(c.card, c.panel, .78);
      instances.push(instance(rectOf(t), fill, selected === idOf(t) ? c.accent : c.border));
    });
    if (scale >= RELATION_SCALE) {
      relationCandidates(s.items).forEach(rel => {
        if (drawRelation(rel, c, s.visible)) relationCount += 1;
      });
    }
    s.items.forEach(t => drawTable(t, c));
    ctx.restore();
    drawGpu(instances);

    if (zoomText) zoomText.innerText = `${Math.round(scale * 100)}%`;
    const now = performance.now();
    if (lastFrame) {
      const currentFps = 1000 / Math.max(1, now-lastFrame);
      fps = fps ? fps*.82 + currentFps*.18 : currentFps;
    }
    lastFrame = now;
    hud.textContent = `WEBGL2 CULL · ${s.items.length}/${tables.length} tables · `
      + `${relationCount}/${(current.relations||[]).length} lines · `
      + `${Math.min(999,Math.round(fps||0))} fps · prep ${prep.toFixed(1)} ms`;
  }

  function requestDraw() {
    if (active && !raf) raf = requestAnimationFrame(draw);
  }

  function hitTable(x, y) {
    if (!index) return null;
    for (const t of index.query({left:x,top:y,right:x,bottom:y}).reverse()) {
      const r=rectOf(t);
      if (x>=r.left && x<=r.right && y>=r.top && y<=r.bottom) return t;
    }
    return null;
  }

  function separate(source, other, anchorId) {
    if (!other || source === other || idOf(other) === anchorId) return false;
    const a=rectOf(source), b=rectOf(other);
    const dx=(b.left+b.right-a.left-a.right)/2;
    const dy=(b.top+b.bottom-a.top-a.bottom)/2;
    const overlapX=W+GAP-Math.abs(dx);
    const overlapY=(heightOf(source)+heightOf(other))/2+GAP-Math.abs(dy);
    if (overlapX<=0 || overlapY<=0) return false;
    if (overlapX < overlapY) other.x += (dx===0?1:Math.sign(dx))*overlapX;
    else other.y += (dy===0?1:Math.sign(dy))*overlapY;
    return true;
  }

  function collisionWave(seeds, maxDepth, maxMoves, anchorId) {
    const queue=seeds.filter(Boolean).map(t=>({t,depth:0}));
    const seen=new Map(queue.map(x=>[idOf(x.t),0]));
    const touched=new Set();
    let moves=0;
    while(queue.length && moves<maxMoves) {
      const {t:source,depth}=queue.shift();
      for(const other of index.query(rectOf(source,GAP))) {
        if(moves>=maxMoves) break;
        if(!separate(source,other,anchorId)) continue;
        index.update(other);
        touched.add(idOf(other));
        moves += 1;
        if(depth>=maxDepth) continue;
        const next=depth+1, prior=seen.get(idOf(other));
        if(prior!==undefined && prior<=next) continue;
        seen.set(idOf(other),next);
        queue.push({t:other,depth:next});
      }
    }
    return touched;
  }

  function inspect(t) {
    const inspector=document.getElementById('inspector');
    selected=idOf(t);
    selectedTableId=selected;
    document.getElementById('drawer-table-name').innerText=t.name;
    document.getElementById('drawer-table-desc').innerText=t.desc||'';
    inspector?.classList.add('open');
    requestDraw();
  }

  function zoomAt(factor, x, y) {
    if(!active) return false;
    const old=Math.max(scale,.0001);
    const next=Math.max(.0035,Math.min(2.5,old*factor));
    const wx=(x-panX)/old, wy=(y-panY)/old;
    scale=next;
    panX=x-wx*next;
    panY=y-wy*next;
    requestDraw();
    return true;
  }

  function handleSearch() {
    if(!active) return false;
    query=(searchInput?.value||'').toLowerCase().trim();
    if(!query) matchedIds=null;
    else {
      matchedIds=new Set();
      tables.forEach(t => {
        if(t.name.toLowerCase().includes(query)
          || (t.desc||'').toLowerCase().includes(query)
          || (t.columns||[]).some(c=>c.name.toLowerCase().includes(query))) {
          matchedIds.add(idOf(t));
        }
      });
    }
    requestDraw();
    return true;
  }

  overlay.addEventListener('mousedown', e => {
    if(!active || e.button!==0) return;
    e.preventDefault();
    const p=world(e.clientX,e.clientY);
    overlay.style.cursor='grabbing';
    const t=hitTable(p.x,p.y);
    if(t) {
      drag={
        t,
        id:idOf(t),
        x:e.clientX,
        y:e.clientY,
        ox:p.x-t.x,
        oy:p.y-t.y,
        moved:false,
        touched:new Set()
      };
    } else {
      pan={x:e.clientX,y:e.clientY,px:panX,py:panY};
    }
  });

  window.addEventListener('mousemove', e => {
    if(!active) return;
    if(drag) {
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if(!drag.moved && Math.hypot(dx,dy)>=5) drag.moved=true;
      const p=world(e.clientX,e.clientY);
      drag.t.x=p.x-drag.ox;
      drag.t.y=p.y-drag.oy;
      index.update(drag.t);
      collisionWave([drag.t],DRAG_DEPTH,DRAG_MOVES,drag.id).forEach(id=>drag.touched.add(id));
      requestDraw();
      return;
    }
    if(pan) {
      panX=pan.px+e.clientX-pan.x;
      panY=pan.py+e.clientY-pan.y;
      requestDraw();
    }
  });

  window.addEventListener('mouseup', () => {
    if(!active) return;
    overlay.style.cursor='grab';
    if(drag) {
      const done=drag;
      drag=null;
      if(!done.moved) {
        inspect(done.t);
        return;
      }
      const seeds=[
        done.t,
        ...[...done.touched].slice(-48).map(id=>byId.get(id)).filter(Boolean)
      ];
      collisionWave(seeds,SETTLE_DEPTH,SETTLE_MOVES,done.id);
      computeBounds();
      requestDraw();
      return;
    }
    pan=null;
  });

  window.addEventListener('wheel', e => {
    if(!active || !workspace.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r=workspace.getBoundingClientRect();
    zoomAt(e.deltaY<0?1.12:.88,e.clientX-r.left,e.clientY-r.top);
  }, {capture:true,passive:false});
  window.addEventListener('resize', requestDraw);

  function enter() {
    previousRender?.call(window,'__argus_cull_off__');
    currentView=VIEW;
    active=true;
    selected=null;
    selectedTableId=null;
    legacy.style.display='none';
    canvas.style.display='block';
    overlay.style.display='block';
    hud.style.display='block';
    lastFrame=0;
    fps=0;
    query=(searchInput?.value||'').toLowerCase().trim();
    prepare();
    if(query) handleSearch();
    requestDraw();
    return true;
  }

  function leave() {
    active=false;
    canvas.style.display='none';
    overlay.style.display='none';
    hud.style.display='none';
    pan=null;
    drag=null;
  }

  window.renderView=function(key) {
    if(key===VIEW) return enter();
    leave();
    return previousRender?.call(this,key);
  };

  window.updateConnections=function(...args) {
    if(active) return requestDraw();
    return previousUpdate?.apply(this,args);
  };

  window.handleSearch=function(...args) {
    if(active) return handleSearch();
    return previousSearch?.apply(this,args);
  };

  window.applyLayout=function(type,...args) {
    if(active) {
      center();
      return true;
    }
    return previousLayout?.call(this,type,...args);
  };

  window.addEventListener('load',()=>{
    const fallbackZoom=window.zoomCanvas;
    const fallbackReset=window.resetZoom;
    const fallbackApply=window.applyTransform;

    window.zoomCanvas=function(f,x,y) {
      if(!active) return fallbackZoom?.call(this,f,x,y);
      const r=workspace.getBoundingClientRect();
      return zoomAt(f,Number.isFinite(x)?x:r.width/2,Number.isFinite(y)?y:r.height/2);
    };

    window.resetZoom=function(...args) {
      if(!active) return fallbackReset?.apply(this,args);
      center();
      return true;
    };

    window.applyTransform=function(...args) {
      if(active) {
        requestDraw();
        return true;
      }
      return fallbackApply?.apply(this,args);
    };
  });

  window.ARGUSCullLab={available,isActive:()=>active,requestDraw,zoomAt};
})();
