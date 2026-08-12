/** Non-destructive table visibility filters for inferred/MyBatis placeholder nodes. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const A = E?.Advanced;
  const Actions = E?.Actions;
  if (!E || !A || !Actions) return;

  const PREF_SHOW_PLACEHOLDERS = 'erd_show_mybatis_placeholders_v1';
  const PREF_RELATION_FOCUS = 'erd_relation_focus_v1';
  let showPlaceholders = localStorage.getItem(PREF_SHOW_PLACEHOLDERS) !== '0';
  let relationFocus = localStorage.getItem(PREF_RELATION_FOCUS) === '1';
  let applyFrame = 0;

  function tableId(table) {
    return E.tableId?.(table) || table?.id || table?.name || '';
  }

  function isPlaceholder(table) {
    if (!table || (table.columns?.length || 0) !== 0) return false;
    return /^MyBatis 참조 테이블(?:\s|\(|$)/.test(String(table.desc || table.comment || '').trim());
  }

  function relationTableIds(view = E.currentSchema?.()) {
    const ids = new Set();
    (view?.relations || []).forEach(rel => { ids.add(rel.from); ids.add(rel.to); });
    return ids;
  }

  function isVisible(table, view = E.currentSchema?.(), relationIds = null) {
    if (!table) return false;
    if (!showPlaceholders && isPlaceholder(table)) return false;
    const focusedIds = relationIds || (relationFocus ? relationTableIds(view) : null);
    if (focusedIds && !focusedIds.has(tableId(table))) return false;
    return true;
  }

  function visibleTables(view = E.currentSchema?.()) {
    const relationIds = relationFocus ? relationTableIds(view) : null;
    return (view?.tables || []).filter(table => isVisible(table, view, relationIds));
  }

  function placeholderCount(view = E.currentSchema?.()) {
    return (view?.tables || []).filter(isPlaceholder).length;
  }

  function setCardVisibility(view) {
    const relationIds = relationFocus ? relationTableIds(view) : null;
    (view?.tables || []).forEach(table => {
      const card = document.getElementById(`card-${tableId(table)}`);
      if (!card) return;
      const placeholder = isPlaceholder(table);
      card.dataset.erdPlaceholder = placeholder ? '1' : '0';
      card.hidden = !isVisible(table, view, relationIds);
    });
  }

  function setRelationVisibility(view) {
    const relations = view?.relations || [];
    const byId = new Map((view?.tables || []).map(table => [tableId(table), table]));
    const relationIds = relationFocus ? relationTableIds(view) : null;
    document.querySelectorAll('#connections-svg .connection-line').forEach(path => {
      const resolved = E.RelationIdentity?.resolveRelation?.(path, relations);
      const index = resolved?.index ?? Number(path.dataset.relationIndex);
      const rel = resolved?.relation || (Number.isInteger(index) ? relations[index] : null);
      if (!rel) return;
      const hidden = !isVisible(byId.get(rel.from), view, relationIds) || !isVisible(byId.get(rel.to), view, relationIds);
      path.style.display = hidden ? 'none' : '';
      const badge = path.nextElementSibling;
      if (badge?.tagName?.toLowerCase() === 'g') badge.style.display = hidden ? 'none' : '';
    });
  }

  function setMinimapVisibility(view) {
    const byName = new Map((view?.tables || []).map(table => [table.name || tableId(table), table]));
    const relationIds = relationFocus ? relationTableIds(view) : null;
    document.querySelectorAll('#editor-minimap .editor-minimap-table').forEach(marker => {
      const table = byName.get(marker.title);
      if (table) marker.hidden = !isVisible(table, view, relationIds);
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

  function setShowPlaceholders(next, { announce = true } = {}) {
    showPlaceholders = !!next;
    localStorage.setItem(PREF_SHOW_PLACEHOLDERS, showPlaceholders ? '1' : '0');
    apply();
    window.updateConnections?.();
    E.updateMinimap?.();
    scheduleApply();
    document.dispatchEvent(new CustomEvent('erd:table-visibility-changed', {
      detail: { showPlaceholders, placeholderCount: placeholderCount() }
    }));
    if (announce) {
      const count = placeholderCount();
      A.showToast?.(showPlaceholders
        ? `MyBatis 빈 참조 테이블 ${count}개 표시`
        : `MyBatis 빈 참조 테이블 ${count}개 숨김 · 프로젝트 데이터는 유지`);
    }
  }

  function setRelationFocus(next, { announce = true } = {}) {
    relationFocus = !!next;
    localStorage.setItem(PREF_RELATION_FOCUS, relationFocus ? '1' : '0');
    apply();
    window.updateConnections?.();
    E.updateMinimap?.();
    scheduleApply();
    document.dispatchEvent(new CustomEvent('erd:table-visibility-changed', {
      detail: { showPlaceholders, relationFocus, visibleCount: visibleTables().length }
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
    id: 'view.placeholders',
    label: 'MyBatis 빈 참조 테이블 표시',
    icon: 'fa-solid fa-ghost',
    checked: () => showPlaceholders,
    run: () => setShowPlaceholders(!showPlaceholders)
  });

  Actions.register({
    id: 'view.relationFocus',
    label: '관계 있는 테이블만 표시',
    icon: 'fa-solid fa-diagram-project',
    checked: () => relationFocus,
    run: () => setRelationFocus(!relationFocus)
  });

  E.TableVisibility = {
    isPlaceholder,
    isVisible,
    relationTableIds,
    visibleTables,
    placeholderCount,
    showPlaceholders: () => showPlaceholders,
    relationFocus: () => relationFocus,
    setShowPlaceholders,
    setRelationFocus,
    apply
  };

  document.addEventListener('erd:workspace-changed', scheduleApply);
  document.addEventListener('erd:project-loaded', scheduleApply);
  requestAnimationFrame(apply);
})();
