/** Add selectable relation router actions to the desktop menus without coupling them to the shell core. */
(() => {
  'use strict';
  const E=window.ERDEditor, Actions=E?.Actions;
  if(!E||!Actions)return;

  const escape=value=>E.escapeHtml?E.escapeHtml(value):String(value);
  function row(id){const action=Actions.get(id);if(!action)return'';const checked=Actions.checked(action);return `<button type="button" class="desktop-menu-item${checked?' checked':''}" data-action-id="${escape(id)}"><span class="desktop-menu-icon">${checked?'<i class="fa-solid fa-check"></i>':`<i class="${escape(action.icon||'fa-solid fa-route')}"></i>`}</span><span class="desktop-menu-label">${escape(action.label)}</span></button>`;}
  function install(){
    const view=document.querySelector('[data-desktop-menu="view"] .desktop-menu-popup');
    if(view&&!view.querySelector('[data-router-menu-section]')){const block=document.createElement('div');block.dataset.routerMenuSection='1';block.innerHTML=`<div class="desktop-menu-separator"></div><div class="desktop-menu-section">관계선 라우팅</div>${['view.router.auto','view.router.direct','view.router.corridor','view.router.astar'].map(row).join('')}`;view.append(...block.childNodes);}
    const tools=document.querySelector('[data-desktop-menu="tools"] .desktop-menu-popup');
    if(tools&&!tools.querySelector('[data-router-benchmark]')){const block=document.createElement('div');block.dataset.routerBenchmark='1';block.innerHTML=`<div class="desktop-menu-separator"></div><div class="desktop-menu-section">Routing Benchmark</div>${row('tools.routerBenchmark')}`;tools.append(...block.childNodes);}
  }
  requestAnimationFrame(install);
  document.addEventListener('erd:workspace-changed',()=>requestAnimationFrame(install));
})();
