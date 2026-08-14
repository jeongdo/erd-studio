/** Selectable relation routing controller layered over Router v2. */
(() => {
  'use strict';
  const E=window.ERDEditor, R=E?.RelationRouting, I=E?.RelationIdentity, V2=E?.RelationRouterV2, S=E?.RelationRouteStrategies, P=E?.RelationPortSelector, F=E?.RelationFanout;
  const Actions=E?.Actions, A=E?.Advanced, base=window.updateConnections;
  if(!E||!R||!I||!V2||!S||!P||!F||typeof base!=='function')return;

  const PREF='erd_relation_router_mode_v1', MODES=new Set(['auto','direct','corridor','astar']);
  const storage=typeof localStorage!=='undefined'?localStorage:{getItem:()=>null,setItem(){}};
  let mode=MODES.has(storage.getItem(PREF))?storage.getItem(PREF):'auto';
  const routeHistory=new Map(), portHistory=new Map();

  const cols=v=>E.columnArray?E.columnArray(v):(Array.isArray(v)?v:[v]);
  const relationKey=(rel,index)=>I.relationKey?.(rel,index)||`${rel.from}|${cols(rel.fromCol).join(',')}|${rel.to}|${cols(rel.toCol).join(',')}|${index}`;
  const segments=(points,owner='')=>points.slice(0,-1).map((a,i)=>({a,b:points[i+1],owner}));

  function worldRect(rect,canvas,scale,clearance=0){const s=Math.max(scale||1,.05);return{left:(rect.left-canvas.left)/s-clearance,top:(rect.top-canvas.top)/s-clearance,right:(rect.right-canvas.left)/s+clearance,bottom:(rect.bottom-canvas.top)/s+clearance};}
  function obstaclesFor(from,to,canvas,scale){const out=[];document.querySelectorAll('#cards-container .table-card').forEach(card=>{if(card.hidden)return;const id=card.id.replace(/^card-/,'');if(!id||id===from||id===to)return;out.push(worldRect(card.getBoundingClientRect(),canvas,scale,18/Math.max(scale,.05)));});return out;}

  function directRoute(rel,index,relations,canvasLayer,scale,obstacles=[],previousPort=''){
    const fc=cols(rel.fromCol)[0],tc=cols(rel.toCol)[0];
    const fromColumn=document.getElementById(`col-${rel.from}-${fc}`)?.getBoundingClientRect();
    const toColumn=document.getElementById(`col-${rel.to}-${tc}`)?.getBoundingClientRect();
    const fromCard=document.getElementById(`card-${rel.from}`)?.getBoundingClientRect();
    const toCard=document.getElementById(`card-${rel.to}`)?.getBoundingClientRect();
    if(!fromColumn||!toColumn||!fromCard||!toCard)return null;
    const canvas=canvasLayer.getBoundingClientRect();
    const selected=P.select({fromColumn,toColumn,fromCard,toCard,canvas,scale,obstacles,previous:previousPort});
    if(!selected)return null;
    const lane=I.parallelLane?.(rel,index,relations)||0;
    const route=I.laneRoute?.(selected.route,lane)||selected.route;
    return {...route,lane,canvas,port:selected};
  }

  function moveBadge(path,mid){const badge=path.nextElementSibling;if(!badge||badge.tagName?.toLowerCase()!=='g')return;const rect=badge.querySelector('rect'),text=badge.querySelector('text');if(rect){const w=Number(rect.getAttribute('width'))||0,h=Number(rect.getAttribute('height'))||0;rect.setAttribute('x',mid.x-w/2);rect.setAttribute('y',mid.y-h/2);}if(text){text.setAttribute('x',mid.x);text.setAttribute('y',mid.y+3.5);}}

  function apply(path,candidate,direct,{fanout=false,laneState={}}={}){if(!candidate)return[];let points;if(candidate.algorithm==='direct'){path.setAttribute('d',direct.d);moveBadge(path,direct.mid);points=V2.sampleCubic(direct.d);}else{path.setAttribute('d',V2.polylinePath(candidate.points));moveBadge(path,V2.polylineMidpoint(candidate.points));points=candidate.points;}path.dataset.routeMode=candidate.algorithm;path.dataset.routeKind=candidate.kind||'';path.dataset.routeFromPort=direct.port?.fromSide||'';path.dataset.routeToPort=direct.port?.toSide||'';path.dataset.routePortSignature=direct.port?.signature||'';path.dataset.routeFanout=fanout?'1':'0';path.dataset.routeFromBundle=fanout?laneState.fromBundle||'':'';path.dataset.routeToBundle=fanout?laneState.toBundle||'':'';path.dataset.obstacleHits=String(candidate.intersections||0);path.dataset.routeCrossings=String(candidate.crossings||0);path.dataset.routeTurns=String(candidate.turns||0);path.dataset.routeScore=String(Math.round(candidate.score||0));return points;}

  function clearHistory(){routeHistory.clear();portHistory.clear();}

  function prepare(view,relations,canvasLayer,scale){
    const canvas=canvasLayer.getBoundingClientRect(),out=[];
    document.querySelectorAll('#connections-svg .connection-line').forEach(path=>{
      const resolved=I.resolveRelation?.(path,relations),index=resolved?.index??Number(path.dataset.relationIndex),rel=resolved?.relation||(Number.isInteger(index)?relations[index]:null);
      if(!rel||!Number.isInteger(index))return;
      const key=relationKey(rel,index),obs=obstaclesFor(rel.from,rel.to,canvas,scale);
      const direct=directRoute(rel,index,relations,canvasLayer,scale,obs,portHistory.get(key)||''),cubic=direct&&V2.parseCubic(direct.d);if(!direct||!cubic)return;
      out.push({path,rel,index,key,obs,direct,cubic,difficulty:(direct.port?.hits||0)*1_000_000+obs.length*1000+(direct.port?.distance||0)});
    });
    return out;
  }

  function plainCandidate(entry,routed){
    const previous=routeHistory.get(entry.key)||'';
    return S.choose({directPoints:V2.sampleCubic(entry.direct.d),p0:entry.cubic.p0,p3:entry.cubic.p3,obstacles:entry.obs,lane:entry.direct.lane,routed,previous,mode});
  }

  function bundledCandidate(entry,laneState,routed){
    if(mode==='direct'||!F.active(laneState))return null;
    const previous=routeHistory.get(entry.key)||'',anchor=F.anchors(entry.direct.port,laneState);
    const raw=P.cubic(anchor.start,anchor.end,entry.direct.port.fromSide,entry.direct.port.toSide);
    const laneRoute=I.laneRoute?.(raw,entry.direct.lane)||raw;
    const directPoints=V2.sampleCubic(laneRoute.d);
    let candidate;
    if(mode==='auto'){
      const c=S.corridor(anchor.start,anchor.end,entry.obs,entry.direct.lane,routed,previous);
      const a=S.astar(anchor.start,anchor.end,entry.obs,entry.direct.lane,routed,previous);
      candidate=[c,a].filter(Boolean).sort((x,y)=>x.score-y.score||x.signature.localeCompare(y.signature))[0]||null;
    }else{
      candidate=S.choose({directPoints,p0:anchor.start,p3:anchor.end,obstacles:entry.obs,lane:entry.direct.lane,routed,previous,mode});
    }
    if(!candidate||candidate.algorithm==='direct')return null;
    const points=F.compose(candidate.points,anchor);
    return S.score({...candidate,points},entry.obs,routed,previous);
  }

  function preferBundled(plain,bundled){
    if(!bundled)return false;if(!plain)return true;
    if((bundled.intersections||0)!==(plain.intersections||0))return (bundled.intersections||0)<(plain.intersections||0);
    if((bundled.crossings||0)!==(plain.crossings||0))return (bundled.crossings||0)<(plain.crossings||0);
    return (bundled.score||Infinity)<=(plain.score||Infinity)+220;
  }

  function isDraggingActive() {
    return Boolean(window.isDraggingCard || E?.isDraggingCard);
  }

  function refine(force = false){
    if (!force && isDraggingActive()) return;
    const view=E.currentSchema?.(),relations=view?.relations||[],canvasLayer=document.getElementById('canvas-layer');
    if(!canvasLayer||!relations.length)return;
    const scale=R.readCanvasScale?.(canvasLayer)||1,entries=prepare(view,relations,canvasLayer,scale),lanes=F.assign(entries),routed=[];
    entries.sort((a,b)=>b.difficulty-a.difficulty||a.key.localeCompare(b.key));
    entries.forEach(entry=>{
      const laneState=lanes.get(entry.key)||{},plain=plainCandidate(entry,routed),bundled=bundledCandidate(entry,laneState,routed);
      const useBundled=preferBundled(plain,bundled),candidate=useBundled?bundled:plain;
      const points=apply(entry.path,candidate,entry.direct,{fanout:useBundled,laneState});
      if(candidate)routeHistory.set(entry.key,candidate.signature);if(entry.direct.port)portHistory.set(entry.key,entry.direct.port.signature);routed.push(...segments(points,entry.key));
    });
  }

  function setMode(next,{announce=true}={}){if(!MODES.has(next))return false;mode=next;storage.setItem(PREF,mode);routeHistory.clear();window.updateConnections?.();document.dispatchEvent?.(new CustomEvent('erd:relation-router-mode-changed',{detail:{mode}}));if(announce)A?.showToast?.(`Relation Router · ${mode==='auto'?'Auto Balanced':mode==='astar'?'A* Orthogonal':mode==='corridor'?'Orthogonal Corridor':'Direct Curve'}`);return true;}

  function benchmark(){
    const view=E.currentSchema?.(),relations=view?.relations||[],canvasLayer=document.getElementById('canvas-layer');if(!canvasLayer)return{};
    const scale=R.readCanvasScale?.(canvasLayer)||1,canvas=canvasLayer.getBoundingClientRect(),names=['direct','corridor','astar','auto'];
    const report=Object.fromEntries(names.map(n=>[n,{relations:0,obstacleHits:0,crossings:0,length:0,turns:0}]));
    names.forEach(name=>{const routed=[];relations.forEach((rel,index)=>{const obs=obstaclesFor(rel.from,rel.to,canvas,scale),direct=directRoute(rel,index,relations,canvasLayer,scale,obs,''),cubic=direct&&V2.parseCubic(direct.d);if(!direct||!cubic)return;const candidate=S.choose({directPoints:V2.sampleCubic(direct.d),p0:cubic.p0,p3:cubic.p3,obstacles:obs,lane:direct.lane,routed,mode:name});if(!candidate)return;const row=report[name];row.relations++;row.obstacleHits+=candidate.intersections||0;row.crossings+=candidate.crossings||0;row.length+=candidate.length||0;row.turns+=candidate.turns||0;const points=candidate.algorithm==='direct'?V2.sampleCubic(direct.d):candidate.points;routed.push(...segments(points,`${name}:${index}`));});report[name].length=Math.round(report[name].length);});
    return report;
  }

  function openBenchmark(){const report=benchmark();if(!A?.ensureDialog)return report;const label={auto:'Auto Balanced',direct:'Direct Curve',corridor:'Orthogonal Corridor',astar:'A* Orthogonal'};const body=`<div class="manager-list">${['auto','direct','corridor','astar'].map(name=>{const row=report[name]||{};return`<div class="manager-row"><div><b>${label[name]}</b><small>${row.relations||0} relations · length ${row.length||0} · turns ${row.turns||0}</small></div><strong>hit ${row.obstacleHits||0} · cross ${row.crossings||0}</strong></div>`;}).join('')}</div><div class="empty-state">port 선택 후 hit/cross를 우선하고, 그 다음 길이와 꺾임 수를 비교합니다.</div>`;A.ensureDialog('relation-router-benchmark-dialog','관계선 라우터 비교',body,true).showModal();return report;}

  window.updateConnections=function(...args){const result=base.apply(this,args);refine();return result;};
  E.RelationRouterModes={mode:()=>mode,setMode,refine,benchmark,clearHistory,portHistory,routeHistory,prepare,preferBundled,isDragging:isDraggingActive};

  if(Actions){[
    ['auto','view.router.auto','관계선 · Auto Balanced'],['direct','view.router.direct','관계선 · Direct Curve'],['corridor','view.router.corridor','관계선 · Orthogonal Corridor'],['astar','view.router.astar','관계선 · A* Orthogonal']
  ].forEach(([value,id,label])=>Actions.register({id,label,icon:'fa-solid fa-route',checked:()=>mode===value,run:()=>setMode(value)}));Actions.register({id:'tools.routerBenchmark',label:'관계선 라우터 비교',icon:'fa-solid fa-chart-simple',run:openBenchmark});}

  document.addEventListener?.('erd:workspace-changed',clearHistory);
  document.addEventListener?.('erd:project-loaded',clearHistory);
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>window.updateConnections?.());
})();
