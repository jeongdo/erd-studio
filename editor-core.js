/** ERD Studio editing core: persistence, history, selection and table CRUD. */
(() => {
  'use strict';
  const E = window.ERDEditor = window.ERDEditor || {};
  const STORAGE_SCHEMA = 'erd_studio_schema_v1';
  const HISTORY_LIMIT = 50;
  const GRID_SIZE = 20;
  const undoStack = [];
  const redoStack = [];
  const selectedIds = new Set();
  let pendingDragSnapshot = null;
  let editingTableId = null;

  E.clone = value => JSON.parse(JSON.stringify(value));
  E.tableId = table => table.id || table.name;
  E.currentSchema = () => schemaData[currentView];
  E.findTable = id => E.currentSchema()?.tables.find(t => E.tableId(t) === id);
  E.selectedIds = selectedIds;
  E.escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  E.columnArray = value => Array.isArray(value) ? value : [value];

  E.snapshot = () => JSON.stringify(schemaData);
  E.persist = () => {
    try { localStorage.setItem(STORAGE_SCHEMA, JSON.stringify(schemaData)); }
    catch (err) { console.warn('ERD schema persistence failed:', err); }
  };

  function restorePersistedSchema() {
    try {
      const raw = localStorage.getItem(STORAGE_SCHEMA);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      Object.keys(schemaData).forEach(k => delete schemaData[k]);
      Object.assign(schemaData, parsed);
    } catch (err) { console.warn('Ignoring invalid saved ERD schema:', err); }
  }

  function updateHistoryButtons() {
    const u = document.getElementById('editor-undo');
    const r = document.getElementById('editor-redo');
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
  }

  E.pushUndo = (raw = E.snapshot()) => {
    if (undoStack.at(-1) === raw) return;
    undoStack.push(raw);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  };

  function restoreSnapshot(raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    Object.keys(schemaData).forEach(k => delete schemaData[k]);
    Object.assign(schemaData, E.clone(parsed));
    E.persist();
    renderTabs();
    if (!schemaData[currentView]) currentView = Object.keys(schemaData)[0] || '';
    renderView(currentView);
    selectedIds.clear();
    E.refreshSelection();
    updateHistoryButtons();
  }

  function undoEditor() {
    if (!undoStack.length) return;
    redoStack.push(E.snapshot());
    restoreSnapshot(undoStack.pop());
  }

  function redoEditor() {
    if (!redoStack.length) return;
    undoStack.push(E.snapshot());
    restoreSnapshot(redoStack.pop());
  }

  function resetSavedSchema() {
    if (!confirm('저장된 편집 상태를 지우고 기본 ERD로 되돌릴까요?')) return;
    localStorage.removeItem(STORAGE_SCHEMA);
    location.reload();
  }

  function normalizeName(value) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_$#]/g, '_').replace(/_+/g, '_');
  }

  function parseColumns(text) {
    return text.split(/\r?\n/).map(v => v.trim()).filter(Boolean).map((line, i) => {
      const tokens = line.split(/\s+/);
      const name = normalizeName(tokens.shift() || `COLUMN_${i + 1}`);
      const flags = new Set(tokens.filter(t => /^(PK|FK)$/i.test(t)).map(t => t.toUpperCase()));
      const type = tokens.filter(t => !/^(PK|FK)$/i.test(t)).join(' ') || 'VARCHAR2(100)';
      return { name, type: type.toUpperCase(), pk: flags.has('PK'), fk: flags.has('FK') };
    });
  }

  function columnsToText(cols) {
    return cols.map(c => `${c.name} ${c.type}${c.pk ? ' PK' : ''}${c.fk ? ' FK' : ''}`).join('\n');
  }

  function canvasCenterPosition() {
    const rect = workspace.getBoundingClientRect();
    return {
      x: Math.round(((rect.width / 2) - panX) / scale / GRID_SIZE) * GRID_SIZE,
      y: Math.round(((rect.height / 2) - panY) / scale / GRID_SIZE) * GRID_SIZE
    };
  }

  function openTableDialog(id = null) {
    editingTableId = id;
    const table = id ? E.findTable(id) : null;
    document.getElementById('table-editor-title').textContent = table ? '테이블 편집' : '새 테이블 추가';
    document.getElementById('table-name-input').value = table?.name || '';
    document.getElementById('table-desc-input').value = table?.desc || '';
    document.getElementById('table-columns-input').value = table ? columnsToText(table.columns) : 'ID NUMBER PK\nNAME VARCHAR2(100)';
    const dialog = document.getElementById('table-editor-dialog');
    dialog.showModal();
    setTimeout(() => document.getElementById('table-name-input').focus(), 0);
  }

  function saveTableDialog(event) {
    event.preventDefault();
    const view = E.currentSchema();
    if (!view) return;
    const name = normalizeName(document.getElementById('table-name-input').value);
    const desc = document.getElementById('table-desc-input').value.trim();
    const columns = parseColumns(document.getElementById('table-columns-input').value);
    if (!name) return alert('테이블명을 입력하세요.');
    if (!columns.length) return alert('컬럼을 하나 이상 입력하세요.');
    if (new Set(columns.map(c => c.name)).size !== columns.length) return alert('중복 컬럼명이 있습니다.');
    if (view.tables.some(t => t.name === name && E.tableId(t) !== editingTableId)) return alert(`이미 ${name} 테이블이 있습니다.`);

    E.pushUndo();
    if (editingTableId) {
      const table = E.findTable(editingTableId);
      const oldId = E.tableId(table);
      Object.assign(table, { id: name, name, desc, columns });
      (view.relations || []).forEach(rel => {
        if (rel.from === oldId) rel.from = name;
        if (rel.to === oldId) rel.to = name;
      });
    } else {
      const pos = canvasCenterPosition();
      view.tables.push({ id: name, name, desc, x: pos.x, y: pos.y, columns });
    }
    E.persist();
    document.getElementById('table-editor-dialog').close();
    renderView(currentView);
    E.selectOnly(name);
    const table = E.findTable(name);
    if (table) selectTable(table);
  }

  E.selectOnly = id => {
    selectedIds.clear();
    if (id) selectedIds.add(id);
    E.refreshSelection();
  };

  E.toggleSelection = id => {
    selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
    E.refreshSelection();
  };

  E.refreshSelection = () => {
    document.querySelectorAll('.table-card').forEach(card => card.classList.toggle('selected', selectedIds.has(card.id.replace(/^card-/, ''))));
    const status = document.getElementById('selection-status');
    if (status) status.textContent = selectedIds.size ? `${selectedIds.size}개 선택` : '선택 없음';
  };

  E.primarySelectedId = () => [...selectedIds].at(-1) || selectedTableId;

  function duplicateSelected() {
    const id = E.primarySelectedId();
    const source = id ? E.findTable(id) : null;
    if (!source) return;
    E.pushUndo();
    const copy = E.clone(source);
    let name = `${source.name}_COPY`, n = 1;
    while (E.currentSchema().tables.some(t => t.name === name)) name = `${source.name}_COPY_${++n}`;
    Object.assign(copy, { id: name, name, desc: source.desc ? `${source.desc} (복제)` : '복제 테이블', x: (source.x || 0) + 60, y: (source.y || 0) + 60 });
    E.currentSchema().tables.push(copy);
    E.persist(); renderView(currentView); E.selectOnly(name); selectTable(copy);
  }

  function deleteSelected() {
    if (!selectedIds.size) return;
    const ids = [...selectedIds];
    if (!confirm(`${ids.join(', ')} 테이블을 삭제할까요?`)) return;
    E.pushUndo();
    const doomed = new Set(ids), view = E.currentSchema();
    view.tables = view.tables.filter(t => !doomed.has(E.tableId(t)));
    view.relations = (view.relations || []).filter(r => !doomed.has(r.from) && !doomed.has(r.to));
    selectedIds.clear(); E.persist(); renderView(currentView);
  }

  function moveSelected(dx, dy) {
    if (!selectedIds.size) return;
    E.pushUndo();
    selectedIds.forEach(id => {
      const t = E.findTable(id); if (!t) return;
      t.x = (t.x || 0) + dx; t.y = (t.y || 0) + dy;
      const card = document.getElementById(`card-${id}`);
      if (card) { card.style.left = `${t.x}px`; card.style.top = `${t.y}px`; }
    });
    E.persist(); updateConnections(); E.updateMinimap();
  }

  function snapDragging(freeMove) {
    if (freeMove || !draggingTable) return;
    draggingTable.x = Math.round(draggingTable.x / GRID_SIZE) * GRID_SIZE;
    draggingTable.y = Math.round(draggingTable.y / GRID_SIZE) * GRID_SIZE;
    const card = document.getElementById(`card-${E.tableId(draggingTable)}`);
    if (card) { card.style.left = `${draggingTable.x}px`; card.style.top = `${draggingTable.y}px`; }
  }

  E.updateMinimap = () => {
    const map = document.getElementById('editor-minimap'), view = E.currentSchema();
    if (!map || !view?.tables?.length) return;
    const maxX = Math.max(...view.tables.map(t => (t.x || 0) + 360), 1000);
    const maxY = Math.max(...view.tables.map(t => (t.y || 0) + 250), 700);
    const sx = 180 / maxX, sy = 120 / maxY;
    map.innerHTML = view.tables.map(t => `<span title="${E.escapeHtml(t.name)}" style="left:${(t.x||0)*sx}px;top:${(t.y||0)*sy}px;width:${Math.max(10,360*sx)}px;height:${Math.max(6,(50+t.columns.length*24)*sy)}px"></span>`).join('');
  };

  function patchLegacyFunctions() {
    const originalRender = renderView;
    renderView = function(viewKey) { originalRender(viewKey); setTimeout(() => { E.refreshSelection(); E.updateMinimap(); }, 0); };
    const originalLayout = applyLayout;
    applyLayout = function(type) { E.pushUndo(); originalLayout(type); setTimeout(() => { E.persist(); E.updateMinimap(); }, 650); };
    const originalTransform = applyTransform;
    applyTransform = function() { originalTransform(); E.updateMinimap(); };
  }

  function handleKeyboard(event) {
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redoEditor() : undoEditor(); return; }
    if (mod && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); return; }
    if (event.key === 'Delete') { event.preventDefault(); deleteSelected(); return; }
    const step = event.shiftKey ? 10 : 1;
    const moves = { ArrowUp:[0,-step], ArrowDown:[0,step], ArrowLeft:[-step,0], ArrowRight:[step,0] };
    if (moves[event.key]) { event.preventDefault(); moveSelected(...moves[event.key]); }
  }

  restorePersistedSchema();
  patchLegacyFunctions();
  updateHistoryButtons();
  document.getElementById('table-editor-form')?.addEventListener('submit', saveTableDialog);
  document.addEventListener('keydown', handleKeyboard);

  cardsContainer.addEventListener('click', event => {
    const card = event.target.closest('.table-card'); if (!card) return;
    const id = card.id.replace(/^card-/, '');
    if (event.ctrlKey || event.metaKey) { event.preventDefault(); event.stopImmediatePropagation(); E.toggleSelection(id); return; }
    setTimeout(() => E.selectOnly(id), 0);
  }, true);

  document.addEventListener('mousedown', event => { if (event.target.closest('.table-header')) pendingDragSnapshot = E.snapshot(); }, true);
  window.addEventListener('mouseup', event => {
    if (!pendingDragSnapshot) return;
    snapDragging(event.shiftKey);
    const after = E.snapshot();
    if (pendingDragSnapshot !== after) { E.pushUndo(pendingDragSnapshot); E.persist(); updateConnections(); E.updateMinimap(); }
    pendingDragSnapshot = null;
  }, true);

  document.getElementById('editor-minimap')?.addEventListener('click', event => {
    const view = E.currentSchema(); if (!view?.tables?.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const maxX = Math.max(...view.tables.map(t => (t.x || 0) + 360), 1000);
    const maxY = Math.max(...view.tables.map(t => (t.y || 0) + 250), 700);
    const tx = ((event.clientX - rect.left) / rect.width) * maxX;
    const ty = ((event.clientY - rect.top) / rect.height) * maxY;
    panX = workspace.clientWidth / 2 - tx * scale; panY = workspace.clientHeight / 2 - ty * scale; applyTransform();
  });

  const originalOnload = window.onload;
  window.onload = function(event) { originalOnload?.call(window, event); setTimeout(() => { E.updateMinimap(); E.refreshSelection(); }, 0); };

  Object.assign(window, { openTableDialog, resetSavedSchema, undoEditor, redoEditor, duplicateSelected, deleteSelected });
})();
