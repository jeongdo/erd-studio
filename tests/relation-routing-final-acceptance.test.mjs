import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'..')
const read=name=>fs.readFileSync(path.join(root,name),'utf8')

function parseCubic(d){
  const n=String(d).match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[]
  return n.length===8?{p0:{x:n[0],y:n[1]},p1:{x:n[2],y:n[3]},p2:{x:n[4],y:n[5]},p3:{x:n[6],y:n[7]}}:null
}
function sampleCubic(d,steps=24){
  const c=parseCubic(d);if(!c)return[]
  return Array.from({length:steps+1},(_,i)=>{const t=i/steps,u=1-t;return{
    x:u*u*u*c.p0.x+3*u*u*t*c.p1.x+3*u*t*t*c.p2.x+t*t*t*c.p3.x,
    y:u*u*u*c.p0.y+3*u*u*t*c.p1.y+3*u*t*t*c.p2.y+t*t*t*c.p3.y
  }})
}

function loadEngine(){
  const E={RelationRouterV2:{sampleCubic,parseCubic}}
  const context={window:null,console,Math,Number,Map,Set,Object}
  context.window=context;context.window.ERDEditor=E
  vm.runInNewContext(read('editor-relation-router-strategies.js'),context)
  vm.runInNewContext(read('editor-relation-port-selector.js'),context)
  vm.runInNewContext(read('editor-relation-fanout.js'),context)
  return E
}

function scenario(participants,relationCount){
  const tables=Array.from({length:participants},(_,i)=>({
    id:`T_${i}`,x:(i%5)*430,y:Math.floor(i/5)*520,width:360,height:i%7===0?400:180
  }))
  const relations=[],used=new Set();let cursor=0
  while(relations.length<relationCount){
    const from=cursor%participants,step=2+Math.floor(cursor/participants),to=(from+step)%participants
    cursor+=1;const key=[from,to].sort().join('|');if(from===to||used.has(key))continue
    used.add(key);relations.push({from,to,key:`R_${relations.length}`,fromSlot:relations.length%4,toSlot:(relations.length*3)%4})
  }
  return {tables,relations}
}

const canvas={left:0,top:0,right:5000,bottom:5000}
const cardRect=t=>({left:t.x,top:t.y,right:t.x+t.width,bottom:t.y+t.height})
const columnRect=(t,slot)=>{const y=t.y+42+(slot%4)*28;return{left:t.x+24,top:y,right:t.x+t.width-24,bottom:y+20}}
const obstacles=(data,from,to)=>data.tables.filter((_,i)=>i!==from&&i!==to).map(t=>({left:t.x-18,top:t.y-18,right:t.x+t.width+18,bottom:t.y+t.height+18}))
const segs=(points,owner)=>points.slice(0,-1).map((a,i)=>({a,b:points[i+1],owner}))

function prepare(E,data){
  const P=E.RelationPortSelector
  return data.relations.map(rel=>{
    const from=data.tables[rel.from],to=data.tables[rel.to],obs=obstacles(data,rel.from,rel.to)
    const port=P.select({fromColumn:columnRect(from,rel.fromSlot),toColumn:columnRect(to,rel.toSlot),fromCard:cardRect(from),toCard:cardRect(to),canvas,scale:1,obstacles:obs})
    const cubic=parseCubic(port.route.d)
    return {key:rel.key,rel:{from:from.id,to:to.id},obs,direct:{port,lane:0,d:port.route.d},cubic,difficulty:port.hits*1_000_000+obs.length*1000+port.distance}
  })
}

function chooseFinal(E,entry,laneState,routed){
  const S=E.RelationRouteStrategies,P=E.RelationPortSelector,F=E.RelationFanout
  const plain=S.choose({directPoints:sampleCubic(entry.direct.d),p0:entry.cubic.p0,p3:entry.cubic.p3,obstacles:entry.obs,lane:0,routed,mode:'auto'})
  if(!F.active(laneState))return plain
  const anchor=F.anchors(entry.direct.port,laneState)
  const raw=P.cubic(anchor.start,anchor.end,entry.direct.port.fromSide,entry.direct.port.toSide)
  const c=S.corridor(anchor.start,anchor.end,entry.obs,0,routed,''),a=S.astar(anchor.start,anchor.end,entry.obs,0,routed,'')
  const base=[c,a].filter(Boolean).sort((x,y)=>x.score-y.score||x.signature.localeCompare(y.signature))[0]
  if(!base)return plain
  const bundled=S.score({...base,points:F.compose(base.points,anchor)},entry.obs,routed,'')
  if(bundled.intersections!==plain.intersections)return bundled.intersections<plain.intersections?bundled:plain
  if(bundled.crossings!==plain.crossings)return bundled.crossings<plain.crossings?bundled:plain
  return bundled.score<=plain.score+220?bundled:plain
}

function runFinal(E,spec){
  const data=scenario(spec.participants,spec.relations),entries=prepare(E,data),lanes=E.RelationFanout.assign(entries),routed=[]
  entries.sort((a,b)=>b.difficulty-a.difficulty||a.key.localeCompare(b.key))
  const total={hits:0,crossings:0,length:0,turns:0,fanout:0}
  entries.forEach(entry=>{
    const laneState=lanes.get(entry.key)||{},candidate=chooseFinal(E,entry,laneState,routed)
    assert.ok(candidate)
    total.hits+=candidate.intersections;total.crossings+=candidate.crossings;total.length+=candidate.length;total.turns+=candidate.turns
    if(E.RelationFanout.active(laneState)&&candidate.algorithm!=='direct')total.fanout+=1
    routed.push(...segs(candidate.points,entry.key))
  })
  return total
}

function runDirect(E,spec){
  const data=scenario(spec.participants,spec.relations),entries=prepare(E,data),routed=[]
  const total={hits:0,crossings:0}
  entries.forEach(entry=>{
    const c=E.RelationRouteStrategies.choose({directPoints:sampleCubic(entry.direct.d),p0:entry.cubic.p0,p3:entry.cubic.p3,obstacles:entry.obs,routed,mode:'direct'})
    total.hits+=c.intersections;total.crossings+=c.crossings;routed.push(...segs(c.points,entry.key))
  })
  return total
}

for(const spec of [
  {name:'master-scale',participants:20,relations:35},
  {name:'analysis-scale',participants:24,relations:37}
]){
  test(`${spec.name} final Auto keeps tables unpierced and beats direct crossing noise`,()=>{
    const E=loadEngine(),direct=runDirect(E,spec),final=runFinal(E,spec)
    assert.ok(direct.hits>0)
    assert.equal(final.hits,0)
    assert.ok(final.crossings<direct.crossings,`${final.crossings} !< ${direct.crossings}`)
    assert.ok(final.length>0)
  })
}

test('final pipeline preserves relation endpoint identity while adding local fan-out',()=>{
  const E=loadEngine(),data=scenario(20,35),entries=prepare(E,data),lanes=E.RelationFanout.assign(entries)
  const crowded=entries.find(entry=>E.RelationFanout.active(lanes.get(entry.key)||{}))
  assert.ok(crowded)
  const state=lanes.get(crowded.key),anchor=E.RelationFanout.anchors(crowded.direct.port,state)
  assert.equal(anchor.p0.x,crowded.direct.port.p0.x)
  assert.equal(anchor.p0.y,crowded.direct.port.p0.y)
  assert.equal(anchor.p3.x,crowded.direct.port.p3.x)
  assert.equal(anchor.p3.y,crowded.direct.port.p3.y)
})
