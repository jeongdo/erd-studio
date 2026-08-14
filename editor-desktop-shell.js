/** Desktop application shell: canonical menu bar and common command routing. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const Actions = E?.Actions;
  if (!E || !Actions) throw new Error('Action registry must load before desktop shell');

  const menus = [
    {
      id:'file', label:'파일', groups:[
        ['file.new','file.open','file.save'],
        ['file.samples','file.settings'],
        ['file.import.ddl','file.import.json'],
        ['file.export.ddl.oracle','file.export.ddl.postgres','file.export.ddl.mysql'],
        ['file.export.json','file.export.png','file.export.svg'],
        ['file.export.spec.md','file.export.spec.csv','file.export.spec.xls']
      ], groupLabels:['', '', '가져오기', 'DDL 내보내기', '파일 내보내기', '명세 내보내기']
    },
    {
      id:'edit', label:'편집', groups:[
        ['edit.undo','edit.redo'],
        ['edit.table.add','edit.duplicate','edit.delete','edit.color'],
        ['edit.relation.manage','edit.relation.link'],
        ['edit.note.add','edit.subjectArea.canvas']
      ], groupLabels:['', '테이블', '관계', '캔버스']
    },
    {
      id:'view', label:'보기', groups:[
        ['view.inspector','view.fit'],
        ['view.layout.grid','view.layout.tree','view.layout.organic'],
        ['view.minimap','view.legend','view.relationFocus'],
        ['view.theme.cyber','view.theme.slate','view.theme.charcoal','view.theme.gold','view.theme.paper']
      ], groupLabels:['', '레이아웃', '표시', '테마']
    },
    {
      id:'tools', label:'도구', groups:[
        ['tools.code.java','tools.code.kotlin','tools.code.typescript'],
        ['tools.impact','tools.lineage','tools.transactionScope'],
        ['tools.join','tools.joinPath','tools.dependency'],
        ['tools.validate','tools.nplus','tools.diagnostics'],
        ['tools.ai.scope','tools.ai.project'],
        ['tools.version.save','tools.versions','tools.templates.add','tools.templates'],
        ['tools.performance'],
        ['tools.reset']
      ], groupLabels:['코드 생성', '영향 분석', 'SQL / 관계', '검증', 'AI Context', '프로젝트 도구', 'Benchmark', 'Maintenance']
    },
    {
      id:'help', label:'도움말', groups:[['help.shortcuts','help.about']]
    }
  ];

  let shell = null;
  let openMenuId = null;

  function actionRow(id) {
    const action = Actions.get(id);
    if (!action) return '';
    const isEnabled = Actions.enabled(action);
    const isChecked = Actions.checked(action);
    return `<button type="button" class="desktop-menu-item${isChecked ? ' checked' : ''}" data-action-id="${E.escapeHtml(id)}" ${isEnabled ? '' : 'disabled'}>
      <span class="desktop-menu-icon">${isChecked ? '<i class="fa-solid fa-check"></i>' : action.icon ? `<i class="${E.escapeHtml(action.icon)}"></i>` : ''}</span>
      <span class="desktop-menu-label">${E.escapeHtml(action.label)}</span>
      ${action.shortcut ? `<kbd>${E.escapeHtml(action.shortcut)}</kbd>` : ''}
    </button>`;
  }

  function menuMarkup(menu) {
    return `<div class="desktop-menu" data-desktop-menu="${menu.id}">
      <button type="button" class="desktop-menu-trigger" aria-haspopup="menu" aria-expanded="false">${E.escapeHtml(menu.label)}</button>
      <div class="desktop-menu-popup" role="menu">
        ${menu.groups.map((group, index) => `${index ? '<div class="desktop-menu-separator"></div>' : ''}${menu.groupLabels?.[index] ? `<div class="desktop-menu-section">${E.escapeHtml(menu.groupLabels[index])}</div>` : ''}${group.map(actionRow).join('')}`).join('')}
      </div>
    </div>`;
  }

  function closeMenus() {
    openMenuId = null;
    shell?.querySelectorAll('.desktop-menu.open').forEach(menu => {
      menu.classList.remove('open');
      menu.querySelector('.desktop-menu-trigger')?.setAttribute('aria-expanded','false');
    });
  }

  function refreshMenuStates() {
    shell?.querySelectorAll('[data-action-id]').forEach(button => {
      const action = Actions.get(button.dataset.actionId);
      if (!action) return;
      button.disabled = !Actions.enabled(action);
      button.classList.toggle('checked', Actions.checked(action));
      const icon = button.querySelector('.desktop-menu-icon');
      if (icon) icon.innerHTML = Actions.checked(action)
        ? '<i class="fa-solid fa-check"></i>'
        : action.icon ? `<i class="${E.escapeHtml(action.icon)}"></i>` : '';
    });
  }

  function toggleMenu(menuElement) {
    const id = menuElement.dataset.desktopMenu;
    const opening = openMenuId !== id;
    closeMenus();
    if (!opening) return;
    refreshMenuStates();
    menuElement.classList.add('open');
    menuElement.querySelector('.desktop-menu-trigger')?.setAttribute('aria-expanded','true');
    openMenuId = id;
  }

  function installMenuBar() {
    const header = document.querySelector('header');
    const brand = header?.querySelector('.brand');
    if (!header || !brand) return false;

    document.body.classList.add('erd-desktop-shell');
    header.classList.add('desktop-app-header');

    shell = header.querySelector('.desktop-menu-bar');
    if (!shell) {
      shell = document.createElement('nav');
      shell.className = 'desktop-menu-bar';
      shell.setAttribute('aria-label','응용 프로그램 메뉴');
      shell.innerHTML = menus.map(menuMarkup).join('');
      brand.insertAdjacentElement('afterend', shell);

      shell.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-action-id]');
        if (actionButton) {
          event.preventDefault();
          if (!actionButton.disabled) Actions.invoke(actionButton.dataset.actionId);
          closeMenus();
          return;
        }
        const trigger = event.target.closest('.desktop-menu-trigger');
        if (trigger) {
          event.preventDefault();
          toggleMenu(trigger.closest('.desktop-menu'));
        }
      });

      shell.addEventListener('pointerover', event => {
        if (!openMenuId) return;
        const menu = event.target.closest('.desktop-menu');
        if (menu && menu.dataset.desktopMenu !== openMenuId) toggleMenu(menu);
      });
    }
    return true;
  }

  function cleanFragmentedCommonActions() {
    document.querySelectorAll([
      '[data-project-new]', '[data-project-samples]', '[data-project-open]', '[data-project-save]',
      '[data-project-settings-explicit]', '[data-project-settings]', '[data-ai-context-export]'
    ].join(',')).forEach(node => node.remove());
    document.querySelector('.editor-tools-menu')?.setAttribute('data-desktop-replaced','true');
    document.getElementById('theme-select')?.setAttribute('data-desktop-replaced','true');
  }

  function updateWindowTitle() {
    const project = E.Project?.state?.project;
    document.title = `${project?.name || '새 프로젝트'} — ERD Studio`;
  }

  function refresh() {
    installMenuBar();
    cleanFragmentedCommonActions();
    refreshMenuStates();
    updateWindowTitle();
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.desktop-menu-bar')) closeMenus();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenus();
  });
  document.addEventListener('erd:workspace-changed', () => requestAnimationFrame(refresh));
  document.addEventListener('erd:project-loaded', () => requestAnimationFrame(refresh));
  document.addEventListener('erd:project-info-changed', () => requestAnimationFrame(refresh));
  document.addEventListener('erd:action-invoked', () => requestAnimationFrame(refreshMenuStates));
  document.addEventListener('erd:table-visibility-changed', () => requestAnimationFrame(refreshMenuStates));

  const observer = new MutationObserver(() => requestAnimationFrame(cleanFragmentedCommonActions));
  const startObserver = () => {
    const dock = document.getElementById('erd-project-dock');
    if (dock) observer.observe(dock, { childList:true, subtree:true });
  };

  const baseOnload = window.onload;
  window.onload = function(event) {
    baseOnload?.call(window, event);
    refresh();
    startObserver();
  };

  refresh();
  E.DesktopShell = { refresh, closeMenus, menus };
})();
