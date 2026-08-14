/** Compact AI context export for full-project or active-work-area analysis. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const P = E?.Project;
  if (!E || !P) throw new Error('ERD project model must load before AI context exporter');

  const FORMAT = 'erd-studio-ai-context';
  const VERSION = 1;

  function cloneColumn(column) {
    const out = {
      name: column.name,
      type: column.type || 'UNKNOWN'
    };
    if (column.pk) out.pk = true;
    if (column.fk) out.fk = true;
    if (column.nullable === false) out.nullable = false;
    if (column.default !== undefined) out.default = column.default;
    if (column.unique) out.unique = true;
    if (column.comment) out.comment = column.comment;
    if (column.inferred) out.inferred = true;
    return out;
  }

  function compactTable(table) {
    const out = {
      name: table.name,
      columns: (table.columns || []).map(cloneColumn)
    };
    if (table.desc) out.description = table.desc;
    if (table.inferred) out.inferred = true;
    if (table.source) out.source = table.source;
    return out;
  }

  function compactRelation(rel) {
    const out = {
      from: rel.from,
      fromColumns: E.columnArray(rel.fromCol),
      to: rel.to,
      toColumns: E.columnArray(rel.toCol),
      cardinality: rel.cardinality || '1 : N'
    };
    if (rel.identifying) out.identifying = true;
    if (rel.inferred) out.inferred = true;
    if (rel.confidence !== undefined) out.confidence = rel.confidence;
    if (rel.source) out.source = rel.source;
    if (rel.sourceCount) out.sourceCount = rel.sourceCount;
    return out;
  }

  function externalRelations(view, ids) {
    const set = new Set(ids);
    return (view.relations || [])
      .filter(rel => set.has(rel.from) !== set.has(rel.to))
      .map(rel => compactRelation(rel));
  }

  function buildSchemaContext(schemaKey, options = {}) {
    const view = schemaData[schemaKey];
    if (!view) throw new Error(`Unknown schema: ${schemaKey}`);
    const requested = options.tableIds ? new Set(options.tableIds) : null;
    const tables = (view.tables || []).filter(table => !requested || requested.has(E.tableId(table)));
    const ids = tables.map(E.tableId);
    const idSet = new Set(ids);
    const relations = (view.relations || [])
      .filter(rel => idSet.has(rel.from) && idSet.has(rel.to))
      .map(compactRelation);
    const areas = P.areasForSchema(schemaKey)
      .filter(area => !requested || area.tableIds.some(id => idSet.has(id)))
      .map(area => ({
        name: area.name,
        source: area.source,
        tableIds: area.tableIds.filter(id => !requested || idSet.has(id))
      }));
    const result = {
      schemaKey,
      schemaName: view.tabName || view.title || schemaKey,
      counts: {
        tables: tables.length,
        relations: relations.length
      },
      tables: tables.map(compactTable),
      relations,
      subjectAreas: areas
    };
    if (requested) {
      const external = externalRelations(view, ids);
      if (external.length) result.externalRelations = external;
    }
    return result;
  }

  function buildScopeContext() {
    const area = P.activeArea(currentView);
    const scope = buildSchemaContext(currentView, {
      tableIds: area?.tableIds || null
    });
    return {
      format: FORMAT,
      version: VERSION,
      generatedAt: new Date().toISOString(),
      mode: area ? 'subject-area' : 'schema',
      project: {
        name: P.state.project.name,
        description: P.state.project.description || '',
        dbms: P.state.project.dbms
      },
      active: {
        schemaKey: currentView,
        subjectArea: area?.name || null
      },
      schema: scope
    };
  }

  function buildProjectContext() {
    const schemas = Object.keys(schemaData).map(schemaKey =>
      buildSchemaContext(schemaKey)
    );
    return {
      format: FORMAT,
      version: VERSION,
      generatedAt: new Date().toISOString(),
      mode: 'project',
      project: {
        name: P.state.project.name,
        description: P.state.project.description || '',
        dbms: P.state.project.dbms
      },
      summary: {
        schemas: schemas.length,
        tables: schemas.reduce((sum, schema) => sum + schema.counts.tables, 0),
        relations: schemas.reduce((sum, schema) => sum + schema.counts.relations, 0)
      },
      schemas
    };
  }

  function safeFilename(value) {
    return String(value || 'erd-project')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'erd-project';
  }

  function download(payload, suffix) {
    const raw = JSON.stringify(payload);
    const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFilename(P.state.project.name)}.${suffix}.ai-context.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    const estimatedTokens = Math.ceil(raw.length / 4);
    E.Advanced?.showToast?.(`AI Context 저장 · 약 ${estimatedTokens.toLocaleString()} tokens`);
    E.showOutput?.('AI Context Export', [
      `Mode: ${payload.mode}`,
      `File: ${a.download}`,
      `Size: ${(raw.length / 1024).toFixed(1)} KB`,
      `Estimated tokens: ~${estimatedTokens.toLocaleString()}`,
      '',
      '화면 좌표/색상/레이아웃 정보는 제외하고 스키마·관계·업무영역만 압축했습니다.'
    ].join('\n'));
  }

  function exportAiScopeContext() {
    download(buildScopeContext(), P.activeArea(currentView) ? 'area' : 'schema');
  }

  function exportAiProjectContext() {
    download(buildProjectContext(), 'project');
  }

  function installUi() {
    const popover = document.querySelector('.editor-tools-popover');
    if (popover && !popover.querySelector('[data-ai-context-tools]')) {
      const label = document.createElement('div');
      label.className = 'menu-label';
      label.dataset.aiContextTools = 'true';
      label.textContent = 'AI Context';
      const scope = document.createElement('button');
      scope.textContent = '현재 범위 AI Context 저장';
      scope.onclick = exportAiScopeContext;
      const project = document.createElement('button');
      project.textContent = '전체 프로젝트 AI Context 저장';
      project.onclick = exportAiProjectContext;
      popover.insertBefore(project, popover.firstChild);
      popover.insertBefore(scope, project);
      popover.insertBefore(label, scope);
    }

    const rail = document.querySelector('.erd-project-dock-rail');
    const toggle = rail?.querySelector('[data-dock-toggle]');
    if (rail && toggle && !rail.querySelector('[data-ai-context-export]')) {
      const button = document.createElement('button');
      button.className = 'dock-icon-btn';
      button.dataset.aiContextExport = 'true';
      button.title = '현재 범위 AI Context 저장';
      button.innerHTML = '<i class="fa-solid fa-brain"></i>';
      button.onclick = exportAiScopeContext;
      rail.insertBefore(button, toggle);
    }
  }

  document.addEventListener('erd:project-loaded', installUi);
  const baseOnload = window.onload;
  window.onload = function(event) {
    baseOnload?.call(window, event);
    installUi();
  };

  E.AIContext = {
    buildScope: buildScopeContext,
    buildProject: buildProjectContext,
    exportScope: exportAiScopeContext,
    exportProject: exportAiProjectContext
  };
  Object.assign(window, { exportAiScopeContext, exportAiProjectContext });
})();
