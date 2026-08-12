import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'..')

function loadStrategies() {
  const E={}
  const context={window:null,console,Math,Number,Map,Set}
  context.window=context; context.window.ERDEditor=E
  vm.runInNewContext(fs.readFileSync(path.join(root,'editor-relation-router-strategies.js'),'utf8'),context)
  return E.RelationRouteStrategies
}

function scenario(participants, relationCount) {
  const tables=Array.from({length:participants},(_,i)=>({
    id:`T_${i}`, x:(i%5)*430, y:Math.floor(i/5)*520, width:360, height:i%7===0?400:180
  }))
  const relations=[]; const used=new Set(); let cursor=0
  while(relations.length<relationCount){
    const from=cursor%participants, step=2+Math.floor(cursor/participants), to=(from+step)%participants
    cursor+=1
    const key=[from,to].sort().join('|')
    if(from===to||used.has(key))continue
    used.add(key); relations.push([from,to])
  }
  return {tables,relations}
}

function endpoints(a,b){
  const ac={x:a.x+a.width/2,y:a.y+a.height/2},bc={x:b.x+b.width/2,y:b.y+b.height/2}
  const dx=bc.x-ac.x,dy=bc.y-ac.y
  if(Math.abs(dx)>=Math.abs(dy)) return [
    {x:dx>=0?a.x+a.width:a.x,y:ac.y}, {x:dx>=0?b.x:b.x+b.width,y:bc.y}
  ]
  return [{x:ac.x,y:dy>=0?a.y+a.height:a.y},{x:bc.x,y:dy>=0?b.y:b.y+b.height}]
}

const directPoints=(p0,p3)=>Array.from({length:25},(_,i)=>({x:p0.x+(p3.x-p0.x)*i/24,y:p0.y+(p3.y-p0.y)*i/24}))

function run(S,spec,mode){
  const data=scenario(spec.participants,spec.relations), routed=[]
  const total={relations:0,hits:0,crossings:0,length:0,turns:0}
  data.relations.forEach(([fromIndex,toIndex],index)=>{
    const from=data.tables[fromIndex],to=data.tables[toIndex], [p0,p3]=endpoints(from,to)
    const obstacles=data.tables.filter((_,i)=>i!==fromIndex&&i!==toIndex).map(t=>({left:t.x-18,top:t.y-18,right:t.x+t.width+18,bottom:t.y+t.height+18}))
    const candidate=S.choose({directPoints:directPoints(p0,p3),p0,p3,obstacles,routed,mode})
    assert.ok(candidate,`${spec.name} ${mode} relation ${index}`)
    total.relations+=1; total.hits+=candidate.intersections; total.crossings+=candidate.crossings; total.length+=candidate.length; total.turns+=candidate.turns
    routed.push(...candidate.points.slice(0,-1).map((a,i)=>({a,b:candidate.points[i+1]})))
  })
  return total
}

for(const spec of [
  {name:'master-scale',participants:20,relations:35},
  {name:'analysis-scale',participants:24,relations:37}
]){
  test(`${spec.name} router benchmark prefers obstacle-free strategies`,()=>{
    const S=loadStrategies()
    const direct=run(S,spec,'direct'), corridor=run(S,spec,'corridor'), astar=run(S,spec,'astar'), auto=run(S,spec,'auto')
    assert.equal(auto.relations,spec.relations)
    assert.ok(direct.hits>0)
    assert.equal(astar.hits,0)
    assert.equal(auto.hits,0)
    assert.ok(auto.crossings<direct.crossings)
    assert.ok(corridor.hits>=auto.hits)
  })
}
