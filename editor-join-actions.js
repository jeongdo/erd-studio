/** Canonical JOIN action: any connected selection of two or more tables. */
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

  // Keep the hidden legacy wrench menu semantically consistent as a fallback.
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.editor-tools-popover button[onclick*="generateJoinForSelected"]').forEach(button => {
      button.textContent = '선택 테이블 JOIN SQL';
    });
  }
})();
