/** Lightweight 1000-table view used to expose large-ERD rendering limits. */
(() => {
  'use strict';

  if (typeof schemaData === 'undefined') return;

  const TABLE_COUNT = 1000;
  const COLS_PER_ROW = 25;
  const H_GAP = 420;
  const V_GAP = 340;
  const tables = [];
  const relations = [];
  let lastConnectedInRow = null;

  for (let i = 0; i < TABLE_COUNT; i += 1) {
    const number = i + 1;
    const label = String(number).padStart(4, '0');
    const col = i % COLS_PER_ROW;
    const row = Math.floor(i / COLS_PER_ROW);
    const isolated = number % 7 === 0 || number % 13 === 0;
    const name = `PERF_TABLE_${label}`;

    if (col === 0) lastConnectedInRow = null;

    tables.push({
      id: name,
      name,
      desc: isolated ? `독립 성능 테이블 ${label}` : `연결 성능 테이블 ${label}`,
      x: 60 + col * H_GAP,
      y: 80 + row * V_GAP,
      columns: [
        { name: 'ID', type: 'NUMBER', pk: true, fk: false },
        { name: 'PARENT_ID', type: 'NUMBER', pk: false, fk: !isolated && !!lastConnectedInRow },
        { name: 'CODE', type: 'VARCHAR2(30)', pk: false, fk: false },
        { name: 'NAME', type: 'VARCHAR2(100)', pk: false, fk: false },
        { name: 'STATUS', type: 'VARCHAR2(20)', pk: false, fk: false },
        { name: 'CREATED_AT', type: 'DATE', pk: false, fk: false }
      ]
    });

    if (!isolated) {
      if (lastConnectedInRow) {
        relations.push({
          from: lastConnectedInRow,
          fromCol: 'ID',
          to: name,
          toCol: 'PARENT_ID',
          identifying: false
        });
      }
      lastConnectedInRow = name;
    }
  }

  schemaData.performance_1000 = {
    tabName: '성능 1000',
    icon: 'fa-solid fa-gauge-high',
    title: '대규모 ERD 성능 확인 (1000 Tables)',
    tables,
    relations
  };

  // The legacy SVG is 5000px square; this sample intentionally exceeds it.
  // Expand only the drawing surface, without changing normal table behavior.
  const svg = document.getElementById('connections-svg');
  if (svg) {
    svg.style.width = '12000px';
    svg.style.height = '15000px';
  }
})();
