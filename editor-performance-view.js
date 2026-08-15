/** Large-ERD sample views used to expose Canvas rendering limits. */
(() => {
  'use strict';

  if (typeof schemaData === 'undefined') return;

  function makeColumns(parentIsFk) {
    return Object.freeze([
      Object.freeze({ name: 'ID', type: 'NUMBER', pk: true, fk: false }),
      Object.freeze({ name: 'PARENT_ID', type: 'NUMBER', pk: false, fk: parentIsFk }),
      Object.freeze({ name: 'CODE', type: 'VARCHAR2(30)', pk: false, fk: false }),
      Object.freeze({ name: 'NAME', type: 'VARCHAR2(100)', pk: false, fk: false }),
      Object.freeze({ name: 'STATUS', type: 'VARCHAR2(20)', pk: false, fk: false }),
      Object.freeze({ name: 'CREATED_AT', type: 'DATE', pk: false, fk: false })
    ]);
  }

  const ISOLATED_COLUMNS = makeColumns(false);
  const CONNECTED_COLUMNS = makeColumns(true);

  function buildPerformanceView({
    tableCount,
    colsPerRow,
    relationStride,
    key,
    tabName,
    title,
    labelWidth
  }) {
    const tables = new Array(tableCount);
    const relations = [];
    let lastConnectedInRow = null;

    for (let i = 0; i < tableCount; i += 1) {
      const number = i + 1;
      const label = String(number).padStart(labelWidth, '0');
      const col = i % colsPerRow;
      const row = Math.floor(i / colsPerRow);
      const connected = relationStride === 1
        ? !(number % 7 === 0 || number % 13 === 0)
        : number % relationStride === 0;
      const name = `PERF_TABLE_${label}`;

      if (col === 0) lastConnectedInRow = null;
      const hasParent = connected && !!lastConnectedInRow;

      tables[i] = {
        id: name,
        name,
        desc: hasParent ? `연결 성능 테이블 ${label}` : `독립 성능 테이블 ${label}`,
        x: 60 + col * 420,
        y: 80 + row * 340,
        columns: hasParent ? CONNECTED_COLUMNS : ISOLATED_COLUMNS
      };

      if (connected) {
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

    return {
      tabName,
      icon: 'fa-solid fa-gauge-high',
      title,
      tables,
      relations,
      performanceSample: true,
      performanceKey: key
    };
  }

  schemaData.performance_1000 = buildPerformanceView({
    tableCount: 1000,
    colsPerRow: 25,
    relationStride: 1,
    key: '1000',
    tabName: '성능 1000',
    title: '대규모 ERD 성능 확인 (1,000 Tables)',
    labelWidth: 4
  });

  let ultraView = null;
  function ensureUltraView() {
    if (!ultraView) {
      ultraView = buildPerformanceView({
        tableCount: 100000,
        colsPerRow: 316,
        relationStride: 1,
        key: '100000',
        tabName: '성능 100000',
        title: '초대규모 ERD 성능 확인 (100,000 Tables)',
        labelWidth: 6
      });
    }
    return ultraView;
  }

  const ultraDescriptor = {
    tabName: '성능 100000',
    icon: 'fa-solid fa-bolt',
    title: '초대규모 ERD 성능 확인 (100,000 Tables)',
    performanceSample: true,
    performanceKey: '100000'
  };

  Object.defineProperties(ultraDescriptor, {
    tables: {
      enumerable: true,
      get() { return ensureUltraView().tables; }
    },
    relations: {
      enumerable: true,
      get() { return ensureUltraView().relations; }
    }
  });

  schemaData.performance_100000 = ultraDescriptor;

  // Legacy DOM/SVG fallback support for the 1,000-table sample.
  const svg = document.getElementById('connections-svg');
  if (svg) {
    svg.style.width = '12000px';
    svg.style.height = '15000px';
  }
})();
