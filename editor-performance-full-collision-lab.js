/** ARGUS 100K full-collision stress lab: same engine, RAW vs viewport CULL. */
(() => {
  'use strict';
  const RAW='performance_lab_raw_full_collision_100000';
  const CULL='performance_lab_cull_full_collision_100000';
  const SRC='performance_100000';
  const W=360,HEADER=52,ROW=34,BOTTOM=12,GAP=60,CELL=840;
  const NAME_SCALE=.16,COLUMN_SCALE=.34,RELATION_SCALE=.10,HIT_PX=8;
  if(typeof schemaData==='undefined'||!schemaData[SRC])return;
  const source=schemaData[SRC];
  const makeDesc=(tabName,icon,key,renderer)=>{
    const d={tabName,icon,title:`${tabName} · 100K · no numeric collision cap`,performanceSample:true,performanceKey:key,argusRenderer:renderer};
    Object.defineProperties(d,{tables:{enumerable:true,get:()=>source.tables},relations:{enumerable:true,get:()=>source.relations}});
    return d;
  };
  schemaData[RAW]=makeDesc('LAB RAW FULL COLLISION','fa-solid fa-burst','raw-full-collision-100k','raw-full-collision');
  schemaData[CULL]=makeDesc('LAB CULL FULL COLLISION','fa-solid fa-arrows-to-circle','cull-full-collision-100k','cull-full-collision');

  const workspace=document.getElementById('workspace');
  const legacy=document.getElementById('canvas-layer');
  const zoomText=document.getElementById('zoom-text');
  if(!workspace||!legacy)return;
  const prevRender=window.renderView,prevUpdate=window.updateConnections,prevLayout=window.applyLayout;

  const canvas=document.createElement('canvas');
  canvas.id='argus-full-collision-webgl';
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'26',display:'none',pointerEvents:'none'});
  workspace.appendChild(canvas);
  const overlay=document.createElement('canvas');
  overlay.id='argus-full-collision-overlay';
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'27',display:'none',cursor:'grab'});
  workspace.appendChild(overlay);
  const hud=document.createElement('div');
  Object.assign(hud.style,{position:'absolute',top:'12px',left:'12px',zIndex:'86',display:'none',padding:'6px 9px',borderRadius:'7px',border:'1px solid var(--panel-border)',background:'var(--panel-bg)',color:'var(--text-muted)',font:"600 11px 'Fira Code', monospace",pointerEvents:'none'});
  workspace.appendChild(hud);
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
  const ctx=overlay.getContext('2d');
  if(!gl||!ctx)return;

  let active=false,state=null,raf=0,gpu=null,pan=null,drag=null,lastFrame=0,fps=0;
  let lastMoves=0,lastMs=0,peakMoves=0;
  const states=new Map();
  const idOf=t=>t?.id||t?.name||'';
  const heightOf=t=>HEADER+(t?.columns?.length||0)*ROW+BOTTOM;
  const rectOf=(t,g=0)=>({left:t.x-g,top:t.y-g,right:t.x+W+g,bottom:t.y+heightOf(t)+g});
  const intersects=(a,b)=>a.right>=b.left&&a.left<=b.right&&a.bottom>=b.top&&a.top<=b.bottom;
  const css=(n,f)=>getComputedStyle(document.body).getPropertyValue(n).trim()||f;
  function parseColor(v,f){
    const s=String(v||'').trim();
    if(s[0]==='#'){
      let h=s.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');
      if(h.length>=6){const a=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);if(a.every(Number.isFinite))return a;}
    }
    const m=s.match(/rgba?\(([^)]+)\)/i);
    if(m){const a=m[1].split(/[, ]+/).filter(Boolean).slice(0,3).map(Number);if(a.length===3&&a.every(Number.isFinite))return a.map(x=>x/255);}
    return f;
  }
  const rgba=(v,a,f)=>{const c=parseColor(v,null);return c?`rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${a})`:f;};
  const colors=()=>({
    card:parseColor(css('--card-bg','#111827'),[.067,.094,.153]),
    border:parseColor(css('--panel-border','#334155'),[.2,.255,.333]),
    accent:parseColor(css('--accent-blue','#38bdf8'),[.22,.74,.97]),
    cardCss:css('--card-bg','#111827'),panelCss:css('--panel-bg','#0f172a'),borderCss:css('--panel-border','#334155'),
    accentCss:css('--accent-blue','#38bdf8'),text:css('--text-main','#e5e7eb'),muted:css('--text-muted','#94a3b8'),
    rose:css('--accent-rose','#fb7185'),line:css('--line-color',css('--accent-blue','#38bdf8'))
  });

  function cells(r){
    const out=[];
    for(let x=Math.floor(r.left/CELL);x<=Math.floor(r.right/CELL);x++)for(let y=Math.floor(r.top/CELL);y<=Math.floor(r.bottom/CELL);y++)out.push(`${x}:${y}`);
    return out;
  }
  function makeIndex(items){
    const buckets=new Map(),membership=new Map();
    const insert=t=>{const ks=cells(rectOf(t,GAP));membership.set(idOf(t),ks);ks.forEach(k=>{if(!buckets.has(k))buckets.set(k,new Set());buckets.get(k).add(t);});};
    const remove=t=>{(membership.get(idOf(t))||[]).forEach(k=>{const b=buckets.get(k);b?.delete(t);if(b?.size===0)buckets.delete(k);});membership.delete(idOf(t));};
    items.forEach(insert);
    return {update:t=>{remove(t);insert(t);},query:r=>{const s=new Set();cells(r).forEach(k=>buckets.get(k)?.forEach(t=>s.add(t)));return [...s];}};
  }
  function boundsOf(tables){
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    tables.forEach(t=>{const r=rectOf(t);left=Math.min(left,r.left);top=Math.min(top,r.top);right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom);});
    return {left,top,right,bottom};
  }
  function makeState(key){
    const tables=source.tables.map(t=>({...t})),relations=source.relations||[],byId=new Map(tables.map(t=>[idOf(t),t])),relBy=new Map();
    relations.forEach(r=>[r.from,r.to].forEach(id=>{if(!relBy.has(id))relBy.set(id,[]);relBy.get(id).push(r);}));
    return {key,mode:key===RAW?'raw':'cull',tables,relations,byId,relBy,index:makeIndex(tables),bounds:boundsOf(tables),selected:null};
  }
  const ensureState=key=>{if(!states.has(key))states.set(key,makeState(key));return states.get(key);};

  function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s;}
  function initGpu(){
    if(gpu)return;
    const vs=`#version 300 es\nprecision highp float;in vec2 p;in vec4 r;in vec3 fill;in vec3 border;uniform vec2 viewport;uniform vec2 pan;uniform float scale;out vec2 uv;flat out vec3 vFill;flat out vec3 vBorder;void main(){vec2 s=(r.xy+p*r.zw)*scale+pan;gl_Position=vec4(s.x/viewport.x*2.-1.,1.-s.y/viewport.y*2.,0,1);uv=p;vFill=fill;vBorder=border;}`;
    const fs=`#version 300 es\nprecision mediump float;in vec2 uv;flat in vec3 vFill;flat in vec3 vBorder;out vec4 outColor;void main(){float e=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));outColor=vec4(mix(vBorder,vFill,smoothstep(.008,.03,e)),.96);}`;
    const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'link');
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
    let loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const instances=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,instances);const stride=40;
    [['r',4,0],['fill',3,16],['border',3,28]].forEach(([name,size,offset])=>{const l=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(l,1);});
    gl.bindVertexArray(null);
    gpu={program,vao,instances,viewport:gl.getUniformLocation(program,'viewport'),pan:gl.getUniformLocation(program,'pan'),scale:gl.getUniformLocation(program,'scale')};
  }
  function resize(){
    const r=workspace.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
    overlay.dataset.dpr=dpr;return r;
  }
  function center(){
    if(!state)return;const r=workspace.getBoundingClientRect(),b=state.bounds;
    scale=Math.max(.0035,Math.min(1,(r.width-100)/Math.max(1,b.right-b.left),(r.height-100)/Math.max(1,b.bottom-b.top)));
    panX=r.width/2-(b.left+b.right)/2*scale;panY=r.height/2-(b.top+b.bottom)/2*scale;requestDraw();
  }
  const world=(x,y)=>{const r=workspace.getBoundingClientRect();return {x:(x-r.left-panX)/scale,y:(y-r.top-panY)/scale};};
  function scene(){
    const r=workspace.getBoundingClientRect(),m=180/Math.max(scale,.0035),visible={left:-panX/scale-m,top:-panY/scale-m,right:(r.width-panX)/scale+m,bottom:(r.height-panY)/scale+m};
    return {visible,items:state.index.query(visible).filter(t=>intersects(rectOf(t),visible))};
  }
  function gpuInstance(t,c){const r=rectOf(t),border=state.selected===idOf(t)?c.accent:c.border;return [r.left,r.top,r.right-r.left,r.bottom-r.top,...c.card,...border];}
  function drawGpu(items,c){
    const r=resize(),data=new Float32Array(items.length*10);let i=0;
    items.forEach(t=>gpuInstance(t,c).forEach(v=>data[i++]=v));
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.instances);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(gpu.program);gl.bindVertexArray(gpu.vao);
    gl.uniform2f(gpu.viewport,r.width,r.height);gl.uniform2f(gpu.pan,panX,panY);gl.uniform1f(gpu.scale,scale);gl.drawArraysInstanced(gl.TRIANGLES,0,6,items.length);gl.bindVertexArray(null);
  }
  function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  function drawTable(t,c){
    if(W*scale<42)return;const x=t.x,y=t.y,h=heightOf(t);ctx.textBaseline='middle';
    if(scale<NAME_SCALE){ctx.fillStyle=c.accentCss;ctx.font="700 30px 'Fira Code', monospace";ctx.fillText(t.name,x+14,y+HEADER/2);return;}
    const g=ctx.createLinearGradient(x,y,x+W,y+HEADER);g.addColorStop(0,c.panelCss);g.addColorStop(1,c.cardCss);ctx.fillStyle=g;ctx.fillRect(x,y,W,HEADER);
    ctx.strokeStyle=c.borderCss;ctx.lineWidth=1/Math.max(scale,.34);ctx.beginPath();ctx.moveTo(x,y+HEADER);ctx.lineTo(x+W,y+HEADER);ctx.stroke();
    ctx.fillStyle=c.accentCss;ctx.font="600 14px 'Fira Code', monospace";ctx.fillText(t.name,x+16,y+18);ctx.fillStyle=c.muted;ctx.font="500 10px 'Inter', sans-serif";ctx.fillText(t.desc||'',x+16,y+38);
    roundRect(x+W-62,y+16,46,20,5);ctx.fillStyle=rgba(c.accentCss,.12,'rgba(56,189,248,.12)');ctx.fill();ctx.strokeStyle=c.borderCss;ctx.stroke();ctx.fillStyle=c.accentCss;ctx.font="700 9px 'Fira Code', monospace";ctx.textAlign='center';ctx.fillText('TABLE',x+W-39,y+26.5);ctx.textAlign='start';
    if(scale>=COLUMN_SCALE)(t.columns||[]).forEach((col,i)=>{const cy=y+HEADER+i*ROW+ROW/2;if(col.pk||col.fk){const color=col.pk?c.rose:c.accentCss;roundRect(x+16,cy-8,24,16,3);ctx.fillStyle=rgba(color,.16,'rgba(56,189,248,.16)');ctx.fill();ctx.strokeStyle=rgba(color,.48,'rgba(56,189,248,.48)');ctx.stroke();ctx.fillStyle=color;ctx.font="700 9px 'Fira Code', monospace";ctx.fillText(col.pk?'PK':'FK',x+18,cy+.5);}ctx.fillStyle=c.text;ctx.font="500 12px 'Fira Code', monospace";ctx.fillText(col.name,x+52,cy);ctx.fillStyle=c.muted;ctx.font="500 10px 'Fira Code', monospace";const tw=ctx.measureText(col.type).width;ctx.fillText(col.type,x+W-16-tw,cy);});
    if(state.selected===idOf(t)){roundRect(x,y,W,h,12);ctx.strokeStyle=c.accentCss;ctx.lineWidth=3/Math.max(scale,.08);ctx.stroke();}
  }
  const colY=(t,col)=>{const name=Array.isArray(col)?col[0]:col,i=t.columns?.findIndex(x=>x.name===name)??-1;return i>=0?t.y+HEADER+i*ROW+ROW/2:t.y+heightOf(t)/2;};
  function drawRelation(rel,c,visible){
    const a=state.byId.get(rel.from),b=state.byId.get(rel.to);if(!a||!b)return false;
    const ah=heightOf(a),bh=heightOf(b),ax=a.x+W/2,ay=a.y+ah/2,bx=b.x+W/2,by=b.y+bh/2,dx=bx-ax,dy=by-ay;
    if(!intersects({left:Math.min(ax,bx)-80,top:Math.min(ay,by)-80,right:Math.max(ax,bx)+80,bottom:Math.max(ay,by)+80},visible))return false;
    let x1,y1,x2,y2,c1x,c1y,c2x,c2y;
    if(Math.abs(dy)>Math.abs(dx)*1.2){x1=ax;x2=bx;y1=dy>0?a.y+ah+8:a.y-8;y2=dy>0?b.y-8:b.y+bh+8;const arm=Math.abs(y2-y1)*.5,mid=(x1+x2)/2;c1x=mid;c2x=mid;c1y=y1+(dy>0?arm:-arm);c2y=y2+(dy>0?-arm:arm);}
    else{y1=colY(a,rel.fromCol);y2=colY(b,rel.toCol);x1=dx>0?a.x+W+8:a.x-8;x2=dx>0?b.x-8:b.x+W+8;const arm=Math.max(Math.abs(x2-x1)*.55,40),mid=(y1+y2)/2;c1x=x1+(dx>0?arm:-arm);c2x=x2+(dx>0?-arm:arm);c1y=mid;c2y=mid;}
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);ctx.strokeStyle=c.line;ctx.globalAlpha=.72;ctx.lineWidth=Math.max(1.2/scale,1.6);ctx.setLineDash(rel.identifying?[]:[8/scale,5/scale]);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;return true;
  }
  function draw(){
    raf=0;if(!active||!state)return;resize();const c=colors(),s=scene(),gpuItems=state.mode==='raw'?state.tables:s.items,r=workspace.getBoundingClientRect(),dpr=Number(overlay.dataset.dpr)||1;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.save();ctx.translate(panX,panY);ctx.scale(scale,scale);
    let lines=0;if(scale>=RELATION_SCALE){const rels=new Set();s.items.forEach(t=>(state.relBy.get(idOf(t))||[]).forEach(rel=>rels.add(rel)));rels.forEach(rel=>{if(drawRelation(rel,c,s.visible))lines++;});}
    s.items.forEach(t=>drawTable(t,c));ctx.restore();drawGpu(gpuItems,c);
    if(zoomText)zoomText.innerText=`${Math.round(scale*100)}%`;const now=performance.now();if(lastFrame){const f=1000/Math.max(1,now-lastFrame);fps=fps?fps*.82+f*.18:f;}lastFrame=now;
    hud.textContent=`${state.mode==='raw'?'RAW':'CULL'} FULL · ${gpuItems.length}/${state.tables.length} geometry · ${s.items.length} visible · ${lines} lines · collision ${lastMoves} moves / ${lastMs.toFixed(2)} ms · peak ${peakMoves} · ${Math.min(999,Math.round(fps||0))} fps`;
  }
  const requestDraw=()=>{if(active&&!raf)raf=requestAnimationFrame(draw);};
  function hitTable(x,y){const rad=HIT_PX/Math.max(scale,.0035),items=state.index.query({left:x-rad,top:y-rad,right:x+rad,bottom:y+rad});for(let i=items.length-1;i>=0;i--){const t=items[i],r=rectOf(t);if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return t;}return null;}
  function separate(a,b,anchor){
    if(!b||a===b||idOf(b)===anchor)return false;const ar=rectOf(a),br=rectOf(b),dx=(br.left+br.right-ar.left-ar.right)/2,dy=(br.top+br.bottom-ar.top-ar.bottom)/2,ox=W+GAP-Math.abs(dx),oy=(heightOf(a)+heightOf(b))/2+GAP-Math.abs(dy);if(ox<=0||oy<=0)return false;if(ox<oy)b.x+=(dx===0?1:Math.sign(dx))*ox;else b.y+=(dy===0?1:Math.sign(dy))*oy;return true;
  }
  function fullCollision(seed,anchor){
    const t0=performance.now(),queue=[seed],visited=new Set([idOf(seed)]);let moves=0;
    while(queue.length){const a=queue.shift();for(const b of state.index.query(rectOf(a,GAP))){if(!separate(a,b,anchor))continue;state.index.update(b);moves++;const id=idOf(b);if(!visited.has(id)){visited.add(id);queue.push(b);}}}
    lastMoves=moves;peakMoves=Math.max(peakMoves,moves);lastMs=performance.now()-t0;
  }
  function zoomAt(f,x,y){const old=Math.max(scale,.0001),next=Math.max(.0035,Math.min(2.5,old*f)),wx=(x-panX)/old,wy=(y-panY)/old;scale=next;panX=x-wx*next;panY=y-wy*next;requestDraw();}

  overlay.addEventListener('mousedown',e=>{if(!active||e.button!==0)return;e.preventDefault();const p=world(e.clientX,e.clientY),t=hitTable(p.x,p.y);overlay.style.cursor='grabbing';if(t){drag={t,id:idOf(t),x:e.clientX,y:e.clientY,ox:p.x-t.x,oy:p.y-t.y,moved:false};state.selected=drag.id;selectedTableId=drag.id;}else pan={x:e.clientX,y:e.clientY,px:panX,py:panY};});
  window.addEventListener('mousemove',e=>{if(!active)return;if(drag){if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>=5)drag.moved=true;const p=world(e.clientX,e.clientY);drag.t.x=p.x-drag.ox;drag.t.y=p.y-drag.oy;state.index.update(drag.t);fullCollision(drag.t,drag.id);requestDraw();return;}if(pan){panX=pan.px+e.clientX-pan.x;panY=pan.py+e.clientY-pan.y;requestDraw();}});
  window.addEventListener('mouseup',()=>{if(!active)return;overlay.style.cursor='grab';if(drag){drag=null;state.bounds=boundsOf(state.tables);requestDraw();return;}pan=null;});
  window.addEventListener('wheel',e=>{if(!active||!workspace.contains(e.target))return;e.preventDefault();e.stopImmediatePropagation();const r=workspace.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:.88,e.clientX-r.left,e.clientY-r.top);},{capture:true,passive:false});
  window.addEventListener('resize',requestDraw);

  function enter(key){prevRender?.call(window,'__argus_full_collision_off__');currentView=key;state=ensureState(key);active=true;legacy.style.display='none';canvas.style.display='block';overlay.style.display='block';hud.style.display='block';pan=null;drag=null;lastFrame=0;fps=0;lastMoves=0;lastMs=0;peakMoves=0;initGpu();center();requestDraw();return true;}
  function leave(){active=false;state=null;canvas.style.display='none';overlay.style.display='none';hud.style.display='none';pan=null;drag=null;}
  window.renderView=function(key){if(key===RAW||key===CULL)return enter(key);leave();return prevRender?.call(this,key);};
  window.updateConnections=function(...args){if(active)return requestDraw();return prevUpdate?.apply(this,args);};
  window.applyLayout=function(type,...args){if(active){center();return true;}return prevLayout?.call(this,type,...args);};
  window.addEventListener('load',()=>{const z=window.zoomCanvas,r=window.resetZoom,a=window.applyTransform;window.zoomCanvas=function(f,x,y){if(!active)return z?.call(this,f,x,y);const rect=workspace.getBoundingClientRect();zoomAt(f,Number.isFinite(x)?x:rect.width/2,Number.isFinite(y)?y:rect.height/2);return true;};window.resetZoom=function(...args){if(!active)return r?.apply(this,args);center();return true;};window.applyTransform=function(...args){if(active){requestDraw();return true;}return a?.apply(this,args);};});
  window.ARGUSFullCollisionLab={isActive:()=>active,requestDraw,reset:()=>states.clear()};
})();
