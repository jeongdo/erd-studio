/** Non-destructive visibility filters for the active ERD view. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const A = E?.Advanced;
  const Actions = E?.Actions;
  if (!E || !A || !Actions) return;

  const PREF_RELATION_FOCUS = 'erd_relation_focus_v1';
  let relationFocus = localStorage.getItem(PREF_RELATION_FOCUS) === '1';
  let applyFrame = 0;

  function tableId(table) {
    return E.tableId?.(table) || table?.id || table?.name || '';
  }

  function relationTableIds(view = E.currentSchema?.()) {
    const ids = new Set();
    (view?.relations || []).forEach(rel => {
      ids.add(rel.from);
      ids.add(rel.to);
    });
    return ids;
  }

  function isVisible(table, view = E.currentSchema?.(), relationIds = null) {
    if (!table) return false;
    if (!relationFocus) return true;
    const ids = relationIds || relationTableIds(view);
    return ids.has(tableId(table));
  }

  function visibleTables(view = E.currentSchema?.()) {
    const ids = relationFocus ? relationTableIds(view) : null;
    return (view?.tables || []).filter(table => isVisible(table, view, ids));
  }

  function setCardVisibility(view) {
    const ids = relationFocus ? relationTableIds(view) : null;
    (view?.tables || []).forEach(table => {
      const card = document.getElementById(`card-${tableId(table)}`);
      if (card) card.hidden = !isVisible(table, view, ids);
    });
  }

  function setRelationVisibility(view) {
    const relations = view?.relations || [];
    const byId = new Map((view?.tables || []).map(table => [tableId(table), table]));
    const ids = relationFocus ? relationTableIds(view) : null;
    document.querySelectorAll('#connections-svg .connection-line').forEach(path => {
      const resolved = E.RelationIdentity?.resolveRelation?.(path, relations);
      const index = resolved?.index ?? Number(path.dataset.relationIndex);
      const rel = resolved?.relation || (Number.isInteger(index) ? relations[index] : null);
      if (!rel) return;
      const hidden = !isVisible(byId.get(rel.from), view, ids) || !isVisible(byId.get(rel.to), view, ids);
      path.style.display = hidden ? 'none' : '';
      const badge = path.nextElementSibling;
      if (badge?.tagName?.toLowerCase() === 'g') badge.style.display = hidden ? 'none' : '';
    });
  }

  function setMinimapVisibility(view) {
    const byName = new Map((view?.tables || []).map(table => [table.name || tableId(table), table]));
    const ids = relationFocus ? relationTableIds(view) : null;
    document.querySelectorAll('#editor-minimap .editor-minimap-table').forEach(marker => {
      const table = byName.get(marker.title);
      if (table) marker.hidden = !isVisible(table, view, ids);
    });
  }

  function apply() {
    applyFrame = 0;
    const view = E.currentSchema?.();
    if (!view) return;
    setCardVisibility(view);
    setRelationVisibility(view);
    setMinimapVisibility(view);
  }

  function scheduleApply() {
    if (applyFrame) return;
    applyFrame = requestAnimationFrame(apply);
  }

  function refreshCanvas() {
    if (E.ViewProjection?.refresh) {
      E.ViewProjection.refresh();
      return;
    }
    apply();
    window.updateConnections?.();
    E.updateMinimap?.();
    scheduleApply();
  }

  function setRelationFocus(next, { announce = true } = {}) {
    relationFocus = !!next;
    localStorage.setItem(PREF_RELATION_FOCUS, relationFocus ? '1' : '0');
    refreshCanvas();
    document.dispatchEvent(new CustomEvent('erd:table-visibility-changed', {
      detail: { relationFocus, visibleCount: visibleTables().length }
    }));
    if (announce) {
      const visible = visibleTables().length;
      const total = E.currentSchema?.()?.tables?.length || 0;
      A.showToast?.(relationFocus
        ? `Relation Focus · 관계 참여 테이블 ${visible}/${total}개 표시`
        : `Relation Focus 해제 · ${visible}/${total}개 표시`);
    }
  }

  const baseRenderView = window.renderView;
  if (typeof baseRenderView === 'function') {
    window.renderView = function(...args) {
      const result = baseRenderView.apply(this, args);
      scheduleApply();
      return result;
    };
  }

  const baseUpdateConnections = window.updateConnections;
  if (typeof baseUpdateConnections === 'function') {
    window.updateConnections = function(...args) {
      const result = baseUpdateConnections.apply(this, args);
      setRelationVisibility(E.currentSchema?.());
      return result;
    };
  }

  const cardsContainer = document.getElementById('cards-container');
  if (cardsContainer && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(scheduleApply);
    observer.observe(cardsContainer, { childList: true });
  }

  Actions.register({
    id: 'view.relationFocus',
    label: '관계 있는 테이블만 표시',
    icon: 'fa-solid fa-diagram-project',
    checked: () => relationFocus,
    run: () => setRelationFocus(!relationFocus)
  });

  E.TableVisibility = {
    isVisible,
    relationTableIds,
    visibleTables,
    relationFocus: () => relationFocus,
    setRelationFocus,
    apply
  };

  document.addEventListener('erd:workspace-changed', scheduleApply);
  document.addEventListener('erd:project-loaded', scheduleApply);
  requestAnimationFrame(apply);
})();
