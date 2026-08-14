/** WebGL2 stress renderer for the 100,000-table view with semantic clustering. */
(() => {
  'use strict';

  const VIEW = 'performance_100000';
  const TABLE_WIDTH = 360;
  const HEADER_HEIGHT = 52;
  const ROW_HEIGHT = 34;
  const BOTTOM_PAD = 12;
  const INDEX_CELL = 840;
  const TABLE_LOD_SCALE = 0.08;
  const CLUSTER_LEVELS = [
    { key: 'fine', cell: 1680, minScale: 0.03 },
    { key: 'medium', cell: 6720, minScale: 0.012 },
    { key: 'coarse', cell: 26880, minScale: 0 }
  ];
  const DRAG_DEPTH = 2;
  const DRAG_MAX_MOVES = 32;
  const SETTLE_DEPTH = 6;
  const SETTLE_MAX_MOVES = 120;

  const workspace = document.getElementById('workspace');
  const domLayer = document.getElementById('canvas-layer');
  const zoomText = document.getElementById('zoom-text');
  const searchInput = document.getElementById('search-input');
  if (!workspace || !domLayer) return;

  const canvasRenderView = window.renderView;
  const canvasUpdateConnections = window.updateConnections;
  const canvasHandleSearch = window.handleSearch;
  const canvasApplyLayout = window.applyLayout;

  const glCanvas = document.createElement('canvas');
  glCanvas.id = 'erd-webgl-canvas';
  Object.assign(glCanvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '14',
    display: 'none', pointerEvents: 'none'
  });
  workspace.appendChild(glCanvas);

  const overlay = document.createElement('canvas');
  overlay.id = 'erd-webgl-overlay';
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '15',
    display: 'none', cursor: 'grab'
  });
  workspace.appendChild(overlay);

  const hud = document.createElement('div');
  hud.id = 'webgl-performance-hud';
  Object.assign(hud.style, {
    position: 'absolute', top: '12px', left: '12px', zIndex: '72', display: 'none',
    padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--panel-border)',
    background: 'var(--panel-bg)', color: 'var(--text-muted)',
    font: "600 11px 'Fira Code', monospace", pointerEvents: 'none'
  });
  workspace.appendChild(hud);

  const gl = glCanvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false
  });
  const overlayCtx = overlay.getContext('2d');
  const available = !!gl && !!overlayCtx;

  let active = false;
  let raf = 0;
  let selected = null;
  let query = '';
  let matchedIds = null;
  let tableIndex = null;
  let byId = new Map();
  let relationByTable = new Map();
  let clusters = new Map();
  let clusterMatchMaps = new Map();
  let clustersDirty = true;
  let bounds = null;
  let drag = null;
  let pan = null;
  let clusterClick = null;
  let lastScene = null;
  let lastFrame = 0;
  let fps = 0;
  let gpu = null;

  const idOf = table => table?.id || table?.name || '';
  const heightOf = table => HEADER_HEIGHT + (table?.columns?.length || 0) * ROW_HEIGHT + BOTTOM_PAD;
  const view = () => schemaData?.[VIEW];
  const isActive = () => active && currentView === VIEW;
  const rectOf = (table, gap = 0) => ({
    left: table.x - gap,
    top: table.y - gap,
    right: table.x + TABLE_WIDTH + gap,
    bottom: table.y + heightOf(table) + gap
  });
  const intersects = (a, b) =>
    a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
  const css = (name, fallback) =>
    getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

  function parseColor(value, fallback = [0.12, 0.16, 0.22]) {
    const raw = String(value || '').trim();
    if (raw.startsWith('#')) {
      const hex = raw.slice(1);
      if (hex.length === 3) return hex.split('').map(ch => parseInt(ch + ch, 16) / 255);
      if (hex.length >= 6) return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    }
    const match = raw.match(/rgba?\(([^)]+)\)/i);
    if (match) {
      const parts = match[1].split(',').slice(0, 3).map(Number);
      if (parts.every(Number.isFinite)) return parts.map(part => part / 255);
    }
    return fallback;
  }

  function colors() {
    return {
      card: parseColor(css('--card-bg', '#111827')),
      panel: parseColor(css('--panel-bg', '#0f172a')),
      border: parseColor(css('--panel-border', '#334155')),
      accent: parseColor(css('--accent-blue', '#38bdf8')),
      text: css('--text-main', '#e5e7eb'),
      muted: css('--text-muted', '#94a3b8'),
      line: css('--line-color', css('--accent-blue', '#38bdf8')),
      rose: css('--accent-rose', '#fb7185')
    };
  }

  function mixColor(a, b, amount) {
    return [
      a[0] + (b[0] - a[0]) * amount,
      a[1] + (b[1] - a[1]) * amount,
      a[2] + (b[2] - a[2]) * amount
    ];
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'unknown shader error';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function initGpu() {
    if (!available || gpu) return;
    const vertexSource = `#version 300 es
      precision highp float;
      in vec2 aPosition;
      in vec4 aRect;
      in vec3 aFill;
      in vec3 aBorder;
      uniform vec2 uViewport;
      uniform vec2 uPan;
      uniform float uScale;
      out vec2 vUv;
      flat out vec3 vFill;
      flat out vec3 vBorder;
      void main() {
        vec2 world = aRect.xy + aPosition * aRect.zw;
        vec2 screen = world * uScale + uPan;
        vec2 clip = vec2(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0);
        gl_Position = vec4(clip, 0.0, 1.0);
        vUv = aPosition;
        vFill = aFill;
        vBorder = aBorder;
      }
    `;
    const fragmentSource = `#version 300 es
      precision mediump float;
      in vec2 vUv;
      flat in vec3 vFill;
      flat in vec3 vBorder;
      out vec4 outColor;
      void main() {
        float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float borderMix = smoothstep(0.008, 0.026, edge);
        vec3 color = mix(vBorder, vFill, borderMix);
        outColor = vec4(color, 0.96);
      }
    `;
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL program link failed');
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]), gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const stride = 40;
    const rectLoc = gl.getAttribLocation(program, 'aRect');
    const fillLoc = gl.getAttribLocation(program, 'aFill');
    const borderLoc = gl.getAttribLocation(program, 'aBorder');
    gl.enableVertexAttribArray(rectLoc); gl.vertexAttribPointer(rectLoc, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(rectLoc, 1);
    gl.enableVertexAttribArray(fillLoc); gl.vertexAttribPointer(fillLoc, 3, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(fillLoc, 1);
    gl.enableVertexAttribArray(borderLoc); gl.vertexAttribPointer(borderLoc, 3, gl.FLOAT, false, stride, 28); gl.vertexAttribDivisor(borderLoc, 1);
    gl.bindVertexArray(null);
    gpu = { program, vao, instanceBuffer, viewportLoc: gl.getUniformLocation(program, 'uViewport'), panLoc: gl.getUniformLocation(program, 'uPan'), scaleLoc: gl.getUniformLocation(program, 'uScale') };
  }

  function cellKeys(rect, size = INDEX_CELL) {
    const keys = [];
    for (let x = Math.floor(rect.left / size); x <= Math.floor(rect.right / size); x += 1) {
      for (let y = Math.floor(rect.top / size); y <= Math.floor(rect.bottom / size); y += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }

  function makeTableIndex(tables) {
    const buckets = new Map(), memberships = new Map();
    function insert(table) {
      const keys = cellKeys(rectOf(table, 60)); memberships.set(idOf(table), keys);
      keys.forEach(key => { if (!buckets.has(key)) buckets.set(key, new Set()); buckets.get(key).add(table); });
    }
    function remove(table) {
      (memberships.get(idOf(table)) || []).forEach(key => { const bucket = buckets.get(key); bucket?.delete(table); if (bucket?.size === 0) buckets.delete(key); });
      memberships.delete(idOf(table));
    }
    tables.forEach(insert);
    return { update(table) { remove(table); insert(table); }, query(rect) { const found = new Set(); cellKeys(rect).forEach(key => buckets.get(key)?.forEach(table => found.add(table))); return [...found]; } };
  }

  function computeBounds(tables) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    tables.forEach(table => { const rect = rectOf(table); left = Math.min(left, rect.left); top = Math.min(top, rect.top); right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom); });
    return { left, top, right, bottom };
  }

  function buildClusterLevel(tables, cellSize) {
    const map = new Map();
    tables.forEach(table => {
      const cx = Math.floor((table.x + TABLE_WIDTH / 2) / cellSize), cy = Math.floor((table.y + heightOf(table) / 2) / cellSize), key = `${cx}:${cy}`;
      let cluster = map.get(key);
      if (!cluster) { cluster = { key, count: 0, left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }; map.set(key, cluster); }
      const rect = rectOf(table); cluster.count += 1; cluster.left = Math.min(cluster.left, rect.left); cluster.top = Math.min(cluster.top, rect.top); cluster.right = Math.max(cluster.right, rect.right); cluster.bottom = Math.max(cluster.bottom, rect.bottom);
    });
    return [...map.values()];
  }

  function rebuildClusters() { const tables = view()?.tables || []; clusters = new Map(); CLUSTER_LEVELS.forEach(level => clusters.set(level.key, buildClusterLevel(tables, level.cell))); clustersDirty = false; }
  function rebuildSceneData() {
    const current = view(); if (!current) return; const tables = current.tables || [];
    byId = new Map(tables.map(table => [idOf(table), table])); tableIndex = makeTableIndex(tables); relationByTable = new Map();
    (current.relations || []).forEach(rel => [rel.from, rel.to].forEach(id => { if (!relationByTable.has(id)) relationByTable.set(id, []); relationByTable.get(id).push(rel); }));
    bounds = computeBounds(tables); clustersDirty = true; matchedIds = null; clusterMatchMaps = new Map();
  }

  function chooseClusterLevel() { if (scale >= TABLE_LOD_SCALE) return null; return CLUSTER_LEVELS.find(level => scale >= level.minScale) || CLUSTER_LEVELS[CLUSTER_LEVELS.length - 1]; }
  function viewportWorld() {
    const rect = workspace.getBoundingClientRect(), margin = 180 / Math.max(scale, 0.004);
    return { left: -panX / scale - margin, top: -panY / scale - margin, right: (rect.width - panX) / scale + margin, bottom: (rect.height - panY) / scale + margin };
  }
  function fitScaleForBounds(targetBounds = bounds, padding = 54) {
    const rect = workspace.getBoundingClientRect(), width = Math.max(1, targetBounds.right - targetBounds.left), height = Math.max(1, targetBounds.bottom - targetBounds.top);
    return Math.max(0.0035, Math.min(1, (rect.width - padding * 2) / width, (rect.height - padding * 2) / height));
  }
  function centerOnBounds(targetBounds = bounds, requestedScale = null) {
    if (!targetBounds) return; const rect = workspace.getBoundingClientRect(), nextScale = requestedScale ?? fitScaleForBounds(targetBounds); scale = Math.min(2.5, Math.max(0.0035, nextScale));
    const cx = (targetBounds.left + targetBounds.right) / 2, cy = (targetBounds.top + targetBounds.bottom) / 2; panX = rect.width / 2 - cx * scale; panY = rect.height / 2 - cy * scale;
  }

  function resize() {
    const rect = workspace.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
    if (glCanvas.width !== width || glCanvas.height !== height) { glCanvas.width = width; glCanvas.height = height; }
    if (overlay.width !== width || overlay.height !== height) { overlay.width = width; overlay.height = height; }
    glCanvas.dataset.dpr = dpr; overlay.dataset.dpr = dpr;
  }
  function instanceForRect(rect, fill, border) { return [rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, fill[0], fill[1], fill[2], border[0], border[1], border[2]]; }
  function drawGpuInstances(instances) {
    initGpu(); if (!gpu) return; const rect = workspace.getBoundingClientRect(); gl.viewport(0, 0, glCanvas.width, glCanvas.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(gpu.program); gl.bindVertexArray(gpu.vao); gl.bindBuffer(gl.ARRAY_BUFFER, gpu.instanceBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instances.flat()), gl.DYNAMIC_DRAW);
    gl.uniform2f(gpu.viewportLoc, rect.width, rect.height); gl.uniform2f(gpu.panLoc, panX, panY); gl.uniform1f(gpu.scaleLoc, scale); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances.length); gl.bindVertexArray(null);
  }

  function visibleTables(visibleRect) { return tableIndex.query(visibleRect).filter(table => intersects(rectOf(table), visibleRect)); }
  function visibleClusters(level, visibleRect) { if (clustersDirty) rebuildClusters(); return (clusters.get(level.key) || []).filter(cluster => intersects(cluster, visibleRect)); }
  function tableMatches(table) { return !query || matchedIds?.has(idOf(table)); }
  function rebuildClusterMatchMaps() {
    clusterMatchMaps = new Map(CLUSTER_LEVELS.map(level => [level.key, new Map()])); if (!query || !matchedIds?.size) return;
    for (const id of matchedIds) { const table = byId.get(id); if (!table) continue; CLUSTER_LEVELS.forEach(level => { const key = `${Math.floor((table.x + TABLE_WIDTH / 2) / level.cell)}:${Math.floor((table.y + heightOf(table) / 2) / level.cell)}`; const counts = clusterMatchMaps.get(level.key); counts.set(key, (counts.get(key) || 0) + 1); }); }
  }
  function clusterMatchCount(cluster, level) { return !query ? cluster.count : clusterMatchMaps.get(level.key)?.get(cluster.key) || 0; }

  function drawTableOverlay(table, colorSet) {
    if (TABLE_WIDTH * scale < 42) return; const x = table.x, y = table.y, height = heightOf(table), match = tableMatches(table); overlayCtx.globalAlpha = match ? 1 : 0.2; overlayCtx.fillStyle = colorSet.panel; overlayCtx.fillRect(x, y, TABLE_WIDTH, HEADER_HEIGHT);
    if (selected === idOf(table)) { overlayCtx.strokeStyle = css('--accent-blue', '#38bdf8'); overlayCtx.lineWidth = 3 / Math.max(scale, 0.08); overlayCtx.strokeRect(x, y, TABLE_WIDTH, height); }
    overlayCtx.textBaseline = 'middle'; overlayCtx.fillStyle = css('--accent-blue', '#38bdf8');
    if (scale < 0.16) { overlayCtx.font = "700 30px 'Fira Code', monospace"; overlayCtx.fillText(table.name, x + 14, y + HEADER_HEIGHT / 2); overlayCtx.globalAlpha = 1; return; }
    overlayCtx.font = "600 14px 'Fira Code', monospace"; overlayCtx.fillText(table.name, x + 16, y + 18); overlayCtx.fillStyle = colorSet.muted; overlayCtx.font = "500 10px 'Inter', sans-serif"; overlayCtx.fillText(table.desc || '', x + 16, y + 38);
    if (scale >= 0.34) table.columns.forEach((column, idx) => { const cy = y + HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2; if (column.pk || column.fk) { overlayCtx.fillStyle = column.pk ? colorSet.rose : css('--accent-blue', '#38bdf8'); overlayCtx.font = "700 9px 'Fira Code', monospace"; overlayCtx.fillText(column.pk ? 'PK' : 'FK', x + 18, cy); } overlayCtx.fillStyle = colorSet.text; overlayCtx.font = "500 12px 'Fira Code', monospace"; overlayCtx.fillText(column.name, x + 52, cy); overlayCtx.fillStyle = colorSet.muted; overlayCtx.font = "500 10px 'Fira Code', monospace"; const width = overlayCtx.measureText(column.type).width; overlayCtx.fillText(column.type, x + TABLE_WIDTH - 16 - width, cy); });
    overlayCtx.globalAlpha = 1;
  }
  function columnY(table, column) { const name = Array.isArray(column) ? column[0] : column, idx = table.columns?.findIndex(item => item.name === name) ?? -1; return idx >= 0 ? table.y + HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2 : table.y + heightOf(table) / 2; }
  function drawRelation(rel, colorSet, visibleRect) {
    const from = byId.get(rel.from), to = byId.get(rel.to); if (!from || !to) return false; const fromHeight = heightOf(from), toHeight = heightOf(to), fx = from.x + TABLE_WIDTH / 2, fy = from.y + fromHeight / 2, tx = to.x + TABLE_WIDTH / 2, ty = to.y + toHeight / 2;
    if (!intersects({ left: Math.min(fx, tx) - 80, top: Math.min(fy, ty) - 80, right: Math.max(fx, tx) + 80, bottom: Math.max(fy, ty) + 80 }, visibleRect)) return false;
    const dx = tx - fx, dy = ty - fy; let x1,y1,x2,y2,c1x,c1y,c2x,c2y;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) { x1=fx; x2=tx; y1=dy>0?from.y+fromHeight+8:from.y-8; y2=dy>0?to.y-8:to.y+toHeight+8; const arm=Math.abs(y2-y1)*0.5, mid=(x1+x2)/2; c1x=mid; c2x=mid; c1y=y1+(dy>0?arm:-arm); c2y=y2+(dy>0?-arm:arm); }
    else { y1=columnY(from, rel.fromCol); y2=columnY(to, rel.toCol); x1=dx>0?from.x+TABLE_WIDTH+8:from.x-8; x2=dx>0?to.x-8:to.x+TABLE_WIDTH+8; const arm=Math.max(Math.abs(x2-x1)*0.55,40), mid=(y1+y2)/2; c1x=x1+(dx>0?arm:-arm); c2x=x2+(dx>0?-arm:arm); c1y=mid; c2y=mid; }
    overlayCtx.beginPath(); overlayCtx.moveTo(x1,y1); overlayCtx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2); overlayCtx.strokeStyle=colorSet.line; overlayCtx.globalAlpha=0.68; overlayCtx.lineWidth=Math.max(1.2/scale,1.6); overlayCtx.setLineDash(rel.identifying?[]:[8/scale,5/scale]); overlayCtx.stroke(); overlayCtx.setLineDash([]); overlayCtx.globalAlpha=1; return true;
  }
  function drawClusterOverlay(cluster, level, colorSet) { const widthPx=(cluster.right-cluster.left)*scale, heightPx=(cluster.bottom-cluster.top)*scale; if(widthPx<34||heightPx<24)return; const matched=clusterMatchCount(cluster,level); overlayCtx.textAlign='center'; overlayCtx.textBaseline='middle'; overlayCtx.fillStyle=matched>0&&query?css('--accent-blue','#38bdf8'):colorSet.text; overlayCtx.font=`700 ${Math.max(12/scale,18)}px 'Fira Code', monospace`; overlayCtx.fillText(query?`${matched}/${cluster.count}`:`${cluster.count}`,(cluster.left+cluster.right)/2,(cluster.top+cluster.bottom)/2); overlayCtx.textAlign='start'; }
  function relationCandidates(tables) { const found=new Set(); tables.forEach(table=>(relationByTable.get(idOf(table))||[]).forEach(rel=>found.add(rel))); return [...found]; }
  function clearOverlay() { const rect=workspace.getBoundingClientRect(), dpr=Number(overlay.dataset.dpr)||1; overlayCtx.setTransform(dpr,0,0,dpr,0,0); overlayCtx.clearRect(0,0,rect.width,rect.height); overlayCtx.save(); overlayCtx.translate(panX,panY); overlayCtx.scale(scale,scale); }

  function draw() {
    raf=0; if(!isActive())return; resize(); const current=view(), visibleRect=viewportWorld(), colorSet=colors(), clusterLevel=chooseClusterLevel(), instances=[]; let tableCount=0, relationCount=0, clusterCount=0; clearOverlay();
    if(clusterLevel){ const sceneClusters=visibleClusters(clusterLevel,visibleRect); lastScene={type:'clusters',level:clusterLevel,items:sceneClusters}; clusterCount=sceneClusters.length; sceneClusters.forEach(cluster=>{ const matched=clusterMatchCount(cluster,clusterLevel), dimmed=query&&matched===0, fill=dimmed?mixColor(colorSet.card,colorSet.panel,0.75):mixColor(colorSet.card,colorSet.accent,Math.min(0.45,0.12+Math.log10(cluster.count+1)*0.08)); instances.push(instanceForRect(cluster,fill,dimmed?colorSet.border:colorSet.accent)); drawClusterOverlay(cluster,clusterLevel,colorSet); }); }
    else { const tables=visibleTables(visibleRect); lastScene={type:'tables',items:tables}; tableCount=tables.length; tables.forEach(table=>{ const match=tableMatches(table), fill=match?colorSet.card:mixColor(colorSet.card,colorSet.panel,0.78); instances.push(instanceForRect(rectOf(table),fill,selected===idOf(table)?colorSet.accent:colorSet.border)); }); const relations=scale>=0.10?relationCandidates(tables):[]; relations.forEach(rel=>{if(drawRelation(rel,colorSet,visibleRect))relationCount+=1;}); tables.forEach(table=>drawTableOverlay(table,colorSet)); }
    overlayCtx.restore(); drawGpuInstances(instances); if(zoomText)zoomText.innerText=`${Math.round(scale*100)}%`; const now=performance.now(); if(lastFrame){const currentFps=1000/Math.max(1,now-lastFrame);fps=fps?fps*0.82+currentFps*0.18:currentFps;} lastFrame=now; hud.textContent=clusterLevel?`WEBGL2 · ${clusterCount} ${clusterLevel.key} clusters · ${current.tables.length} tables · ${Math.min(99,Math.round(fps||0))} fps`:`WEBGL2 · ${tableCount}/${current.tables.length} tables · ${relationCount}/${(current.relations||[]).length} lines · ${Math.min(99,Math.round(fps||0))} fps`;
  }
  function requestDraw(){if(isActive()&&!raf)raf=requestAnimationFrame(draw);}
  function world(clientX,clientY){const rect=workspace.getBoundingClientRect();return{x:(clientX-rect.left-panX)/scale,y:(clientY-rect.top-panY)/scale};}
  function hitTable(x,y){for(const table of tableIndex.query({left:x,top:y,right:x,bottom:y}).reverse()){const rect=rectOf(table);if(x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom)return table;}return null;}
  function hitCluster(x,y){if(lastScene?.type!=='clusters')return null;return lastScene.items.find(cluster=>x>=cluster.left&&x<=cluster.right&&y>=cluster.top&&y<=cluster.bottom)||null;}
  function separate(source,other,anchorId){if(!other||source===other||idOf(other)===anchorId)return false;const a=rectOf(source),b=rectOf(other),dx=(b.left+b.right-a.left-a.right)/2,dy=(b.top+b.bottom-a.top-a.bottom)/2,overlapX=TABLE_WIDTH+60-Math.abs(dx),overlapY=(heightOf(source)+heightOf(other))/2+60-Math.abs(dy);if(overlapX<=0||overlapY<=0)return false;if(overlapX<overlapY)other.x+=(dx===0?1:Math.sign(dx))*overlapX;else other.y+=(dy===0?1:Math.sign(dy))*overlapY;return true;}
  function collisionWave(seeds,maxDepth,maxMoves,anchorId){const queue=seeds.filter(Boolean).map(table=>({table,depth:0})),seen=new Map(queue.map(item=>[idOf(item.table),0])),touched=new Set();let moves=0;while(queue.length&&moves<maxMoves){const{table:source,depth}=queue.shift();for(const other of tableIndex.query(rectOf(source,60))){if(moves>=maxMoves)break;if(!separate(source,other,anchorId))continue;tableIndex.update(other);const otherId=idOf(other);touched.add(otherId);moves+=1;if(depth>=maxDepth)continue;const nextDepth=depth+1,prior=seen.get(otherId);if(prior!==undefined&&prior<=nextDepth)continue;seen.set(otherId,nextDepth);queue.push({table:other,depth:nextDepth});}}if(touched.size)clustersDirty=true;return touched;}

  function inspect(table){const inspector=document.getElementById('inspector'),tableId=idOf(table),sameOpen=selected===tableId&&inspector?.classList.contains('open');selected=tableId;selectedTableId=tableId;if(sameOpen){inspector?.classList.remove('open');requestDraw();return;}document.getElementById('drawer-table-name').innerText=table.name;document.getElementById('drawer-table-desc').innerText=table.desc||'';const maxName=Math.max(...table.columns.map(column=>column.name.length),22);let ddl=`CREATE TABLE ${table.name} (\n`;table.columns.forEach((column,idx)=>{ddl+=`    ${column.name.padEnd(maxName+4)}${column.type}${column.pk?' PRIMARY KEY':''}${idx===table.columns.length-1?'':','}\n`;});ddl+=');';document.getElementById('ddl-text').innerText=ddl;let mock=`INSERT INTO ${table.name} (\n`;table.columns.forEach((column,idx)=>{mock+=`    ${column.name}${idx===table.columns.length-1?'':','}\n`;});mock+=') VALUES (\n';table.columns.forEach((column,idx)=>{const value=column.type.includes('VARCHAR')?"'STD_VALUE'":column.type==='DATE'?'SYSDATE':'100';mock+=`    ${value}${idx===table.columns.length-1?'':','}\n`;});mock+=');';document.getElementById('mock-text').innerText=mock;inspector?.classList.add('open');requestDraw();}
  function zoomAt(factor,anchorX,anchorY){if(!isActive())return false;const oldScale=Math.max(scale,0.0001),minScale=Math.max(0.0035,fitScaleForBounds(bounds)*0.72),nextScale=Math.min(2.5,Math.max(minScale,oldScale*factor));if(Math.abs(nextScale-oldScale)<0.000001)return true;const worldX=(anchorX-panX)/oldScale,worldY=(anchorY-panY)/oldScale;scale=nextScale;panX=anchorX-worldX*nextScale;panY=anchorY-worldY*nextScale;requestDraw();return true;}
  function focusCluster(cluster){const fit=fitScaleForBounds(cluster,70);centerOnBounds(cluster,Math.min(0.12,Math.max(scale*2.4,fit)));requestDraw();}
  function resetView(){if(!isActive())return false;centerOnBounds(bounds);requestDraw();return true;}
  function handleSearch(){if(!isActive())return false;query=(searchInput?.value||'').toLowerCase().trim();if(!query)matchedIds=null;else{matchedIds=new Set();(view()?.tables||[]).forEach(table=>{if(table.name.toLowerCase().includes(query)||(table.desc||'').toLowerCase().includes(query)||table.columns.some(column=>column.name.toLowerCase().includes(query)))matchedIds.add(idOf(table));});}rebuildClusterMatchMaps();requestDraw();return true;}

  overlay.addEventListener('mousedown',event=>{if(!isActive()||event.button!==0)return;event.preventDefault();const point=world(event.clientX,event.clientY);overlay.style.cursor='grabbing';if(chooseClusterLevel()){clusterClick={cluster:hitCluster(point.x,point.y),startX:event.clientX,startY:event.clientY,moved:false};pan={startX:event.clientX,startY:event.clientY,panX,panY};return;}const table=hitTable(point.x,point.y);if(table)drag={table,id:idOf(table),startX:event.clientX,startY:event.clientY,offsetX:point.x-table.x,offsetY:point.y-table.y,moved:false,touched:new Set()};else pan={startX:event.clientX,startY:event.clientY,panX,panY};});
  window.addEventListener('mousemove',event=>{if(!isActive())return;if(drag){const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;if(!drag.moved&&Math.hypot(dx,dy)>=5)drag.moved=true;const point=world(event.clientX,event.clientY);drag.table.x=point.x-drag.offsetX;drag.table.y=point.y-drag.offsetY;tableIndex.update(drag.table);collisionWave([drag.table],DRAG_DEPTH,DRAG_MAX_MOVES,drag.id).forEach(id=>drag.touched.add(id));clustersDirty=true;requestDraw();return;}if(pan){const dx=event.clientX-pan.startX,dy=event.clientY-pan.startY;if(clusterClick&&Math.hypot(dx,dy)>=5)clusterClick.moved=true;panX=pan.panX+dx;panY=pan.panY+dy;requestDraw();}});
  window.addEventListener('mouseup',()=>{if(!isActive())return;overlay.style.cursor='grab';if(drag){const finished=drag;drag=null;if(!finished.moved){inspect(finished.table);return;}const seeds=[finished.table,...[...finished.touched].slice(-48).map(id=>byId.get(id)).filter(Boolean)];collisionWave(seeds,SETTLE_DEPTH,SETTLE_MAX_MOVES,finished.id);clustersDirty=true;requestDraw();return;}if(clusterClick){const clicked=clusterClick;clusterClick=null;pan=null;if(!clicked.moved&&clicked.cluster)focusCluster(clicked.cluster);return;}if(pan)pan=null;});
  window.addEventListener('wheel',event=>{if(!isActive()||!workspace.contains(event.target))return;event.preventDefault();event.stopImmediatePropagation();const rect=workspace.getBoundingClientRect();zoomAt(event.deltaY<0?1.12:0.88,event.clientX-rect.left,event.clientY-rect.top);},{capture:true,passive:false});
  window.addEventListener('resize',requestDraw);

  function enter(viewKey){if(!available)return false;currentView=viewKey;active=true;selected=null;selectedTableId=null;query=(searchInput?.value||'').toLowerCase().trim();domLayer.style.display='none';glCanvas.style.display='block';overlay.style.display='block';hud.style.display='block';rebuildSceneData();if(query)handleSearch();centerOnBounds(bounds);requestDraw();return true;}
  function leave(){active=false;glCanvas.style.display='none';overlay.style.display='none';hud.style.display='none';drag=null;pan=null;clusterClick=null;lastScene=null;}
  const api={available,supports(viewKey){return available&&viewKey===VIEW;},isActive,enter,leave,requestDraw,zoomAt,resetView,handleSearch,applyLayout(){if(!isActive())return false;resetView();return true;}};window.ERDUltraWebGL=api;
  window.renderView=function(viewKey){if(api.supports(viewKey)){canvasRenderView?.call(this,'__webgl_ultra_off__');return enter(viewKey);}leave();return canvasRenderView?.call(this,viewKey);};
  window.updateConnections=function(...args){if(isActive())return requestDraw();return canvasUpdateConnections?.apply(this,args);};
  window.handleSearch=function(...args){if(isActive())return handleSearch();return canvasHandleSearch?.apply(this,args);};
  window.applyLayout=function(type,...args){if(isActive())return api.applyLayout(type,...args);return canvasApplyLayout?.call(this,type,...args);};
  window.addEventListener('load',()=>{const fallbackZoom=window.zoomCanvas,fallbackReset=window.resetZoom,fallbackApply=window.applyTransform;window.zoomCanvas=function(factor,anchorX,anchorY){if(!isActive())return fallbackZoom?.call(this,factor,anchorX,anchorY);const rect=workspace.getBoundingClientRect();return zoomAt(factor,Number.isFinite(anchorX)?anchorX:rect.width/2,Number.isFinite(anchorY)?anchorY:rect.height/2);};window.resetZoom=function(...args){return isActive()?resetView():fallbackReset?.apply(this,args);};window.applyTransform=function(...args){if(isActive())return requestDraw();return fallbackApply?.apply(this,args);};});
})();
