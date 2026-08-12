/** Non-destructive render projection: full project data stays intact while the canvas renders only the active view scope. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  if (!E) return;

  function tableId(table) {
    return E.tableId?.(table) || table?.id || table?.name || '';
  }

  function areaTableIds(schemaKey = currentView) {
    const area = E.Project?.activeArea?.(schemaKey);
    return area ? new Set(area.tableIds || []) : null;
  }

  function tables(view = E.currentSchema?.(), schemaKey = currentView) {
    if (!view) return [];
    let projected = E.TableVisibility?.visibleTables
      ? E.TableVisibility.visibleTables(view)
      : [...(view.tables || [])];

    const areaIds = areaTableIds(schemaKey);
    if (areaIds) projected = projected.filter(table => areaIds.has(tableId(table)));
    return projected;
  }

  function relations(view = E.currentSchema?.(), projectedTables = tables(view)) {
    if (!view) return [];
    const ids = new Set(projectedTables.map(tableId));
    return (view.relations || []).filter(rel => ids.has(rel.from) && ids.has(rel.to));
  }

  function build(view = E.currentSchema?.(), schemaKey = currentView) {
    const projectedTables = tables(view, schemaKey);
    const projectedRelations = relations(view, projectedTables);
    const totalTables = view?.tables?.length || 0;
    const totalRelations = view?.relations?.length || 0;
    return {
      schemaKey,
      tables: projectedTables,
      relations: projectedRelations,
      tableIds: new Set(projectedTables.map(tableId)),
      totalTables,
      totalRelations,
      projectedTableCount: projectedTables.length,
      projectedRelationCount: projectedRelations.length,
      active: projectedTables.length !== totalTables || projectedRelations.length !== totalRelations
    };
  }

  function pruneSelection(projection) {
    if (!E.selectedIds?.size) return;
    let changed = false;
    [...E.selectedIds].forEach(id => {
      if (!projection.tableIds.has(id)) {
        E.selectedIds.delete(id);
        changed = true;
      }
    });
    if (changed) E.refreshSelection?.();
  }

  let refreshFrame = 0;
  function refresh({ announce = false } = {}) {
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      const view = E.currentSchema?.();
      if (!view || !currentView || typeof renderView !== 'function') return;
      const projection = build(view, currentView);
      pruneSelection(projection);
      renderView(currentView);
      E.TableVisibility?.apply?.();
      E.updateMinimap?.();
      document.dispatchEvent(new CustomEvent('erd:view-projection-changed', {
        detail: {
          schemaKey: currentView,
          totalTables: projection.totalTables,
          projectedTables: projection.projectedTableCount,
          totalRelations: projection.totalRelations,
          projectedRelations: projection.projectedRelationCount
        }
      }));
      if (announce) {
        E.Advanced?.showToast?.(`Canvas ${projection.projectedTableCount}/${projection.totalTables} tables`);
      }
    });
  }

  E.ViewProjection = {
    tableId,
    areaTableIds,
    tables,
    relations,
    build,
    refresh
  };

  document.addEventListener('erd:project-scope-changed', () => refresh());
  document.addEventListener('erd:project-areas-changed', () => refresh());
})();
