/** Pre-render viewport virtualization, minimap viewport and final render hooks for large ERDs. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const A = E.Advanced;
  const THRESHOLD = 80;
  const MARGIN = 500;
  const CARD_WIDTH = 360;
  const FALLBACK_COLUMNS = 3;
  let virtualViewKey = null;
  let virtualIds = new Set();

  // Virtualized cards are recreated on demand rather than retained off-screen.
  A.getDetachedCard = () => null;

  function tableHeight(table) {
    return 60 + (table.columns?.length || 0) * 34;
  }

  function ensureTableLayout(view) {
    (view?.tables || []).forEach((table, index) => {
      table.id ||= table.name;
      if (typeof table.x === 'undefined' || typeof table.y === 'undefined') {
        const col = index % FALLBACK_COLUMNS;
        const row = Math.floor(index / FALLBACK_COLUMNS);
        table.x = 60 + col * 520;
        table.y = 80 + row * 400;
      }
    });
  }

  function scopedTables(view) {
    const area = E.Project?.activeArea?.(currentView);
    if (!area) return view?.tables || [];
    const allowed = new Set(area.tableIds || []);
    return (view?.tables || []).filter(table => allowed.has(E.tableId(table)));
  }

  function cameraForTables(tables) {
    if (!tables.length) return { panX: 0, panY: 0, scale: 1 };
    const minX = Math.min(...tables.map(table => table.x || 0));
    const minY = Math.min(...tables.map(table => table.y || 0));
    const maxX = Math.max(...tables.map(table => (table.x || 0) + CARD_WIDTH));
    const maxY = Math.max(...tables.map(table => (table.y || 0) + tableHeight(table)));
    return {
      panX: window.innerWidth / 2 - (minX + maxX) / 2,
      panY: window.innerHeight / 2 - (minY + maxY) / 2,
      scale: 1
    };
  }

  function viewportBounds(camera = null) {
    const nextScale = camera?.scale ?? scale;
    const nextPanX = camera?.panX ?? panX;
    const nextPanY = camera?.panY ?? panY;
    return {
      left: (-nextPanX) / nextScale - MARGIN,
      top: (-nextPanY) / nextScale - MARGIN,
      right: (-nextPanX + workspace.clientWidth) / nextScale + MARGIN,
      bottom: (-nextPanY + workspace.clientHeight) / nextScale + MARGIN
    };
  }

  function intersectsViewport(table, bounds) {
    const x = table.x || 0;
    const y = table.y || 0;
    return x + CARD_WIDTH >= bounds.left
      && x <= bounds.right
      && y + tableHeight(table) >= bounds.top
      && y <= bounds.bottom;
  }

  function visibleTables(view, camera = null) {
    const bounds = viewportBounds(camera);
    return scopedTables(view).filter(table => intersectsViewport(table, bounds));
  }

  function createVirtualCard(table) {
    const id = E.tableId(table);
    const card = document.createElement('div');
    card.className = 'table-card';
    card.id = `card-${id}`;
    card.style.left = `${table.x || 0}px`;
    card.style.top = `${table.y || 0}px`;
    card.innerHTML = `
      <div class="table-header" onmousedown="startDragCard(event, '${id}')">
        <div class="table-title">
          <span class="table-name">${table.name}</span>
          <span class="table-desc">${table.desc || ''}</span>
        </div>
        <span class="table-badge">TABLE</span>
      </div>
      <div class="column-list">
        ${(table.columns || []).map(column => `
          <div class="column-row" id="col-${id}-${column.name}">
            <div class="column-left">
              <span class="key-badge ${column.pk ? 'key-pk' : (column.fk ? 'key-fk' : 'key-none')}">
                ${column.pk ? 'PK' : (column.fk ? 'FK' : '')}
              </span>
              <span class="col-name">${column.name}</span>
            </div>
            <span class="col-type">${column.type}</span>
          </div>
        `).join('')}
      </div>
    `;
    card.addEventListener('click', event => {
      event.stopPropagation();
      selectTable(table);
    });
    return card;
  }

  function updateCullingStatus(visibleCount, totalCount) {
    const status = document.getElementById('culling-status');
    if (!status) return;
    status.textContent = totalCount >= THRESHOLD ? `${visibleCount}/${totalCount}` : '';
  }

  function syncVirtualCards() {
    const view = A.view();
    if (!view) return false;
    if (view.tables.length < THRESHOLD) {
      virtualViewKey = null;
      virtualIds = new Set();
      updateCullingStatus(view.tables.length, view.tables.length);
      return false;
    }

    ensureTableLayout(view);
    const candidates = scopedTables(view);
    const targetTables = visibleTables(view);
    const targetIds = new Set(targetTables.map(E.tableId));
    let changed = virtualViewKey !== currentView;

    cardsContainer.querySelectorAll('.table-card').forEach(card => {
      const id = card.id.replace(/^card-/, '');
      if (!targetIds.has(id)) {
        card.remove();
        changed = true;
      }
    });

    const fragment = document.createDocumentFragment();
    targetTables.forEach(table => {
      const id = E.tableId(table);
      if (!document.getElementById(`card-${id}`)) {
        fragment.appendChild(createVirtualCard(table));
        changed = true;
      }
    });
    if (fragment.childNodes.length) cardsContainer.appendChild(fragment);

    virtualViewKey = currentView;
    virtualIds = targetIds;
    updateCullingStatus(targetIds.size, candidates.length);

    if (changed) {
      A.applyTableColors?.();
      E.refreshSelection?.();
      window.updateConnections?.();
      A.updateGroupBounds?.();
    }
    return changed;
  }

  function scheduleCull() {
    cancelAnimationFrame(scheduleCull.raf);
    scheduleCull.raf = requestAnimationFrame(syncVirtualCards);
  }

  A.cullViewport = syncVirtualCards;

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
    let maxX = Math.max(...tables.map(table => (table.x || 0) + CARD_WIDTH)) + padding;
    let maxY = Math.max(...tables.map(table => (table.y || 0) + tableHeight(table))) + padding;

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

  function updateMinimapViewport() {
    const map = document.getElementById('editor-minimap');
    const metrics = map?.__erdMetrics;
    const frame = map?.__erdViewportFrame;
    if (!map || !metrics || !frame) return;

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

    if (right <= left || bottom <= top) {
      frame.style.display = 'none';
      return;
    }
    frame.style.display = 'block';
    frame.style.left = `${left}px`;
    frame.style.top = `${top}px`;
    frame.style.width = `${Math.max(2, right - left)}px`;
    frame.style.height = `${Math.max(2, bottom - top)}px`;
  }

  function renderMinimap() {
    const map = document.getElementById('editor-minimap');
    const view = E.currentSchema();
    if (!map) return;
    if (view) ensureTableLayout(view);

    const tables = view ? scopedTables(view) : [];
    if (!tables.length) {
      map.innerHTML = '';
      map.__erdMetrics = null;
      map.__erdViewportFrame = null;
      return;
    }

    const metrics = minimapMetrics(map, tables);
    map.__erdMetrics = metrics;
    map.innerHTML = '';
    const fragment = document.createDocumentFragment();

    tables.forEach(table => {
      const point = toMini(metrics, table.x || 0, table.y || 0);
      const marker = document.createElement('span');
      marker.className = 'editor-minimap-table';
      marker.title = table.name || E.tableId(table);
      marker.style.left = `${point.x}px`;
      marker.style.top = `${point.y}px`;
      marker.style.width = `${Math.max(4, CARD_WIDTH * metrics.miniScale)}px`;
      marker.style.height = `${Math.max(3, tableHeight(table) * metrics.miniScale)}px`;
      fragment.appendChild(marker);
    });

    const frame = document.createElement('div');
    const viewportColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#ffffff';
    frame.className = 'editor-minimap-viewport';
    frame.title = '현재 화면 영역';
    Object.assign(frame.style, {
      position: 'absolute',
      border: `1.5px solid ${viewportColor}`,
      background: 'rgba(255,255,255,.035)',
      borderRadius: '2px',
      boxShadow: '0 0 0 1px rgba(0,0,0,.32), 0 0 7px rgba(255,255,255,.16)',
      pointerEvents: 'none',
      zIndex: '5'
    });
    fragment.appendChild(frame);
    map.appendChild(fragment);
    map.__erdViewportFrame = frame;
    updateMinimapViewport();
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
    map.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  const baseRender = window.renderView;
  window.renderView = function(viewKey) {
    const view = schemaData[viewKey];
    if (!view || (view.tables?.length || 0) < THRESHOLD) {
      virtualViewKey = null;
      virtualIds = new Set();
      baseRender(viewKey);
      requestAnimationFrame(() => {
        A.renderCanvasExtras?.();
        A.decorateRelations?.();
        renderMinimap();
        updateCullingStatus(view?.tables?.length || 0, view?.tables?.length || 0);
      });
      return;
    }

    ensureTableLayout(view);
    currentView = viewKey;
    const candidates = scopedTables(view);
    const camera = cameraForTables(candidates.length ? candidates : view.tables);
    const targetTables = visibleTables(view, camera);
    const fullTables = view.tables;
    const initialTables = targetTables.length ? targetTables : candidates.slice(0, 1);

    view.tables = initialTables;
    try {
      baseRender(viewKey);
    } finally {
      view.tables = fullTables;
    }

    panX = camera.panX;
    panY = camera.panY;
    scale = camera.scale;
    canvasLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    const zoomText = document.getElementById('zoom-text');
    if (zoomText) zoomText.innerText = `${Math.round(scale * 100)}%`;
    virtualViewKey = viewKey;
    virtualIds = new Set(initialTables.map(E.tableId));
    updateCullingStatus(virtualIds.size, candidates.length);

    requestAnimationFrame(() => {
      A.renderCanvasExtras?.();
      A.applyTableColors?.();
      E.refreshSelection?.();
      window.updateConnections?.();
      A.decorateRelations?.();
      renderMinimap();
    });
  };

  const baseTransform = window.applyTransform;
  window.applyTransform = function() {
    baseTransform();
    if ((A.view()?.tables?.length || 0) >= THRESHOLD) scheduleCull();
    updateMinimapViewport();
  };

  const baseSearch = window.handleSearch;
  window.handleSearch = function() {
    if ((A.view()?.tables?.length || 0) < THRESHOLD) return baseSearch();
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    cardsContainer.querySelectorAll('.table-card').forEach(card => {
      const table = E.findTable(card.id.replace(/^card-/, ''));
      if (!table) return;
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
  document.addEventListener('erd:project-scope-changed', () => requestAnimationFrame(() => {
    scheduleCull();
    renderMinimap();
  }));
  document.addEventListener('erd:project-areas-changed', () => requestAnimationFrame(renderMinimap));
  document.addEventListener('erd:project-loaded', () => requestAnimationFrame(() => {
    scheduleCull();
    renderMinimap();
  }));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-dock-toggle]') || event.target.closest('[onclick*="toggleInspector"]')) {
      requestAnimationFrame(() => requestAnimationFrame(updateMinimapViewport));
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
