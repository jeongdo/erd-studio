/** SQL/code/export tools for ERD Studio. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const STORAGE_TEMPLATES = 'erd_studio_sql_templates_v1';

  function mockValue(col, i = 0) {
    const t = col.type.toUpperCase();
    if (col.pk && /(NUMBER|INT|DECIMAL)/.test(t)) return String(i + 1);
    if (/TIMESTAMP/.test(t)) return 'SYSTIMESTAMP';
    if (/DATE/.test(t)) return 'SYSDATE';
    if (/CHAR|CLOB|TEXT/.test(t)) return `'${col.name.toLowerCase()}_sample'`;
    if (/NUMBER|INT|DECIMAL|FLOAT|DOUBLE/.test(t)) return col.pk ? String(i + 1) : '100';
    return 'NULL';
  }

  E.sqlForTable = (table, action) => {
    const cols = table.columns, names = cols.map(c => c.name);
    const pk = cols.find(c => c.pk) || cols[0], nonPk = cols.filter(c => c !== pk);
    const where = pk ? `${pk.name} = ${mockValue(pk)}` : '1 = 1';
    if (action === 'SELECT') return `SELECT\n    ${names.join(',\n    ')}\nFROM ${table.name}\nWHERE ${where};`;
    if (action === 'INSERT') return `INSERT INTO ${table.name} (\n    ${names.join(',\n    ')}\n) VALUES (\n    ${cols.map(mockValue).join(',\n    ')}\n);`;
    if (action === 'UPDATE') return `UPDATE ${table.name}\nSET\n    ${nonPk.map((c,i)=>`${c.name} = ${mockValue(c,i)}`).join(',\n    ')}\nWHERE ${where};`;
    if (action === 'DELETE') return `DELETE FROM ${table.name}\nWHERE ${where};`;
    if (action === 'MERGE') return `MERGE INTO ${table.name} T\nUSING (SELECT ${cols.map((c,i)=>`${mockValue(c,i)} AS ${c.name}`).join(', ')} FROM DUAL) S\nON (T.${pk.name} = S.${pk.name})\nWHEN MATCHED THEN UPDATE SET\n    ${nonPk.map(c=>`T.${c.name} = S.${c.name}`).join(',\n    ')}\nWHEN NOT MATCHED THEN INSERT (${names.join(', ')})\nVALUES (${names.map(n=>`S.${n}`).join(', ')});`;
    return '';
  };

  function camel(name) { return name.toLowerCase().replace(/_([a-z0-9])/g, (_,c)=>c.toUpperCase()); }
  function pascal(name) { const c=camel(name); return c.charAt(0).toUpperCase()+c.slice(1); }
  function javaType(type) {
    const t=type.toUpperCase();
    if (/DATE|TIMESTAMP/.test(t)) return 'LocalDateTime';
    if (/NUMBER\([^,]+,\s*\d+\)|DECIMAL|FLOAT|DOUBLE/.test(t)) return 'BigDecimal';
    if (/NUMBER|INT/.test(t)) return 'Long';
    if (/BLOB|RAW/.test(t)) return 'byte[]';
    return 'String';
  }

  function generateCode(language='java') {
    const table=E.findTable(E.primarySelectedId());
    if (!table) return alert('테이블을 먼저 선택하세요.');
    let code='';
    if (language==='typescript') {
      code=`export interface ${pascal(table.name)}Dto {\n${table.columns.map(c=>`  ${camel(c.name)}: ${/NUMBER|INT|DECIMAL|FLOAT|DOUBLE/.test(c.type)?'number':/DATE|TIMESTAMP/.test(c.type)?'Date':'string'};`).join('\n')}\n}`;
    } else if (language==='kotlin') {
      code=`data class ${pascal(table.name)}Dto(\n${table.columns.map((c,i)=>`    val ${camel(c.name)}: ${javaType(c.type)}${i<table.columns.length-1?',':''}`).join('\n')}\n)`;
    } else {
      const className=`${pascal(table.name)}Dto`;
      const fields=table.columns.map(c=>`    private ${javaType(c.type)} ${camel(c.name)};`).join('\n');
      const methods=table.columns.map(c=>{const type=javaType(c.type), prop=camel(c.name), m=pascal(c.name);return `    public ${type} get${m}() { return ${prop}; }\n    public void set${m}(${type} ${prop}) { this.${prop} = ${prop}; }`;}).join('\n\n');
      code=`public class ${className} {\n${fields}\n\n    public ${className}() {}\n\n${methods}\n}`;
    }
    E.showOutput(`${table.name} ${language.toUpperCase()} DTO`,code);
  }

  const defaults=[
    {name:'SELECT TOP 10',sql:'SELECT ${COLUMNS}\nFROM ${TABLE}\nFETCH FIRST 10 ROWS ONLY;'},
    {name:'COUNT',sql:'SELECT COUNT(*) AS CNT\nFROM ${TABLE};'},
    {name:'PK LOOKUP',sql:'SELECT ${COLUMNS}\nFROM ${TABLE}\nWHERE ${PK} = :${PK};'},
    {name:'ORDER BY DESC',sql:'SELECT ${COLUMNS}\nFROM ${TABLE}\nORDER BY ${PK} DESC;'}
  ];
  function customTemplates(){try{return JSON.parse(localStorage.getItem(STORAGE_TEMPLATES)||'[]')}catch{return[]}}
  E.renderTemplateMenu=()=>{
    const el=document.getElementById('template-list'); if(!el)return;
    el.innerHTML=[...defaults,...customTemplates()].map((t,i)=>`<button type="button" data-template-index="${i}">${E.escapeHtml(t.name)}</button>`).join('');
  };
  E.applyTemplate=index=>{
    const table=E.findTable(E.primarySelectedId()); if(!table)return alert('테이블을 먼저 선택하세요.');
    const t=[...defaults,...customTemplates()][index]; if(!t)return;
    const pk=table.columns.find(c=>c.pk)?.name||table.columns[0]?.name||'ID';
    const sql=t.sql.replaceAll('${TABLE}',table.name).replaceAll('${COLUMNS}',table.columns.map(c=>c.name).join(', ')).replaceAll('${PK}',pk);
    E.showOutput(`Template · ${t.name}`,sql);
  };
  function addCustomTemplate(){
    const name=prompt('템플릿 이름'); if(!name)return;
    const sql=prompt('SQL 템플릿 (${TABLE}, ${COLUMNS}, ${PK} 사용 가능)'); if(!sql)return;
    const list=customTemplates(); list.push({name,sql}); localStorage.setItem(STORAGE_TEMPLATES,JSON.stringify(list)); E.renderTemplateMenu();
  }

  function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}
  function escapeXml(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')}
  function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function downloadText(name,text,mime){downloadBlob(name,new Blob([text],{type:mime}))}

  function exportSpecification(format='md'){
    const rows=[]; E.currentSchema().tables.forEach(t=>t.columns.forEach(c=>rows.push({table:t.name,desc:t.desc||'',column:c.name,type:c.type,key:c.pk?'PK':c.fk?'FK':''})));
    let content,mime,ext;
    if(format==='csv'){
      content=['TABLE,TABLE_DESC,COLUMN,TYPE,KEY',...rows.map(r=>[r.table,r.desc,r.column,r.type,r.key].map(csvCell).join(','))].join('\n'); mime='text/csv;charset=utf-8';ext='csv';
    }else if(format==='xls'){
      const xr=[['TABLE','TABLE_DESC','COLUMN','TYPE','KEY'],...rows.map(r=>[r.table,r.desc,r.column,r.type,r.key])].map(row=>`<Row>${row.map(v=>`<Cell><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`).join('')}</Row>`).join('');
      content=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="ERD Spec"><Table>${xr}</Table></Worksheet></Workbook>`;mime='application/vnd.ms-excel;charset=utf-8';ext='xls';
    }else{
      content=['| 테이블 | 설명 | 컬럼 | 타입 | 키 |','|---|---|---|---|---|',...rows.map(r=>`| ${r.table} | ${r.desc} | ${r.column} | ${r.type} | ${r.key} |`)].join('\n');mime='text/markdown;charset=utf-8';ext='md';
    }
    downloadText(`erd-spec-${currentView}.${ext}`,content,mime);
  }

  function exportDiagram(type='svg'){
    const view=E.currentSchema();
    const maxX=Math.max(1000,...view.tables.map(t=>(t.x||0)+400)),maxY=Math.max(700,...view.tables.map(t=>(t.y||0)+100+t.columns.length*28));
    const cards=view.tables.map(t=>{const x=t.x||0,y=t.y||0,h=54+t.columns.length*26;const rows=t.columns.map((c,i)=>`<text x="${x+14}" y="${y+48+i*26}" fill="#dbeafe" font-size="12" font-family="monospace">${E.escapeHtml(c.pk?'PK ':c.fk?'FK ':'   ')}${E.escapeHtml(c.name)}  ${E.escapeHtml(c.type)}</text>`).join('');return `<g><rect x="${x}" y="${y}" width="360" height="${h}" rx="10" fill="#111827" stroke="#38bdf8"/><rect x="${x}" y="${y}" width="360" height="34" rx="10" fill="#1e293b"/><text x="${x+14}" y="${y+23}" fill="#38bdf8" font-weight="700" font-size="14" font-family="monospace">${E.escapeHtml(t.name)}</text>${rows}</g>`}).join('');
    const pos=new Map(view.tables.map(t=>[E.tableId(t),t]));
    const lines=(view.relations||[]).map(r=>{const a=pos.get(r.from),b=pos.get(r.to);if(!a||!b)return'';return `<line x1="${(a.x||0)+180}" y1="${(a.y||0)+34}" x2="${(b.x||0)+180}" y2="${(b.y||0)+34}" stroke="#38bdf8" stroke-width="2" ${r.identifying?'':'stroke-dasharray="8 5"'}/>`}).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}"><rect width="100%" height="100%" fill="#090d16"/>${lines}${cards}</svg>`;
    if(type==='svg')return downloadText(`erd-${currentView}.svg`,svg,'image/svg+xml');
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),img=new Image();
    img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=maxX;canvas.height=maxY;canvas.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);canvas.toBlob(png=>downloadBlob(`erd-${currentView}.png`,png));};img.src=url;
  }

  Object.assign(window,{generateCode,addCustomTemplate,exportSpecification,exportDiagram});
})();
