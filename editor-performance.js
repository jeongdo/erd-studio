/** Viewport culling, minimap viewport and final render hooks for large ERDs. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const A = E.Advanced;
  const THRESHOLD = 80;
  const MARGIN = 500;
  const detached = new Map();

  A.getDetachedCard = id => detached.get(id);

  function getCard(id) {
    return document.getElementById(`card-${id}`) || detached.get(id);
  }

  function cull() {
    const view = A.view();
    if (!view) return;

    if (view.tables.length < THRESHOLD) {
      if (detached.size) {
        detached.forEach(card => cardsContainer.appendChild(card));
        detached.clear();
        A.legacyUpdateConnections?.();
        A.decorateRelations?.();
      }
      const status = document.getElementById('culling-status');
      if (status) status.textContent = '';
      return;
    }

    const left = (-panX) / scale - MARGIN;
    const top = (-panY) / scale - MARGIN;
    const right = left + workspace.clientWidth / scale + MARGIN * 2;
    const bottom = top + workspace.clientHeight / scale + MARGIN * 2;
    let changed = false;

    view.tables.forEach(table => {
      const id = E.tableId(table);
      const x = table.x || 0;
      const y = table.y || 0;
      const height = 60 + (table.columns?.length || 0) * 34;
      const visible = x + 360 >= left && x <= right && y + height >= top && y <= bottom;
      const inDom = document.getElementById(`card-${id}`);

      if (!visible && inDom) {
        detached.set(id, inDom);
        inDom.remove();
        changed = true;
      } else if (visible && !inDom && detached.has(id)) {
        cardsContainer.appendChild(detached.get(id));
        detached.delete(id);
        changed = true;
      }
    });

    if (changed) {
      A.applyTableColors?.();
      A.legacyUpdateConnections?.();
      A.decorateRelations?.();
    }

    const status = document.getElementById('culling-status');
    if (status) status.textContent = `${view.tables.length - detached.size}/${view.tables.length}`;
  }

  function scheduleCull() {
    cancelAnimationFrame(scheduleCull.raf);
    scheduleCull.raf = requestAnimationFrame(cull);
  }

  A.cullViewport = cull;

  function scopedMinimapTables(view) {
    const area = E.Project?.activeArea?.(currentView);
    if (!area) return view.tables || [];
    const allowed = new Set(area.tableIds || []);
    return (view.tables || []).filter(table => allowed.has(E.tableId(table)));
  }

  function visibleViewport() {
    const dock = document.getElementById('erd-project-dock');
    const inspector = document.getElementById('inspector');
    const dockHeight = dock ? Math.min(workspace.clientHeight - 1, dock.getBoundingClientRect().height || 0) : 0;
    const inspectorWidth = inspector?.classList.contains('open')
      ? Math.min(workspace.clientWidth - 1, inspector.getBoundingClientRect().width || 0)
      : 0;
    return {
      width: Math.max(1, workspace.clientWidth - inspectorWidth),
      height: Math.max(1, workspace.clientHeight - dockHeight)
    };
  }

  function minimapMetrics(map, tables) {
    const mapWidth = map.clientWidth || 180;
    const mapHeight = map.clientHeight || 120;
    const padding = 100;

    let minX = Math.min(...tables.map(table => table.x || 0)) - padding;
    let minY = Math.min(...tables.map(table => table.y || 0)) - padding;
    let maxX = Math.max(...tables.map(table => (table.x || 0) + 360)) + padding;
    let maxY = Math.max(...tables.map(table => (
      (table.y || 0) + 58 + (table.columns?.length || 0) * 34
    ))) + padding;

    let worldWidth = Math.max(1, maxX - minX);
    let worldHeight = Math.max(1, maxY - minY);

    if (worldWidth < 1000) {
      const extra = (1000 - worldWidth) / 2;
      minX -= extra;
      maxX += extra;
      worldWidth = 1000;
    }
    if (worldHeight < 700) {
      const extra = (700 - worldHeight) / 2;
      minY -= extra;
      maxY += extra;
      worldHeight = 700;
    }

    const miniScale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight);
    const contentWidth = worldWidth * miniScale;
    const contentHeight = worldHeight * miniScale;

    return {
      mapWidth,
      mapHeight,
      minX,
      minY,
      maxX,
      maxY,
      worldWidth,
      worldHeight,
      miniScale,
      offsetX: (mapWidth - contentWidth) / 2,
      offsetY: (mapHeight - contentHeight) / 2
    };
  }

  function toMini(metrics, x, y) {
    return {
      x: metrics.offsetX + (x - metrics.minX) * metrics.miniScale,
      y: metrics.offsetY + (y - metrics.minY) * metrics.miniScale
    };
  }

  function renderMinimap() {
    const map = document.getElementById('editor-minimap');
    const view = E.currentSchema();
    if (!map) return;

    const tables = view ? scopedMinimapTables(view) : [];
    if (!tables.length) {
      map.innerHTML = '';
      map.__erdMetrics = null;
      return;
    }

    const metrics = minimapMetrics(map, tables);
    map.__erdMetrics = metrics;
    map.innerHTML = '';

    tables.forEach(table => {
      const point = toMini(metrics, table.x || 0, table.y || 0);
      const marker = document.createElement('span');
      marker.className = 'editor-minimap-table';
      marker.title = table.name || E.tableId(table);
      marker.style.left = `${point.x}px`;
      marker.style.top = `${point.y}px`;
      marker.style.width = `${Math.max(4, 360 * metrics.miniScale)}px`;
      marker.style.height = `${Math.max(3, (58 + (table.columns?.length || 0) * 34) * metrics.miniScale)}px`;
      map.appendChild(marker);
    });

    const visible = visibleViewport();
    const viewportX = (-panX) / scale;
    const viewportY = (-panY) / scale;
    const viewportWidth = visible.width / scale;
    const viewportHeight = visible.height / scale;
    const topLeft = toMini(metrics, viewportX, viewportY);

    const rawLeft = topLeft.x;
    const rawTop = topLeft.y;
    const rawRight = rawLeft + viewportWidth * metrics.miniScale;
    const rawBottom = rawTop + viewportHeight * metrics.miniScale;
    const left = Math.max(0, rawLeft);
    const top = Math.max(0, rawTop);
    const right = Math.min(metrics.mapWidth, rawRight);
    const bottom = Math.min(metrics.mapHeight, rawBottom);

    if (right > left && bottom > top) {
      const frame = document.createElement('div');
      const viewportColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#ffffff';
      frame.className = 'editor-minimap-viewport';
      frame.title = '현재 화면 영역';
      Object.assign(frame.style, {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.max(2, right - left)}px`,
        height: `${Math.max(2, bottom - top)}px`,
        border: `1.5px solid ${viewportColor}`,
        background: 'rgba(255,255,255,.035)',
        borderRadius: '2px',
        boxShadow: '0 0 0 1px rgba(0,0,0,.32), 0 0 7px rgba(255,255,255,.16)',
        pointerEvents: 'none',
        zIndex: '5'
      });
      map.appendChild(frame);
    }
  }

  E.updateMinimap = renderMinimap;

  function navigateMinimap(event) {
    const map = document.getElementById('editor-minimap');
    const metrics = map?.__erdMetrics;
    if (!map || !metrics) return;

    const rect = map.getBoundingClientRect();
    const mx = Math.min(metrics.mapWidth, Math.max(0, event.clientX - rect.left));
    const my = Math.min(metrics.mapHeight, Math.max(0, event.clientY - rect.top));
    const worldX = (mx - metrics.offsetX) / metrics.miniScale + metrics.minX;
    const worldY = (my - metrics.offsetY) / metrics.miniScale + metrics.minY;
    const visible = visibleViewport();

    panX = visible.width / 2 - worldX * scale;
    panY = visible.height / 2 - worldY * scale;
    applyTransform();
  }

  function installMinimapNavigation() {
    const map = document.getElementById('editor-minimap');
    if (!map || map.dataset.viewportNavigation === '1') return;
    map.dataset.viewportNavigation = '1';
    let dragging = false;

    map.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      dragging = true;
      map.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      navigateMinimap(event);
    }, true);

    map.addEventListener('pointermove', event => {
      if (!dragging) return;
      event.preventDefault();
      navigateMinimap(event);
    }, true);

    const finish = event => {
      if (!dragging) return;
      dragging = false;
      map.releasePointerCapture?.(event.pointerId);
    };
    map.addEventListener('pointerup', finish, true);
    map.addEventListener('pointercancel', finish, true);

    // editor-core has the original click-to-center listener. Stop that legacy
    // handler so the viewport-aware coordinate system is the single source.
    map.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  const baseRender = window.renderView;
  window.renderView = function(viewKey) {
    detached.clear();
    baseRender(viewKey);
    requestAnimationFrame(() => {
      A.renderCanvasExtras?.();
      scheduleCull();
      A.decorateRelations?.();
      renderMinimap();
    });
  };

  const baseTransform = window.applyTransform;
  window.applyTransform = function() {
    baseTransform();
    scheduleCull();
    renderMinimap();
  };

  const baseSearch = window.handleSearch;
  window.handleSearch = function() {
    if ((A.view()?.tables?.length || 0) < THRESHOLD) return baseSearch();
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    A.view().tables.forEach(table => {
      const card = getCard(E.tableId(table));
      if (!card) return;
      const match = table.name.toLowerCase().includes(query)
        || (table.desc && table.desc.toLowerCase().includes(query))
        || table.columns.some(column => column.name.toLowerCase().includes(query));
      card.classList.toggle('dimmed', !!query && !match);
    });
  };

  window.addEventListener('resize', () => {
    scheduleCull();
    renderMinimap();
  });
  document.addEventListener('erd:project-scope-changed', () => requestAnimationFrame(renderMinimap));
  document.addEventListener('erd:project-areas-changed', () => requestAnimationFrame(renderMinimap));
  document.addEventListener('erd:project-loaded', () => requestAnimationFrame(renderMinimap));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-dock-toggle]') || event.target.closest('[onclick*="toggleInspector"]')) {
      requestAnimationFrame(() => requestAnimationFrame(renderMinimap));
    }
  }, true);

  installMinimapNavigation();
  setTimeout(() => {
    A.renderCanvasExtras?.();
    scheduleCull();
    A.decorateRelations?.();
    renderMinimap();
  }, 0);
})();
