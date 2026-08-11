/** Relationship analysis tools for ERD Studio. */
(() => {
  'use strict';
  const E = window.ERDEditor;

  function relationBetween(a,b){return (E.currentSchema()?.relations||[]).find(r=>(r.from===a&&r.to===b)||(r.from===b&&r.to===a))}
  function joinCondition(rel,leftAlias,rightAlias,leftId){
    const from=E.columnArray(rel.fromCol),to=E.columnArray(rel.toCol);
    return from.map((fc,i)=>{const tc=to[i]||to[0];return rel.from===leftId?`${leftAlias}.${fc} = ${rightAlias}.${tc}`:`${leftAlias}.${tc} = ${rightAlias}.${fc}`}).join(' AND ');
  }

  function focusTables(ids,relations=[]){
    const set=new Set(ids),relKeys=new Set(relations.map(r=>`${r.from}-${r.to}`));
    document.querySelectorAll('.table-card').forEach(card=>{const id=card.id.replace(/^card-/,'');card.classList.toggle('analysis-focus',set.has(id));card.classList.toggle('analysis-dimmed',!set.has(id));});
    document.querySelectorAll('.connection-line').forEach(line=>{const key=line.id.replace(/^line-/,'');line.classList.toggle('highlighted',relKeys.has(key));line.classList.toggle('dimmed',relKeys.size>0&&!relKeys.has(key));});
  }
  function clearAnalysisFocus(){document.querySelectorAll('.analysis-focus,.analysis-dimmed').forEach(el=>el.classList.remove('analysis-focus','analysis-dimmed'));document.querySelectorAll('.connection-line').forEach(el=>el.classList.remove('highlighted','dimmed'))}
  E.clearAnalysisFocus=clearAnalysisFocus;

  function generateJoinForSelected(){
    const ids=[...E.selectedIds]; if(ids.length!==2)return alert('JOIN은 테이블 2개를 Ctrl+클릭으로 선택하세요.');
    const [a,b]=ids,ta=E.findTable(a),tb=E.findTable(b),rel=relationBetween(a,b);
    const cols=[...ta.columns.map(c=>`A.${c.name} AS ${ta.name.toLowerCase()}_${c.name.toLowerCase()}`),...tb.columns.map(c=>`B.${c.name} AS ${tb.name.toLowerCase()}_${c.name.toLowerCase()}`)];
    const sql=rel?`SELECT\n    ${cols.join(',\n    ')}\nFROM ${ta.name} A\nJOIN ${tb.name} B\n  ON ${joinCondition(rel,'A','B',a)};`:`SELECT\n    ${cols.join(',\n    ')}\nFROM ${ta.name} A\nCROSS JOIN ${tb.name} B;\n\n-- 직접 FK 관계를 찾지 못해 CROSS JOIN으로 생성했습니다.`;
    E.showOutput('JOIN SQL',sql);focusTables(ids,rel?[rel]:[]);
  }

  function buildGraph(){
    const graph=new Map(E.currentSchema().tables.map(t=>[E.tableId(t),[]]));
    (E.currentSchema().relations||[]).forEach(rel=>{graph.get(rel.from)?.push({id:rel.to,rel});graph.get(rel.to)?.push({id:rel.from,rel});});return graph;
  }
  function allJoinPaths(start,goal,limit=20){
    const graph=buildGraph(),paths=[];
    function dfs(node,seen,steps){if(paths.length>=limit)return;if(node===goal){paths.push(steps.slice());return;}for(const edge of graph.get(node)||[]){if(seen.has(edge.id))continue;seen.add(edge.id);steps.push({from:node,to:edge.id,rel:edge.rel});dfs(edge.id,seen,steps);steps.pop();seen.delete(edge.id)}}
    dfs(start,new Set([start]),[]);return paths.sort((a,b)=>a.length-b.length);
  }
  function generateJoinPath(){
    const ids=[...E.selectedIds];if(ids.length!==2)return alert('경로 탐색은 테이블 2개를 선택하세요.');
    const paths=allJoinPaths(ids[0],ids[1]);if(!paths.length)return E.showOutput('Join Path Finder',`${ids[0]} ↔ ${ids[1]} 사이 FK 경로가 없습니다.`);
    const path=paths[0],aliases=new Map([[ids[0],'T1']]);let sql=`SELECT T1.*\nFROM ${E.findTable(ids[0]).name} T1`;
    path.forEach((step,i)=>{const l=aliases.get(step.from),r=`T${i+2}`;aliases.set(step.to,r);sql+=`\nJOIN ${E.findTable(step.to).name} ${r}\n  ON ${joinCondition(step.rel,l,r,step.from)}`});sql+=';';
    const alternatives=paths.slice(0,10).map((p,i)=>`${i+1}. ${p.map(x=>x.from).concat(p.at(-1).to).join(' → ')}`).join('\n');
    E.showOutput('Join Path Finder',`최단 경로\n${path.map(p=>p.from).concat(path.at(-1).to).join(' → ')}\n\n탐색 경로 (${paths.length}개, 최대 20개)\n${alternatives}\n\n${sql}`);focusTables(path.flatMap(p=>[p.from,p.to]),path.map(p=>p.rel));
  }

  function topologicalOrder(){
    const view=E.currentSchema(),indegree=new Map(view.tables.map(t=>[E.tableId(t),0])),children=new Map(view.tables.map(t=>[E.tableId(t),[]]));
    (view.relations||[]).forEach(r=>{children.get(r.from)?.push(r.to);indegree.set(r.to,(indegree.get(r.to)||0)+1)});
    const q=[...indegree].filter(([,n])=>n===0).map(([id])=>id),result=[];
    while(q.length){const id=q.shift();result.push(id);for(const child of children.get(id)||[]){indegree.set(child,indegree.get(child)-1);if(indegree.get(child)===0)q.push(child)}}
    return {result,cyclic:[...indegree].filter(([,n])=>n>0).map(([id])=>id)};
  }
  E.topologicalOrder=topologicalOrder;
  function showDependencyOrder(){const {result,cyclic}=topologicalOrder();const ins=result.map((id,i)=>`${i+1}. ${id}`).join('\n'),del=[...result].reverse().map((id,i)=>`${i+1}. ${id}`).join('\n');E.showOutput('Dependency Order',`INSERT 순서\n${ins}\n\nDELETE 순서\n${del}${cyclic.length?`\n\n⚠ 순환/자기참조 후보: ${cyclic.join(', ')}`:''}`)}

  function relatedIds(start,mode){
    const view=E.currentSchema(),result=new Set([start]),q=[start];
    while(q.length){const id=q.shift();for(const r of view.relations||[]){let next=null;if(mode==='impact'&&r.from===id)next=r.to;if(mode==='lineage'&&r.to===id)next=r.from;if(next&&!result.has(next)){result.add(next);q.push(next)}}}return result;
  }
  function analyzeRelations(mode){const id=E.primarySelectedId();if(!id)return alert('테이블을 먼저 선택하세요.');const ids=relatedIds(id,mode),rels=(E.currentSchema().relations||[]).filter(r=>ids.has(r.from)&&ids.has(r.to));focusTables([...ids],rels);E.showOutput(mode==='impact'?'Impact Analysis':'Data Lineage',[...ids].join(' → '))}

  function detectNPlusOneRisk(){
    const view=E.currentSchema(),out=new Map(view.tables.map(t=>[E.tableId(t),[]]));(view.relations||[]).forEach(r=>out.get(r.from)?.push(r.to));const risks=[];
    function walk(id,path){if(path.length>=4){risks.push(path.slice());return;}for(const next of out.get(id)||[]){if(path.includes(next))continue;walk(next,[...path,next])}}
    view.tables.forEach(t=>walk(E.tableId(t),[E.tableId(t)]));const unique=[...new Map(risks.map(p=>[p.join('>'),p])).values()];
    E.showOutput('N+1 Risk Scan',unique.length?`깊은 1:N 연쇄 후보 ${unique.length}건\n\n${unique.map(p=>`⚠ ${p.join(' → ')}`).join('\n')}`:'3단계 이상 연쇄 관계를 찾지 못했습니다.');if(unique.length)focusTables(unique[0],[]);
  }

  function validateSchema(){
    const view=E.currentSchema(),issues=[],names=new Set();
    view.tables.forEach(t=>{if(names.has(t.name))issues.push(`ERROR 중복 테이블명: ${t.name}`);names.add(t.name);if(!/^[A-Z][A-Z0-9_$#]*$/.test(t.name))issues.push(`WARN 테이블 네이밍: ${t.name}`);if(!t.columns.some(c=>c.pk))issues.push(`WARN PK 없음: ${t.name}`);const cols=new Set();t.columns.forEach(c=>{if(cols.has(c.name))issues.push(`ERROR 중복 컬럼: ${t.name}.${c.name}`);cols.add(c.name);if(!/^[A-Z][A-Z0-9_$#]*$/.test(c.name))issues.push(`WARN 컬럼 네이밍: ${t.name}.${c.name}`)})});
    (view.relations||[]).forEach(r=>{const from=E.findTable(r.from),to=E.findTable(r.to);if(!from||!to)issues.push(`ERROR 끊어진 관계: ${r.from} → ${r.to}`);E.columnArray(r.fromCol).forEach(c=>{if(from&&!from.columns.some(x=>x.name===c))issues.push(`ERROR 관계 컬럼 없음: ${r.from}.${c}`)});E.columnArray(r.toCol).forEach(c=>{if(to&&!to.columns.some(x=>x.name===c))issues.push(`ERROR 관계 컬럼 없음: ${r.to}.${c}`)})});
    const {cyclic}=topologicalOrder();if(cyclic.length)issues.push(`WARN 순환/자기참조 후보: ${cyclic.join(', ')}`);
    E.showOutput('ERD Validation',issues.length?`${issues.length}개 이슈\n\n${issues.join('\n')}`:'검증 통과: 중복/PK/네이밍/관계 무결성/순환 참조 이슈를 찾지 못했습니다.');
  }

  Object.assign(window,{generateJoinForSelected,generateJoinPath,showDependencyOrder,analyzeRelations,detectNPlusOneRisk,validateSchema,clearAnalysisFocus});
})();
