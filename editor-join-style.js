/** JOIN SQL style toggle: ANSI JOIN or Oracle legacy outer join (+). */
(() => {
  'use strict';

  const E = window.ERDEditor;
  if (!E) return;

  const STORAGE_KEY = 'erd_studio_join_style_v1';
  const ANSI = 'ansi';
  const ORACLE = 'oracle-plus';
  const validStyles = new Set([ANSI, ORACLE]);
  const baseShowOutput = E.showOutput;

  function relationBetween(a, b) {
    return (E.currentSchema()?.relations || []).find(rel =>
      (rel.from === a && rel.to === b) || (rel.from === b && rel.to === a));
  }

  function preferredStyle() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (validStyles.has(saved)) return saved;
    return E.Project?.state?.project?.dbms === 'oracle' ? ORACLE : ANSI;
  }

  function aliasesFor(a, b) {
    return new Map([[a, 'A'], [b, 'B']]);
  }

  function selectedColumns(a, b, ta, tb) {
    return [
      ...ta.columns.map(column => `A.${column.name} AS ${ta.name.toLowerCase()}_${column.name.toLowerCase()}`),
      ...tb.columns.map(column => `B.${column.name} AS ${tb.name.toLowerCase()}_${column.name.toLowerCase()}`)
    ];
  }

  function ansiCondition(rel, aliases) {
    const fromCols = E.columnArray(rel.fromCol);
    const toCols = E.columnArray(rel.toCol);
    const fromAlias = aliases.get(rel.from);
    const toAlias = aliases.get(rel.to);
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
    return fromCols.map((parentCol, index) => {
      const childCol = toCols[index] || toCols[0];
      return `${parentAlias}.${parentCol} = ${childAlias}.${childCol}(+)`;
    }).join('\n   AND ');
  }

  function buildJoinSql(a, b, style = ANSI) {
    const ta = E.findTable(a);
    const tb = E.findTable(b);
    if (!ta || !tb) return '';

    const rel = relationBetween(a, b);
    const aliases = aliasesFor(a, b);
    const cols = selectedColumns(a, b, ta, tb);
    const select = `SELECT\n    ${cols.join(',\n    ')}`;

    if (!rel) {
      if (style === ORACLE) {
        return `${select}\nFROM ${ta.name} A,\n     ${tb.name} B;\n\n-- 직접 FK 관계를 찾지 못해 Oracle legacy CROSS JOIN 형태로 생성했습니다.`;
      }
      return `${select}\nFROM ${ta.name} A\nCROSS JOIN ${tb.name} B;\n\n-- 직접 FK 관계를 찾지 못해 CROSS JOIN으로 생성했습니다.`;
    }

    if (style === ORACLE) {
      return `${select}\nFROM ${ta.name} A,\n     ${tb.name} B\nWHERE ${oracleOuterCondition(rel, aliases)};`;
    }

    return `${select}\nFROM ${ta.name} A\nJOIN ${tb.name} B\n  ON ${ansiCondition(rel, aliases)};`;
  }

  function focusSelection(ids, rel) {
    const selected = new Set(ids);
    document.querySelectorAll('.table-card').forEach(card => {
      const id = card.id.replace(/^card-/, '');
      card.classList.toggle('analysis-focus', selected.has(id));
      card.classList.toggle('analysis-dimmed', !selected.has(id));
    });
    document.querySelectorAll('.connection-line').forEach(line => {
      const matches = !!rel && (
        line.id === `line-${rel.from}-${rel.to}` ||
        line.id === `line-${rel.to}-${rel.from}`
      );
      line.classList.toggle('highlighted', matches);
      line.classList.toggle('dimmed', !!rel && !matches);
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

  function setOutput(style, a, b) {
    const title = style === ORACLE ? 'JOIN SQL · Oracle (+)' : 'JOIN SQL · ANSI';
    E.showOutput(title, buildJoinSql(a, b, style));
    installToggle(style, a, b);
  }

  function installToggle(style, a, b) {
    const actions = document.querySelector('.editor-output-actions');
    if (!actions) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'join-style-toggle';
    toolbar.dataset.joinStyleToolbar = 'true';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'JOIN SQL 스타일');

    const options = [
      [ANSI, 'ANSI JOIN', '표준 ANSI JOIN 문법'],
      [ORACLE, 'Oracle (+)', 'Oracle legacy outer join · 부모 테이블 행을 보존하고 자식 컬럼에 (+) 적용']
    ];

    const dbms = E.Project?.state?.project?.dbms || 'oracle';
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
        setOutput(value, a, b);
      };
      toolbar.appendChild(button);
    });

    const firstAction = actions.firstElementChild;
    firstAction ? actions.insertBefore(toolbar, firstAction) : actions.appendChild(toolbar);
  }

  function generateJoinForSelectedWithStyle() {
    const ids = [...E.selectedIds];
    if (ids.length !== 2) return alert('JOIN은 테이블 2개를 Ctrl+클릭으로 선택하세요.');
    const [a, b] = ids;
    const rel = relationBetween(a, b);
    const style = preferredStyle();
    setOutput(style, a, b);
    focusSelection(ids, rel);
  }

  E.JoinStyle = {
    ANSI,
    ORACLE,
    buildJoinSql,
    preferredStyle,
    relationBetween
  };
  window.generateJoinForSelected = generateJoinForSelectedWithStyle;
})();
