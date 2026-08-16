/** ARGUS lab: pure WebGL2 geometry, 100k instanced cards, no detail overlay. */
(() => {
  'use strict';
  const VIEW='performance_lab_webgl_geometry_100000', W=360, H=256;
  const workspace=document.getElementById('workspace'), legacy=document.getElementById('canvas-layer'), zoomText=document.getElementById('zoom-text');
  if(!workspace||!legacy||typeof schemaData==='undefined') return;
  const previousRender=window.renderView, previousUpdate=window.updateConnections, previousLayout=window.applyLayout;
  const canvas=document.createElement('canvas');
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'22',display:'none',cursor:'grab'});
  workspace.appendChild(canvas);
  const hud=document.createElement('div');
  Object.assign(hud.style,{position:'absolute',top:'12px',left:'12px',zIndex:'83',display:'none',padding:'6px 9px',borderRadius:'7px',border:'1px solid var(--panel-border)',background:'var(--panel-bg)',color:'var(--text-muted)',font:"600 11px 'Fira Code', monospace",pointerEvents:'none'});
  workspace.appendChild(hud);
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false}); if(!gl) return;
  let active=false, tables=[], bounds=null, gpu=null, pan=null, raf=0, prep=0, last=0, fps=0;
  const css=(n,f)=>getComputedStyle(document.body).getPropertyValue(n).trim()||f;
  const rgb=v=>{const h=css(v,v).replace('#',''); return h.length===6?[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255):[.1,.15,.2];};
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  function init(){if(gpu)return;const vs=`#version 300 es\nprecision highp float;in vec2 p;in vec4 r;uniform vec2 vp,pan;uniform float scale;out vec2 uv;void main(){vec2 s=(r.xy+p*r.zw)*scale+pan;gl_Position=vec4(s.x/vp.x*2.-1.,1.-s.y/vp.y*2.,0,1);uv=p;}`;const fs=`#version 300 es\nprecision mediump float;in vec2 uv;uniform vec3 fill,border;out vec4 o;void main(){float e=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));o=vec4(mix(border,fill,smoothstep(.008,.03,e)),.96);}`;const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);const vao=gl.createVertexArray();gl.bindVertexArray(vao);const q=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,q);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);let a=gl.getAttribLocation(p,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);a=gl.getAttribLocation(p,'r');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,16,0);gl.vertexAttribDivisor(a,1);gl.bindVertexArray(null);gpu={p,vao,buf,vp:gl.getUniformLocation(p,'vp'),pan:gl.getUniformLocation(p,'pan'),scale:gl.getUniformLocation(p,'scale'),fill:gl.getUniformLocation(p,'fill'),border:gl.getUniformLocation(p,'border')};}
  function prepare(){const t0=performance.now();tables=schemaData[VIEW].tables;init();const data=new Float32Array(tables.length*4);let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity,i=0;for(const x of tables){const h=52+(x.columns?.length||0)*34+12;data[i++]=x.x;data[i++]=x.y;data[i++]=W;data[i++]=h;l=Math.min(l,x.x);t=Math.min(t,x.y);r=Math.max(r,x.x+W);b=Math.max(b,x.y+h);}gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);bounds={l,t,r,b};prep=performance.now()-t0;center();}
  function resize(){const r=workspace.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.round(r.width*d),h=Math.round(r.height*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}return{r,d};}
  function center(){const r=workspace.getBoundingClientRect();scale=Math.max(.0035,Math.min(1,(r.width-100)/(bounds.r-bounds.l),(r.height-100)/(bounds.b-bounds.t)));panX=r.width/2-(bounds.l+bounds.r)/2*scale;panY=r.height/2-(bounds.t+bounds.b)/2*scale;request();}
  function draw(){raf=0;if(!active)return;const {r,d}=resize();gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(gpu.p);gl.bindVertexArray(gpu.vao);gl.uniform2f(gpu.vp,r.width*d,r.height*d);gl.uniform2f(gpu.pan,panX*d,panY*d);gl.uniform1f(gpu.scale,scale*d);gl.uniform3fv(gpu.fill,new Float32Array(rgb('--card-bg')));gl.uniform3fv(gpu.border,new Float32Array(rgb('--panel-border')));gl.drawArraysInstanced(gl.TRIANGLES,0,6,tables.length);const now=performance.now();if(last){const f=1000/Math.max(1,now-last);fps=fps?fps*.82+f*.18:f;}last=now;hud.textContent=`WEBGL2 GEO · ${tables.length} instances · ${Math.min(999,Math.round(fps||0))} fps · prep ${prep.toFixed(1)} ms`;if(zoomText)zoomText.innerText=`${Math.round(scale*100)}%`;}
  function request(){if(active&&!raf)raf=requestAnimationFrame(draw);}
  function zoomAt(f,x,y){const old=Math.max(scale,.0001),next=Math.max(.0035,Math.min(2.5,old*f)),wx=(x-panX)/old,wy=(y-panY)/old;scale=next;panX=x-wx*next;panY=y-wy*next;request();return true;}
  function enter(){previousRender?.call(window,'__argus_geo_off__');currentView=VIEW;active=true;legacy.style.display='none';canvas.style.display='block';hud.style.display='block';last=0;fps=0;prepare();}
  function leave(){active=false;canvas.style.display='none';hud.style.display='none';pan=null;}
  canvas.addEventListener('mousedown',e=>{if(!active||e.button!==0)return;pan={x:e.clientX,y:e.clientY,px:panX,py:panY};canvas.style.cursor='grabbing';});
  window.addEventListener('mousemove',e=>{if(active&&pan){panX=pan.px+e.clientX-pan.x;panY=pan.py+e.clientY-pan.y;request();}});
  window.addEventListener('mouseup',()=>{if(active){pan=null;canvas.style.cursor='grab';}});
  window.addEventListener('wheel',e=>{if(!active||!workspace.contains(e.target))return;e.preventDefault();e.stopImmediatePropagation();const r=workspace.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:.88,e.clientX-r.left,e.clientY-r.top);},{capture:true,passive:false});
  window.renderView=function(k){if(k===VIEW)return enter();leave();return previousRender?.call(this,k);};
  window.updateConnections=function(...a){if(active)return request();return previousUpdate?.apply(this,a);};
  window.applyLayout=function(type,...a){if(active){center();return true;}return previousLayout?.call(this,type,...a);};
  window.addEventListener('load',()=>{const z=window.zoomCanvas,r=window.resetZoom,a=window.applyTransform;window.zoomCanvas=function(f,x,y){if(!active)return z?.call(this,f,x,y);const q=workspace.getBoundingClientRect();return zoomAt(f,Number.isFinite(x)?x:q.width/2,Number.isFinite(y)?y:q.height/2);};window.resetZoom=function(...x){if(!active)return r?.apply(this,x);center();return true;};window.applyTransform=function(...x){if(active){request();return true;}return a?.apply(this,x);};});
})();
