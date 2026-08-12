/** Small UX correction for the project dock: project name is context, not an action. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  if (!P) return;

  function install() {
    const dock = document.getElementById('erd-project-dock');
    if (!dock) return false;

    const projectButton = dock.querySelector('[data-project-settings]');
    if (projectButton && !dock.querySelector('[data-project-display]')) {
      const display = document.createElement('div');
      display.className = 'dock-project-main dock-project-display';
      display.dataset.projectDisplay = 'true';
      display.setAttribute('aria-label', '현재 프로젝트');
      display.innerHTML = projectButton.innerHTML;
      projectButton.replaceWith(display);
    }

    if (!dock.querySelector('[data-project-settings-explicit]')) {
      const button = document.createElement('button');
      button.className = 'dock-icon-btn';
      button.dataset.projectSettingsExplicit = 'true';
      button.title = '프로젝트 설정';
      button.setAttribute('aria-label', '프로젝트 설정');
      button.innerHTML = '<i class="fa-solid fa-gear"></i>';
      button.onclick = () => P.editInfo();

      const openButton = dock.querySelector('[data-project-open]');
      if (openButton) openButton.before(button);
      else dock.querySelector('.erd-project-dock-rail')?.appendChild(button);
    }

    return true;
  }

  function installWhenReady() {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 20) clearInterval(timer);
    }, 50);
  }

  document.addEventListener('erd:project-loaded', installWhenReady);
  window.addEventListener('load', installWhenReady, { once: true });
  installWhenReady();
})();
