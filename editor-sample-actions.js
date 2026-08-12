/** Canonical actions for sample projects. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const Actions = E?.Actions;
  const W = E?.Project?.Workspace;
  if (!Actions || !W) throw new Error('Actions/workspace must load before sample actions');

  Actions.register({
    id: 'tools.performance',
    label: 'Performance 300 프로젝트',
    icon: 'fa-solid fa-gauge-high',
    run: () => {
      if (!W.confirmReplace('Performance 300 샘플 프로젝트를 열까요?\n현재 프로젝트는 교체됩니다.')) return;
      W.loadSample('performance_300');
    }
  });
})();
