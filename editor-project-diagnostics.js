/** Read-only diagnostics for large/imported ERD projects. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const A = E?.Advanced;
  const Actions = E?.Actions;
  if (!E || !A || !Actions) return;

  const VIRTUAL_THRESHOLD = 80;

  function tableId(table) {
    return E.tableId?.(table) || table?.id || table?.name || '';
  }

  function columnArray(value) {
    return E.columnArray ? E.columnArray(value) : (Array.isArray(value) ? value : [value]);
  }

  function pairKey(rel) {
    return [rel?.from || '', rel?.to || ''].sort().join('|');
  }

  function routingMetrics() {
    if (typeof document === 'undefined') {
      return { renderedRelations:0, routeObstacleHits:0, routeCrossings:0, fanoutRelations:0, routeModes:{} };
    }
    const paths = [...(document.querySelectorAll?.('#connections-svg .connection-line') || [])];
    const routeModes = {};
    let routeObstacleHits = 0;
    let routeCrossings = 0;
    let fanoutRelations = 0;
    paths.forEach(path => {
      const mode = path.dataset?.routeMode || 'legacy';
      routeModes[mode] = (routeModes[mode] || 0) + 1;
      routeObstacleHits += Number(path.dataset?.obstacleHits) || 0;
      routeCrossings += Number(path.dataset?.routeCrossings) || 0;
      if (path.dataset?.routeFanout === '1') fanoutRelations += 1;
    });
    return { renderedRelations:paths.length, routeObstacleHits, routeCrossings, fanoutRelations, routeModes };
  }

  function analyze(view = E.currentSchema?.(), sources = E.Project?.state?.sources || {}) {
    const tables = view?.tables || [];
    const relations = view?.relations || [];
    const byId = new Map(tables.map(table => [tableId(table), table]));
    const isPlaceholder = E.TableVisibility?.isPlaceholder || (() => false);
    const placeholders = tables.filter(isPlaceholder);
    const participants = new Set();
    const pairCounts = new Map();
    const missingTableRelations = [];
    const missingColumnRelations = [];

    relations.forEach((rel, index) => {
      participants.add(rel.from);
      participants.add(rel.to);
      const key = pairKey(rel);
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);

      const fromTable = byId.get(rel.from);
      const toTable = byId.get(rel.to);
      if (!fromTable || !toTable) {
        missingTableRelations.push({ index, rel });
        return;
      }

      const fromNames = new Set((fromTable.columns || []).map(column => column.name));
      const toNames = new Set((toTable.columns || []).map(column => column.name));
      const missingFrom = columnArray(rel.fromCol).filter(name => !fromNames.has(name));
      const missingTo = columnArray(rel.toCol).filter(name => !toNames.has(name));
      if (missingFrom.length || missingTo.length) {
        missingColumnRelations.push({ index, rel, missingFrom, missingTo });
      }
    });

    const parallelPairs = [...pairCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));
    const physicalOverlaps = E.ImportLayoutGuard?.physicalOverlapCount?.(tables) || 0;
    const unresolvedRelations = Array.isArray(sources?.unresolvedRelations) ? sources.unresolvedRelations.length : 0;
    const projection = E.ViewProjection?.build?.(view) || {
      projectedTableCount:tables.length,
      projectedRelationCount:relations.length
    };
    const placeholderMode = E.TableVisibility?.placeholderMode?.() || (E.TableVisibility?.showPlaceholders?.() === false ? 'hidden' : 'full');
    const mountedCards = typeof document !== 'undefined'
      ? document.querySelectorAll?.('#cards-container .table-card')?.length || 0
      : projection.projectedTableCount;
    const rendererMode = projection.projectedTableCount >= VIRTUAL_THRESHOLD ? 'Viewport Virtualized' : 'Direct';
    const route = routingMetrics();
    const routerMode = E.RelationRouterModes?.mode?.() || 'legacy';

    return {
      totalTables: tables.length,
      placeholderTables: placeholders.length,
      definedTables: tables.length - placeholders.length,
      relationCount: relations.length,
      relationParticipantCount: [...participants].filter(id => byId.has(id)).length,
      parallelRelationPairs: parallelPairs.length,
      parallelRelationEdges: parallelPairs.reduce((sum, item) => sum + item.count, 0),
      physicalOverlaps,
      missingTableRelations: missingTableRelations.length,
      missingColumnRelations: missingColumnRelations.length,
      unresolvedRelations,
      placeholderMode,
      projectedTables: projection.projectedTableCount,
      projectedRelations: projection.projectedRelationCount,
      mountedCards,
      rendererMode,
      routerMode,
      ...route,
      parallelPairs,
      issues: { missingTableRelations, missingColumnRelations }
    };
  }

  function metric(label, value, note = '') {
    return `<div class="manager-row"><div><b>${E.escapeHtml(label)}</b>${note ? `<small>${E.escapeHtml(note)}</small>` : ''}</div><strong>${E.escapeHtml(String(value))}</strong></div>`;
  }

  function openDiagnostics() {
    const report = analyze();
    const issueCount = report.missingTableRelations + report.missingColumnRelations + report.physicalOverlaps;
    const routeModeLabel = report.routerMode === 'auto' ? 'Auto Balanced' : report.routerMode === 'astar' ? 'A* Orthogonal' : report.routerMode === 'corridor' ? 'Orthogonal Corridor' : report.routerMode === 'direct' ? 'Direct Curve' : report.routerMode;
    const body = `
      <div class="manager-list">
        ${metric('전체 테이블', report.totalTables)}
        ${metric('MyBatis 빈 참조 테이블', report.placeholderTables, `현재 ${report.placeholderMode} 모드`)}
        ${metric('컬럼 정의 테이블', report.definedTables)}
        ${metric('Canvas Projection', `${report.projectedTables}/${report.totalTables}`, `${report.projectedRelations}/${report.relationCount} 관계`)}
        ${metric('현재 DOM 카드', report.mountedCards, report.rendererMode)}
        ${metric('관계', report.relationCount)}
        ${metric('관계 참여 테이블', report.relationParticipantCount, 'Relation Focus 대상')}
        ${metric('다중 관계 테이블 쌍', report.parallelRelationPairs, `${report.parallelRelationEdges}개 관계선`)}
        ${metric('현재 렌더 관계선', `${report.renderedRelations}/${report.projectedRelations}`, routeModeLabel)}
        ${metric('관계선 테이블 관통', report.routeObstacleHits, 'Auto 기준 0 권장')}
        ${metric('관계선 교차 점수', report.routeCrossings, '낮을수록 정돈됨')}
        ${metric('Fan-out / Soft Bundle', report.fanoutRelations, '복잡한 포트 주변 정돈')}
        ${metric('현재 카드 겹침', report.physicalOverlaps)}
        ${metric('없는 테이블 참조 관계', report.missingTableRelations)}
        ${metric('없는 컬럼 참조 관계', report.missingColumnRelations)}
        ${metric('가져오기 보류 관계', report.unresolvedRelations)}
      </div>
      <div class="empty-state">${issueCount
        ? `구조 경고 ${issueCount}건 · 먼저 배치/관계 참조를 확인하세요.`
        : report.routeObstacleHits
          ? `구조 오류는 없지만 관계선 ${report.routeObstacleHits}개가 테이블을 관통합니다. Auto/A* 라우터를 확인하세요.`
          : '현재 표시 가능한 구조 오류와 관계선 관통은 없습니다.'}</div>
    `;
    A.ensureDialog('project-diagnostics-dialog', '대형 ERD 진단', body, true).showModal();
    return report;
  }

  Actions.register({
    id: 'tools.diagnostics',
    label: '대형 ERD 진단',
    icon: 'fa-solid fa-stethoscope',
    run: openDiagnostics
  });

  E.ProjectDiagnostics = { analyze, open: openDiagnostics, pairKey, routingMetrics };
})();
