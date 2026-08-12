/** Built-in project library backed by source-controlled definitions in /projects. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  const W = P?.Workspace;
  const A = E?.Advanced;
  const Samples = window.ERDStudioSamples;
  if (!E || !P || !W || !A || !Samples) {
    throw new Error('Project workspace and sample catalog must load before project library');
  }

  const MANIFEST_URL = '/projects/manifest.json';
  const DEFINITION_FORMAT = 'erd-studio-builtin-project';
  const originalOpenLocalFile = W.openProjectFile.bind(W);
  let manifestCache = null;

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} 로드 실패 (${response.status})`);
    return response.json();
  }

  async function manifest() {
    if (manifestCache) return manifestCache;
    const payload = await fetchJson(MANIFEST_URL);
    if (payload?.format !== 'erd-studio-project-library' || !Array.isArray(payload.projects)) {
      throw new Error('projects/manifest.json 형식이 올바르지 않습니다.');
    }
    manifestCache = payload;
    return payload;
  }

  async function definitionFor(entry) {
    const definition = await fetchJson(`/projects/${entry.file}`);
    if (definition?.format !== DEFINITION_FORMAT || !Array.isArray(definition.schemas)) {
      throw new Error(`${entry.file} 프로젝트 정의 형식이 올바르지 않습니다.`);
    }
    return definition;
  }

  function payloadFromDefinition(definition) {
    const schemas = {};
    const activeAreaBySchema = {};

    definition.schemas.forEach(schemaRef => {
      const key = String(schemaRef.key || '').trim();
      const sampleId = String(schemaRef.sampleId || '').trim();
      if (!key || !sampleId) throw new Error('프로젝트 스키마 정의가 올바르지 않습니다.');
      schemas[key] = Samples.create(sampleId);
      delete schemas[key].transient;
      activeAreaBySchema[key] = null;
    });

    return {
      format: P.format,
      version: P.version,
      project: {
        id: `builtin_${definition.id}`,
        name: definition.name,
        description: definition.description || '',
        dbms: definition.dbms || 'oracle'
      },
      schemas,
      areas: [],
      activeAreaBySchema,
      sources: {
        mybatis: { importedAt: null, files: [], statements: [], tableUsage: {} },
        mybatisIndexes: {}
      }
    };
  }

  async function loadBundledProject(entryOrId) {
    const library = await manifest();
    const entry = typeof entryOrId === 'string'
      ? library.projects.find(project => project.id === entryOrId)
      : entryOrId;
    if (!entry) throw new Error('내장 프로젝트를 찾을 수 없습니다.');

    if (!W.confirmReplace(`${entry.name} 프로젝트를 열까요?\n현재 작업공간은 교체됩니다.`)) return false;

    const definition = await definitionFor(entry);
    W.applyProjectFilePayload(payloadFromDefinition(definition), { reason: 'builtin-project' });
    A.showToast?.(`${entry.name} 프로젝트를 열었습니다.`);
    return true;
  }

  function projectCards(projects) {
    return projects.map(project => `
      <button class="workspace-sample-card" data-builtin-project="${E.escapeHtml(project.id)}">
        <span class="workspace-sample-icon"><i class="${E.escapeHtml(project.icon || 'fa-solid fa-diagram-project')}"></i></span>
        <span class="workspace-sample-copy">
          <strong>${E.escapeHtml(project.name)}</strong>
          <small>${E.escapeHtml(project.description || '')}</small>
          <em>SOURCE / projects</em>
        </span>
        <i class="fa-solid fa-chevron-right workspace-sample-arrow"></i>
      </button>`).join('');
  }

  async function openProjectLibrary() {
    let library;
    try {
      library = await manifest();
    } catch (err) {
      console.error(err);
      A.showToast?.('내장 프로젝트 목록을 읽지 못해 파일 선택기를 엽니다.');
      originalOpenLocalFile();
      return;
    }

    const body = `
      <div class="workspace-samples-intro">
        소스의 <b>projects/</b> 폴더에 등록된 프로젝트를 바로 열거나, 내 컴퓨터의
        <code>.erdproject.json</code> 파일을 선택할 수 있습니다.
      </div>
      <div class="workspace-sample-list">${projectCards(library.projects)}</div>
      <div class="advanced-actions">
        <button class="editor-btn" type="button" data-open-local-project>
          <i class="fa-regular fa-folder-open"></i> 내 파일에서 열기…
        </button>
      </div>`;

    const dialog = A.ensureDialog('project-library-dialog', '프로젝트 열기', body, true);

    dialog.querySelectorAll('[data-builtin-project]').forEach(button => {
      button.onclick = async () => {
        const id = button.dataset.builtinProject;
        try {
          const opened = await loadBundledProject(id);
          if (opened) dialog.close();
        } catch (err) {
          console.error(err);
          alert(`프로젝트를 열 수 없습니다.\n${err.message}`);
        }
      };
    });

    dialog.querySelector('[data-open-local-project]').onclick = () => {
      dialog.close();
      originalOpenLocalFile();
    };

    dialog.showModal();
  }

  W.openLocalProjectFile = originalOpenLocalFile;
  W.openProjectFile = openProjectLibrary;
  W.openBundledProject = loadBundledProject;

  E.ProjectLibrary = {
    manifest,
    open: openProjectLibrary,
    openLocal: originalOpenLocalFile,
    load: loadBundledProject
  };
})();
