/** Relation CRUD, click-to-connect, duplicate routing and relation tooltip. */
(() => {
  'use strict';
  const E = window.ERDEditor, A = E.Advanced;
  let relationLinkStart = null;

  function relationFormBody() {
    const opts = A.view().tables.map(t => `<option value="${E.tableId(t)}">${E.escapeHtml(t.name)}</option>`).join('');
    return `<form id="relation-editor-form" class="advanced-form">
      <div class="advanced-grid-2">
        <div class="editor-field"><label>참조/부모 테이블 (FROM)</label><select id="rel-from-table">${opts}</select></div>
        <div class="editor-field"><label>FK/자식 테이블 (TO)</label><select id="rel-to-table">${opts}</select></div>
      </div>
      <div class="advanced-grid-2">
        <div class="editor-field"><label>부모 컬럼</label><input id="rel-from-cols" placeholder="ID 또는 ID1, ID2"></div>
        <div class="editor-field"><label>자식 FK 컬럼</label><input id="rel-to-cols" placeholder="PARENT_ID 또는 PARENT_ID1, PARENT_ID2"></div>
      </div>
      <div class="advanced-grid-2">
        <div class="editor-field"><label>Cardinality</label><select id="rel-cardinality"><option>1 : N</option><option>1 : 1</option><option>0..1 : N</option><option>1 : 0..N</option></select></div>
        <label class="advanced-check"><input type="checkbox" id="rel-identifying"> 식별 관계 (Solid)</label>
      </div>
      <div class="editor-dialog-actions inline-actions"><button type="button" class="editor-btn" data-dialog-cancel>취소</button><button type="submit" class="editor-btn primary">관계 저장</button></div>
    </form>`;
  }

  function openRelationDialog(index = null, presetFrom = '', presetTo = '') {
    const view = A.view(); if (!view?.tables?.length) return alert('테이블이 필요합니다.');
    const relation = Number.isInteger(index) ? view.relations?.[index] : null;
    const dialog = A.ensureDialog('relation-editor-dialog', relation ? '관계 편집' : '새 관계 추가', relationFormBody());
    const fromTable = dialog.querySelector('#rel-from-table'), toTable = dialog.querySelector('#rel-to-table');
    fromTable.value = relation?.from || presetFrom || view.tables[0]?.name;
    toTable.value = relation?.to || presetTo || view.tables.find(t => E.tableId(t) !== fromTable.value)?.name || fromTable.value;
    dialog.querySelector('#rel-from-cols').value = E.columnArray(relation?.fromCol || E.findTable(fromTable.value)?.columns.find(c => c.pk)?.name || 'ID').join(', ');
    dialog.querySelector('#rel-to-cols').value = E.columnArray(relation?.toCol || '').join(', ');
    dialog.querySelector('#rel-cardinality').value = relation?.cardinality || '1 : N';
    dialog.querySelector('#rel-identifying').checked = !!relation?.identifying;

    const suggest = () => {
      const parent = E.findTable(fromTable.value), child = E.findTable(toTable.value);
      const pks = parent?.columns.filter(c => c.pk).map(c => c.name) || [];
      if (!dialog.querySelector('#rel-from-cols').value.trim()) dialog.querySelector('#rel-from-cols').value = pks.join(', ');
      if (!dialog.querySelector('#rel-to-cols').value.trim() && pks.length) {
        dialog.querySelector('#rel-to-cols').value = pks.map(pk => child?.columns.find(c => c.name === pk || c.name === `${parent?.name}_${pk}` || c.name === `${parent?.name.replace(/S$/, '')}_${pk}`)?.name || pk).join(', ');
      }
    };
    fromTable.addEventListener('change', suggest); toTable.addEventListener('change', suggest); suggest();
    dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => dialog.close());
    dialog.querySelector('#relation-editor-form').addEventListener('submit', event => {
      event.preventDefault();
      const from = fromTable.value, to = toTable.value;
      const fromCol = A.csvNames(dialog.querySelector('#rel-from-cols').value), toCol = A.csvNames(dialog.querySelector('#rel-to-cols').value);
      const parent = E.findTable(from), child = E.findTable(to);
      if (!parent || !child) return alert('관계 테이블을 찾을 수 없습니다.');
      if (!fromCol.length || fromCol.length !== toCol.length) return alert('부모/자식 관계 컬럼 수가 같아야 합니다.');
      const missing = [...fromCol.filter(c => !parent.columns.some(x => x.name === c)).map(c => `${from}.${c}`), ...toCol.filter(c => !child.columns.some(x => x.name === c)).map(c => `${to}.${c}`)];
      if (missing.length) return alert(`존재하지 않는 컬럼: ${missing.join(', ')}`);
      const next = { from, fromCol: fromCol.length === 1 ? fromCol[0] : fromCol, to, toCol: toCol.length === 1 ? toCol[0] : toCol, identifying: dialog.querySelector('#rel-identifying').checked, cardinality: dialog.querySelector('#rel-cardinality').value };
      if ((view.relations || []).some((r, i) => i !== index && A.relationKey(r) === A.relationKey(next))) return alert('동일한 관계가 이미 존재합니다.');
      A.mutate(relation ? '관계를 수정했습니다.' : '관계를 추가했습니다.', () => {
        view.relations ||= []; Number.isInteger(index) ? view.relations[index] = next : view.relations.push(next);
        toCol.forEach(name => { const c = child.columns.find(x => x.name === name); if (c) c.fk = true; });
      });
      dialog.close();
    });
    dialog.showModal();
  }

  function deleteRelation(index) {
    const rel = A.view()?.relations?.[index]; if (!rel || !confirm(`${rel.from} → ${rel.to} 관계를 삭제할까요?`)) return;
    A.mutate('관계를 삭제했습니다.', () => A.view().relations.splice(index, 1)); openRelationManager();
  }

  function openRelationManager() {
    const relations = A.view()?.relations || [];
    const rows = relations.length ? relations.map((r, i) => `<div class="manager-row"><div><b>${E.escapeHtml(r.from)}</b>.${E.escapeHtml(E.columnArray(r.fromCol).join(', '))}<span> → </span><b>${E.escapeHtml(r.to)}</b>.${E.escapeHtml(E.columnArray(r.toCol).join(', '))}<small>${E.escapeHtml(r.cardinality || '1 : N')} · ${r.identifying ? '식별' : '비식별'}</small></div><div class="manager-actions"><button data-rel-edit="${i}" class="editor-btn">편집</button><button data-rel-delete="${i}" class="editor-btn danger">삭제</button></div></div>`).join('') : '<div class="empty-state">등록된 관계가 없습니다.</div>';
    const dialog = A.ensureDialog('relation-manager-dialog', '관계 관리', `<div class="manager-list">${rows}</div><div class="editor-dialog-actions inline-actions"><button class="editor-btn primary" data-rel-add>+ 새 관계</button></div>`, true);
    dialog.querySelector('[data-rel-add]')?.addEventListener('click', () => { dialog.close(); openRelationDialog(); });
    dialog.querySelectorAll('[data-rel-edit]').forEach(b => b.addEventListener('click', () => { dialog.close(); openRelationDialog(Number(b.dataset.relEdit)); }));
    dialog.querySelectorAll('[data-rel-delete]').forEach(b => b.addEventListener('click', () => { dialog.close(); deleteRelation(Number(b.dataset.relDelete)); }));
    dialog.showModal();
  }

  function startRelationLink(id = E.primarySelectedId()) {
    if (!id || !E.findTable(id)) return alert('시작 테이블을 먼저 선택하세요.');
    relationLinkStart = id; document.body.classList.add('relation-linking');
    A.showToast(`${id}에서 연결 시작 · 대상 테이블 클릭 (Esc 취소)`);
  }
  function cancelRelationLink() { relationLinkStart = null; document.body.classList.remove('relation-linking'); }

  cardsContainer.addEventListener('click', event => {
    if (!relationLinkStart) return; const card = event.target.closest('.table-card'); if (!card) return;
    const target = card.id.replace(/^card-/, ''); event.preventDefault(); event.stopImmediatePropagation();
    const start = relationLinkStart; cancelRelationLink();
    if (target === start) return A.showToast('같은 테이블이어서 연결을 취소했습니다.');
    E.selectOnly(target); openRelationDialog(null, start, target);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && relationLinkStart) { cancelRelationLink(); A.showToast('관계 연결 취소'); } }, true);

  const legacy = window.updateConnections;
  A.legacyUpdateConnections = legacy;
  A.decorateRelations = () => {
    const relations = A.view()?.relations || [];
    const paths = [...svgOverlay.querySelectorAll('path.connection-line')];
    const used = new Set();
    const pairs = new Map();
    relations.forEach((r, i) => { const k = [r.from, r.to].sort().join('|'); if (!pairs.has(k)) pairs.set(k, []); pairs.get(k).push(i); });
    relations.forEach((rel, i) => {
      const expectedId = `line-${rel.from}-${rel.to}`;
      const path = paths.find(p => !used.has(p) && p.id === expectedId);
      if (!path) return;
      used.add(path);
      const badge = path.nextElementSibling?.tagName?.toLowerCase() === 'g' ? path.nextElementSibling : null;
      path.dataset.relationIndex = String(i); path.style.pointerEvents = 'stroke'; path.style.cursor = 'help';
      let title = path.querySelector('title'); if (!title) { title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); path.appendChild(title); }
      title.textContent = `${rel.from}.${E.columnArray(rel.fromCol).join(', ')} → ${rel.to}.${E.columnArray(rel.toCol).join(', ')} (${rel.cardinality || '1 : N'})`;
      const siblings = pairs.get([rel.from, rel.to].sort().join('|')) || [i], offset = (siblings.indexOf(i) - (siblings.length - 1) / 2) * 16;
      if (offset) { const a = E.findTable(rel.from), b = E.findTable(rel.to), dx = Math.abs((b?.x || 0) - (a?.x || 0)), dy = Math.abs((b?.y || 0) - (a?.y || 0)); const tr = dx >= dy ? `translate(0 ${offset})` : `translate(${offset} 0)`; path.setAttribute('transform', tr); badge?.setAttribute('transform', tr); }
    });
  };
  window.updateConnections = function() { legacy(); A.decorateRelations(); A.updateGroupBounds?.(); };
  svgOverlay.addEventListener('dblclick', e => { const p = e.target.closest?.('.connection-line'); if (!p) return; const i = Number(p.dataset.relationIndex); if (Number.isInteger(i)) openRelationDialog(i); });

  Object.assign(E, { openRelationDialog, openRelationManager, startRelationLink });
  Object.assign(window, { openRelationDialog, openRelationManager, startRelationLink, cancelRelationLink });
})();
