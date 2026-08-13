/** Folder-first ERD Studio projects: project.json + per-table JSON + relations.json. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  if (!E || !P) throw new Error('ERD project model must load before folder projects');

  const FOLDER_FORMAT = 'erd-studio-folder-project';
  const TABLE_FORMAT = 'erd-studio-table';
  const RELATION_FORMAT = 'erd-studio-relations';
  const VERSION = 1;
  const INPUT_ID = 'erd-project-folder-input';
  const clone = value => JSON.parse(JSON.stringify(value));
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const tableId = table => String(table?.id || table?.name || '').trim();
  const columnNames = table => new Set((table?.columns || []).map(column => String(column?.name || '').trim()));
  const columnArray = value => Array.isArray(value) ? value : [value];

  function fail(message, path = '') {
    throw new Error(path ? `${path}: ${message}` : message);
  }

  function assertFormat(value, format, path) {
    if (!isObject(value)) fail('JSON 객체가 필요합니다.', path);
    if (value.format !== format) fail(`format은 ${format}이어야 합니다.`, path);
    if (value.version !== VERSION) fail(`지원하지 않는 version입니다: ${value.version ?? 'unknown'}`, path);
  }

  function safeSegment(value, fallback) {
    const segment = String(value || fallback || '')
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
      .replace(/^\.+$|[. ]+$/g, '_')
      .slice(0, 120);
    return segment || fallback || 'item';
  }

  function schemaMetadata(view) {
    const { tables, relations, tableFiles, ...metadata } = view || {};
    return clone(metadata);
  }

  function validateTable(table, path) {
    if (!isObject(table)) fail('table 객체가 필요합니다.', path);
    const id = tableId(table);
    if (!id) fail('table.id 또는 table.name이 필요합니다.', path);
    if (!Array.isArray(table.columns)) fail(`${id}.columns는 배열이어야 합니다.`, path);
    const names = new Set();
    table.columns.forEach((column, index) => {
      if (!isObject(column)) fail(`${id}.columns[${index}]는 객체여야 합니다.`, path);
      const name = String(column.name || '').trim();
      if (!name) fail(`${id}.columns[${index}].name이 필요합니다.`, path);
      if (names.has(name)) fail(`${id}에 중복 컬럼이 있습니다: ${name}`, path);
      names.add(name);
    });
    return id;
  }

  function validateRelation(relation, schemaKey, index, tables) {
    const path = `relations.json (${schemaKey}[${index}])`;
    if (!isObject(relation)) fail('관계는 객체여야 합니다.', path);
    const from = String(relation.from || '').trim();
    const to = String(relation.to || '').trim();
    if (!from || !to) fail('from과 to가 필요합니다.', path);
    const fromTable = tables.get(from);
    const toTable = tables.get(to);
    if (!fromTable) fail(`from 테이블을 찾을 수 없습니다: ${from}`, path);
    if (!toTable) fail(`to 테이블을 찾을 수 없습니다: ${to}`, path);

    const fromCols = columnArray(relation.fromCol).map(value => String(value || '').trim());
    const toCols = columnArray(relation.toCol).map(value => String(value || '').trim());
    if (!fromCols.length || fromCols.some(value => !value)) fail('fromCol이 필요합니다.', path);
    if (!toCols.length || toCols.some(value => !value)) fail('toCol이 필요합니다.', path);
    if (fromCols.length !== toCols.length) fail('복합 관계의 fromCol/toCol 개수가 다릅니다.', path);

    // Empty inferred/MyBatis placeholders intentionally do not know columns yet.
    const fromNames = columnNames(fromTable);
    const toNames = columnNames(toTable);
    if (fromNames.size) {
      const missing = fromCols.filter(name => !fromNames.has(name));
      if (missing.length) fail(`${from}에 관계 컬럼이 없습니다: ${missing.join(', ')}`, path);
    }
    if (toNames.size) {
      const missing = toCols.filter(name => !toNames.has(name));
      if (missing.length) fail(`${to}에 관계 컬럼이 없습니다: ${missing.join(', ')}`, path);
    }
  }

  function splitPayload(payload) {
    P.Workspace?.validateProjectFile?.(payload);
    if (!isObject(payload?.schemas) || !Object.keys(payload.schemas).length) {
      fail('내보낼 스키마가 없습니다.');
    }

    const projectFile = {
      format: FOLDER_FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      project: clone(payload.project || {}),
      schemas: {},
      areas: clone(payload.areas || []),
      activeAreaBySchema: clone(payload.activeAreaBySchema || {}),
      sources: clone(payload.sources || {})
    };
    const relationFile = { format: RELATION_FORMAT, version: VERSION, schemas: {} };
    const tableFiles = [];
    const paths = new Set();

    Object.entries(payload.schemas).forEach(([schemaKey, view]) => {
      if (!isObject(view) || !Array.isArray(view.tables) || !Array.isArray(view.relations || [])) {
        fail(`${schemaKey} 스키마 형식이 올바르지 않습니다.`);
      }
      projectFile.schemas[schemaKey] = { ...schemaMetadata(view), tableFiles: [] };
      relationFile.schemas[schemaKey] = clone(view.relations || []);
      const ids = new Set();
      (view.tables || []).forEach(table => {
        const id = validateTable(table, `${schemaKey}/${tableId(table) || '?'}`);
        if (ids.has(id)) fail(`${schemaKey} 스키마에 중복 테이블이 있습니다: ${id}`);
        ids.add(id);
        const relativePath = `tables/${safeSegment(schemaKey, 'schema')}__${safeSegment(id, 'table')}.json`;
        const folded = relativePath.toLocaleLowerCase();
        if (paths.has(folded)) fail(`파일명이 충돌합니다: ${relativePath}`);
        paths.add(folded);
        tableFiles.push({
          path: relativePath,
          value: { format: TABLE_FORMAT, version: VERSION, schemaKey, table: clone(table) }
        });
        projectFile.schemas[schemaKey].tableFiles.push(relativePath);
      });
      const map = new Map((view.tables || []).map(table => [tableId(table), table]));
      (view.relations || []).forEach((relation, index) => validateRelation(relation, schemaKey, index, map));
    });

    return { projectFile, relationFile, tableFiles };
  }

  function normalizedEntries(files) {
    const raw = Array.from(files || []).map(file => ({
      file,
      path: String(file.webkitRelativePath || file.name || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    })).filter(entry => entry.path);
    if (!raw.length) fail('선택한 폴더에 파일이 없습니다.');

    const paths = raw.map(entry => entry.path.split('/'));
    const commonRoot = paths.every(parts => parts.length > 1 && parts[0] === paths[0][0]) ? `${paths[0][0]}/` : '';
    const seen = new Set();
    return raw.map(entry => {
      const path = commonRoot && entry.path.startsWith(commonRoot) ? entry.path.slice(commonRoot.length) : entry.path;
      const folded = path.toLocaleLowerCase();
      if (seen.has(folded)) fail(`중복 파일 경로입니다: ${path}`);
      seen.add(folded);
      return { ...entry, path };
    });
  }

  function validateRegisteredTablePath(value, schemaKey, index) {
    const location = `project.json (${schemaKey}.tableFiles[${index}])`;
    if (typeof value !== 'string' || !value.trim()) fail('테이블 파일 경로가 필요합니다.', location);
    const path = value.trim();
    const segments = path.split('/');
    if (path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)
      || segments.some(segment => !segment || segment === '.' || segment === '..')) {
      fail('절대경로와 경로 이탈(., .., 역슬래시)은 허용하지 않습니다.', location);
    }
    if (!/^tables\/[^/]+\.json$/i.test(path)) {
      fail('테이블 파일은 tables/*.json 안에 있어야 합니다.', location);
    }
    const schemaPrefix = `tables/${safeSegment(schemaKey, 'schema')}__`.toLocaleLowerCase();
    if (!path.toLocaleLowerCase().startsWith(schemaPrefix)) {
      fail(`스키마 ${schemaKey} 범위 밖의 테이블 파일입니다: ${path}`, location);
    }
    return path;
  }

  async function readJson(entry) {
    try {
      return JSON.parse(await entry.file.text());
    } catch (error) {
      fail(`JSON을 읽을 수 없습니다. ${error.message}`, entry.path);
    }
  }

  async function assembleFiles(files) {
    const entries = normalizedEntries(files);
    const byPath = new Map(entries.map(entry => [entry.path.toLocaleLowerCase(), entry]));
    const projectEntry = byPath.get('project.json');
    const relationEntry = byPath.get('relations.json');
    if (!projectEntry) fail('project.json이 없습니다.');
    if (!relationEntry) fail('relations.json이 없습니다.');

    const projectFile = await readJson(projectEntry);
    const relationFile = await readJson(relationEntry);
    assertFormat(projectFile, FOLDER_FORMAT, 'project.json');
    assertFormat(relationFile, RELATION_FORMAT, 'relations.json');
    if (!isObject(projectFile.project)) fail('project 객체가 필요합니다.', 'project.json');
    if (!isObject(projectFile.schemas) || !Object.keys(projectFile.schemas).length) {
      fail('최소 하나의 schemas 항목이 필요합니다.', 'project.json');
    }
    if (!isObject(relationFile.schemas)) fail('schemas 객체가 필요합니다.', 'relations.json');

    const schemas = {};
    const registeredFiles = [];
    const registeredPaths = new Set();
    Object.entries(projectFile.schemas).forEach(([schemaKey, metadata]) => {
      if (!isObject(metadata)) fail(`${schemaKey} 메타데이터는 객체여야 합니다.`, 'project.json');
      if ('tables' in metadata || 'relations' in metadata) {
        fail(`${schemaKey}에는 tables/relations를 넣지 말고 분리 파일을 사용하세요.`, 'project.json');
      }
      if (!Array.isArray(metadata.tableFiles)) {
        fail(`${schemaKey}.tableFiles는 배열이어야 합니다.`, 'project.json');
      }
      const relations = relationFile.schemas[schemaKey] ?? [];
      if (!Array.isArray(relations)) fail(`${schemaKey} 관계는 배열이어야 합니다.`, 'relations.json');
      const { tableFiles, ...runtimeMetadata } = metadata;
      schemas[schemaKey] = { ...clone(runtimeMetadata), tables: [], relations: clone(relations) };
      tableFiles.forEach((value, index) => {
        const path = validateRegisteredTablePath(value, schemaKey, index);
        const folded = path.toLocaleLowerCase();
        if (registeredPaths.has(folded)) fail(`중복 등록된 테이블 파일입니다: ${path}`, 'project.json');
        registeredPaths.add(folded);
        registeredFiles.push({ schemaKey, path });
      });
    });
    Object.keys(relationFile.schemas).forEach(schemaKey => {
      if (!schemas[schemaKey]) fail(`알 수 없는 스키마입니다: ${schemaKey}`, 'relations.json');
    });

    for (const registered of registeredFiles) {
      const entry = byPath.get(registered.path.toLocaleLowerCase());
      if (!entry) fail(`등록된 테이블 파일이 없습니다: ${registered.path}`, 'project.json');
      const value = await readJson(entry);
      assertFormat(value, TABLE_FORMAT, entry.path);
      const schemaKey = String(value.schemaKey || '').trim();
      if (schemaKey !== registered.schemaKey) {
        fail(`schemaKey가 manifest와 다릅니다: ${schemaKey || '(empty)'} != ${registered.schemaKey}`, entry.path);
      }
      const id = validateTable(value.table, entry.path);
      if (schemas[schemaKey].tables.some(table => tableId(table) === id)) {
        fail(`${schemaKey} 스키마에 중복 테이블이 있습니다: ${id}`, entry.path);
      }
      schemas[schemaKey].tables.push(clone(value.table));
    }

    Object.entries(schemas).forEach(([schemaKey, view]) => {
      const map = new Map(view.tables.map(table => [tableId(table), table]));
      view.relations.forEach((relation, index) => validateRelation(relation, schemaKey, index, map));
    });

    const payload = {
      format: P.format,
      version: P.version,
      exportedAt: projectFile.exportedAt || new Date().toISOString(),
      project: clone(projectFile.project),
      schemas,
      areas: clone(projectFile.areas || []),
      activeAreaBySchema: clone(projectFile.activeAreaBySchema || {}),
      sources: clone(projectFile.sources || {})
    };
    P.Workspace?.validateProjectFile?.(payload);
    return payload;
  }

  function ensureFolderInput() {
    let input = document.getElementById(INPUT_ID);
    if (input) return input;
    input = document.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.hidden = true;
    input.tabIndex = -1;
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.setAttribute('aria-hidden', 'true');
    input.addEventListener('change', async () => {
      if (!input.files?.length) return;
      try {
        const payload = await assembleFiles(input.files);
        P.Workspace?.applyProjectFilePayload?.(payload, { reason: 'open-folder' });
        E.Advanced?.showToast?.(`폴더 프로젝트를 열었습니다. · ${input.files.length} files`);
      } catch (error) {
        console.error(error);
        alert(`프로젝트 폴더를 열 수 없습니다.\n${error.message}`);
      } finally {
        input.value = '';
      }
    });
    document.body.appendChild(input);
    return input;
  }

  function openFolder() {
    if (!P.Workspace?.confirmReplace?.('현재 프로젝트를 닫고 다른 프로젝트 폴더를 열까요?\n필요하면 먼저 현재 프로젝트를 저장하세요.')) return false;
    const input = ensureFolderInput();
    input.value = '';
    input.click();
    return true;
  }

  async function writeJson(directory, filename, value) {
    const handle = await directory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(`${JSON.stringify(value, null, 2)}\n`);
    await writable.close();
  }

  async function saveToDirectory(directory, payload = P.payload()) {
    if (!directory?.getDirectoryHandle || !directory?.getFileHandle) fail('쓰기 가능한 폴더 핸들이 아닙니다.');
    const parts = splitPayload(payload);
    const tablesRoot = await directory.getDirectoryHandle('tables', { create: true });
    for (const item of parts.tableFiles) {
      const [, filename] = item.path.split('/');
      await writeJson(tablesRoot, filename, item.value);
    }
    await writeJson(directory, 'relations.json', parts.relationFile);
    await writeJson(directory, 'project.json', parts.projectFile);
    return { tableCount: parts.tableFiles.length, schemaCount: Object.keys(parts.projectFile.schemas).length };
  }

  async function saveFolder() {
    if (typeof window.showDirectoryPicker !== 'function') {
      alert('이 브라우저는 폴더 직접 저장을 지원하지 않습니다. 파일 > 호환용 단일 JSON 내보내기를 사용하세요.');
      return false;
    }
    try {
      const directory = await window.showDirectoryPicker({ id: 'erd-studio-project', mode: 'readwrite' });
      const result = await saveToDirectory(directory, P.payload());
      E.Advanced?.showToast?.(`폴더 프로젝트 저장 완료 · ${result.schemaCount} schemas · ${result.tableCount} tables`);
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      console.error(error);
      alert(`프로젝트 폴더를 저장할 수 없습니다.\n${error.message}`);
      return false;
    }
  }

  E.FolderProject = {
    formats: { project: FOLDER_FORMAT, table: TABLE_FORMAT, relations: RELATION_FORMAT, version: VERSION },
    splitPayload,
    assembleFiles,
    validateTable,
    validateRelation,
    ensureFolderInput,
    openFolder,
    saveFolder,
    saveToDirectory
  };
})();
