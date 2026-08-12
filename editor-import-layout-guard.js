/** Import layout guard: preserve healthy coordinates, repair pathological imported layouts. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  if (!E) return;

  const LARGE_SCHEMA_TABLES = 80;
  const MAX_ASPECT_RATIO = 8;
  const MAX_OVERLAP_RATIO = 0.08;
  const GRID_X = 430;
  const GRID_Y = 390;
  const GRID_ORIGIN_X = 80;
  const GRID_ORIGIN_Y = 80;

  function finitePosition(table) {
    return Number.isFinite(Number(table?.x)) && Number.isFinite(Number(table?.y));
  }

  function positionKey(table) {
    return `${Number(table.x)}:${Number(table.y)}`;
  }

  function layoutStats(tables = []) {
    const count = tables.length;
    if (!count) {
      return {
        count: 0,
        positioned: 0,
        missing: 0,
        overlapRatio: 0,
        width: 0,
        height: 0,
        aspectRatio: 1,
        pathological: false,
        reasons: []
      };
    }

    const positioned = tables.filter(finitePosition);
    const missing = count - positioned.length;
    const coordinates = new Map();
    positioned.forEach(table => {
      const key = positionKey(table);
      coordinates.set(key, (coordinates.get(key) || 0) + 1);
    });
    const overlaps = [...coordinates.values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0);
    const overlapRatio = overlaps / count;

    let width = 0;
    let height = 0;
    let aspectRatio = 1;
    if (positioned.length > 1) {
      const xs = positioned.map(table => Number(table.x));
      const ys = positioned.map(table => Number(table.y));
      width = Math.max(...xs) - Math.min(...xs);
      height = Math.max(...ys) - Math.min(...ys);
      const shortSide = Math.max(1, Math.min(Math.max(width, 1), Math.max(height, 1)));
      const longSide = Math.max(width, height, 1);
      aspectRatio = longSide / shortSide;
    }

    const reasons = [];
    if (missing > 0) reasons.push('missing-coordinates');
    if (overlapRatio > MAX_OVERLAP_RATIO) reasons.push('overlapping-coordinates');
    if (count >= LARGE_SCHEMA_TABLES && aspectRatio > MAX_ASPECT_RATIO) reasons.push('extreme-aspect-ratio');

    return {
      count,
      positioned: positioned.length,
      missing,
      overlapRatio,
      width,
      height,
      aspectRatio,
      pathological: reasons.length > 0,
      reasons
    };
  }

  function gridColumns(count) {
    // Slightly wider than square because ERD table cards are wider than they are tall.
    return Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count) * 1.2)));
  }

  function applyGrid(tables = []) {
    const columns = gridColumns(tables.length);
    tables.forEach((table, index) => {
      table.x = GRID_ORIGIN_X + (index % columns) * GRID_X;
      table.y = GRID_ORIGIN_Y + Math.floor(index / columns) * GRID_Y;
    });
    return columns;
  }

  function guardSchema(schema, schemaKey = '') {
    const tables = schema?.tables || [];
    const before = layoutStats(tables);
    if (!before.pathological) return { changed: false, schemaKey, before, after: before };

    const columns = applyGrid(tables);
    const after = layoutStats(tables);
    return { changed: true, schemaKey, columns, before, after };
  }

  function guardSchemas(schemas = schemaData) {
    const results = Object.entries(schemas || {}).map(([key, schema]) => guardSchema(schema, key));
    return {
      changed: results.some(result => result.changed),
      results
    };
  }

  function repairImportedLayout(event) {
    const reason = event?.detail?.reason;
    if (reason && !['open-file', 'replace'].includes(reason)) return;

    const guarded = guardSchemas(schemaData);
    const changed = guarded.results.filter(result => result.changed);
    if (!changed.length) return;

    E.persist?.();
    if (typeof renderView === 'function' && currentView) renderView(currentView);
    E.updateMinimap?.();

    const summary = changed.map(result => `${result.schemaKey} (${result.before.reasons.join(', ')})`).join(', ');
    console.info(`ERD import layout repaired: ${summary}`);
    E.Advanced?.showToast?.(`가져온 ERD 배치를 자동 정리했습니다. (${changed.length}개 스키마)`);

    document.dispatchEvent(new CustomEvent('erd:import-layout-repaired', {
      detail: { results: changed }
    }));
  }

  E.ImportLayoutGuard = {
    layoutStats,
    gridColumns,
    applyGrid,
    guardSchema,
    guardSchemas
  };

  document.addEventListener('erd:project-loaded', repairImportedLayout);
})();
