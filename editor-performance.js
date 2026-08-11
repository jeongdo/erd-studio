/** Viewport culling and final render hooks for large ERDs. */
(() => {
  'use strict';
  const E=window.ERDEditor,A=E.Advanced,THRESHOLD=80,MARGIN=500,detached=new Map();
  A.getDetachedCard=id=>detached.get(id);
  function getCard(id){return document.getElementById(`card-${id}`)||detached.get(id)}
  function cull(){const view=A.view();if(!view)return;if(view.tables.length<THRESHOLD){if(detached.size){detached.forEach(c=>cardsContainer.appendChild(c));detached.clear();A.legacyUpdateConnections?.();A.decorateRelations?.();}const s=document.getElementById('culling-status');if(s)s.textContent='';return;}const left=(-panX)/scale-MARGIN,top=(-panY)/scale-MARGIN,right=left+workspace.clientWidth/scale+MARGIN*2,bottom=top+workspace.clientHeight/scale+MARGIN*2;let changed=false;view.tables.forEach(t=>{const id=E.tableId(t),x=t.x||0,y=t.y||0,h=60+(t.columns?.length||0)*34,visible=x+360>=left&&x<=right&&y+h>=top&&y<=bottom,inDom=document.getElementById(`card-${id}`);if(!visible&&inDom){detached.set(id,inDom);inDom.remove();changed=true}else if(visible&&!inDom&&detached.has(id)){cardsContainer.appendChild(detached.get(id));detached.delete(id);changed=true}});if(changed){A.applyTableColors?.();A.legacyUpdateConnections?.();A.decorateRelations?.();}const status=document.getElementById('culling-status');if(status)status.textContent=`${view.tables.length-detached.size}/${view.tables.length}`;}
  function schedule(){cancelAnimationFrame(schedule.raf);schedule.raf=requestAnimationFrame(cull)}
  A.cullViewport=cull;
  const baseRender=window.renderView;window.renderView=function(viewKey){detached.clear();baseRender(viewKey);requestAnimationFrame(()=>{A.renderCanvasExtras?.();schedule();A.decorateRelations?.()})};
  const baseTransform=window.applyTransform;window.applyTransform=function(){baseTransform();schedule()};
  const baseSearch=window.handleSearch;window.handleSearch=function(){if((A.view()?.tables?.length||0)<THRESHOLD)return baseSearch();const q=document.getElementById('search-input').value.toLowerCase().trim();A.view().tables.forEach(t=>{const card=getCard(E.tableId(t));if(!card)return;const match=t.name.toLowerCase().includes(q)||(t.desc&&t.desc.toLowerCase().includes(q))||t.columns.some(c=>c.name.toLowerCase().includes(q));card.classList.toggle('dimmed',!!q&&!match)})};
  window.addEventListener('resize',schedule);
  setTimeout(()=>{A.renderCanvasExtras?.();schedule();A.decorateRelations?.()},0);
})();
