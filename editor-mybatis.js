/** MyBatis mapper scanner: infer schema structure and source index without a DB connection. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const P = E?.Project;
  const A = E?.Advanced;
  if (!E || !P) throw new Error('ERD project model must load before MyBatis scanner');

  const SQL_TAGS = new Set(['select', 'insert', 'update', 'delete']);
  const RESERVED_ALIAS = new Set([
    'WHERE','JOIN','LEFT','RIGHT','FULL','INNER','OUTER','CROSS','ON','GROUP','ORDER','HAVING',
    'UNION','MINUS','EXCEPT','CONNECT','START','SET','VALUES','RETURNING','WHEN','USING'
  ]);

  function mapperIndex(schemaKey = currentView) {
    const indexes = P.state.sources?.mybatisIndexes || {};
    return indexes[schemaKey]
      || (P.state.sources?.mybatis?.schemaKey === schemaKey ? P.state.sources.mybatis : null)
      || null;
  }

  function stripDoctype(xml) {
    return String(xml || '')
      .replace(/<!DOCTYPE[\s\S]*?\]>/gi, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '');
  }

  function normalizeSql(text) {
    return String(text || '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\r\n]*/g, ' ')
      .replace(/#\{[^}]+\}|\$\{[^}]+\}/g, '?')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanIdentifier(value) {
    const parts = String(value || '')
      .trim()
      .replace(/[;,]+$/g, '')
      .split('.')
      .map(part => part.replace(/^["`\[]|["`\]]$/g, ''))
      .filter(Boolean);
    return (parts.at(-1) || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_$#]/g, '_')
      .replace(/_+/g, '_');
  }

  function cleanAlias(value) {
    return String(value || '').replace(/^["`\[]|["`\]]$/g, '').toUpperCase();
  }

  function nodeSqlText(node, fragments, stack = new Set()) {
    if (!node) return '';
    if (node.nodeType === 3 || node.nodeType === 4) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    if (node.tagName?.toLowerCase() === 'include') {
      let ref = node.getAttribute('refid') || '';
      ref = ref.split('.').at(-1);
      if (!ref || stack.has(ref)) return ' ';
      const fragment = fragments.get(ref);
      if (!fragment) return ' ';
      const next = new Set(stack);
      next.add(ref);
      return nodeSqlText(fragment, fragments, next);
    }
    return [...node.childNodes].map(child => nodeSqlText(child, fragments, stack)).join(' ');
  }

  function parseMapperXml(text, filePath) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(stripDoctype(text), 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) throw new Error(parserError.textContent.split('\n')[0] || 'XML parse error');
    const mapper = doc.documentElement;
    if (!mapper || mapper.tagName?.toLowerCase() !== 'mapper') throw new Error('MyBatis <mapper> 루트가 없습니다.');
    const namespace = mapper.getAttribute('namespace') || filePath.replace(/\\/g, '/');
    const fragments = new Map(
      [...mapper.children]
        .filter(el => el.tagName.toLowerCase() === 'sql' && el.getAttribute('id'))
        .map(el => [el.getAttribute('id'), el])
    );
    const statements = [];
    [...mapper.children].forEach(el => {
      const type = el.tagName.toLowerCase();
      if (!SQL_TAGS.has(type)) return;
      const id = el.getAttribute('id') || `anonymous_${statements.length + 1}`;
      const sql = normalizeSql(nodeSqlText(el, fragments));
      statements.push({
        key: `${namespace}.${id}`,
        namespace,
        id,
        type,
        file: filePath,
        sql
      });
    });
    return { namespace, statements };
  }

  function aliasMap(sql) {
    const aliases = new Map();
    const re = /\b(?:FROM|JOIN)\s+([A-Z0-9_$#."`\[\]]+)(?:\s+(?:AS\s+)?([A-Z0-9_$#"`\[\]]+))?/gi;
    let match;
    while ((match = re.exec(sql))) {
      const table = cleanIdentifier(match[1]);
      if (!table || table === 'SELECT') continue;
      let alias = cleanAlias(match[2] || '');
      if (!alias || RESERVED_ALIAS.has(alias)) alias = table;
      aliases.set(alias, table);
      aliases.set(table, table);
    }
    const targets = [
      /\bINSERT\s+INTO\s+([A-Z0-9_$#."`\[\]]+)/i,
      /\bUPDATE\s+([A-Z0-9_$#."`\[\]]+)/i,
      /\bMERGE\s+INTO\s+([A-Z0-9_$#."`\[\]]+)/i,
      /\bDELETE\s+FROM\s+([A-Z0-9_$#."`\[\]]+)/i
    ];
    targets.forEach(rex => {
      const m = sql.match(rex);
      if (!m) return;
      const table = cleanIdentifier(m[1]);
      if (table) aliases.set(table, table);
    });
    return aliases;
  }

  function extractTables(sql) {
    const out = [];
    const seen = new Set();
    const patterns = [
      /\bFROM\s+([A-Z0-9_$#."`\[\]]+)/gi,
      /\bJOIN\s+([A-Z0-9_$#."`\[\]]+)/gi,
      /\bINSERT\s+INTO\s+([A-Z0-9_$#."`\[\]]+)/gi,
      /\bUPDATE\s+([A-Z0-9_$#."`\[\]]+)/gi,
      /\bMERGE\s+INTO\s+([A-Z0-9_$#."`\[\]]+)/gi,
      /\bDELETE\s+FROM\s+([A-Z0-9_$#."`\[\]]+)/gi
    ];
    patterns.forEach(re => {
      let m;
      while ((m = re.exec(sql))) {
        const table = cleanIdentifier(m[1]);
        if (!table || table === 'SELECT' || seen.has(table)) continue;
        seen.add(table);
        out.push(table);
      }
    });
    return out;
  }

  function addColumn(map, table, column) {
    table = cleanIdentifier(table);
    column = cleanIdentifier(column);
    if (!table || !column || column === '*' || /^\d/.test(column)) return;
    if (!map.has(table)) map.set(table, new Set());
    map.get(table).add(column);
  }

  function extractColumns(sql, aliases, tables) {
    const columns = new Map();
    const qualified = /\b([A-Z0-9_$#"`\[\]]+)\.([A-Z0-9_$#"`\[\]]+)\b/gi;
    let m;
    while ((m = qualified.exec(sql))) {
      const alias = cleanAlias(m[1]);
      const table = aliases.get(alias);
      if (table) addColumn(columns, table, m[2]);
    }

    const insert = sql.match(/\bINSERT\s+INTO\s+([A-Z0-9_$#."`\[\]]+)\s*\(([^)]+)\)/i);
    if (insert) {
      const table = cleanIdentifier(insert[1]);
      insert[2].split(',').forEach(col => addColumn(columns, table, col));
    }

    const targetMatch = sql.match(/\b(?:UPDATE|MERGE\s+INTO)\s+([A-Z0-9_$#."`\[\]]+)/i);
    if (targetMatch) {
      const table = cleanIdentifier(targetMatch[1]);
      const setPart = sql.match(/\bSET\s+(.+?)(?:\bWHERE\b|\bWHEN\b|\bRETURNING\b|$)/i)?.[1] || '';
      setPart.split(',').forEach(expr => {
        const left = expr.split('=')[0]?.trim();
        if (!left) return;
        addColumn(columns, table, left.includes('.') ? left.split('.').at(-1) : left);
      });
    }

    if (tables.length === 1) {
      const table = tables[0];
      const whereCols = sql.match(/\b[A-Z0-9_$#]+\s*(?:=|<>|!=|>=|<=|>|<|LIKE|IN\s*\()/gi) || [];
      whereCols.forEach(token => addColumn(columns, table, token.match(/^[A-Z0-9_$#]+/i)?.[0] || ''));
    }
    return columns;
  }

  function extractJoins(sql, aliases) {
    const joins = [];
    const seen = new Set();
    const re = /\b([A-Z0-9_$#"`\[\]]+)\.([A-Z0-9_$#"`\[\]]+)\s*=\s*([A-Z0-9_$#"`\[\]]+)\.([A-Z0-9_$#"`\[\]]+)\b/gi;
    let m;
    while ((m = re.exec(sql))) {
      const leftTable = aliases.get(cleanAlias(m[1]));
      const rightTable = aliases.get(cleanAlias(m[3]));
      const leftCol = cleanIdentifier(m[2]), rightCol = cleanIdentifier(m[4]);
      if (!leftTable || !rightTable || leftTable === rightTable || !leftCol || !rightCol) continue;
      const a = `${leftTable}.${leftCol}`, b = `${rightTable}.${rightCol}`;
      const key = [a, b].sort().join('=');
      if (seen.has(key)) continue;
      seen.add(key);
      joins.push({ leftTable, leftCol, rightTable, rightCol });
    }
    return joins;
  }

  function deriveDomain(filePath, namespace) {
    const pathParts = String(filePath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const lower = pathParts.map(part => part.toLowerCase());
    const marker = lower.findIndex(part => ['mapper','mappers','sqlmap','sqlmaps','mybatis'].includes(part));
    if (marker >= 0 && marker + 1 < pathParts.length - 1) return pathParts[marker + 1];
    if (pathParts.length > 1) {
      const parent = pathParts.at(-2);
      if (!['resources','java','src','main'].includes(parent.toLowerCase())) return parent;
    }
    const ns = String(namespace || '').split('.').filter(Boolean);
    return ns.length > 1 ? ns.at(-2) : 'MyBatis';
  }

  function analyzeFiles(parsedFiles) {
    const tableColumns = new Map();
    const tableUsage = new Map();
    const joinCounts = new Map();
    const domainTables = new Map();
    const statements = [];

    parsedFiles.forEach(file => {
      const domain = deriveDomain(file.path, file.namespace);
      if (!domainTables.has(domain)) domainTables.set(domain, new Set());
      file.statements.forEach(stmt => {
        const tables = extractTables(stmt.sql);
        const aliases = aliasMap(stmt.sql);
        const cols = extractColumns(stmt.sql, aliases, tables);
        const joins = extractJoins(stmt.sql, aliases);
        tables.forEach(table => {
          domainTables.get(domain).add(table);
          if (!tableUsage.has(table)) tableUsage.set(table, []);
          tableUsage.get(table).push({ key: stmt.key, type: stmt.type, file: stmt.file });
        });
        cols.forEach((set, table) => {
          if (!tableColumns.has(table)) tableColumns.set(table, new Set());
          set.forEach(col => tableColumns.get(table).add(col));
        });
        joins.forEach(join => {
          addColumn(tableColumns, join.leftTable, join.leftCol);
          addColumn(tableColumns, join.rightTable, join.rightCol);
          const left = `${join.leftTable}.${join.leftCol}`;
          const right = `${join.rightTable}.${join.rightCol}`;
          const key = [left, right].sort().join('=');
          const entry = joinCounts.get(key) || { ...join, count: 0, statements: [] };
          entry.count += 1;
          if (entry.statements.length < 20) entry.statements.push(stmt.key);
          joinCounts.set(key, entry);
        });
        statements.push({
          key: stmt.key,
          namespace: stmt.namespace,
          id: stmt.id,
          type: stmt.type,
          file: stmt.file,
          domain,
          tables,
          joins: joins.map(j => `${j.leftTable}.${j.leftCol} = ${j.rightTable}.${j.rightCol}`),
          preview: stmt.sql.slice(0, 480)
        });
      });
    });
    return { tableColumns, tableUsage, joinCounts, domainTables, statements };
  }

  function tableById(view, id) {
    return view.tables.find(t => E.tableId(t) === id);
  }

  function ensureColumn(table, name) {
    if (!name || table.columns.some(c => c.name === name)) return;
    table.columns.push({ name, type: 'UNKNOWN', pk: false, fk: false, inferred: true, source: 'mybatis' });
  }

  function inferOrientation(view, join) {
    const lt = tableById(view, join.leftTable), rt = tableById(view, join.rightTable);
    const lc = lt?.columns?.find(c => c.name === join.leftCol);
    const rc = rt?.columns?.find(c => c.name === join.rightCol);
    if (lc?.pk && !rc?.pk) {
      return { from: join.leftTable, fromCol: join.leftCol, to: join.rightTable, toCol: join.rightCol, direction: 'pk' };
    }
    if (rc?.pk && !lc?.pk) {
      return { from: join.rightTable, fromCol: join.rightCol, to: join.leftTable, toCol: join.leftCol, direction: 'pk' };
    }
    const leftKey = `${join.leftTable}.${join.leftCol}`, rightKey = `${join.rightTable}.${join.rightCol}`;
    if (leftKey.localeCompare(rightKey) <= 0) {
      return { from: join.leftTable, fromCol: join.leftCol, to: join.rightTable, toCol: join.rightCol, direction: 'unknown' };
    }
    return { from: join.rightTable, fromCol: join.rightCol, to: join.leftTable, toCol: join.leftCol, direction: 'unknown' };
  }

  function relationExists(view, rel) {
    return (view.relations || []).some(existing => {
      const direct = existing.from === rel.from && existing.to === rel.to
        && String(existing.fromCol) === String(rel.fromCol) && String(existing.toCol) === String(rel.toCol);
      const reverse = existing.from === rel.to && existing.to === rel.from
        && String(existing.fromCol) === String(rel.toCol) && String(existing.toCol) === String(rel.fromCol);
      return direct || reverse;
    });
  }

  function nextPosition(index, baseCount) {
    const i = baseCount + index;
    return { x: 80 + (i % 4) * 470, y: 90 + Math.floor(i / 4) * 380 };
  }

  function mergeAnalysis(schemaKey, analysis) {
    const view = schemaData[schemaKey];
    if (!view) throw new Error('대상 스키마를 찾을 수 없습니다.');
    view.tables ||= [];
    view.relations ||= [];
    const baseCount = view.tables.length;
    let createdTables = 0, createdColumns = 0, createdRelations = 0;

    const discoveredTables = new Set([
      ...analysis.tableUsage.keys(),
      ...analysis.tableColumns.keys()
    ]);
    discoveredTables.forEach(tableId => {
      let table = tableById(view, tableId);
      if (!table) {
        const pos = nextPosition(createdTables, baseCount);
        table = {
          id: tableId,
          name: tableId,
          desc: 'MyBatis Mapper에서 추론',
          x: pos.x,
          y: pos.y,
          columns: [],
          inferred: true,
          source: 'mybatis',
          sourceRefs: []
        };
        view.tables.push(table);
        createdTables += 1;
      }
      const before = table.columns.length;
      (analysis.tableColumns.get(tableId) || []).forEach(col => ensureColumn(table, col));
      createdColumns += table.columns.length - before;
      const refs = analysis.tableUsage.get(tableId) || [];
      table.sourceRefs = [...new Set([...(table.sourceRefs || []), ...refs.map(ref => ref.key)])].slice(0, 100);
    });

    analysis.joinCounts.forEach(join => {
      const rel = inferOrientation(view, join);
      if (relationExists(view, rel)) return;
      const confidence = Math.min(0.99, (rel.direction === 'pk' ? 0.88 : 0.62) + Math.min(0.24, (join.count - 1) * 0.06));
      view.relations.push({
        ...rel,
        identifying: false,
        cardinality: rel.direction === 'pk' ? '1 : N' : '? : ?',
        inferred: true,
        confidence: Number(confidence.toFixed(2)),
        source: 'mybatis',
        sourceCount: join.count,
        sourceRefs: join.statements
      });
      createdRelations += 1;
    });
    return { createdTables, createdColumns, createdRelations, discoveredTables: discoveredTables.size };
  }

  function syncAutoAreas(schemaKey, analysis) {
    let created = 0, updated = 0;
    analysis.domainTables.forEach((tables, domain) => {
      const source = `mybatis:${String(domain).toLowerCase()}`;
      const existing = P.state.areas.find(a => a.schemaKey === schemaKey && a.source === source);
      const ids = [...tables].filter(id => tableById(schemaData[schemaKey], id));
      if (!ids.length) return;
      if (existing) {
        P.updateArea(existing.id, { tableIds: ids });
        existing.name = existing.name || domain;
        updated += 1;
      } else {
        P.createArea({
          name: domain,
          schemaKey,
          tableIds: ids,
          color: '#22c55e',
          description: 'MyBatis Mapper 경로/namespace에서 자동 생성',
          source
        });
        created += 1;
      }
    });
    return { created, updated };
  }

  function updateSourceIndex(parsedFiles, analysis, schemaKey) {
    const mapper = {
      importedAt: new Date().toISOString(),
      schemaKey,
      files: parsedFiles.map(file => ({
        path: file.path,
        namespace: file.namespace,
        statementCount: file.statements.length,
        domain: deriveDomain(file.path, file.namespace)
      })),
      statements: analysis.statements,
      tableUsage: Object.fromEntries([...analysis.tableUsage.entries()].map(([table, refs]) => [table, refs]))
    };
    P.state.sources.mybatisIndexes ||= {};
    P.state.sources.mybatisIndexes[schemaKey] = mapper;
    P.state.sources.mybatis = mapper;
    P.save();
    return mapper;
  }

  async function scanFiles(fileList, options) {
    const files = [...fileList].filter(file => file.name.toLowerCase().endsWith('.xml'));
    if (!files.length) throw new Error('XML 파일이 없습니다.');
    const parsed = [], errors = [];
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      try {
        const result = parseMapperXml(await file.text(), path);
        if (result.statements.length) parsed.push({ path, ...result });
      } catch (err) {
        errors.push({ file: path, message: err.message });
      }
    }
    if (!parsed.length) throw new Error('분석 가능한 MyBatis Mapper XML을 찾지 못했습니다.');
    const analysis = analyzeFiles(parsed);
    E.pushUndo?.();
    const merged = mergeAnalysis(options.schemaKey, analysis);
    const areas = options.autoAreas ? syncAutoAreas(options.schemaKey, analysis) : { created: 0, updated: 0 };
    updateSourceIndex(parsed, analysis, options.schemaKey);
    E.persist();
    if (currentView !== options.schemaKey) switchView(options.schemaKey);
    else renderView(currentView);
    P.Dock?.render?.();
    requestAnimationFrame(() => P.Dock?.applyScope?.(true));
    return {
      parsedFiles: parsed.length,
      statementCount: analysis.statements.length,
      errors,
      ...merged,
      areas
    };
  }

  function sourceSummaryText(result) {
    const lines = [
      `Mapper XML: ${result.parsedFiles}개`,
      `SQL statements: ${result.statementCount}개`,
      `발견 테이블: ${result.discoveredTables}개`,
      `신규 테이블: ${result.createdTables}개`,
      `신규 컬럼: ${result.createdColumns}개`,
      `추론 관계: ${result.createdRelations}개`,
      `업무 영역: 신규 ${result.areas.created} / 갱신 ${result.areas.updated}`,
      `파싱 제외/오류: ${result.errors.length}개`
    ];
    if (result.errors.length) {
      lines.push('', '오류 파일 (최대 20개)', ...result.errors.slice(0, 20).map(e => `- ${e.file}: ${e.message}`));
    }
    lines.push('', '※ 관계는 JOIN 반복 횟수와 기존 PK 정보를 이용한 추론입니다. 실제 FK와 다를 수 있습니다.');
    return lines.join('\n');
  }

  function chooseFiles(mode, options) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.xml,text/xml,application/xml';
    if (mode === 'folder') input.setAttribute('webkitdirectory', '');
    input.onchange = async () => {
      if (!input.files?.length) return;
      try {
        A?.showToast?.('MyBatis Mapper를 분석 중입니다...');
        const result = await scanFiles(input.files, options);
        E.showOutput?.('MyBatis Project Scan', sourceSummaryText(result));
        A?.showToast?.(`MyBatis ${result.statementCount}개 SQL 분석 완료`);
      } catch (err) {
        console.error(err);
        alert(`MyBatis 분석에 실패했습니다.\n${err.message}`);
      }
    };
    input.click();
  }

  function createBlankSchema() {
    const name = prompt('새 스키마 이름', 'Company Schema');
    if (!name?.trim()) return null;
    let key = name.trim().toLowerCase()
      .replace(/[^a-z0-9가-힣_$#]+/g, '_')
      .replace(/^_+|_+$/g, '') || `schema_${Date.now().toString(36)}`;
    if (schemaData[key]) {
      let n = 2;
      const base = key;
      while (schemaData[`${base}_${n}`]) n += 1;
      key = `${base}_${n}`;
    }
    schemaData[key] = {
      tabName: name.trim(),
      title: name.trim(),
      icon: 'fa-solid fa-database',
      tables: [],
      relations: []
    };
    E.persist();
    renderTabs();
    return key;
  }

  function openMyBatisImport() {
    const schemaOptions = Object.keys(schemaData).map(key => {
      const view = schemaData[key];
      const label = view.tabName || view.title || key;
      return `<option value="${E.escapeHtml(key)}">${E.escapeHtml(label)}</option>`;
    }).join('') + '<option value="__new__">＋ 새 스키마 생성</option>';
    const dialog = A.ensureDialog('mybatis-import-dialog', 'MyBatis Project Import', `
      <div class="mybatis-import-intro">
        <i class="fa-solid fa-code-branch"></i>
        <div><strong>DB 연결 없이 Mapper XML로 구조를 추론합니다.</strong><small>테이블 · 사용 컬럼 · JOIN 관계 · Mapper 사용처 · 업무 영역을 프로젝트 파일에 인덱싱합니다.</small></div>
      </div>
      <div class="advanced-grid two">
        <label class="advanced-field"><span>대상 스키마</span><select id="mybatis-schema-select">${schemaOptions}</select></label>
        <label class="advanced-field checkbox-field"><span>업무 영역</span><label><input type="checkbox" id="mybatis-auto-area" checked> Mapper 경로 기준 자동 생성</label></label>
      </div>
      <div class="mybatis-import-actions">
        <button class="editor-btn primary" data-mybatis-folder><i class="fa-regular fa-folder-open"></i> 프로젝트 폴더 선택</button>
        <button class="editor-btn" data-mybatis-files><i class="fa-regular fa-file-code"></i> Mapper XML 파일 선택</button>
      </div>
      <div class="mybatis-import-note">원본 XML 파일 자체는 프로젝트에 저장하지 않습니다. AI/ERD용 구조 인덱스와 짧은 SQL preview만 저장합니다.</div>
    `);
    dialog.querySelector('#mybatis-schema-select').value = currentView;
    const options = () => {
      let schemaKey = dialog.querySelector('#mybatis-schema-select').value;
      if (schemaKey === '__new__') schemaKey = createBlankSchema();
      if (!schemaKey) return null;
      return {
        schemaKey,
        autoAreas: dialog.querySelector('#mybatis-auto-area').checked
      };
    };
    dialog.querySelector('[data-mybatis-folder]').onclick = () => {
      const opts = options(); if (!opts) return;
      dialog.close(); chooseFiles('folder', opts);
    };
    dialog.querySelector('[data-mybatis-files]').onclick = () => {
      const opts = options(); if (!opts) return;
      dialog.close(); chooseFiles('files', opts);
    };
    dialog.showModal();
  }

  function showMapperUsage(tableId = E.primarySelectedId?.()) {
    if (!tableId) return alert('테이블을 선택하세요.');
    const mapper = mapperIndex(currentView);
    const refs = mapper?.tableUsage?.[tableId] || [];
    if (!refs.length) {
      E.showOutput?.('MyBatis Usage', `${tableId}\n\nMyBatis 사용처가 인덱싱되어 있지 않습니다.`);
      return;
    }
    const byType = refs.reduce((acc, ref) => {
      acc[ref.type] = (acc[ref.type] || 0) + 1;
      return acc;
    }, {});
    const lines = [
      tableId,
      '',
      `총 ${refs.length}개 SQL`,
      Object.entries(byType).map(([type, count]) => `${type.toUpperCase()}: ${count}`).join(' · '),
      '',
      ...refs.slice(0, 300).map(ref => `${ref.type.toUpperCase().padEnd(6)} ${ref.key}\n       ${ref.file}`)
    ];
    if (refs.length > 300) lines.push('', `... ${refs.length - 300}개 생략`);
    E.showOutput?.('MyBatis Usage', lines.join('\n'));
  }

  function openMyBatisIndex() {
    const mapper = mapperIndex(currentView);
    if (!mapper?.importedAt) {
      alert('아직 MyBatis 인덱스가 없습니다.');
      return;
    }
    const tables = Object.entries(mapper.tableUsage || {})
      .sort((a, b) => b[1].length - a[1].length);
    const body = `
      <div class="mybatis-index-summary">
        <span><b>${mapper.files?.length || 0}</b><small>Mapper XML</small></span>
        <span><b>${mapper.statements?.length || 0}</b><small>SQL</small></span>
        <span><b>${tables.length}</b><small>Tables</small></span>
        <span><b>${P.areasForSchema(mapper.schemaKey || currentView).filter(a => a.source.startsWith('mybatis:')).length}</b><small>Auto Areas</small></span>
      </div>
      <div class="advanced-manager-list mybatis-index-list">
        ${tables.slice(0, 200).map(([table, refs]) => `<button class="mybatis-index-row" data-mybatis-table="${E.escapeHtml(table)}">
          <strong>${E.escapeHtml(table)}</strong><span>${refs.length} SQL</span>
        </button>`).join('')}
      </div>`;
    const dialog = A.ensureDialog('mybatis-index-dialog', 'MyBatis Source Index', body, true);
    dialog.querySelectorAll('[data-mybatis-table]').forEach(row => {
      row.onclick = () => {
        dialog.close();
        const table = row.dataset.mybatisTable;
        if (schemaData[currentView]?.tables?.some(t => E.tableId(t) === table)) {
          E.selectOnly?.(table);
        }
        showMapperUsage(table);
      };
    });
    dialog.showModal();
  }

  function installUi() {
    const popover = document.querySelector('.editor-tools-popover');
    if (popover && !popover.querySelector('[data-mybatis-tools]')) {
      const label = document.createElement('div');
      label.className = 'menu-label';
      label.dataset.mybatisTools = 'true';
      label.textContent = 'Source / MyBatis';
      const scan = document.createElement('button');
      scan.innerHTML = '<i class="fa-solid fa-code-branch"></i> MyBatis Project Import';
      scan.onclick = openMyBatisImport;
      const index = document.createElement('button');
      index.textContent = 'MyBatis Source Index';
      index.onclick = openMyBatisIndex;
      const usage = document.createElement('button');
      usage.textContent = '선택 테이블 Mapper 사용처';
      usage.onclick = () => showMapperUsage();
      popover.insertBefore(usage, popover.firstChild);
      popover.insertBefore(index, usage);
      popover.insertBefore(scan, index);
      popover.insertBefore(label, scan);
    }

    const rail = document.querySelector('.erd-project-dock-rail');
    const toggle = rail?.querySelector('[data-dock-toggle]');
    if (rail && toggle && !rail.querySelector('[data-mybatis-import]')) {
      const button = document.createElement('button');
      button.className = 'dock-icon-btn';
      button.dataset.mybatisImport = 'true';
      button.title = 'MyBatis Project Import';
      button.innerHTML = '<i class="fa-solid fa-code-branch"></i>';
      button.onclick = openMyBatisImport;
      rail.insertBefore(button, toggle);
    }
  }

  document.addEventListener('erd:project-loaded', installUi);
  const baseOnload = window.onload;
  window.onload = function(event) {
    baseOnload?.call(window, event);
    installUi();
  };

  E.MyBatis = {
    parseMapperXml,
    analyzeFiles,
    scanFiles,
    openImport: openMyBatisImport,
    openIndex: openMyBatisIndex,
    showUsage: showMapperUsage,
    mapperIndex
  };
  Object.assign(window, { openMyBatisImport, openMyBatisIndex, showMapperUsage });
})();
