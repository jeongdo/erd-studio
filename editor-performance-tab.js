/** Temporary top performance tab for large-ERD smoke testing. */
(() => {
  'use strict';

  const PERF_KEY = '__performance_300';
  const TABLE_COUNT = 300;
  const E = window.ERDEditor;
  if (!E || typeof window.renderTabs !== 'function' || typeof window.switchView !== 'function') return;

  function createPerformanceView() {
    const tables = [];
    const relations = [];
    const colsPerRow = 20;

    for (let i = 0; i < TABLE_COUNT; i += 1) {
      const n = String(i + 1).padStart(3, '0');
      const row = Math.floor(i / colsPerRow);
      const col = i % colsPerRow;
      const name = `PERF_TABLE_${n}`;
      tables.push({
        id: name,
        name,
        desc: `성능 테스트 테이블 ${n}`,
        x: 80 + col * 430,
        y: 80 + row * 390,
        columns: [
          { name: 'ID', type: 'NUMBER', pk: true, fk: false },
          { name: 'PARENT_ID', type: 'NUMBER', pk: false, fk: i > 0 },
          { name: 'CODE', type: 'VARCHAR2(30)', pk: false, fk: false },
          { name: 'NAME', type: 'VARCHAR2(100)', pk: false, fk: false },
          { name: 'STATUS', type: 'VARCHAR2(20)', pk: false, fk: false },
          { name: 'OWNER_ID', type: 'NUMBER', pk: false, fk: false },
          { name: 'AMOUNT', type: 'NUMBER(14,2)', pk: false, fk: false },
          { name: 'CREATED_AT', type: 'DATE', pk: false, fk: false },
          { name: 'UPDATED_AT', type: 'DATE', pk: false, fk: false },
          { name: 'REMARKS', type: 'VARCHAR2(500)', pk: false, fk: false }
        ]
      });

      if (i > 0) {
        const prev = `PERF_TABLE_${String(i).padStart(3, '0')}`;
        relations.push({ from: prev, fromCol: 'ID', to: name, toCol: 'PARENT_ID', identifying: false });
      }
      if (i >= colsPerRow) {
        const upper = `PERF_TABLE_${String(i + 1 - colsPerRow).padStart(3, '0')}`;
        relations.push({ from: upper, fromCol: 'ID', to: name, toCol: 'OWNER_ID', identifying: false });
      }
    }

    return {
      transient: true,
      tabName: '성능 확인',
      icon: 'fa-solid fa-gauge-high',
      title: '임시 대규모 ERD 성능 테스트 (300 Tables)',
      tables,
      relations
    };
  }

  function ensurePerformanceView() {
    if (!schemaData[PERF_KEY]) {
      Object.defineProperty(schemaData, PERF_KEY, {
        value: createPerformanceView(),
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
    return schemaData[PERF_KEY];
  }

  function performanceButton() {
    return document.getElementById(`tab-btn-${PERF_KEY}`);
  }

  function renderPerformanceOnly() {
    const tabs = document.getElementById('tabs-container');
    if (!tabs) return;

    tabs.innerHTML = '';
    const button = document.createElement('button');
    button.className = 'tab-btn performance-test-tab';
    button.id = `tab-btn-${PERF_KEY}`;
    button.title = '300개 테이블 / 약 579개 관계선 성능 테스트 · 클릭할 때만 생성';
    button.innerHTML = '<i class="fa-solid fa-gauge-high"></i> 성능 확인';
    button.onclick = () => {
      const startedAt = performance.now();
      ensurePerformanceView();
      switchView(PERF_KEY, button);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const elapsed = performance.now() - startedAt;
        button.innerHTML = `<i class="fa-solid fa-gauge-high"></i> 성능 확인 <small>${Math.round(elapsed)}ms</small>`;
        button.title = `최근 화면 전환: ${elapsed.toFixed(1)}ms · ${TABLE_COUNT} tables / ${schemaData[PERF_KEY].relations.length} relations`;
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

  renderPerformanceOnly();
})();
