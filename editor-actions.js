/** Central command registry for ERD Studio desktop-style menus and shared UI actions. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const A = E?.Advanced;
  const P = E?.Project;
  if (!E || !A || !P) throw new Error('ERD project/advanced core must load before action registry');

  const actions = new Map();

  function register(action) {
    if (!action?.id || typeof action.run !== 'function') throw new Error('Action requires id and run');
    actions.set(action.id, { ...action });
    return action;
  }

  function get(id) { return actions.get(id) || null; }
  function enabled(actionOrId) {
    const action = typeof actionOrId === 'string' ? get(actionOrId) : actionOrId;
    if (!action) return false;
    try { return action.when ? !!action.when() : true; } catch { return false; }
  }
  function checked(actionOrId) {
    const action = typeof actionOrId === 'string' ? get(actionOrId) : actionOrId;
    if (!action?.checked) return false;
    try { return !!action.checked(); } catch { return false; }
  }
  function invoke(id, ...args) {
    const action = get(id);
    if (!action || !enabled(action)) return false;
    action.run(...args);
    document.dispatchEvent(new CustomEvent('erd:action-invoked', { detail: { id } }));
    return true;
  }
  function callGlobal(name, ...args) {
    const fn = window[name];
    if (typeof fn !== 'function') {
      A.showToast?.(`${name} 기능을 아직 불러오는 중입니다.`);
      return false;
    }
    fn(...args);
    return true;
  }

  function setTheme(theme) {
    callGlobal('changeTheme', theme);
    const select = document.getElementById('theme-select');
    if (select) select.value = theme;
  }

  function toggleChrome(key, className) {
    const nextHidden = !document.body.classList.contains(className);
    document.body.classList.toggle(className, nextHidden);
    localStorage.setItem(key, nextHidden ? '0' : '1');
  }

  function restoreChromePrefs() {
    document.body.classList.toggle('erd-hide-minimap', localStorage.getItem('erd_show_minimap_v1') === '0');
    document.body.classList.toggle('erd-hide-legend', localStorage.getItem('erd_show_legend_v1') === '0');
  }

  function showShortcuts() {
    const rows = [
      ['Ctrl / Cmd + Z', '실행 취소'],
      ['Ctrl / Cmd + Shift + Z', '다시 실행'],
      ['Ctrl / Cmd + D', '선택 테이블 복제'],
      ['Delete', '선택 테이블 삭제'],
      ['Ctrl / Cmd + 클릭', '테이블 다중 선택'],
      ['Shift + 드래그', '그리드 스냅 없이 이동'],
      ['마우스 휠', '확대 / 축소'],
      ['관계선 더블클릭', '관계 편집']
    ];
    const body = `<div class="desktop-shortcut-list">${rows.map(([key, label]) =>
      `<div><kbd>${E.escapeHtml(key)}</kbd><span>${E.escapeHtml(label)}</span></div>`).join('')}</div>`;
    A.ensureDialog('desktop-shortcuts-dialog', '키보드 / 마우스 단축키', body, true).showModal();
  }

  function showAbout() {
    const project = P.state.project || {};
    const body = `<div class="desktop-about">
      <i class="fa-solid fa-diagram-project"></i>
      <div><strong>ERD Studio</strong><p>프로젝트 중심 DB 역설계 · ERD 편집 도구</p>
      <small>현재 프로젝트 · ${E.escapeHtml(project.name || '새 프로젝트')}</small></div>
    </div>`;
    A.ensureDialog('desktop-about-dialog', 'ERD Studio 정보', body).showModal();
  }

  const hasSelection = () => !!E.selectedIds?.size;
  const twoSelected = () => E.selectedIds?.size === 2;

  [
    { id:'file.new', label:'새 프로젝트', icon:'fa-solid fa-file-circle-plus', shortcut:'Ctrl+N', run:()=>callGlobal('openNewProjectDialog') },
    { id:'file.open', label:'프로젝트 열기…', icon:'fa-regular fa-folder-open', shortcut:'Ctrl+O', run:()=>P.Workspace?.openProjectFile?.() },
    { id:'file.save', label:'프로젝트 파일 저장', icon:'fa-regular fa-floppy-disk', shortcut:'Ctrl+S', run:()=>P.exportFile?.() },
    { id:'file.samples', label:'샘플 / 성능 테스트…', icon:'fa-solid fa-flask', run:()=>callGlobal('openSamplesDialog') },
    { id:'file.settings', label:'프로젝트 설정…', icon:'fa-solid fa-gear', run:()=>P.editInfo?.() },
    { id:'file.import.ddl', label:'DDL Import…', icon:'fa-solid fa-file-code', run:()=>callGlobal('openDdlImportDialog') },
    { id:'file.import.json', label:'ERD JSON Restore…', icon:'fa-solid fa-file-import', run:()=>callGlobal('importSchemaJson') },
    { id:'file.export.ddl.oracle', label:'Oracle DDL', icon:'fa-solid fa-database', run:()=>callGlobal('exportDdl','oracle') },
    { id:'file.export.ddl.postgres', label:'PostgreSQL DDL', icon:'fa-solid fa-database', run:()=>callGlobal('exportDdl','postgres') },
    { id:'file.export.ddl.mysql', label:'MySQL DDL', icon:'fa-solid fa-database', run:()=>callGlobal('exportDdl','mysql') },
    { id:'file.export.json', label:'ERD JSON Backup', icon:'fa-solid fa-file-export', run:()=>callGlobal('exportSchemaJson') },
    { id:'file.export.png', label:'Diagram PNG', icon:'fa-regular fa-image', run:()=>callGlobal('exportDiagram','png') },
    { id:'file.export.svg', label:'Diagram SVG', icon:'fa-regular fa-image', run:()=>callGlobal('exportDiagram','svg') },
    { id:'file.export.spec.md', label:'테이블 명세 Markdown', icon:'fa-regular fa-file-lines', run:()=>callGlobal('exportSpecification','md') },
    { id:'file.export.spec.csv', label:'테이블 명세 CSV', icon:'fa-solid fa-file-csv', run:()=>callGlobal('exportSpecification','csv') },
    { id:'file.export.spec.xls', label:'테이블 명세 Excel', icon:'fa-regular fa-file-excel', run:()=>callGlobal('exportSpecification','xls') },

    { id:'edit.undo', label:'실행 취소', icon:'fa-solid fa-rotate-left', shortcut:'Ctrl+Z', run:()=>callGlobal('undoEditor') },
    { id:'edit.redo', label:'다시 실행', icon:'fa-solid fa-rotate-right', shortcut:'Ctrl+Shift+Z', run:()=>callGlobal('redoEditor') },
    { id:'edit.table.add', label:'테이블 추가…', icon:'fa-solid fa-plus', run:()=>callGlobal('openTableDialog') },
    { id:'edit.relation.manage', label:'관계 관리…', icon:'fa-solid fa-link', run:()=>callGlobal('openRelationManager') },
    { id:'edit.relation.link', label:'선택 테이블에서 관계 연결', icon:'fa-solid fa-link', when:hasSelection, run:()=>callGlobal('startRelationLink') },
    { id:'edit.duplicate', label:'선택 테이블 복제', icon:'fa-regular fa-clone', shortcut:'Ctrl+D', when:hasSelection, run:()=>callGlobal('duplicateSelected') },
    { id:'edit.delete', label:'선택 테이블 삭제', icon:'fa-regular fa-trash-can', shortcut:'Delete', when:hasSelection, run:()=>callGlobal('deleteSelected') },
    { id:'edit.color', label:'선택 테이블 색상', icon:'fa-solid fa-palette', when:hasSelection, run:()=>callGlobal('changeTableColor') },
    { id:'edit.note.add', label:'메모 추가', icon:'fa-regular fa-note-sticky', run:()=>callGlobal('addNoteAt') },
    { id:'edit.subjectArea.canvas', label:'선택 테이블 Canvas Subject Area', icon:'fa-solid fa-object-group', when:hasSelection, run:()=>callGlobal('createSubjectArea') },

    { id:'view.inspector', label:'Inspector', icon:'fa-solid fa-table-columns', run:()=>callGlobal('toggleInspector') },
    { id:'view.fit', label:'화면 맞춤', icon:'fa-solid fa-compress', run:()=>callGlobal('resetZoom') },
    { id:'view.layout.grid', label:'Grid 레이아웃', icon:'fa-solid fa-table-cells-large', run:()=>callGlobal('applyLayout','grid') },
    { id:'view.layout.tree', label:'Tree 레이아웃', icon:'fa-solid fa-code-branch', run:()=>callGlobal('applyLayout','tree') },
    { id:'view.layout.organic', label:'Organic 레이아웃', icon:'fa-solid fa-share-nodes', run:()=>callGlobal('applyLayout','organic') },
    { id:'view.minimap', label:'Minimap 표시', icon:'fa-regular fa-map', checked:()=>!document.body.classList.contains('erd-hide-minimap'), run:()=>toggleChrome('erd_show_minimap_v1','erd-hide-minimap') },
    { id:'view.legend', label:'Legend 표시', icon:'fa-solid fa-list', checked:()=>!document.body.classList.contains('erd-hide-legend'), run:()=>toggleChrome('erd_show_legend_v1','erd-hide-legend') },
    { id:'view.theme.cyber', label:'Cyber Navy', checked:()=>document.body.classList.contains('theme-cyber-navy'), run:()=>setTheme('theme-cyber-navy') },
    { id:'view.theme.slate', label:'Industrial Slate', checked:()=>document.body.classList.contains('theme-industrial-slate'), run:()=>setTheme('theme-industrial-slate') },
    { id:'view.theme.charcoal', label:'Charcoal Gray', checked:()=>document.body.classList.contains('theme-charcoal-gray'), run:()=>setTheme('theme-charcoal-gray') },
    { id:'view.theme.gold', label:'Midnight Gold', checked:()=>document.body.classList.contains('theme-midnight-gold'), run:()=>setTheme('theme-midnight-gold') },
    { id:'view.theme.paper', label:'Paper Light', checked:()=>document.body.classList.contains('theme-paper-light'), run:()=>setTheme('theme-paper-light') },

    { id:'tools.code.java', label:'Java DTO 생성', icon:'fa-brands fa-java', when:hasSelection, run:()=>callGlobal('generateCode','java') },
    { id:'tools.code.kotlin', label:'Kotlin DTO 생성', icon:'fa-solid fa-code', when:hasSelection, run:()=>callGlobal('generateCode','kotlin') },
    { id:'tools.code.typescript', label:'TypeScript interface 생성', icon:'fa-solid fa-code', when:hasSelection, run:()=>callGlobal('generateCode','typescript') },
    { id:'tools.impact', label:'영향도 분석', icon:'fa-solid fa-burst', when:hasSelection, run:()=>callGlobal('analyzeRelations','impact') },
    { id:'tools.lineage', label:'데이터 계보 추적', icon:'fa-solid fa-share-nodes', when:hasSelection, run:()=>callGlobal('analyzeRelations','lineage') },
    { id:'tools.transactionScope', label:'Transaction Scope Guide', icon:'fa-solid fa-arrows-to-circle', when:hasSelection, run:()=>callGlobal('transactionScopeGuide') },
    { id:'tools.join', label:'선택 2개 JOIN SQL', icon:'fa-solid fa-code', when:twoSelected, run:()=>callGlobal('generateJoinForSelected') },
    { id:'tools.joinPath', label:'Join Path Finder', icon:'fa-solid fa-route', when:twoSelected, run:()=>callGlobal('generateJoinPath') },
    { id:'tools.dependency', label:'INSERT / DELETE 순서', icon:'fa-solid fa-arrow-down-wide-short', run:()=>callGlobal('showDependencyOrder') },
    { id:'tools.validate', label:'ERD 검증', icon:'fa-solid fa-circle-check', run:()=>callGlobal('validateSchema') },
    { id:'tools.nplus', label:'N+1 위험 스캔', icon:'fa-solid fa-triangle-exclamation', run:()=>callGlobal('detectNPlusOneRisk') },
    { id:'tools.ai.scope', label:'현재 범위 AI Context 저장', icon:'fa-solid fa-brain', run:()=>callGlobal('exportAiScopeContext') },
    { id:'tools.ai.project', label:'전체 프로젝트 AI Context 저장', icon:'fa-solid fa-brain', run:()=>callGlobal('exportAiProjectContext') },
    { id:'tools.version.save', label:'현재 버전 저장', icon:'fa-regular fa-bookmark', run:()=>callGlobal('manualVersionSave') },
    { id:'tools.versions', label:'버전 히스토리 / Diff', icon:'fa-solid fa-clock-rotate-left', run:()=>callGlobal('openVersionHistory') },
    { id:'tools.templates', label:'SQL 템플릿 관리', icon:'fa-solid fa-file-lines', run:()=>callGlobal('openTemplateManager', false) },
    { id:'tools.templates.add', label:'사용자 SQL 템플릿 추가', icon:'fa-solid fa-plus', run:()=>callGlobal('openTemplateManager', true) },
    { id:'tools.reset', label:'저장 상태 초기화', icon:'fa-solid fa-eraser', run:()=>callGlobal('resetSavedSchema') },
    { id:'tools.performance', label:'Performance 300', icon:'fa-solid fa-gauge-high', run:()=>{
      const open = () => {
        const button = document.querySelector('.performance-test-tab');
        if (!button) return false;
        button.click();
        return true;
      };
      if (!open()) setTimeout(() => { if (!open()) A.showToast?.('성능 테스트를 아직 불러오는 중입니다.'); }, 120);
    } },

    { id:'help.shortcuts', label:'단축키', icon:'fa-regular fa-keyboard', run:showShortcuts },
    { id:'help.about', label:'ERD Studio 정보', icon:'fa-solid fa-circle-info', run:showAbout }
  ].forEach(register);

  restoreChromePrefs();

  document.addEventListener('keydown', event => {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    const shortcuts = { n:'file.new', o:'file.open', s:'file.save' };
    const actionId = shortcuts[key];
    if (!actionId) return;
    event.preventDefault();
    invoke(actionId);
  });

  E.Actions = {
    register,
    get,
    list: () => [...actions.values()],
    invoke,
    enabled,
    checked
  };

  document.dispatchEvent(new CustomEvent('erd:actions-ready'));
})();
