/** UI glue: output drawer and right-click context menus. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  let contextTargetId = null;

  E.showOutput = (title, content) => {
    const panel = document.getElementById('editor-output');
    document.getElementById('editor-output-title').textContent = title;
    document.getElementById('editor-output-code').textContent = content;
    panel.classList.add('open');
  };

  function closeOutput(){document.getElementById('editor-output').classList.remove('open');E.clearAnalysisFocus?.()}
  function copyEditorOutput(){navigator.clipboard.writeText(document.getElementById('editor-output-code').textContent||'')}
  function hideContextMenu(){document.getElementById('editor-context-menu')?.classList.remove('open')}

  function showContextMenu(event,id=null){
    event.preventDefault(); contextTargetId=id;
    if(id&&!E.selectedIds.has(id))E.selectOnly(id);
    const menu=document.getElementById('editor-context-menu'),multi=E.selectedIds.size===2;
    menu.innerHTML=id?`
      <button data-action="inspect">인스펙트</button>
      <button data-action="edit">테이블 편집</button>
      <button data-action="duplicate">복제</button>
      <div class="context-separator"></div>
      ${['SELECT','INSERT','UPDATE','DELETE','MERGE'].map(a=>`<button data-sql="${a}">${a} SQL</button>`).join('')}
      <div class="context-separator"></div>
      <button data-action="join" ${multi?'':'disabled'}>선택 2개 JOIN SQL</button>
      <button data-action="path" ${multi?'':'disabled'}>Join Path Finder</button>
      <div class="context-separator"></div>
      <button class="danger" data-action="delete">삭제</button>`:
      `<button data-action="add">새 테이블 추가</button><button data-action="clear">분석 포커스 해제</button>`;
    menu.style.left=`${Math.min(event.clientX,innerWidth-230)}px`;menu.style.top=`${Math.min(event.clientY,innerHeight-360)}px`;menu.classList.add('open');
  }

  function contextAction(event){
    const btn=event.target.closest('button');if(!btn||btn.disabled)return;hideContextMenu();
    if(btn.dataset.sql){const table=E.findTable(contextTargetId);if(table)E.showOutput(`${table.name} · ${btn.dataset.sql}`,E.sqlForTable(table,btn.dataset.sql));return;}
    const action=btn.dataset.action;
    if(action==='add')openTableDialog();
    else if(action==='edit')openTableDialog(contextTargetId);
    else if(action==='duplicate')duplicateSelected();
    else if(action==='delete')deleteSelected();
    else if(action==='join')generateJoinForSelected();
    else if(action==='path')generateJoinPath();
    else if(action==='inspect'){const t=E.findTable(contextTargetId);if(t)selectTable(t)}
    else if(action==='clear')E.clearAnalysisFocus?.();
  }

  document.getElementById('editor-context-menu')?.addEventListener('click',contextAction);
  document.getElementById('template-list')?.addEventListener('click',event=>{const b=event.target.closest('[data-template-index]');if(b)E.applyTemplate(Number(b.dataset.templateIndex))});
  cardsContainer.addEventListener('contextmenu',event=>{const card=event.target.closest('.table-card');if(!card)return;event.stopPropagation();showContextMenu(event,card.id.replace(/^card-/,''))});
  workspace.addEventListener('contextmenu',event=>{if(!event.target.closest('.table-card'))showContextMenu(event,null)});
  document.addEventListener('click',event=>{if(!event.target.closest('#editor-context-menu'))hideContextMenu()});
  E.renderTemplateMenu?.();

  Object.assign(window,{closeOutput,copyEditorOutput});
})();
