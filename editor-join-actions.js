/** Expand canonical JOIN action from exactly two tables to any connected selection. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const Actions = E?.Actions;
  if (!Actions) return;

  Actions.register({
    id: 'tools.join',
    label: '선택 테이블 JOIN SQL',
    icon: 'fa-solid fa-code',
    when: () => (E.selectedIds?.size || 0) >= 2,
    run: () => window.generateJoinForSelected?.()
  });
})();
