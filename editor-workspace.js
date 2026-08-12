/** Project-first workspace lifecycle: blank/new/open/sample are isolated workspaces. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  const A = E?.Advanced;
  if (!E || !P) throw new Error('Project model must load before workspace lifecycle');

  const WORKSPACE_MIGRATION_KEY = 'erd_studio_workspace_project_first_v1';
  const VERSION_STORAGE_KEY = 'erd_studio_versions_v1';
  const now = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => A?.uid?.(prefix) || `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function normalizeSchemaName(value) {
    const raw = String(value || 'MAIN').trim().toUpperCase();
    return raw.replace(/[^A-Z0-9_$#]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'MAIN';
  }

  function schemaKeyFor(name) {
    return normalizeSchemaName(name).toLowerCase();
  }

  function emptySchema(name = 'MAIN', dbms = 'oracle') {
    const schemaName = normalizeSchemaName(name);
    const label = dbms === 'oracle' ? schemaName : `${schemaName}`;
    return {
      tabName: label,
      icon: 'fa-solid fa-database',
      title: `${schemaName} Schema`,
      tables: [],
      relations: []
    };
  }

  function blankSources() {
    return {
      mybatis: { importedAt: null, files: [], statements: [], tableUsage: {} },
      mybatisIndexes: {}
    };
  }

  function currentHasContent() {
    return Object.values(schemaData || {}).some(view => (view?.tables?.length || 0) > 0 || (view?.relations?.length || 0) > 0);
  }

  function isLegacyBundledSampleWorkspace() {
    const keys = Object.keys(schemaData || {});
    if (!keys.length) return false;
    const known = new Set(['oracle_hr', 'oracle_scott']);
    return keys.every(key => known.has(key)) && keys.some(key => known.has(key));
  }

  function resetTransientUi() {
    E.selectedIds?.clear?.();
    E.refreshSelection?.();
    E.clearAnalysisFocus?.();
    document.getElementById('inspector')?.classList.remove('open');
    document.getElementById('editor-output')?.classList.remove('open');
    try { selectedTableId = null; } catch {}
    panX = 0;
    panY = 0;
    scale = 1;
    applyTransform?.();
  }

  function replaceWorkspace({ project, schemas, areas = [], activeAreaBySchema = {}, sources = null }, options = {}) {
    const nextSchemas = clone(schemas || {});
    const keys = Object.keys(nextSchemas);
    if (!keys.length) throw new Error('프로젝트에는 최소 하나의 스키마가 필요합니다.');

    Object.keys(schemaData).forEach(key => delete schemaData[key]);
    Object.assign(schemaData, nextSchemas);

    const state = P.state;
    state.project = {
      id: project?.id || uid('project'),
      name: String(project?.name || '새 프로젝트').trim() || '새 프로젝트',
      description: String(project?.description || '').trim(),
      dbms: project?.dbms || 'oracle',
      createdAt: project?.createdAt || now(),
      updatedAt: now(),
      ...(project?.sampleId ? { sampleId: project.sampleId, sample: true } : {})
    };
    state.areas = clone(areas || []);
    state.activeAreaBySchema = { ...activeAreaBySchema };
    keys.forEach(key => {
      if (!(key in state.activeAreaBySchema)) state.activeAreaBySchema[key] = null;
    });
    state.sources = clone(sources || blankSources());

    currentView = keys[0];
    resetTransientUi();
    localStorage.removeItem(VERSION_STORAGE_KEY);
    E.persist();
    P.save();
    renderTabs();
    renderView(currentView);
    resetTransientUi();

    const detail = { reason: options.reason || 'replace', projectId: state.project.id, sampleId: state.project.sampleId || null };
    document.dispatchEvent(new CustomEvent('erd:workspace-changed', { detail }));
    document.dispatchEvent(new CustomEvent('erd:project-loaded', { detail }));
    if (!options.silent) A?.showToast?.(`${state.project.name} 프로젝트를 열었습니다.`);
    return state.project;
  }

  function createBlankProject({ name = '새 프로젝트', dbms = 'oracle', schemaName = 'MAIN', description = '' } = {}, options = {}) {
    const cleanSchema = normalizeSchemaName(schemaName);
    const key = schemaKeyFor(cleanSchema);
    return replaceWorkspace({
      project: { name, dbms, description },
      schemas: { [key]: emptySchema(cleanSchema, dbms) },
      activeAreaBySchema: { [key]: null },
      sources: blankSources()
    }, { ...options, reason: options.reason || 'new' });
  }

  function loadSample(sampleId, options = {}) {
    const catalog = window.ERDStudioSamples;
    const sample = catalog?.get?.(sampleId);
    if (!sample) throw new Error('샘플을 찾을 수 없습니다.');
    const schema = catalog.create(sampleId);
    const key = sample.schemaKey;
    return replaceWorkspace({
      project: {
        name: `Sample · ${sample.name}`,
        description: sample.description,
        dbms: sample.dbms || 'oracle',
        sampleId
      },
      schemas: { [key]: schema },
      activeAreaBySchema: { [key]: null },
      sources: blankSources()
    }, { ...options, reason: 'sample' });
  }

  function shouldConfirmReplace() {
    return currentHasContent() && !P.state.project?.sample;
  }

  function confirmReplace(message) {
    return !shouldConfirmReplace() || confirm(message || '현재 프로젝트 작업공간을 교체할까요?\n필요하면 먼저 프로젝트 파일로 저장하세요.');
  }

  function migrateLegacyBootstrap() {
    if (localStorage.getItem(WORKSPACE_MIGRATION_KEY) === '1') return;
    const genericProject = !P.state.project?.name || P.state.project.name === 'ERD Project';
    if (genericProject && isLegacyBundledSampleWorkspace()) {
      createBlankProject({ name: '새 프로젝트', dbms: 'oracle', schemaName: 'MAIN' }, { silent: true, reason: 'sample-bootstrap-migration' });
    } else if (!Object.keys(schemaData).length) {
      createBlankProject({ name: P.state.project?.name || '새 프로젝트', dbms: P.state.project?.dbms || 'oracle', schemaName: 'MAIN' }, { silent: true, reason: 'empty-recovery' });
    } else if (genericProject && Object.keys(schemaData).length === 1) {
      const only = schemaData[Object.keys(schemaData)[0]];
      if (!(only?.tables?.length || 0)) {
        P.state.project.name = '새 프로젝트';
        P.save();
      }
    }
    localStorage.setItem(WORKSPACE_MIGRATION_KEY, '1');
  }

  P.Workspace = {
    createBlankProject,
    replaceWorkspace,
    loadSample,
    confirmReplace,
    normalizeSchemaName,
    schemaKeyFor,
    emptySchema,
    hasContent: currentHasContent
  };

  migrateLegacyBootstrap();
})();