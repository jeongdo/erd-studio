/** Fan-out and soft bundling geometry for crowded relation ports. */
(() => {
  'use strict';
  const E=window.ERDEditor;
  const P=E?.RelationPortSelector;
  const S=E?.RelationRouteStrategies;
  if(!E||!P||!S)return;

  const FAN_GAP=16;
  const MAX_LANE=48;
  const STUB=28;

  const normal=side=>(side==='left'||side==='right')?{x:0,y:1}:{x:1,y:0};
  const clampLane=value=>Math.max(-MAX_LANE,Math.min(MAX_LANE,value));
  const point=(p,v,d=1)=>({x:p.x+v.x*d,y:p.y+v.y*d});

  function endpointGroups(entries=[]){
    const groups=new Map();
    const add=(groupKey,item)=>{if(!groups.has(groupKey))groups.set(groupKey,[]);groups.get(groupKey).push(item);};
    entries.forEach(entry=>{
      const port=entry.direct?.port;if(!port)return;
      add(`${entry.rel.from}|${port.fromSide}`,{entry,role:'from',target:port.p3});
      add(`${entry.rel.to}|${port.toSide}`,{entry,role:'to',target:port.p0});
    });
    return groups;
  }

  function assign(entries=[]){
    const lanes=new Map(entries.map(entry=>[entry.key,{fromLane:0,toLane:0,fromBundleSize:1,toBundleSize:1,fromBundle:'',toBundle:''}]));
    endpointGroups(entries).forEach((items,groupKey)=>{
      if(items.length<=1)return;
      const side=groupKey.split('|').at(-1);
      const horizontal=side==='left'||side==='right';
      items.sort((a,b)=>{
        const av=horizontal?a.target.y:a.target.x,bv=horizontal?b.target.y:b.target.x;
        return av-bv||a.entry.key.localeCompare(b.entry.key);
      });
      items.forEach((item,index)=>{
        const state=lanes.get(item.entry.key);
        const lane=clampLane((index-(items.length-1)/2)*FAN_GAP);
        state[`${item.role}Lane`]=lane;
        state[`${item.role}BundleSize`]=items.length;
        state[`${item.role}Bundle`]=groupKey;
      });
    });
    return lanes;
  }

  function anchors(port,laneState={}){
    const fv=P.sideVector(port.fromSide),tv=P.sideVector(port.toSide);
    const fn=normal(port.fromSide),tn=normal(port.toSide);
    const fromLane=laneState.fromLane||0,toLane=laneState.toLane||0;
    const sourceForward=point(port.p0,fv,STUB);
    const start=point(sourceForward,fn,fromLane);
    const targetForward=point(port.p3,tv,STUB);
    const end=point(targetForward,tn,toLane);
    return {p0:port.p0,p3:port.p3,sourceForward,start,end,targetForward,fromLane,toLane};
  }

  function compose(routePoints=[],anchor){
    if(!anchor||!routePoints.length)return routePoints;
    const interior=routePoints.slice(1,-1);
    return S.compact([anchor.p0,anchor.sourceForward,anchor.start,...interior,anchor.end,anchor.targetForward,anchor.p3]);
  }

  function active(state={}){
    return (state.fromBundleSize||1)>1||(state.toBundleSize||1)>1||!!state.fromLane||!!state.toLane;
  }

  E.RelationFanout={assign,anchors,compose,active,normal,endpointGroups,constants:{FAN_GAP,MAX_LANE,STUB}};
})();
