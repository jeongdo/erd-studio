/** Temporary top performance benchmark backed by the shared sample catalog. */
(() => {
  'use strict';

  const PERF_KEY = '__performance_300';
  const TABLE_COUNT = 300;
  const E = window.ERDEditor;
  const Samples = window.ERDStudioSamples;
  if (!E || !Samples || typeof window.renderTabs !== 'function' || typeof window.switchView !== 'function') return;

  function ensurePerformanceView() {
    if (!schemaData[PERF_KEY]) {
      Object.defineProperty(schemaData, PERF_KEY, {
        value: Samples.create('performance_300'),
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
    return schemaData[PERF_KEY];
  }

  function renderPerformanceOnly() {
    const tabs = document.getElementById('tabs-container');
    if (!tabs) return;

    tabs.innerHTML = '';
    const button = document.createElement('button');
    button.className = 'tab-btn performance-test-tab';
    button.id = `tab-btn-${PERF_KEY}`;
    button.title = 'Sample · 300개 테이블 / 약 579개 관계선 성능 테스트 · 클릭할 때만 생성';
    button.innerHTML = '<i class="fa-solid fa-gauge-high"></i> 성능 확인';
    button.onclick = () => {
      const startedAt = performance.now();
      const view = ensurePerformanceView();
      switchView(PERF_KEY, button);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const elapsed = performance.now() - startedAt;
        button.innerHTML = `<i class="fa-solid fa-gauge-high"></i> 성능 확인 <small>${Math.round(elapsed)}ms</small>`;
        button.title = `Sample benchmark · 최근 화면 전환: ${elapsed.toFixed(1)}ms · ${TABLE_COUNT} tables / ${view.relations.length} relations`;
        E.Advanced?.showToast?.(`성능 300 렌더 ${elapsed.toFixed(0)}ms`);
      }));
    };
    tabs.appendChild(button);
  }

  const baseRenderTabs = window.renderTabs;
  window.renderTabs = function() {
    baseRenderTabs();
    renderPerformanceOnly();
  };

  E.PerformanceSample = { ensureView: ensurePerformanceView, key: PERF_KEY };
  renderPerformanceOnly();
})();
