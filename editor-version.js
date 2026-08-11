/** SQL template management, version history and schema diff. */
(() => {
  'use strict';
  const E=window.ERDEditor,A=E.Advanced;
  const STORAGE_TEMPLATES='erd_studio_sql_templates_v1',STORAGE_VERSIONS='erd_studio_versions_v1',VERSION_LIMIT=15;
  let persistTimer=null,suppress=false;

  const readTemplates=()=>{try{const v=JSON.parse(localStorage.getItem(STORAGE_TEMPLATES)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const writeTemplates=list=>{localStorage.setItem(STORAGE_TEMPLATES,JSON.stringify(list));E.renderTemplateMenu?.();};
  function openTemplateManager(add=false){
    const list=readTemplates();if(add)list.push({name:'',sql:'SELECT ${COLUMNS}\nFROM ${TABLE}\nWHERE ${PK} = :${PK};'});
    const row=t=>`<div class="template-manager-row" data-template-row><input data-name value="${E.escapeHtml(t.name)}" placeholder="템플릿 이름"><textarea data-sql spellcheck="false">${E.escapeHtml(t.sql)}</textarea><button type="button" class="editor-btn danger" data-remove>삭제</button></div>`;
    const dialog=A.ensureDialog('template-manager-dialog','사용자 SQL 템플릿 관리',`<form id="template-manager-form" class="advanced-form"><div id="template-manager-list" class="template-manager-list">${list.map(row).join('')}</div><div class="editor-dialog-actions inline-actions"><button type="button" class="editor-btn" data-add>+ 추가</button><button type="submit" class="editor-btn primary">저장</button></div></form>`,true),container=dialog.querySelector('#template-manager-list');
    dialog.querySelector('[data-add]').addEventListener('click',()=>{const w=document.createElement('div');w.innerHTML=row({name:'',sql:'SELECT ${COLUMNS}\nFROM ${TABLE};'});container.appendChild(w.firstElementChild);});
    container.addEventListener('click',e=>{if(e.target.matches('[data-remove]'))e.target.closest('[data-template-row]').remove();});
    dialog.querySelector('#template-manager-form').addEventListener('submit',e=>{e.preventDefault();const next=[...container.querySelectorAll('[data-template-row]')].map(r=>({name:r.querySelector('[data-name]').value.trim(),sql:r.querySelector('[data-sql]').value.trim()})).filter(t=>t.name&&t.sql);writeTemplates(next);dialog.close();A.showToast('SQL 템플릿을 저장했습니다.');});dialog.showModal();
  }
  window.addCustomTemplate=()=>openTemplateManager(true);

  const readVersions=()=>{try{const v=JSON.parse(localStorage.getItem(STORAGE_VERSIONS)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  function writeVersions(v){try{localStorage.setItem(STORAGE_VERSIONS,JSON.stringify(v.slice(-VERSION_LIMIT)));}catch{try{localStorage.setItem(STORAGE_VERSIONS,JSON.stringify(v.slice(-5)));}catch{}}}
  function captureVersion(label='자동 저장'){if(suppress)return;const snapshot=E.snapshot(),v=readVersions();if(v.at(-1)?.snapshot===snapshot)return;v.push({id:A.uid('ver'),ts:Date.now(),label,snapshot});writeVersions(v);}
  function scheduleVersion(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>captureVersion(),700);}
  const basePersist=E.persist;A.basePersist=basePersist;E.persist=function(){basePersist();scheduleVersion();};
  function manualVersionSave(){const label=prompt('버전 이름',`수동 저장 ${A.nowLabel()}`);if(label===null)return;captureVersion(label.trim()||'수동 저장');A.showToast('버전을 저장했습니다.');}

  function schemaDiff(a,b){
    const lines=[];
    const flat=s=>{const m=new Map();Object.entries(s||{}).forEach(([v,view])=>(view.tables||[]).forEach(t=>m.set(`${v}/${t.name}`,t)));return m;},A1=flat(a),B1=flat(b);
    [...B1.keys()].filter(k=>!A1.has(k)).sort().forEach(k=>lines.push(`+ TABLE ${k}`));[...A1.keys()].filter(k=>!B1.has(k)).sort().forEach(k=>lines.push(`- TABLE ${k}`));
    [...B1.keys()].filter(k=>A1.has(k)).sort().forEach(k=>{const ta=A1.get(k),tb=B1.get(k),ca=new Map((ta.columns||[]).map(c=>[c.name,c])),cb=new Map((tb.columns||[]).map(c=>[c.name,c]));
      [...cb.keys()].filter(n=>!ca.has(n)).forEach(n=>lines.push(`+ COLUMN ${k}.${n} ${cb.get(n).type}`));[...ca.keys()].filter(n=>!cb.has(n)).forEach(n=>lines.push(`- COLUMN ${k}.${n} ${ca.get(n).type}`));
      [...cb.keys()].filter(n=>ca.has(n)).forEach(n=>{const x=ca.get(n),y=cb.get(n);if(x.type!==y.type||!!x.pk!==!!y.pk||!!x.fk!==!!y.fk)lines.push(`~ COLUMN ${k}.${n}: ${x.type}${x.pk?' PK':''}${x.fk?' FK':''} → ${y.type}${y.pk?' PK':''}${y.fk?' FK':''}`);});if((ta.desc||'')!==(tb.desc||''))lines.push(`~ DESC ${k}: "${ta.desc||''}" → "${tb.desc||''}"`);});
    const rels=s=>new Set(Object.entries(s||{}).flatMap(([v,view])=>(view.relations||[]).map(r=>`${v}/${A.relationKey(r)}`))),ra=rels(a),rb=rels(b);[...rb].filter(x=>!ra.has(x)).forEach(x=>lines.push(`+ REL ${x}`));[...ra].filter(x=>!rb.has(x)).forEach(x=>lines.push(`- REL ${x}`));return lines.length?lines.join('\n'):'차이가 없습니다.';
  }
  function restoreVersion(ver){if(!ver||!confirm(`${ver.label} 버전으로 복원할까요?`))return;try{const parsed=JSON.parse(ver.snapshot);E.pushUndo();suppress=true;Object.keys(schemaData).forEach(k=>delete schemaData[k]);Object.assign(schemaData,E.clone(parsed));basePersist();renderTabs();currentView=Object.keys(schemaData)[0]||'';A.rerender();suppress=false;captureVersion(`복원: ${ver.label}`);A.showToast('버전을 복원했습니다.');}catch(err){suppress=false;alert(`복원 실패: ${err.message}`);}}
  function diffVersion(ver){try{E.showOutput(`Diff · ${ver.label} → 현재`,schemaDiff(JSON.parse(ver.snapshot),schemaData));}catch(err){alert(`Diff 실패: ${err.message}`);}}
  function openVersionHistory(){
    const versions=readVersions().slice().reverse(),rows=versions.length?versions.map(v=>`<div class="manager-row version-row" data-version-id="${v.id}"><div><b>${E.escapeHtml(v.label)}</b><small>${new Date(v.ts).toLocaleString('ko-KR')}</small></div><div class="manager-actions"><button class="editor-btn" data-diff>Diff</button><button class="editor-btn" data-restore>복원</button><button class="editor-btn danger" data-delete>삭제</button></div></div>`).join(''):'<div class="empty-state">저장된 버전이 없습니다.</div>';
    const dialog=A.ensureDialog('version-history-dialog','버전 히스토리',`<div class="manager-list">${rows}</div><div class="editor-dialog-actions inline-actions"><button class="editor-btn primary" data-save>현재 버전 저장</button></div>`,true);dialog.querySelector('[data-save]')?.addEventListener('click',()=>{manualVersionSave();dialog.close();});
    dialog.querySelectorAll('[data-version-id]').forEach(row=>{const id=row.dataset.versionId,v=versions.find(x=>x.id===id);row.querySelector('[data-diff]').onclick=()=>{dialog.close();diffVersion(v)};row.querySelector('[data-restore]').onclick=()=>{dialog.close();restoreVersion(v)};row.querySelector('[data-delete]').onclick=()=>{writeVersions(readVersions().filter(x=>x.id!==id));dialog.close();openVersionHistory()};});dialog.showModal();
  }
  Object.assign(window,{openTemplateManager,openVersionHistory,manualVersionSave});
  setTimeout(()=>captureVersion('로드 기준'),0);
})();
