/** ERD Studio portable project model: project metadata, schemas, subject areas and source indexes. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  if (!E) throw new Error('ERDEditor core must load before project layer');

  const STORAGE_KEY = 'erd_studio_project_v1';
  const FORMAT = 'erd-studio-project';
  const VERSION = 1;

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function schemaKeys() {
    return Object.keys(schemaData || {});
  }

  function defaultState() {
    const first = schemaKeys()[0] || '';
    return {
      format: FORMAT,
      version: VERSION,
      project: {
        id: uid('project'),
        name: 'ERD Project',
        description: '',
        dbms: 'oracle',
        createdAt: now(),
        updatedAt: now()
      },
      areas: [],
      activeAreaBySchema: first ? { [first]: null } : {},
      sources: {
        mybatis: {
          importedAt: null,
          files: [],
          statements: [],
          tableUsage: {}
        }
      }
    };
  }

  function normalizeArea(area) {
    return {
      id: String(area?.id || uid('area')),
      name: String(area?.name || '업무 영역').trim(),
      description: String(area?.description || '').trim(),
      schemaKey: String(area?.schemaKey || schemaKeys()[0] || ''),
      tableIds: [...new Set((area?.tableIds || []).map(String))],
      color: String(area?.color || '#8b5cf6'),
      source: String(area?.source || 'manual'),
      createdAt: area?.createdAt || now(),
      updatedAt: area?.updatedAt || now()
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    return {
      ...base,
      ...raw,
      format: FORMAT,
      version: VERSION,
      project: { ...base.project, ...(raw.project || {}) },
      areas: Array.isArray(raw.areas) ? raw.areas.map(normalizeArea) : [],
      activeAreaBySchema: raw.activeAreaBySchema && typeof raw.activeAreaBySchema === 'object'
        ? { ...raw.activeAreaBySchema } : {},
      sources: {
        ...base.sources,
        ...(raw.sources || {}),
        mybatis: { ...base.sources.mybatis, ...(raw.sources?.mybatis || {}) }
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (err) {
      console.warn('Ignoring invalid ERD project metadata:', err);
      return defaultState();
    }
  }

  let state = loadState();

  function liveTableIds(schemaKey) {
    return new Set((schemaData[schemaKey]?.tables || []).map(E.tableId));
  }

  function sanitizeAreas() {
    const keys = new Set(schemaKeys());
    state.areas = state.areas
      .filter(area => keys.has(area.schemaKey))
      .map(area => {
        const live = liveTableIds(area.schemaKey);
        area.tableIds = area.tableIds.filter(id => live.has(id));
        return area;
      });
    Object.keys(state.activeAreaBySchema).forEach(key => {
      if (!keys.has(key)) delete state.activeAreaBySchema[key];
      const active = state.activeAreaBySchema[key];
      if (active && !state.areas.some(a => a.id === active && a.schemaKey === key)) {
        state.activeAreaBySchema[key] = null;
      }
    });
  }

  function saveState() {
    sanitizeAreas();
    state.project.updatedAt = now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      try {
        const light = clone(state);
        light.sources.mybatis = {
          importedAt: state.sources?.mybatis?.importedAt || null,
          files: [],
          statements: [],
          tableUsage: {},
          localStorageOmitted: true
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
      } catch (fallbackErr) {
        console.warn('ERD project persistence failed:', fallbackErr);
      }
      console.warn('Large source index kept in memory only:', err);
    }
  }

  function activeArea(schemaKey = currentView) {
    const id = state.activeAreaBySchema[schemaKey] || null;
    return id ? state.areas.find(a => a.id === id && a.schemaKey === schemaKey) || null : null;
  }

  function setActiveArea(areaId = null, schemaKey = currentView) {
    if (areaId && !state.areas.some(a => a.id === areaId && a.schemaKey === schemaKey)) {
      throw new Error('Unknown subject area');
    }
    state.activeAreaBySchema[schemaKey] = areaId || null;
    saveState();
    document.dispatchEvent(new CustomEvent('erd:project-scope-changed', {
      detail: { schemaKey, areaId: areaId || null }
    }));
  }

  function areasForSchema(schemaKey = currentView) {
    return state.areas.filter(a => a.schemaKey === schemaKey);
  }

  function createArea({ name, schemaKey = currentView, tableIds = [], color = '#8b5cf6', description = '', source = 'manual' }) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Subject Area 이름이 필요합니다.');
    const live = liveTableIds(schemaKey);
    const ids = [...new Set(tableIds.map(String))].filter(id => live.has(id));
    const area = normalizeArea({ id: uid('area'), name: cleanName, schemaKey, tableIds: ids, color, description, source });
    state.areas.push(area);
    saveState();
    document.dispatchEvent(new CustomEvent('erd:project-areas-changed', { detail: { areaId: area.id } }));
    return area;
  }

  function updateArea(areaId, patch = {}) {
    const area = state.areas.find(a => a.id === areaId);
    if (!area) throw new Error('Subject Area를 찾을 수 없습니다.');
    if (patch.name !== undefined) area.name = String(patch.name).trim() || area.name;
    if (patch.description !== undefined) area.description = String(patch.description).trim();
    if (patch.color !== undefined) area.color = String(patch.color || area.color);
    if (patch.tableIds !== undefined) {
      const live = liveTableIds(area.schemaKey);
      area.tableIds = [...new Set(patch.tableIds.map(String))].filter(id => live.has(id));
    }
    area.updatedAt = now();
    saveState();
    document.dispatchEvent(new CustomEvent('erd:project-areas-changed', { detail: { areaId } }));
    return area;
  }

  function deleteArea(areaId) {
    const area = state.areas.find(a => a.id === areaId);
    if (!area) return false;
    state.areas = state.areas.filter(a => a.id !== areaId);
    if (state.activeAreaBySchema[area.schemaKey] === areaId) state.activeAreaBySchema[area.schemaKey] = null;
    saveState();
    document.dispatchEvent(new CustomEvent('erd:project-areas-changed', { detail: { areaId } }));
    return true;
  }

  function createAreaFromSelection(name = '') {
    const ids = [...E.selectedIds];
    if (!ids.length) throw new Error('업무 영역으로 묶을 테이블을 먼저 선택하세요.');
    return createArea({
      name: name || `업무 영역 ${areasForSchema().length + 1}`,
      schemaKey: currentView,
      tableIds: ids
    });
  }

  function projectPayload() {
    sanitizeAreas();
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: now(),
      project: clone(state.project),
      schemas: clone(schemaData),
      areas: clone(state.areas),
      activeAreaBySchema: clone(state.activeAreaBySchema),
      sources: clone(state.sources)
    };
  }

  function safeFilename(value) {
    return String(value || 'erd-project')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'erd-project';
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function exportProjectFile() {
    saveState();
    downloadJson(projectPayload(), `${safeFilename(state.project.name)}.erdproject.json`);
    E.Advanced?.showToast?.('프로젝트 파일을 저장했습니다.');
  }

  function validateProjectPayload(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('프로젝트 JSON 형식이 아닙니다.');
    if (payload.format !== FORMAT) throw new Error(`지원하지 않는 프로젝트 형식입니다: ${payload.format || 'unknown'}`);
    if (!payload.schemas || typeof payload.schemas !== 'object' || Array.isArray(payload.schemas)) {
      throw new Error('schemas 데이터가 없습니다.');
    }
    Object.entries(payload.schemas).forEach(([key, view]) => {
      if (!view || !Array.isArray(view.tables) || !Array.isArray(view.relations || [])) {
        throw new Error(`${key} 스키마 형식이 올바르지 않습니다.`);
      }
    });
  }

  function applyProjectPayload(payload) {
    validateProjectPayload(payload);
    E.pushUndo?.();
    Object.keys(schemaData).forEach(key => delete schemaData[key]);
    Object.assign(schemaData, clone(payload.schemas));
    state = normalizeState({
      format: FORMAT,
      version: VERSION,
      project: payload.project,
      areas: payload.areas,
      activeAreaBySchema: payload.activeAreaBySchema,
      sources: payload.sources
    });
    sanitizeAreas();
    E.persist();
    saveState();
    renderTabs();
    currentView = schemaData[currentView] ? currentView : schemaKeys()[0] || '';
    if (currentView) renderView(currentView);
    E.selectedIds.clear();
    E.refreshSelection?.();
    document.dispatchEvent(new CustomEvent('erd:project-loaded'));
    E.Advanced?.showToast?.('프로젝트를 불러왔습니다.');
  }

  function importProjectFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.erdproject';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        applyProjectPayload(JSON.parse(await file.text()));
      } catch (err) {
        console.error(err);
        alert(`프로젝트 파일을 열 수 없습니다.\n${err.message}`);
      }
    };
    input.click();
  }

  function editProjectInfo() {
    const A = E.Advanced;
    if (!A?.ensureDialog) return;
    const dialog = A.ensureDialog('project-info-dialog', '프로젝트 설정', `
      <div class="advanced-grid two">
        <label class="advanced-field"><span>프로젝트명</span><input id="project-name-input" value="${E.escapeHtml(state.project.name)}"></label>
        <label class="advanced-field"><span>기본 DBMS</span>
          <select id="project-dbms-input">
            <option value="oracle">Oracle</option>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="mixed">Mixed / Unknown</option>
          </select>
        </label>
      </div>
      <label class="advanced-field"><span>설명</span><textarea id="project-desc-input" rows="4">${E.escapeHtml(state.project.description || '')}</textarea></label>
      <div class="advanced-actions"><button class="editor-btn primary" id="project-info-save">저장</button></div>
    `);
    dialog.querySelector('#project-dbms-input').value = state.project.dbms || 'oracle';
    dialog.querySelector('#project-info-save').onclick = () => {
      state.project.name = dialog.querySelector('#project-name-input').value.trim() || 'ERD Project';
      state.project.dbms = dialog.querySelector('#project-dbms-input').value;
      state.project.description = dialog.querySelector('#project-desc-input').value.trim();
      saveState();
      dialog.close();
      document.dispatchEvent(new CustomEvent('erd:project-info-changed'));
      A.showToast?.('프로젝트 정보를 저장했습니다.');
    };
    dialog.showModal();
  }

  function installProjectTools() {
    const popover = document.querySelector('.editor-tools-popover');
    if (!popover || popover.querySelector('[data-project-tools]')) return;
    const marker = [...popover.querySelectorAll('.menu-label')]
      .find(el => el.textContent.includes('Schema Import'));
    const fragment = document.createDocumentFragment();
    const label = document.createElement('div');
    label.className = 'menu-label';
    label.dataset.projectTools = 'true';
    label.textContent = 'Project';
    fragment.appendChild(label);
    [
      ['프로젝트 설정', editProjectInfo],
      ['프로젝트 파일 저장', exportProjectFile],
      ['프로젝트 파일 열기', importProjectFile]
    ].forEach(([text, handler]) => {
      const button = document.createElement('button');
      button.textContent = text;
      button.onclick = handler;
      fragment.appendChild(button);
    });
    popover.insertBefore(fragment, marker || popover.firstChild);
  }

  const basePersist = E.persist;
  E.persist = function() {
    basePersist();
    sanitizeAreas();
    saveState();
  };

  document.getElementById('table-editor-form')?.addEventListener('submit', () => {
    const editing = document.getElementById('table-editor-title')?.textContent?.includes('편집');
    const oldId = editing ? E.primarySelectedId?.() : null;
    const before = new Set((schemaData[currentView]?.tables || []).map(E.tableId));
    setTimeout(() => {
      const after = (schemaData[currentView]?.tables || []).map(E.tableId);
      const created = after.filter(id => !before.has(id));
      const nextId = document.getElementById('table-name-input')?.value?.trim()?.toUpperCase()?.replace(/[^A-Z0-9_$#]/g, '_');
      let changed = false;
      if (editing && oldId && nextId && oldId !== nextId) {
        state.areas.filter(a => a.schemaKey === currentView).forEach(area => {
          area.tableIds = area.tableIds.map(id => {
            if (id === oldId) { changed = true; return nextId; }
            return id;
          });
        });
      }
      const active = activeArea(currentView);
      if (!editing && active && created.length) {
        created.forEach(id => {
          if (!active.tableIds.includes(id)) {
            active.tableIds.push(id);
            changed = true;
          }
        });
      }
      if (changed) {
        saveState();
        document.dispatchEvent(new CustomEvent('erd:project-areas-changed'));
      }
    }, 0);
  }, true);

  E.Project = {
    get state() { return state; },
    get format() { return FORMAT; },
    get version() { return VERSION; },
    save: saveState,
    payload: projectPayload,
    exportFile: exportProjectFile,
    importFile: importProjectFile,
    applyPayload: applyProjectPayload,
    editInfo: editProjectInfo,
    areasForSchema,
    activeArea,
    setActiveArea,
    createArea,
    createAreaFromSelection,
    updateArea,
    deleteArea,
    sanitizeAreas
  };

  Object.assign(window, {
    editProjectInfo,
    exportProjectFile,
    importProjectFile
  });

  const baseOnload = window.onload;
  window.onload = function(event) {
    baseOnload?.call(window, event);
    sanitizeAreas();
    saveState();
    installProjectTools();
    document.dispatchEvent(new CustomEvent('erd:project-ready'));
  };
})();
