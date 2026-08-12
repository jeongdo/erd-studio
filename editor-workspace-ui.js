/** Project-first UI: new/open/save/sample actions and an empty workspace landing state. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  const W = P?.Workspace;
  const A = E?.Advanced;
  if (!E || !P || !W || !A) throw new Error('Workspace lifecycle must load before workspace UI');

  function openNewProjectDialog() {
    if (!W.confirmReplace('현재 프로젝트를 닫고 새 프로젝트를 시작할까요?\n필요하면 먼저 현재 프로젝트를 저장하세요.')) return;
    const dialog = A.ensureDialog('workspace-new-project-dialog', '새 프로젝트', `
      <div class="workspace-new-grid">
        <label class="advanced-field"><span>프로젝트명</span><input id="workspace-project-name" value="새 프로젝트" autocomplete="off"></label>
        <label class="advanced-field"><span>기본 DBMS</span>
          <select id="workspace-project-dbms">
            <option value="oracle">Oracle</option>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="mixed">Mixed / Unknown</option>
          </select>
        </label>
        <label class="advanced-field"><span>첫 스키마명</span><input id="workspace-schema-name" value="MAIN" autocomplete="off"></label>
      </div>
      <label class="advanced-field"><span>설명 <small>선택</small></span><textarea id="workspace-project-description" rows="3" placeholder="프로젝트 설명"></textarea></label>
      <div class="workspace-new-hint"><i class="fa-solid fa-circle-info"></i> 빈 스키마 하나로 시작합니다. 이후 DDL / MyBatis Import 또는 수동 편집으로 채울 수 있습니다.</div>
      <div class="advanced-actions"><button class="editor-btn primary" data-create-project>새 프로젝트 만들기</button></div>
    `);
    dialog.querySelector('#workspace-project-dbms').value = P.state.project?.dbms || 'oracle';
    dialog.querySelector('[data-create-project]').onclick = () => {
      const name = dialog.querySelector('#workspace-project-name').value.trim() || '새 프로젝트';
      const dbms = dialog.querySelector('#workspace-project-dbms').value;
      const schemaName = dialog.querySelector('#workspace-schema-name').value.trim() || 'MAIN';
      const description = dialog.querySelector('#workspace-project-description').value.trim();
      W.createBlankProject({ name, dbms, schemaName, description });
      dialog.close();
    };
    dialog.showModal();
    setTimeout(() => dialog.querySelector('#workspace-project-name')?.select(), 0);
  }

  function openSamplesDialog() {
    const samples = window.ERDStudioSamples?.list?.() || [];
    const cards = samples.map(sample => {
      const icon = sample.id === 'oracle_hr' ? 'fa-solid fa-users'
        : sample.id === 'performance_300' ? 'fa-solid fa-gauge-high'
        : 'fa-solid fa-database';
      const badge = sample.transient ? '<em>임시 벤치마크</em>' : '<em>프로젝트 샘플</em>';
      return `<button class="workspace-sample-card" data-sample-id="${E.escapeHtml(sample.id)}">
        <span class="workspace-sample-icon"><i class="${icon}"></i></span>
        <span class="workspace-sample-copy"><strong>${E.escapeHtml(sample.name)}</strong><small>${E.escapeHtml(sample.description)}</small>${badge}</span>
        <i class="fa-solid fa-chevron-right workspace-sample-arrow"></i>
      </button>`;
    }).join('');
    const dialog = A.ensureDialog('workspace-samples-dialog', '샘플 / 성능 테스트', `
      <div class="workspace-samples-intro">샘플은 실제 작업 프로젝트와 분리되어 있습니다. Oracle 샘플은 새 작업공간으로 열리고, Performance 300은 현재 프로젝트를 건드리지 않는 임시 벤치마크입니다.</div>
      <div class="workspace-sample-list">${cards}</div>
    `, true);
    dialog.querySelectorAll('[data-sample-id]').forEach(button => {
      button.onclick = () => {
        const id = button.dataset.sampleId;
        const sample = window.ERDStudioSamples?.get?.(id);
        if (!sample) return;
        if (sample.transient) {
          dialog.close();
          const performance = document.querySelector('.performance-test-tab');
          if (performance) performance.click();
          else A.showToast('성능 테스트 모듈을 아직 불러오는 중입니다.');
          return;
        }
        if (!W.confirmReplace(`${sample.name} 샘플을 새 작업공간으로 열까요?\n현재 프로젝트는 교체됩니다.`)) return;
        W.loadSample(id);
        dialog.close();
      };
    });
    dialog.showModal();
  }

  function makeDockButton(attr, title, icon, handler) {
    const button = document.createElement('button');
    button.className = 'dock-icon-btn workspace-dock-action';
    button.setAttribute(attr, 'true');
    button.title = title;
    button.innerHTML = `<i class="${icon}"></i>`;
    button.onclick = handler;
    return button;
  }

  function installDockActions() {
    const rail = document.querySelector('.erd-project-dock-rail');
    const open = rail?.querySelector('[data-project-open]');
    if (!rail || !open) return false;

    if (!rail.querySelector('[data-project-new]')) {
      rail.insertBefore(makeDockButton('data-project-new', '새 프로젝트', 'fa-solid fa-plus', openNewProjectDialog), open);
    }
    if (!rail.querySelector('[data-project-samples]')) {
      rail.insertBefore(makeDockButton('data-project-samples', '샘플 / 성능 테스트', 'fa-solid fa-flask', openSamplesDialog), open);
    }
    open.onclick = W.openProjectFile;
    return true;
  }

  function installToolsActions() {
    const popover = document.querySelector('.editor-tools-popover');
    const projectLabel = popover?.querySelector('[data-project-tools]');
    if (!popover || !projectLabel) return false;

    if (!popover.querySelector('[data-workspace-new]')) {
      const newButton = document.createElement('button');
      newButton.dataset.workspaceNew = 'true';
      newButton.innerHTML = '<i class="fa-solid fa-plus"></i> 새 프로젝트';
      newButton.onclick = openNewProjectDialog;
      projectLabel.insertAdjacentElement('afterend', newButton);

      const samplesButton = document.createElement('button');
      samplesButton.dataset.workspaceSamples = 'true';
      samplesButton.innerHTML = '<i class="fa-solid fa-flask"></i> 샘플 / 성능 테스트';
      samplesButton.onclick = openSamplesDialog;
      newButton.insertAdjacentElement('afterend', samplesButton);
    }

    [...popover.querySelectorAll('button')].forEach(button => {
      if (button.textContent.trim() === '프로젝트 파일 열기') button.onclick = W.openProjectFile;
    });
    return true;
  }

  function emptyStateVisible() {
    const view = E.currentSchema?.();
    return !!view && !(view.tables?.length || 0) && !String(currentView || '').startsWith('__performance');
  }

  function ensureEmptyState() {
    let panel = document.getElementById('erd-workspace-empty');
    if (!emptyStateVisible()) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'erd-workspace-empty';
      panel.className = 'workspace-empty-state';
      workspace.appendChild(panel);
    }
    const project = P.state.project || {};
    const schema = schemaData[currentView] || {};
    panel.innerHTML = `
      <div class="workspace-empty-mark"><i class="fa-solid fa-diagram-project"></i></div>
      <span class="workspace-empty-kicker">EMPTY SCHEMA</span>
      <h2>${E.escapeHtml(project.name || '새 프로젝트')}</h2>
      <p><b>${E.escapeHtml(schema.tabName || currentView || 'MAIN')}</b> 스키마가 비어 있습니다. 원하는 방식으로 구조를 시작하세요.</p>
      <div class="workspace-empty-actions">
        <button class="editor-btn primary" data-empty-table><i class="fa-solid fa-plus"></i> 테이블 추가</button>
        <button class="editor-btn" data-empty-ddl><i class="fa-solid fa-file-code"></i> DDL Import</button>
        <button class="editor-btn" data-empty-mybatis><i class="fa-solid fa-code-branch"></i> MyBatis Import</button>
        <button class="editor-btn" data-empty-sample><i class="fa-solid fa-flask"></i> 샘플 보기</button>
      </div>`;
    panel.querySelector('[data-empty-table]').onclick = () => window.openTableDialog?.();
    panel.querySelector('[data-empty-ddl]').onclick = () => window.openDdlImportDialog?.();
    panel.querySelector('[data-empty-mybatis]').onclick = () => window.openMyBatisImport?.();
    panel.querySelector('[data-empty-sample]').onclick = openSamplesDialog;
  }

  function refreshUi() {
    installDockActions();
    installToolsActions();
    ensureEmptyState();
  }

  const observer = new MutationObserver(() => requestAnimationFrame(ensureEmptyState));
  observer.observe(cardsContainer, { childList: true });

  document.addEventListener('erd:workspace-changed', () => requestAnimationFrame(refreshUi));
  document.addEventListener('erd:project-loaded', () => requestAnimationFrame(refreshUi));
  document.addEventListener('erd:project-info-changed', () => requestAnimationFrame(ensureEmptyState));

  const baseOnload = window.onload;
  window.onload = function(event) {
    baseOnload?.call(window, event);
    requestAnimationFrame(() => requestAnimationFrame(refreshUi));
  };

  E.WorkspaceUI = { openNewProjectDialog, openSamplesDialog, refresh: refreshUi };
  Object.assign(window, { openNewProjectDialog, openSamplesDialog });
})();