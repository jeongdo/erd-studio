/** Pure WebGL2 100k benchmark: no clustering, no viewport culling. */
(() => {
  'use strict';

  const VIEW = 'performance_100000_raw';
  const SOURCE = 'performance_100000';
  const W = 360, HEADER = 52, ROW = 34, BOTTOM = 12;
  if (typeof schemaData === 'undefined' || !schemaData[SOURCE]) return;

  const source = schemaData[SOURCE];
  const descriptor = {
    tabName: '성능 100000 RAW',
    icon: 'fa-solid fa-microchip',
    title: '초대규모 ERD RAW WebGL2 (100,000 Tables)',
    performanceSample: true,
    performanceKey: '100000-raw'
  };
  Object.defineProperties(descriptor, {
    tables: { enumerable: true, get: () => source.tables },
    relations: { enumerable: true, get: () => source.relations }
  });
  schemaData[VIEW] = descriptor;

  const workspace = document.getElementById('workspace');
  const domLayer = document.getElementById('canvas-layer');
  const zoomText = document.getElementById('zoom-text');
  if (!workspace || !domLayer) return;

  const fallbackRenderView = window.renderView;
  const fallbackUpdateConnections = window.updateConnections;
  const fallbackApplyLayout = window.applyLayout;

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    zIndex: '18', display: 'none', cursor: 'grab'
  });
  workspace.appendChild(canvas);

  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'absolute', top: '12px', left: '12px', zIndex: '76', display: 'none',
    padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--panel-border)',
    background: 'var(--panel-bg)', color: 'var(--text-muted)',
    font: "600 11px 'Fira Code', monospace", pointerEvents: 'none'
  });
  workspace.appendChild(hud);

  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false
  });
  const available = !!gl;
  let active = false, raf = 0, gpu = null, count = 0, bounds = null, pan = null;
  let lastFrame = 0, fps = 0;

  const heightOf = t => HEADER + (t?.columns?.length || 0) * ROW + BOTTOM;

  function rgb(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw.startsWith('#')) return fallback;
    const hex = raw.slice(1);
    if (hex.length === 3) return hex.split('').map(ch => parseInt(ch + ch, 16) / 255);
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  }

  function compile(type, code) {
    const s = gl.createShader(type);
    gl.shaderSource(s, code);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
    return s;
  }

  function initGpu() {
    if (gpu) return;
    const vs = `#version 300 es
      precision highp float; in vec2 p; in vec4 r;
      uniform vec2 viewport; uniform vec2 pan; uniform float scale; out vec2 uv;
      void main(){ vec2 s=(r.xy+p*r.zw)*scale+pan; gl_Position=vec4(s.x/viewport.x*2.0-1.0,1.0-s.y/viewport.y*2.0,0,1); uv=p; }`;
    const fs = `#version 300 es
      precision mediump float; in vec2 uv; uniform vec3 fill; uniform vec3 border; out vec4 outColor;
      void main(){ float e=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y)); outColor=vec4(mix(border,fill,smoothstep(.008,.03,e)),.96); }`;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link failed');

    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const instances = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    const r = gl.getAttribLocation(program, 'r'); gl.enableVertexAttribArray(r); gl.vertexAttribPointer(r, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(r, 1);
    gl.bindVertexArray(null);
    gpu = {
      program, vao, instances,
      viewport: gl.getUniformLocation(program, 'viewport'), pan: gl.getUniformLocation(program, 'pan'),
      scale: gl.getUniformLocation(program, 'scale'), fill: gl.getUniformLocation(program, 'fill'), border: gl.getUniformLocation(program, 'border')
    };
  }

  function upload() {
    initGpu();
    const tables = descriptor.tables;
    const data = new Float32Array(tables.length * 4);
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, i = 0;
    for (const t of tables) {
      const h = heightOf(t);
      data[i++] = t.x; data[i++] = t.y; data[i++] = W; data[i++] = h;
      left = Math.min(left, t.x); top = Math.min(top, t.y); right = Math.max(right, t.x + W); bottom = Math.max(bottom, t.y + h);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.instances); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    count = tables.length; bounds = { left, top, right, bottom };
  }

  function resize() {
    const r = workspace.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function fitScale() {
    const r = workspace.getBoundingClientRect();
    return Math.max(.0035, Math.min(1, (r.width - 108) / Math.max(1, bounds.right - bounds.left), (r.height - 108) / Math.max(1, bounds.bottom - bounds.top)));
  }

  function center() {
    const r = workspace.getBoundingClientRect(); scale = fitScale();
    panX = r.width / 2 - (bounds.left + bounds.right) / 2 * scale;
    panY = r.height / 2 - (bounds.top + bounds.bottom) / 2 * scale;
  }

  function draw() {
    raf = 0; if (!active) return; resize();
    const r = workspace.getBoundingClientRect();
    const css = name => getComputedStyle(document.body).getPropertyValue(name).trim();
    const fill = rgb(css('--card-bg'), [0.067,0.094,0.153]);
    const border = rgb(css('--accent-blue'), [0.22,0.74,0.97]);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(gpu.program); gl.bindVertexArray(gpu.vao);
    gl.uniform2f(gpu.viewport, r.width, r.height); gl.uniform2f(gpu.pan, panX, panY); gl.uniform1f(gpu.scale, scale);
    gl.uniform3fv(gpu.fill, fill); gl.uniform3fv(gpu.border, border); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count); gl.bindVertexArray(null);
    if (zoomText) zoomText.innerText = `${Math.round(scale * 100)}%`;
    const now = performance.now(); if (lastFrame) { const f = 1000 / Math.max(1, now - lastFrame); fps = fps ? fps * .82 + f * .18 : f; } lastFrame = now;
    hud.textContent = `WEBGL2 RAW · ${count} instances · no cluster · no culling · ${Math.min(99, Math.round(fps || 0))} fps`;
  }

  function requestDraw() { if (active && !raf) raf = requestAnimationFrame(draw); }

  function zoomAt(factor, x, y) {
    if (!active) return false;
    const old = Math.max(scale, .0001), min = Math.max(.0035, fitScale() * .72), next = Math.min(2.5, Math.max(min, old * factor));
    const wx = (x - panX) / old, wy = (y - panY) / old; scale = next; panX = x - wx * next; panY = y - wy * next; requestDraw(); return true;
  }

  function enter() {
    if (!available) return false;
    currentView = VIEW; active = true; domLayer.style.display = 'none'; canvas.style.display = 'block'; hud.style.display = 'block';
    upload(); center(); requestDraw(); return true;
  }
  function leave() { active = false; canvas.style.display = 'none'; hud.style.display = 'none'; pan = null; }

  canvas.addEventListener('mousedown', e => { if (!active || e.button !== 0) return; e.preventDefault(); canvas.style.cursor = 'grabbing'; pan = { x:e.clientX, y:e.clientY, panX, panY }; });
  window.addEventListener('mousemove', e => { if (!active || !pan) return; panX = pan.panX + e.clientX - pan.x; panY = pan.panY + e.clientY - pan.y; requestDraw(); });
  window.addEventListener('mouseup', () => { if (!active) return; pan = null; canvas.style.cursor = 'grab'; });
  window.addEventListener('wheel', e => { if (!active || !workspace.contains(e.target)) return; e.preventDefault(); e.stopImmediatePropagation(); const r = workspace.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : .88, e.clientX-r.left, e.clientY-r.top); }, { capture:true, passive:false });
  window.addEventListener('resize', requestDraw);

  window.renderView = function(viewKey) {
    if (available && viewKey === VIEW) { fallbackRenderView?.call(this, '__webgl_raw_off__'); window.ERDUltraWebGL?.leave?.(); return enter(); }
    leave(); return fallbackRenderView?.call(this, viewKey);
  };
  window.updateConnections = function(...args) { if (active) return requestDraw(); return fallbackUpdateConnections?.apply(this, args); };
  window.applyLayout = function(type, ...args) { if (active) { center(); requestDraw(); return true; } return fallbackApplyLayout?.call(this, type, ...args); };
  window.ERDUltraWebGLRaw = { available, isActive: () => active, requestDraw, zoomAt };

  window.addEventListener('load', () => {
    const fallbackZoom = window.zoomCanvas, fallbackReset = window.resetZoom, fallbackApply = window.applyTransform;
    window.zoomCanvas = function(factor, x, y) { if (!active) return fallbackZoom?.call(this, factor, x, y); const r = workspace.getBoundingClientRect(); return zoomAt(factor, Number.isFinite(x)?x:r.width/2, Number.isFinite(y)?y:r.height/2); };
    window.resetZoom = function(...args) { if (!active) return fallbackReset?.apply(this, args); center(); requestDraw(); return true; };
    window.applyTransform = function(...args) { if (active) return requestDraw(); return fallbackApply?.apply(this, args); };
  });
})();
