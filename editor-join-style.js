/** JOIN SQL style support for multi-table selection and Join Path Finder. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  if (!E) return;

  const STORAGE_KEY = 'erd_studio_join_style_v1';
  const ANSI = 'ansi';
  const ORACLE = 'oracle-plus';
  const validStyles = new Set([ANSI, ORACLE]);
  const baseShowOutput = E.showOutput;

  function relations() {
    return E.currentSchema()?.relations || [];
  }

  function relationBetween(a, b) {
    return relations().find(rel =>
      (rel.from === a && rel.to === b) || (rel.from === b && rel.to === a));
  }

  function preferredStyle() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (validStyles.has(saved)) return saved;
    return E.Project?.state?.project?.dbms === 'oracle' ? ORACLE : ANSI;
  }

  function aliasesForIds(ids) {
    const aliases = new Map();
    ids.forEach((id, index) => {
      const alias = ids.length === 2 ? (index === 0 ? 'A' : 'B') : `T${index + 1}`;
      aliases.set(id, alias);
    });
    return aliases;
  }

  function selectedColumns(ids, aliases) {
    return ids.flatMap(id => {
      const table = E.findTable(id);
      const alias = aliases.get(id);
      if (!table || !alias) return [];
      return table.columns.map(column =>
        `${alias}.${column.name} AS ${table.name.toLowerCase()}_${column.name.toLowerCase()}`);
    });
  }

  function ansiCondition(rel, aliases) {
    const fromCols = E.columnArray(rel.fromCol);
    const toCols = E.columnArray(rel.toCol);
    const fromAlias = aliases.get(rel.from);
    const toAlias = aliases.get(rel.to);
    if (!fromAlias || !toAlias) return '';
    return fromCols.map((fromCol, index) => {
      const toCol = toCols[index] || toCols[0];
      return `${fromAlias}.${fromCol} = ${toAlias}.${toCol}`;
    }).join(' AND ');
  }

  function oracleOuterCondition(rel, aliases) {
    const fromCols = E.columnArray(rel.fromCol);
    const toCols = E.columnArray(rel.toCol);
    const parentAlias = aliases.get(rel.from);
    const childAlias = aliases.get(rel.to);
    if (!parentAlias || !childAlias) return '';
    return fromCols.map((parentCol, index) => {
      const childCol = toCols[index] || toCols[0];
      return `${parentAlias}.${parentCol} = ${childAlias}.${childCol}(+)`;
    }).join('\n   AND ');
  }

  function buildGraph(allowedIds = null) {
    const allowed = allowedIds ? new Set(allowedIds) : null;
    const tableIds = allowed ? [...allowed] : (E.currentSchema()?.tables || []).map(E.tableId);
    const graph = new Map(tableIds.map(id => [id, []]));
    relations().forEach(rel => {
      if (!graph.has(rel.from) || !graph.has(rel.to)) return;
      graph.get(rel.from).push({ id: rel.to, rel });
      graph.get(rel.to).push({ id: rel.from, rel });
    });
    return graph;
  }

  function buildSelectionPlan(ids) {
    const uniqueIds = [...new Set(ids)].filter(id => !!E.findTable(id));
    if (uniqueIds.length < 2) {
      return { ids: uniqueIds, steps: [], connectedIds: uniqueIds, disconnectedIds: [] };
    }

    const graph = buildGraph(uniqueIds);
    const visited = new Set([uniqueIds[0]]);
    const queue = [uniqueIds[0]];
    const steps = [];

    while (queue.length) {
      const current = queue.shift();
      for (const edge of graph.get(current) || []) {
        if (visited.has(edge.id)) continue;
        visited.add(edge.id);
        queue.push(edge.id);
        steps.push({ from: current, to: edge.id, rel: edge.rel });
      }
    }

    return {
      ids: uniqueIds,
      steps,
      connectedIds: uniqueIds.filter(id => visited.has(id)),
      disconnectedIds: uniqueIds.filter(id => !visited.has(id))
    };
  }

  function buildSelectionJoinSql(ids, style = ANSI) {
    const plan = buildSelectionPlan(ids);
    if (plan.ids.length < 2 || plan.disconnectedIds.length) return { sql: '', plan };

    const aliases = aliasesForIds(plan.ids);
    const cols = selectedColumns(plan.ids, aliases);
    const select = `SELECT\n    ${cols.join(',\n    ')}`;

    if (style === ORACLE) {
      const from = plan.ids.map(id => {
        const table = E.findTable(id);
        return `${table.name} ${aliases.get(id)}`;
      }).join(',\n     ');
      const where = plan.steps.map(step => oracleOuterCondition(step.rel, aliases)).filter(Boolean).join('\n   AND ');
      return { sql: `${select}\nFROM ${from}\nWHERE ${where};`, plan, aliases };
    }

    const firstId = plan.ids[0];
    const first = E.findTable(firstId);
    let sql = `${select}\nFROM ${first.name} ${aliases.get(firstId)}`;
    plan.steps.forEach(step => {
      const table = E.findTable(step.to);
      sql += `\nJOIN ${table.name} ${aliases.get(step.to)}\n  ON ${ansiCondition(step.rel, aliases)}`;
    });
    return { sql: `${sql};`, plan, aliases };
  }

  // Compatibility for existing callers/tests that build only two selected tables.
  function buildJoinSql(a, b, style = ANSI) {
    return buildSelectionJoinSql([a, b], style).sql;
  }

  function allJoinPaths(start, goal, limit = 20) {
    const graph = buildGraph();
    const paths = [];
    function dfs(node, seen, steps) {
      if (paths.length >= limit) return;
      if (node === goal) {
        paths.push(steps.slice());
        return;
      }
      for (const edge of graph.get(node) || []) {
        if (seen.has(edge.id)) continue;
        seen.add(edge.id);
        steps.push({ from: node, to: edge.id, rel: edge.rel });
        dfs(edge.id, seen, steps);
        steps.pop();
        seen.delete(edge.id);
      }
    }
    dfs(start, new Set([start]), []);
    return paths.sort((a, b) => a.length - b.length);
  }

  function pathNodeIds(path) {
    if (!path.length) return [];
    return [path[0].from, ...path.map(step => step.to)];
  }

  function buildPathSql(path, style = ANSI) {
    const ids = pathNodeIds(path);
    if (ids.length < 2) return '';
    const aliases = new Map(ids.map((id, index) => [id, `T${index + 1}`]));

    if (style === ORACLE) {
      const from = ids.map(id => `${E.findTable(id).name} ${aliases.get(id)}`).join(',\n     ');
      const where = path.map(step => oracleOuterCondition(step.rel, aliases)).filter(Boolean).join('\n   AND ');
      return `SELECT T1.*\nFROM ${from}\nWHERE ${where};`;
    }

    let sql = `SELECT T1.*\nFROM ${E.findTable(ids[0]).name} T1`;
    path.forEach(step => {
      sql += `\nJOIN ${E.findTable(step.to).name} ${aliases.get(step.to)}\n  ON ${ansiCondition(step.rel, aliases)}`;
    });
    return `${sql};`;
  }

  function focusTables(ids, focusRelations = []) {
    const selected = new Set(ids);
    const relationKeys = new Set(focusRelations.flatMap(rel => [
      `line-${rel.from}-${rel.to}`,
      `line-${rel.to}-${rel.from}`
    ]));

    document.querySelectorAll('.table-card').forEach(card => {
      const id = card.id.replace(/^card-/, '');
      card.classList.toggle('analysis-focus', selected.has(id));
      card.classList.toggle('analysis-dimmed', !selected.has(id));
    });
    document.querySelectorAll('.connection-line').forEach(line => {
      const matches = relationKeys.has(line.id);
      line.classList.toggle('highlighted', matches);
      line.classList.toggle('dimmed', relationKeys.size > 0 && !matches);
    });
  }

  function clearJoinToolbar() {
    document.querySelector('[data-join-style-toolbar]')?.remove();
  }

  if (typeof baseShowOutput === 'function') {
    E.showOutput = function(title, content) {
      clearJoinToolbar();
      return baseShowOutput.call(this, title, content);
    };
  }

  function installToggle(style, rerender) {
    const actions = document.querySelector('.editor-output-actions');
    if (!actions) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'join-style-toggle';
    toolbar.dataset.joinStyleToolbar = 'true';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'JOIN SQL 스타일');

    const dbms = E.Project?.state?.project?.dbms || 'oracle';
    const options = [
      [ANSI, 'ANSI JOIN', '표준 ANSI JOIN 문법'],
      [ORACLE, 'Oracle (+)', 'Oracle legacy outer join · 관계의 부모 행을 보존하고 자식 컬럼에 (+) 적용']
    ];

    options.forEach(([value, label, title]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `join-style-option${style === value ? ' active' : ''}`;
      button.textContent = label;
      button.title = title;
      if (value === ORACLE && !['oracle', 'mixed'].includes(dbms)) {
        button.title += ` · 현재 프로젝트 DBMS: ${dbms}`;
      }
      button.onclick = () => {
        if (style === value) return;
        localStorage.setItem(STORAGE_KEY, value);
        rerender(value);
      };
      toolbar.appendChild(button);
    });

    const firstAction = actions.firstElementChild;
    firstAction ? actions.insertBefore(toolbar, firstAction) : actions.appendChild(toolbar);
  }

  function setSelectionOutput(style, ids) {
    const result = buildSelectionJoinSql(ids, style);
    if (result.plan.ids.length < 2) {
      return alert('JOIN할 테이블을 2개 이상 Ctrl+클릭으로 선택하세요.');
    }
    if (result.plan.disconnectedIds.length) {
      E.showOutput('JOIN SQL · 연결 확인', [
        `선택한 ${result.plan.ids.length}개 테이블이 하나의 FK 관계망으로 연결되지 않았습니다.`,
        '',
        `연결된 테이블: ${result.plan.connectedIds.join(', ')}`,
        `분리된 테이블: ${result.plan.disconnectedIds.join(', ')}`,
        '',
        '분리된 테이블을 선택에서 제외하거나 Join Path Finder로 중간 경로를 확인하세요.'
      ].join('\n'));
      focusTables(result.plan.connectedIds, result.plan.steps.map(step => step.rel));
      return false;
    }

    const title = style === ORACLE ? 'JOIN SQL · Oracle (+)' : 'JOIN SQL · ANSI';
    E.showOutput(title, result.sql);
    focusTables(result.plan.ids, result.plan.steps.map(step => step.rel));
    installToggle(style, nextStyle => setSelectionOutput(nextStyle, ids));
    return true;
  }

  function generateJoinForSelectedWithStyle() {
    const ids = [...E.selectedIds];
    return setSelectionOutput(preferredStyle(), ids);
  }

  function setPathOutput(style, endpointIds, paths) {
    const path = paths[0];
    const route = pathNodeIds(path);
    const alternatives = paths.slice(0, 10)
      .map((candidate, index) => `${index + 1}. ${pathNodeIds(candidate).join(' → ')}`)
      .join('\n');
    const title = style === ORACLE ? 'Join Path Finder · Oracle (+)' : 'Join Path Finder · ANSI';
    const sql = buildPathSql(path, style);

    E.showOutput(title, [
      '최단 경로',
      route.join(' → '),
      '',
      `탐색 경로 (${paths.length}개, 최대 20개)`,
      alternatives,
      '',
      sql
    ].join('\n'));
    focusTables(route, path.map(step => step.rel));
    installToggle(style, nextStyle => setPathOutput(nextStyle, endpointIds, paths));
  }

  function generateJoinPathWithStyle() {
    const ids = [...E.selectedIds];
    if (ids.length !== 2) return alert('경로 탐색은 시작/도착 테이블 2개를 선택하세요.');
    const paths = allJoinPaths(ids[0], ids[1]);
    if (!paths.length) {
      return E.showOutput('Join Path Finder', `${ids[0]} ↔ ${ids[1]} 사이 FK 경로가 없습니다.`);
    }
    setPathOutput(preferredStyle(), ids, paths);
  }

  E.JoinStyle = {
    ANSI,
    ORACLE,
    preferredStyle,
    relationBetween,
    buildSelectionPlan,
    buildSelectionJoinSql,
    buildJoinSql,
    allJoinPaths,
    buildPathSql,
    pathNodeIds
  };
  window.generateJoinForSelected = generateJoinForSelectedWithStyle;
  window.generateJoinPath = generateJoinPathWithStyle;
})();
