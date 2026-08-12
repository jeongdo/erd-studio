/** Non-destructive table visibility filters for inferred/MyBatis placeholder nodes. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const A = E?.Advanced;
  const Actions = E?.Actions;
  if (!E || !A || !Actions) return;

  const PREF_MODE = 'erd_mybatis_placeholder_mode_v1';
  const LEGACY_PREF_SHOW = 'erd_show_mybatis_placeholders_v1';
  const PREF_RELATION_FOCUS = 'erd_relation_focus_v1';
  const MODES = ['full', 'compact', 'hidden'];

  function initialPlaceholderMode() {
    const saved = localStorage.getItem(PREF_MODE);
    if (MODES.includes(saved)) return saved;
    return localStorage.getItem(LEGACY_PREF_SHOW) === '0' ? 'hidden' : 'full';
  }

  let placeholderMode = initialPlaceholderMode();
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
    if (placeholderMode === 'hidden' && isPlaceholder(table)) return false;
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

  function applyCardMode(card, table, view, relationIds) {
    const placeholder = isPlaceholder(table);
    const compact = placeholder && placeholderMode === 'compact';
    card.dataset.erdPlaceholder = placeholder ? '1' : '0';
    card.classList.toggle('erd-placeholder-compact', compact);
    card.hidden = !isVisible(table, view, relationIds);
    const badge = card.querySelector?.('.table-badge');
    if (badge && placeholder) badge.textContent = compact ? 'REF' : 'TABLE';
  }

  function setCardVisibility(view) {
    const relationIds = relationFocus ? relationTableIds(view) : null;
    (view?.tables || []).forEach(table => {
      const card = document.getElementById(`card-${tableId(table)}`);
      if (card) applyCardMode(card, table, view, relationIds);
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

  function setPlaceholderMode(next, { announce = true } = {}) {
    if (!MODES.includes(next)) throw new Error(`Unknown placeholder mode: ${next}`);
    const previous = placeholderMode;
    placeholderMode = next;
    localStorage.setItem(PREF_MODE, placeholderMode);
    localStorage.setItem(LEGACY_PREF_SHOW, placeholderMode === 'hidden' ? '0' : '1');

    const membershipChanged = (previous === 'hidden') !== (placeholderMode === 'hidden');
    if (membershipChanged) refreshCanvas();
    else {
      apply();
      scheduleApply();
    }

    document.dispatchEvent(new CustomEvent('erd:table-visibility-changed', {
      detail: { placeholderMode, relationFocus, placeholderCount: placeholderCount(), visibleCount: visibleTables().length }
    }));

    if (announce) {
      const labels = { full:'Full', compact:'Compact', hidden:'Hidden' };
      const count = placeholderCount();
      A.showToast?.(`MyBatis 빈 참조 테이블 ${count}개 · ${labels[placeholderMode]} 모드`);
    }
  }

  function setShowPlaceholders(next, options = {}) {
    setPlaceholderMode(next ? 'full' : 'hidden', options);
  }

  function setRelationFocus(next, { announce = true } = {}) {
    relationFocus = !!next;
    localStorage.setItem(PREF_RELATION_FOCUS, relationFocus ? '1' : '0');
    refreshCanvas();
    document.dispatchEvent(new CustomEvent('erd:table-visibility-changed', {
      detail: { placeholderMode, relationFocus, visibleCount: visibleTables().length }
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

  // Compatibility action retained for older shell/tests: toggles Full <-> Hidden.
  Actions.register({
    id: 'view.placeholders',
    label: 'MyBatis 빈 참조 테이블 표시',
    icon: 'fa-solid fa-ghost',
    checked: () => placeholderMode !== 'hidden',
    run: () => setShowPlaceholders(placeholderMode === 'hidden')
  });

  [
    ['full', 'MyBatis 참조 테이블 · Full', 'fa-solid fa-table'],
    ['compact', 'MyBatis 참조 테이블 · Compact', 'fa-solid fa-compress'],
    ['hidden', 'MyBatis 참조 테이블 · Hidden', 'fa-solid fa-eye-slash']
  ].forEach(([mode, label, icon]) => Actions.register({
    id:`view.placeholders.${mode}`,
    label,
    icon,
    checked:() => placeholderMode === mode,
    run:() => setPlaceholderMode(mode)
  }));

  Actions.register({
    id: 'view.relationFocus',
    label: '관계 있는 테이블만 표시',
    icon: 'fa-solid fa-diagram-project',
    checked: () => relationFocus,
    run: () => setRelationFocus(!relationFocus)
  });

  E.TableVisibility = {
    MODES:[...MODES],
    isPlaceholder,
    isVisible,
    relationTableIds,
    visibleTables,
    placeholderCount,
    placeholderMode:() => placeholderMode,
    showPlaceholders:() => placeholderMode !== 'hidden',
    relationFocus:() => relationFocus,
    setPlaceholderMode,
    setShowPlaceholders,
    setRelationFocus,
    apply
  };

  document.addEventListener('erd:workspace-changed', scheduleApply);
  document.addEventListener('erd:project-loaded', scheduleApply);
  requestAnimationFrame(apply);
})();
