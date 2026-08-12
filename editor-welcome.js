/** JetBrains-like welcome hub shown only when ERD Studio has no real project content open. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  const W = P?.Workspace;
  const Actions = E?.Actions;
  if (!E || !P || !W || !Actions) throw new Error('Workspace/actions must load before welcome hub');

  let dismissed = false;

  function isBlankWorkspace() {
    if (P.state.project?.sample) return false;
    const schemas = Object.values(schemaData || {});
    if (!schemas.length) return true;
    return schemas.every(view => !(view?.tables?.length || 0) && !(view?.relations?.length || 0));
  }

  function removeWelcome() {
    document.getElementById('erd-welcome-hub')?.remove();
  }

  function sampleCards() {
    const samples = window.ERDStudioSamples?.list?.() || [];
    return samples.map(sample => {
      const icon = sample.id === 'oracle_hr' ? 'fa-solid fa-users'
        : sample.id === 'performance_300' ? 'fa-solid fa-gauge-high'
        : 'fa-solid fa-database';
      return `<button class="welcome-sample" data-welcome-sample="${E.escapeHtml(sample.id)}">
        <i class="${icon}"></i>
        <span><strong>${E.escapeHtml(sample.name)}</strong><small>${E.escapeHtml(sample.description)}</small></span>
      </button>`;
    }).join('');
  }

  function openSample(sampleId) {
    const sample = window.ERDStudioSamples?.get?.(sampleId);
    if (!sample) return;
    removeWelcome();
    dismissed = true;
    if (sample.transient) {
      requestAnimationFrame(() => Actions.invoke('tools.performance'));
      return;
    }
    W.loadSample(sampleId);
  }

  function showWelcome({ force = false } = {}) {
    if (!force && (dismissed || !isBlankWorkspace())) return false;
    removeWelcome();

    const project = P.state.project || {};
    const overlay = document.createElement('section');
    overlay.id = 'erd-welcome-hub';
    overlay.className = 'welcome-overlay';
    overlay.setAttribute('aria-label', 'ERD Studio 시작 화면');
    overlay.innerHTML = `
      <div class="welcome-card">
        <aside class="welcome-brand-panel">
          <div class="welcome-logo"><i class="fa-solid fa-diagram-project"></i></div>
          <div>
            <span class="welcome-kicker">ERD STUDIO</span>
            <h1>프로젝트를 열어<br>구조부터 파악하세요.</h1>
            <p>DDL · MyBatis · 수동 메타데이터를 하나의 프로젝트 작업공간으로 관리합니다.</p>
          </div>
          <div class="welcome-current">
            <small>현재 로컬 작업공간</small>
            <strong>${E.escapeHtml(project.name || '새 프로젝트')}</strong>
            <span>빈 스키마 · 바로 시작 가능</span>
          </div>
        </aside>

        <main class="welcome-main-panel">
          <button class="welcome-close" type="button" data-welcome-close title="빈 작업공간으로 계속"><i class="fa-solid fa-xmark"></i></button>
          <div class="welcome-heading"><span>START</span><h2>ERD Studio 시작</h2></div>
          <div class="welcome-primary-actions">
            <button class="welcome-action primary" data-welcome-action="file.new"><i class="fa-solid fa-file-circle-plus"></i><span><strong>새 프로젝트</strong><small>빈 스키마에서 시작</small></span></button>
            <button class="welcome-action" data-welcome-action="file.open"><i class="fa-regular fa-folder-open"></i><span><strong>프로젝트 열기</strong><small>.erdproject.json 선택</small></span></button>
          </div>
          <div class="welcome-import-actions">
            <button data-welcome-action="file.import.ddl"><i class="fa-solid fa-file-code"></i> DDL Import</button>
            <button data-welcome-action="file.import.mybatis"><i class="fa-solid fa-code-branch"></i> MyBatis Import</button>
          </div>
          <div class="welcome-section-head"><strong>샘플 / Benchmark</strong><span>실제 프로젝트와 분리</span></div>
          <div class="welcome-samples">${sampleCards()}</div>
          <button class="welcome-continue" type="button" data-welcome-close>빈 MAIN 작업공간으로 계속 <i class="fa-solid fa-arrow-right"></i></button>
        </main>
      </div>`;

    overlay.addEventListener('click', event => {
      const close = event.target.closest('[data-welcome-close]');
      if (close) {
        dismissed = true;
        removeWelcome();
        return;
      }
      const sample = event.target.closest('[data-welcome-sample]');
      if (sample) {
        openSample(sample.dataset.welcomeSample);
        return;
      }
      const action = event.target.closest('[data-welcome-action]');
      if (action) {
        dismissed = true;
        removeWelcome();
        Actions.invoke(action.dataset.welcomeAction);
      }
    });

    document.body.appendChild(overlay);
    return true;
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('erd-welcome-hub')) {
      dismissed = true;
      removeWelcome();
    }
  });

  // A real project opening should always dismiss the welcome layer.
  document.addEventListener('erd:workspace-changed', () => {
    if (!isBlankWorkspace()) {
      dismissed = true;
      removeWelcome();
    }
  });

  const baseOnload = window.onload;
  window.onload = function(event) {
    baseOnload?.call(window, event);
    requestAnimationFrame(() => requestAnimationFrame(() => showWelcome()));
  };

  E.Welcome = { show: () => showWelcome({ force:true }), close: removeWelcome, isBlankWorkspace };
})();
