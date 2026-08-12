/** Pure route strategies used by the selectable ERD relation router. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  if (!E) return;

  const CORRIDOR_PAD = 42;
  const ASTAR_PAD = 26;
  const ASTAR_MARGIN = 180;
  const ASTAR_MAX_OBSTACLES = 14;
  const TURN_PENALTY = 24;
  const CROSSING_PENALTY = 420;
  const SWITCH_PENALTY = 150;
  const HIT_PENALTY = 1_000_000;

  const inside = (p, r) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;

  function segmentHitsRect(a, b, r) {
    if (inside(a, r) || inside(b, r)) return true;
    const dx = b.x - a.x, dy = b.y - a.y;
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[-dx,a.x-r.left],[dx,r.right-a.x],[-dy,a.y-r.top],[dy,r.bottom-a.y]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const x = q / p;
      if (p < 0) { if (x > t1) return false; if (x > t0) t0 = x; }
      else { if (x < t0) return false; if (x < t1) t1 = x; }
    }
    return t0 <= t1;
  }

  const hitsAny = (a, b, obstacles) => obstacles.some(r => segmentHitsRect(a, b, r));

  function intersections(points, obstacles = []) {
    return obstacles.reduce((sum, r) => sum + (points.slice(0,-1).some((p,i) => segmentHitsRect(p, points[i+1], r)) ? 1 : 0), 0);
  }

  function length(points = []) {
    return points.slice(0,-1).reduce((sum,p,i) => sum + Math.hypot(points[i+1].x-p.x, points[i+1].y-p.y), 0);
  }

  function compact(points = []) {
    const out = [];
    for (const p of points) {
      const prev = out.at(-1);
      if (!prev || prev.x !== p.x || prev.y !== p.y) out.push(p);
    }
    if (out.length < 3) return out;
    const result = [out[0]];
    for (let i=1;i<out.length-1;i+=1) {
      const a=result.at(-1), b=out[i], c=out[i+1];
      if (!((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y))) result.push(b);
    }
    result.push(out.at(-1));
    return result;
  }

  const turns = points => Math.max(0, compact(points).length - 2);

  function orient(a,b,c) {
    const v=(b.y-a.y)*(c.x-b.x)-(b.x-a.x)*(c.y-b.y);
    return Math.abs(v)<1e-6 ? 0 : (v>0 ? 1 : 2);
  }
  const onSegment=(a,b,c)=>b.x<=Math.max(a.x,c.x)+1e-6&&b.x+1e-6>=Math.min(a.x,c.x)&&b.y<=Math.max(a.y,c.y)+1e-6&&b.y+1e-6>=Math.min(a.y,c.y);

  function segmentsCross(a,b,c,d) {
    if ([a,b].some(p=>[c,d].some(q=>Math.abs(p.x-q.x)<1e-6&&Math.abs(p.y-q.y)<1e-6))) return false;
    const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
    if (o1!==o2&&o3!==o4) return true;
    return (o1===0&&onSegment(a,c,b))||(o2===0&&onSegment(a,d,b))||(o3===0&&onSegment(c,a,d))||(o4===0&&onSegment(c,b,d));
  }

  function crossings(points, routed = []) {
    let count=0;
    points.slice(0,-1).forEach((p,i)=>routed.forEach(edge=>{ if (segmentsCross(p,points[i+1],edge.a,edge.b)) count+=1; }));
    return count;
  }

  function score(candidate, obstacles=[], routed=[], previous='') {
    const pts=candidate.points||[];
    const hit=intersections(pts,obstacles), cross=crossings(pts,routed), len=length(pts), bend=turns(pts);
    const signature=`${candidate.algorithm}:${candidate.kind||''}`;
    const switched=previous&&previous!==signature?1:0;
    return {...candidate,points:pts,intersections:hit,crossings:cross,length:len,turns:bend,signature,
      score:hit*HIT_PENALTY+cross*CROSSING_PENALTY+len+bend*TURN_PENALTY+switched*SWITCH_PENALTY};
  }

  function corridorCandidates(p0,p3,obstacles=[],lane=0) {
    const xs=[p0.x,p3.x,...obstacles.flatMap(r=>[r.left,r.right])], ys=[p0.y,p3.y,...obstacles.flatMap(r=>[r.top,r.bottom])];
    const mx=(p0.x+p3.x)/2+lane,my=(p0.y+p3.y)/2+lane;
    const left=Math.min(...xs)-CORRIDOR_PAD+lane,right=Math.max(...xs)+CORRIDOR_PAD+lane;
    const top=Math.min(...ys)-CORRIDOR_PAD+lane,bottom=Math.max(...ys)+CORRIDOR_PAD+lane;
    return [
      ['mid-x',[p0,{x:mx,y:p0.y},{x:mx,y:p3.y},p3]],['mid-y',[p0,{x:p0.x,y:my},{x:p3.x,y:my},p3]],
      ['top',[p0,{x:p0.x,y:top},{x:p3.x,y:top},p3]],['bottom',[p0,{x:p0.x,y:bottom},{x:p3.x,y:bottom},p3]],
      ['left',[p0,{x:left,y:p0.y},{x:left,y:p3.y},p3]],['right',[p0,{x:right,y:p0.y},{x:right,y:p3.y},p3]]
    ].map(([kind,points])=>({algorithm:'corridor',kind,points:compact(points)}));
  }

  function corridor(p0,p3,obstacles=[],lane=0,routed=[],previous='') {
    return corridorCandidates(p0,p3,obstacles,lane).map(c=>score(c,obstacles,routed,previous))
      .sort((a,b)=>a.score-b.score||a.kind.localeCompare(b.kind))[0]||null;
  }

  function relevant(p0,p3,obstacles=[]) {
    const box={left:Math.min(p0.x,p3.x)-ASTAR_MARGIN,right:Math.max(p0.x,p3.x)+ASTAR_MARGIN,top:Math.min(p0.y,p3.y)-ASTAR_MARGIN,bottom:Math.max(p0.y,p3.y)+ASTAR_MARGIN};
    const mid={x:(p0.x+p3.x)/2,y:(p0.y+p3.y)/2};
    return obstacles.filter(r=>r.right>=box.left&&r.left<=box.right&&r.bottom>=box.top&&r.top<=box.bottom)
      .sort((a,b)=>Math.hypot((a.left+a.right)/2-mid.x,(a.top+a.bottom)/2-mid.y)-Math.hypot((b.left+b.right)/2-mid.x,(b.top+b.bottom)/2-mid.y))
      .slice(0,ASTAR_MAX_OBSTACLES);
  }

  const uniq=values=>[...new Set(values.map(v=>Math.round(v*1000)/1000))].sort((a,b)=>a-b);
  const key=(x,y)=>`${x},${y}`;

  function visibilityGrid(p0,p3,obstacles=[],lane=0) {
    const obs=relevant(p0,p3,obstacles);
    const xs=uniq([p0.x,p3.x,(p0.x+p3.x)/2+lane,...obs.flatMap(r=>[r.left-ASTAR_PAD,r.right+ASTAR_PAD])]);
    const ys=uniq([p0.y,p3.y,(p0.y+p3.y)/2+lane,...obs.flatMap(r=>[r.top-ASTAR_PAD,r.bottom+ASTAR_PAD])]);
    const nodes=new Map();
    xs.forEach(x=>ys.forEach(y=>{const p={x,y};if((x===p0.x&&y===p0.y)||(x===p3.x&&y===p3.y)||!obs.some(r=>inside(p,r)))nodes.set(key(x,y),p);}));
    return {xs,ys,nodes,obstacles:obs};
  }

  function astar(p0,p3,obstacles=[],lane=0,routed=[],previous='') {
    const g=visibilityGrid(p0,p3,obstacles,lane), start=key(p0.x,p0.y), goal=key(p3.x,p3.y);
    if(!g.nodes.has(start)||!g.nodes.has(goal))return null;
    const neighbors=new Map([...g.nodes.keys()].map(k=>[k,[]]));
    const link=list=>{for(let i=0;i<list.length-1;i+=1){const a=list[i],b=list[i+1];if(hitsAny(a,b,g.obstacles))continue;neighbors.get(key(a.x,a.y)).push(b);neighbors.get(key(b.x,b.y)).push(a);}};
    g.ys.forEach(y=>link(g.xs.map(x=>g.nodes.get(key(x,y))).filter(Boolean)));
    g.xs.forEach(x=>link(g.ys.map(y=>g.nodes.get(key(x,y))).filter(Boolean)));

    const heap=[];
    const push=item=>{heap.push(item);let i=heap.length-1;while(i>0){const p=Math.floor((i-1)/2);if(heap[p].rank<=item.rank)break;heap[i]=heap[p];i=p;}heap[i]=item;};
    const pop=()=>{if(!heap.length)return null;const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=heap.length)break;let c=r<heap.length&&heap[r].rank<heap[l].rank?r:l;if(heap[c].rank>=last.rank)break;heap[i]=heap[c];i=c;}heap[i]=last;}return root;};
    const best=new Map([[`${start}|`,0]]),from=new Map();
    push({key:start,dir:'',cost:0,rank:Math.abs(p3.x-p0.x)+Math.abs(p3.y-p0.y)});
    let end=null;
    while(heap.length){const cur=pop(),curState=`${cur.key}|${cur.dir}`;if(cur.cost!==(best.get(curState)??Infinity))continue;if(cur.key===goal){end=cur;break;}const p=g.nodes.get(cur.key);
      for(const n of neighbors.get(cur.key)||[]){const nk=key(n.x,n.y),dir=p.x===n.x?'v':'h';const turn=cur.dir&&cur.dir!==dir?TURN_PENALTY:0;const cross=crossings([p,n],routed)*CROSSING_PENALTY;
        const cost=cur.cost+Math.abs(n.x-p.x)+Math.abs(n.y-p.y)+turn+cross,state=`${nk}|${dir}`;if(cost>=(best.get(state)??Infinity))continue;
        best.set(state,cost);from.set(state,{key:cur.key,dir:cur.dir});push({key:nk,dir,cost,rank:cost+Math.abs(p3.x-n.x)+Math.abs(p3.y-n.y)});}}
    if(!end)return null;
    const rev=[];let state={key:end.key,dir:end.dir};while(state){rev.push(g.nodes.get(state.key));if(state.key===start&&!state.dir)break;state=from.get(`${state.key}|${state.dir}`)||null;}
    if(!rev.length||rev.at(-1)?.x!==p0.x||rev.at(-1)?.y!==p0.y)return null;
    return score({algorithm:'astar',kind:'visibility-grid',points:compact(rev.reverse())},obstacles,routed,previous);
  }

  function direct(points,obstacles=[],routed=[],previous='') {
    const result=score({algorithm:'direct',kind:'cubic',points},obstacles,routed,previous);
    result.score-=result.turns*TURN_PENALTY;result.turns=0;return result;
  }

  function choose({directPoints,p0,p3,obstacles=[],lane=0,routed=[],previous='',mode='auto'}) {
    const d=direct(directPoints,obstacles,routed,previous),c=corridor(p0,p3,obstacles,lane,routed,previous),a=astar(p0,p3,obstacles,lane,routed,previous);
    if(mode==='direct')return d;if(mode==='corridor')return c||d;if(mode==='astar')return a||c||d;
    if(d.intersections===0&&d.crossings===0)d.score-=80;
    return [d,c,a].filter(Boolean).sort((x,y)=>x.score-y.score||x.signature.localeCompare(y.signature))[0]||null;
  }

  E.RelationRouteStrategies={segmentHitsRect,intersections,length,compact,turns,segmentsCross,crossings,score,corridorCandidates,corridor,relevant,visibilityGrid,astar,direct,choose};
})();
