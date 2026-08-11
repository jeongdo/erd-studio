/** Multi-DB DDL import/export and JSON backup/restore. */
(() => {
  'use strict';
  const E = window.ERDEditor, A = E.Advanced;

  function typeForDb(type, db) {
    let t = String(type || 'VARCHAR2(100)').toUpperCase().trim();
    if (db === 'oracle') return t;
    if (db === 'postgres') {
      t = t.replace(/VARCHAR2/g, 'VARCHAR').replace(/NVARCHAR2/g, 'VARCHAR').replace(/CLOB/g, 'TEXT').replace(/BLOB/g, 'BYTEA').replace(/RAW\s*\((\d+)\)/g, 'BYTEA');
      t = t.replace(/NUMBER\s*\((\d+)\s*,\s*(\d+)\)/g, 'NUMERIC($1,$2)').replace(/NUMBER\s*\((\d+)\)/g, 'NUMERIC($1)').replace(/^NUMBER$/g, 'NUMERIC');
      if (t === 'DATE') t = 'TIMESTAMP'; return t;
    }
    if (db === 'mysql') {
      t = t.replace(/VARCHAR2/g, 'VARCHAR').replace(/NVARCHAR2/g, 'VARCHAR').replace(/CLOB/g, 'LONGTEXT').replace(/BLOB/g, 'LONGBLOB').replace(/RAW\s*\((\d+)\)/g, 'VARBINARY($1)');
      t = t.replace(/NUMBER\s*\((\d+)\s*,\s*(\d+)\)/g, 'DECIMAL($1,$2)').replace(/NUMBER\s*\((\d+)\)/g, 'DECIMAL($1)').replace(/^NUMBER$/g, 'DECIMAL(38,10)');
      if (t === 'DATE') t = 'DATETIME'; return t;
    }
    return t;
  }

  function generateSchemaDdl(db = 'oracle') {
    const view = A.view();
    const tables = view.tables.map(t => {
      const pk = t.columns.filter(c => c.pk).map(c => c.name);
      const defs = t.columns.map(c => `    ${c.name.padEnd(28)} ${typeForDb(c.type, db)}`);
      if (pk.length) defs.push(`    CONSTRAINT PK_${t.name} PRIMARY KEY (${pk.join(', ')})`);
      return `CREATE TABLE ${t.name} (\n${defs.join(',\n')}\n);`;
    });
    const fks = (view.relations || []).map((r, i) => {
      const parent = E.columnArray(r.fromCol), child = E.columnArray(r.toCol);
      const name = `FK_${r.to}_${r.from}_${i + 1}`.slice(0, db === 'oracle' ? 30 : 63);
      return `ALTER TABLE ${r.to}\n    ADD CONSTRAINT ${name} FOREIGN KEY (${child.join(', ')})\n    REFERENCES ${r.from} (${parent.join(', ')});`;
    });
    return `-- ERD Studio · ${db.toUpperCase()} DDL · ${A.nowLabel()}\n\n${[...tables, ...fks].join('\n\n')}`;
  }
  function exportDdl(db = 'oracle') { E.showOutput(`${db.toUpperCase()} DDL`, generateSchemaDdl(db)); }

  function splitTopLevel(text) {
    const out=[]; let depth=0, quote=null, start=0;
    for(let i=0;i<text.length;i++){
      const ch=text[i]; if(quote){if(ch===quote&&text[i-1]!=='\\')quote=null;continue;}
      if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;} if(ch==='(')depth++; else if(ch===')')depth--; else if(ch===','&&depth===0){out.push(text.slice(start,i).trim());start=i+1;}
    }
    out.push(text.slice(start).trim()); return out.filter(Boolean);
  }
  function matchingParen(text, open){let d=0,q=null;for(let i=open;i<text.length;i++){const ch=text[i];if(q){if(ch===q&&text[i-1]!=='\\')q=null;continue;}if(ch==="'"||ch==='"'||ch==='`'){q=ch;continue;}if(ch==='(')d++;if(ch===')'&&--d===0)return i;}return-1;}
  function createBlocks(ddl){const out=[],re=/CREATE\s+TABLE\s+([^\s(]+)\s*\(/ig;let m;while((m=re.exec(ddl))){const open=ddl.indexOf('(',m.index),close=matchingParen(ddl,open);if(close<0)continue;out.push({name:A.normalizeName(m[1]),body:ddl.slice(open+1,close)});re.lastIndex=close+1;}return out;}

  function parseDdl(ddl) {
    const tables=[], pending=[];
    createBlocks(ddl).forEach((block,index)=>{
      const columns=[], tablePk=new Set(), localFks=[];
      splitTopLevel(block.body).forEach(item=>{
        const clean=item.trim().replace(/^CONSTRAINT\s+[^\s]+\s+/i,''); let m;
        if((m=clean.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i))){A.csvNames(m[1]).forEach(c=>tablePk.add(c));return;}
        if((m=clean.match(/^FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i))){localFks.push({childCols:A.csvNames(m[1]),parent:A.normalizeName(m[2]),parentCols:A.csvNames(m[3])});return;}
        if(/^(UNIQUE|CHECK|KEY\s|INDEX\s)/i.test(clean))return;
        const cm=item.match(/^\s*["`]?([A-Za-z0-9_$#]+)["`]?\s+(.+)$/s);if(!cm)return;
        const name=A.normalizeName(cm[1]),rest=cm[2].trim();
        const at=rest.search(/\s+(?:CONSTRAINT\b|PRIMARY\s+KEY\b|REFERENCES\b|NOT\s+NULL\b|NULL\b|DEFAULT\b|UNIQUE\b|CHECK\b|GENERATED\b|AUTO_INCREMENT\b)/i);
        const type=(at>=0?rest.slice(0,at):rest).trim().replace(/,$/,'')||'VARCHAR2(100)';
        const pk=/\bPRIMARY\s+KEY\b/i.test(rest),ref=rest.match(/\bREFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i);
        columns.push({name,type:type.toUpperCase(),pk,fk:!!ref});if(ref)localFks.push({childCols:[name],parent:A.normalizeName(ref[1]),parentCols:A.csvNames(ref[2])});
      });
      columns.forEach(c=>{if(tablePk.has(c.name))c.pk=true;});localFks.forEach(f=>f.childCols.forEach(n=>{const c=columns.find(x=>x.name===n);if(c)c.fk=true;}));
      tables.push({id:block.name,name:block.name,desc:'DDL Import',x:80+(index%3)*500,y:80+Math.floor(index/3)*380,columns});
      localFks.forEach(f=>pending.push({from:f.parent,fromCol:f.parentCols.length===1?f.parentCols[0]:f.parentCols,to:block.name,toCol:f.childCols.length===1?f.childCols[0]:f.childCols,identifying:f.childCols.every(c=>tablePk.has(c)),cardinality:'1 : N'}));
    });
    const alter=/ALTER\s+TABLE\s+([^\s]+)[\s\S]*?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/ig;let m;
    while((m=alter.exec(ddl)))pending.push({from:A.normalizeName(m[3]),fromCol:A.csvNames(m[4]).length===1?A.csvNames(m[4])[0]:A.csvNames(m[4]),to:A.normalizeName(m[1]),toCol:A.csvNames(m[2]).length===1?A.csvNames(m[2])[0]:A.csvNames(m[2]),identifying:false,cardinality:'1 : N'});
    return {tables,relations:[...new Map(pending.map(r=>[A.relationKey(r),r])).values()]};
  }

  function openDdlImportDialog() {
    const dialog=A.ensureDialog('ddl-import-dialog','DDL Import',`<form id="ddl-import-form" class="advanced-form"><div class="editor-field"><label>Import 모드</label><select id="ddl-import-mode"><option value="replace">현재 탭 교체</option><option value="append">현재 탭에 추가</option></select></div><div class="editor-field"><label>CREATE TABLE / ALTER TABLE DDL</label><textarea id="ddl-import-text" class="advanced-code-input" placeholder="CREATE TABLE ..."></textarea><small>Oracle / PostgreSQL / MySQL 일반 CREATE TABLE, PK, FK, REFERENCES 구문 지원</small></div><div class="editor-dialog-actions inline-actions"><button type="button" class="editor-btn" data-cancel>취소</button><button type="submit" class="editor-btn primary">ERD로 가져오기</button></div></form>`,true);
    dialog.querySelector('[data-cancel]').addEventListener('click',()=>dialog.close());
    dialog.querySelector('#ddl-import-form').addEventListener('submit',e=>{
      e.preventDefault();const parsed=parseDdl(dialog.querySelector('#ddl-import-text').value),mode=dialog.querySelector('#ddl-import-mode').value;if(!parsed.tables.length)return alert('CREATE TABLE 구문을 찾지 못했습니다.');const view=A.view();
      A.mutate(`DDL에서 ${parsed.tables.length}개 테이블을 가져왔습니다.`,()=>{
        if(mode==='replace'){const names=new Set(parsed.tables.map(t=>t.name));view.tables=parsed.tables;view.relations=parsed.relations.filter(r=>names.has(r.from)&&names.has(r.to));view.notes=[];view.groups=[];}
        else{const existing=new Set(view.tables.map(t=>t.name)),added=parsed.tables.filter(t=>!existing.has(t.name)),offset=view.tables.length;added.forEach((t,i)=>{t.x=80+((offset+i)%3)*500;t.y=80+Math.floor((offset+i)/3)*380;});view.tables.push(...added);const all=new Set(view.tables.map(t=>t.name)),keys=new Set((view.relations||[]).map(A.relationKey));parsed.relations.filter(r=>all.has(r.from)&&all.has(r.to)&&!keys.has(A.relationKey(r))).forEach(r=>view.relations.push(r));}
      });dialog.close();validateSchema?.();
    });dialog.showModal();
  }

  function downloadText(name,text,mime='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  function exportSchemaJson(){downloadText(`erd-studio-${Date.now()}.json`,JSON.stringify(schemaData,null,2),'application/json;charset=utf-8');}
  function importSchemaJson(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{const f=input.files?.[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('invalid root');E.pushUndo();Object.keys(schemaData).forEach(k=>delete schemaData[k]);Object.assign(schemaData,E.clone(parsed));E.persist();renderTabs();currentView=Object.keys(schemaData)[0]||'';A.rerender();A.showToast('JSON 스키마를 가져왔습니다.');}catch(err){alert(`JSON Import 실패: ${err.message}`);}});input.click();}

  Object.assign(E,{generateSchemaDdl,parseDdl});
  Object.assign(window,{exportDdl,openDdlImportDialog,exportSchemaJson,importSchemaJson});
})();
