/** Bottom sliding project/schema/subject-area dock. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const P = E?.Project;
  const A = E?.Advanced;
  if (!E || !P) throw new Error('ERD project model must load before project dock');

  const DOCK_OPEN_KEY = 'erd_studio_project_dock_open_v1';
  let dock = null;

  function isOpen() {
    return localStorage.getItem(DOCK_OPEN_KEY) !== '0';
  }

  function setOpen(open) {
    localStorage.setItem(DOCK_OPEN_KEY, open ? '1' : '0');
    document.body.classList.toggle('erd-project-dock-open', open);
    dock?.classList.toggle('open', open);
    const icon = dock?.querySelector('[data-dock-toggle] i');
    if (icon) icon.className = open ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
  }

  function currentArea() {
    return P.activeArea(currentView);
  }

  function areaStats(area) {
    const view = schemaData[area.schemaKey];
    const inside = new Set(area.tableIds);
    const external = new Set();
    (view?.relations || []).forEach(rel => {
      const fromIn = inside.has(rel.from), toIn = inside.has(rel.to);
      if (fromIn !== toIn) external.add(fromIn ? rel.to : rel.from);
    });
    return { tables: inside.size, external: external.size };
  }

  function visibleTableCount() {
    const area = currentArea();
    return area ? area.tableIds.length : (schemaData[currentView]?.tables?.length || 0);
  }

  function ensureDock() {
    dock = document.getElementById('erd-project-dock');
    if (dock) return dock;
    dock = document.createElement('section');
    dock.id = 'erd-project-dock';
    dock.className = 'erd-project-dock';
    dock.innerHTML = `
      <div class="erd-project-dock-rail">
        <button class="dock-project-main" data-project-settings title="프로젝트 설정">
          <i class="fa-solid fa-box-archive"></i>
          <span class="dock-project-name"></span>
        </button>
        <span class="dock-path-separator"><i class="fa-solid fa-chevron-right"></i></span>
        <button class="dock-current-schema" data-current-schema></button>
        <span class="dock-path-separator"><i class="fa-solid fa-chevron-right"></i></span>
        <button class="dock-current-area" data-current-area></button>
        <span class="dock-flex"></span>
        <span class="dock-count" data-dock-count></span>
        <button class="dock-icon-btn" data-project-open title="프로젝트 파일 열기"><i class="fa-regular fa-folder-open"></i></button>
        <button class="dock-icon-btn" data-project-save title="프로젝트 파일 저장"><i class="fa-regular fa-floppy-disk"></i></button>
        <button class="dock-icon-btn dock-toggle" data-dock-toggle title="스키마/업무영역 패널"><i class="fa-solid fa-chevron-down"></i></button>
      </div>
      <div class="erd-project-dock-panel">
        <div class="dock-section">
          <div class="dock-section-head">
            <div><span class="dock-kicker">SCHEMAS</span><strong>스키마</strong></div>
            <span class="dock-help">전체 원본 스키마 · 가로 스크롤</span>
          </div>
          <div class="dock-chip-scroll" data-schema-list></div>
        </div>
        <div class="dock-section">
          <div class="dock-section-head">
            <div><span class="dock-kicker">SUBJECT AREAS</span><strong>업무 영역</strong></div>
            <div class="dock-section-actions">
              <button class="dock-text-btn" data-area-add-selection><i class="fa-solid fa-object-group"></i> 선택으로 생성</button>
              <button class="dock-text-btn" data-area-manage><i class="fa-solid fa-sliders"></i> 관리</button>
            </div>
          </div>
          <div class="dock-chip-scroll" data-area-list></div>
        </div>
        <div class="dock-scope-summary" data-scope-summary></div>
      </div>
    `;
    document.body.appendChild(dock);

    dock.querySelector('[data-dock-toggle]').onclick = () => setOpen(!dock.classList.contains('open'));
    dock.querySelector('[data-project-settings]').onclick = () => P.editInfo();
    dock.querySelector('[data-project-open]').onclick = () => P.importFile();
    dock.querySelector('[data-project-save]').onclick = () => P.exportFile();
    dock.querySelector('[data-area-add-selection]').onclick = createAreaFromSelection;
    dock.querySelector('[data-area-manage]').onclick = openAreaManager;
    setOpen(isOpen());
    return dock;
  }

  function schemaLabel(key) {
    const view = schemaData[key] || {};
    return view.tabName || view.title || key;
  }

  function switchSchema(key) {
    if (!schemaData[key] || key === currentView) return;
    switchView(key);
    renderDock();
    requestAnimationFrame(() => applyScope(true));
  }

  function selectArea(areaId) {
    P.setActiveArea(areaId, currentView);
    renderView(currentView);
    renderDock();
    requestAnimationFrame(() => applyScope(true));
  }

  function renderDock() {
    ensureDock();
    const state = P.state;
    dock.querySelector('.dock-project-name').textContent = state.project.name || 'ERD Project';
    dock.querySelector('[data-current-schema]').textContent = schemaLabel(currentView);
    const area = currentArea();
    dock.querySelector('[data-current-area]').textContent = area?.name || '전체 스키마';
    dock.querySelector('[data-dock-count]').textContent = `${visibleTableCount()} tables`;

    const schemaList = dock.querySelector('[data-schema-list]');
    schemaList.innerHTML = '';
    Object.keys(schemaData).forEach(key => {
      const view = schemaData[key];
      const button = document.createElement('button');
      button.className = `dock-chip schema-chip${key === currentView ? ' active' : ''}`;
      button.innerHTML = `<i class="${view.icon || 'fa-solid fa-database'}"></i><span>${E.escapeHtml(schemaLabel(key))}</span><em>${view.tables?.length || 0}</em>`;
      button.onclick = () => switchSchema(key);
      schemaList.appendChild(button);
    });

    const areaList = dock.querySelector('[data-area-list]');
    areaList.innerHTML = '';
    const all = document.createElement('button');
    all.className = `dock-chip area-chip${area ? '' : ' active'}`;
    all.innerHTML = `<i class="fa-solid fa-border-all"></i><span>전체 스키마</span><em>${schemaData[currentView]?.tables?.length || 0}</em>`;
    all.onclick = () => selectArea(null);
    areaList.appendChild(all);

    P.areasForSchema(currentView).forEach(item => {
      const stats = areaStats(item);
      const button = document.createElement('button');
      button.className = `dock-chip area-chip${area?.id === item.id ? ' active' : ''}`;
      button.style.setProperty('--area-color', item.color || '#8b5cf6');
      button.innerHTML = `<span class="dock-area-dot"></span><span>${E.escapeHtml(item.name)}</span><em>${stats.tables}</em>`;
      button.title = `${stats.tables}개 테이블 · 외부 연결 ${stats.external}개`;
      button.onclick = () => selectArea(item.id);
      button.ondblclick = event => { event.preventDefault(); event.stopPropagation(); editArea(item.id); };
      areaList.appendChild(button);
    });

    const summary = dock.querySelector('[data-scope-summary]');
    if (!area) {
      const mapper = state.sources?.mybatis;
      const statements = mapper?.statements?.length || 0;
      summary.innerHTML = `<span><i class="fa-solid fa-layer-group"></i> 현재 스키마 전체를 표시 중입니다.</span><span>${schemaData[currentView]?.tables?.length || 0} tables · ${(schemaData[currentView]?.relations || []).length} relations${statements ? ` · ${statements} mapper SQL` : ''}</span>`;
    } else {
      const stats = areaStats(area);
      summary.innerHTML = `<span><i class="fa-solid fa-filter"></i> <b>${E.escapeHtml(area.name)}</b> 업무 범위만 표시합니다.</span><span>${stats.tables} tables · 외부 연결 ${stats.external}개 · 더블클릭하면 편집</span>`;
    }
  }

  function createAreaFromSelection() {
    if (!E.selectedIds.size) {
      alert('업무 영역으로 묶을 테이블을 먼저 선택하세요.\nCtrl/Cmd + 클릭으로 여러 테이블을 선택할 수 있습니다.');
      return;
    }
    const name = prompt('새 업무 영역 이름', `업무 영역 ${P.areasForSchema(currentView).length + 1}`);
    if (!name?.trim()) return;
    try {
      const area = P.createAreaFromSelection(name.trim());
      P.setActiveArea(area.id, currentView);
      renderView(currentView);
      renderDock();
      requestAnimationFrame(() => applyScope(true));
      A?.showToast?.(`${area.name} 업무 영역을 만들었습니다.`);
    } catch (err) {
      alert(err.message);
    }
  }

  function editArea(areaId) {
    const area = P.state.areas.find(item => item.id === areaId);
    if (!area) return;
    const name = prompt('업무 영역 이름', area.name);
    if (name === null) return;
    const color = prompt('업무 영역 색상', area.color || '#8b5cf6');
    if (color === null) return;
    P.updateArea(areaId, { name, color });
    renderDock();
    applyScope(false);
  }

  function addSelectionToArea(areaId) {
    const area = P.state.areas.find(item => item.id === areaId);
    if (!area || !E.selectedIds.size) return;
    P.updateArea(areaId, { tableIds: [...area.tableIds, ...E.selectedIds] });
    renderDock();
    if (P.activeArea(currentView)?.id === areaId) {
      renderView(currentView);
      requestAnimationFrame(() => applyScope(false));
    }
  }

  function removeSelectionFromArea(areaId) {
    const area = P.state.areas.find(item => item.id === areaId);
    if (!area || !E.selectedIds.size) return;
    const remove = new Set(E.selectedIds);
    P.updateArea(areaId, { tableIds: area.tableIds.filter(id => !remove.has(id)) });
    E.selectedIds.clear();
    E.refreshSelection?.();
    renderDock();
    if (P.activeArea(currentView)?.id === areaId) {
      renderView(currentView);
      requestAnimationFrame(() => applyScope(false));
    }
  }

  function openAreaManager() {
    const areas = P.areasForSchema(currentView);
    const body = `
      <div class="area-manager-toolbar">
        <span>${E.escapeHtml(schemaLabel(currentView))} · ${areas.length}개 업무 영역</span>
        <button class="editor-btn primary" data-area-new>선택 테이블로 새 영역</button>
      </div>
      <div class="advanced-manager-list">
        ${areas.length ? areas.map(area => {
          const stats = areaStats(area);
          return `<div class="advanced-manager-row" data-area-row="${E.escapeHtml(area.id)}">
            <div>
              <strong><span class="area-manager-dot" style="--area-color:${E.escapeHtml(area.color)}"></span>${E.escapeHtml(area.name)}</strong>
              <small>${stats.tables} tables · 외부 연결 ${stats.external}개${area.description ? ` · ${E.escapeHtml(area.description)}` : ''}</small>
            </div>
            <div class="manager-actions">
              <button class="editor-btn" data-area-show>보기</button>
              <button class="editor-btn" data-area-add>선택 추가</button>
              <button class="editor-btn" data-area-remove>선택 제외</button>
              <button class="editor-btn" data-area-edit>편집</button>
              <button class="editor-btn danger" data-area-delete>삭제</button>
            </div>
          </div>`;
        }).join('') : '<div class="advanced-empty">아직 업무 영역이 없습니다. 테이블을 여러 개 선택한 뒤 새 영역을 만드세요.</div>'}
      </div>`;
    const dialog = A.ensureDialog('subject-area-manager-dialog', '업무 영역 관리', body, true);
    dialog.querySelector('[data-area-new]')?.addEventListener('click', () => {
      dialog.close();
      createAreaFromSelection();
    });
    dialog.querySelectorAll('[data-area-row]').forEach(row => {
      const id = row.dataset.areaRow;
      row.querySelector('[data-area-show]').onclick = () => { dialog.close(); selectArea(id); };
      row.querySelector('[data-area-add]').onclick = () => { addSelectionToArea(id); dialog.close(); openAreaManager(); };
      row.querySelector('[data-area-remove]').onclick = () => { removeSelectionFromArea(id); dialog.close(); openAreaManager(); };
      row.querySelector('[data-area-edit]').onclick = () => { editArea(id); dialog.close(); openAreaManager(); };
      row.querySelector('[data-area-delete]').onclick = () => {
        const target = P.state.areas.find(item => item.id === id);
        if (!confirm(`${target?.name || '업무 영역'}을 삭제할까요?\n테이블 원본은 삭제되지 않습니다.`)) return;
        P.deleteArea(id);
        renderView(currentView);
        renderDock();
        requestAnimationFrame(() => applyScope(false));
        dialog.close();
        openAreaManager();
      };
    });
    dialog.showModal();
  }

  function allowedSet() {
    const area = currentArea();
    return area ? new Set(area.tableIds) : null;
  }

  function filterCards(allowed) {
    const view = schemaData[currentView];
    if (!view) return;
    view.tables.forEach(table => {
      const id = E.tableId(table);
      const card = document.getElementById(`card-${id}`) || A?.getDetachedCard?.(id);
      if (!card) return;
      const hidden = allowed && !allowed.has(id);
      card.classList.toggle('scope-hidden', !!hidden);
      card.style.display = hidden ? 'none' : '';
    });
  }

  function filterRelations(allowed) {
    const view = schemaData[currentView];
    if (!view) return;
    document.querySelectorAll('path.connection-line').forEach(path => {
      const index = Number(path.dataset.relationIndex);
      const rel = Number.isFinite(index) ? view.relations?.[index] : null;
      const hidden = !!(allowed && rel && (!allowed.has(rel.from) || !allowed.has(rel.to)));
      path.style.display = hidden ? 'none' : '';
      const badge = path.nextElementSibling;
      if (badge?.tagName?.toLowerCase() === 'g') badge.style.display = hidden ? 'none' : '';
    });
  }

  function fitScope(allowed) {
    const view = schemaData[currentView];
    const tables = (view?.tables || []).filter(t => !allowed || allowed.has(E.tableId(t)));
    if (!tables.length) return;
    const minX = Math.min(...tables.map(t => t.x || 0));
    const minY = Math.min(...tables.map(t => t.y || 0));
    const maxX = Math.max(...tables.map(t => (t.x || 0) + 360));
    const maxY = Math.max(...tables.map(t => (t.y || 0) + 70 + (t.columns?.length || 0) * 34));
    const width = Math.max(360, maxX - minX);
    const height = Math.max(260, maxY - minY);
    const dockHeight = dock?.classList.contains('open') ? 230 : 52;
    const availableW = Math.max(400, workspace.clientWidth - 80);
    const availableH = Math.max(260, workspace.clientHeight - dockHeight - 60);
    scale = Math.max(0.4, Math.min(1.15, Math.min(availableW / width, availableH / height) * 0.9));
    panX = availableW / 2 - ((minX + maxX) / 2) * scale + 40;
    panY = availableH / 2 - ((minY + maxY) / 2) * scale + 30;
    applyTransform();
  }

  function applyScope(fit = false) {
    const allowed = allowedSet();
    filterCards(allowed);
    A?.legacyUpdateConnections?.();
    A?.decorateRelations?.();
    filterRelations(allowed);
    if (fit) requestAnimationFrame(() => fitScope(allowed));
    const count = dock?.querySelector('[data-dock-count]');
    if (count) count.textContent = `${visibleTableCount()} tables`;
  }

  const baseRender = window.renderView;
  window.renderView = function(viewKey) {
    baseRender(viewKey);
    requestAnimationFrame(() => {
      renderDock();
      applyScope(false);
    });
  };

  if (A?.decorateRelations) {
    const baseDecorate = A.decorateRelations;
    A.decorateRelations = function() {
      baseDecorate();
      filterRelations(allowedSet());
    };
  }

  document.addEventListener('erd:project-scope-changed', () => {
    renderDock();
    applyScope(false);
  });
  document.addEventListener('erd:project-areas-changed', renderDock);
  document.addEventListener('erd:project-info-changed', renderDock);
  document.addEventListener('erd:project-loaded', () => {
    renderDock();
    requestAnimationFrame(() => applyScope(true));
  });

  const baseOnload = window.onload;
  window.onload = function(event) {
    baseOnload?.call(window, event);
    ensureDock();
    renderDock();
    requestAnimationFrame(() => applyScope(false));
  };

  P.Dock = { render: renderDock, applyScope, openAreaManager, selectArea, switchSchema };
  Object.assign(window, { openProjectDockAreaManager: openAreaManager });
})();
