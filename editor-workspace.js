/** Project-first workspace lifecycle: blank/new/open/sample are isolated workspaces. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  const A = E?.Advanced;
  if (!E || !P) throw new Error('Project model must load before workspace lifecycle');

  const WORKSPACE_MIGRATION_KEY = 'erd_studio_workspace_project_first_v1';
  const VERSION_STORAGE_KEY = 'erd_studio_versions_v1';
  const PROJECT_FILE_INPUT_ID = 'erd-project-file-input';
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

    Reflect.ownKeys(schemaData).forEach(key => delete schemaData[key]);
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

  function validateProjectFile(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('프로젝트 JSON 형식이 아닙니다.');
    if (payload.format !== P.format) throw new Error(`지원하지 않는 프로젝트 형식입니다: ${payload.format || 'unknown'}`);
    if (!payload.schemas || typeof payload.schemas !== 'object' || Array.isArray(payload.schemas)) {
      throw new Error('schemas 데이터가 없습니다.');
    }
    const entries = Object.entries(payload.schemas);
    if (!entries.length) throw new Error('프로젝트에 스키마가 없습니다.');
    entries.forEach(([key, view]) => {
      if (!view || !Array.isArray(view.tables) || !Array.isArray(view.relations || [])) {
        throw new Error(`${key} 스키마 형식이 올바르지 않습니다.`);
      }
    });
  }

  function applyProjectFilePayload(payload, options = {}) {
    validateProjectFile(payload);
    return replaceWorkspace({
      project: payload.project || {},
      schemas: payload.schemas,
      areas: payload.areas || [],
      activeAreaBySchema: payload.activeAreaBySchema || {},
      sources: payload.sources || blankSources()
    }, { ...options, reason: 'open-file' });
  }

  function ensureProjectFileInput() {
    let input = document.getElementById(PROJECT_FILE_INPUT_ID);
    if (input) return input;

    input = document.createElement('input');
    input.id = PROJECT_FILE_INPUT_ID;
    input.type = 'file';
    input.hidden = true;
    input.tabIndex = -1;
    input.accept = '.erdproject.json,.erdproject,.json,application/json';
    input.setAttribute('aria-hidden', 'true');
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        applyProjectFilePayload(payload);
      } catch (err) {
        console.error(err);
        alert(`프로젝트 파일을 열 수 없습니다.\n${err.message}`);
      } finally {
        input.value = '';
      }
    });
    document.body.appendChild(input);
    return input;
  }

  function openProjectFile() {
    if (!confirmReplace('현재 프로젝트를 닫고 다른 프로젝트 파일을 열까요?\n필요하면 먼저 현재 프로젝트를 저장하세요.')) return;
    const input = ensureProjectFileInput();
    input.value = '';
    input.click();
  }

  function shouldConfirmReplace() {
    return currentHasContent() && !P.state.project?.sample;
  }

  function confirmReplace(message) {
    return !shouldConfirmReplace() || confirm(message || '현재 프로젝트 작업공간을 교체할까요?\n필요하면 먼저 프로젝트 파일로 저장하세요.');
  }

  function migrateLegacyBootstrap() {
    const migrated = localStorage.getItem(WORKSPACE_MIGRATION_KEY) === '1';
    const genericProject = !P.state.project?.name || P.state.project.name === 'ERD Project';

    // Older versions persisted the bundled HR/SCOTT pair as the active schema.
    // Convert that exact legacy bootstrap back to an empty project even when a
    // previous migration marker exists, so reset/reload never revives samples.
    if (isLegacyBundledSampleWorkspace() && !P.state.project?.sample) {
      createBlankProject({
        name: genericProject ? '새 프로젝트' : (P.state.project?.name || '새 프로젝트'),
        dbms: P.state.project?.dbms || 'oracle',
        schemaName: 'MAIN',
        description: P.state.project?.description || ''
      }, { silent: true, reason: 'sample-bootstrap-migration' });
      localStorage.setItem(WORKSPACE_MIGRATION_KEY, '1');
      return;
    }

    if (migrated) return;
    if (!Object.keys(schemaData).length) {
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
    hasContent: currentHasContent,
    openProjectFile,
    applyProjectFilePayload,
    validateProjectFile
  };

  P.importFile = openProjectFile;
  window.importProjectFile = openProjectFile;

  migrateLegacyBootstrap();
})();
