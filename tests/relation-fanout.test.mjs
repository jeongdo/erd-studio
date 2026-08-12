import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'..')
const read=name=>fs.readFileSync(path.join(root,name),'utf8')

function loadFanout(){
  const compact=points=>{
    const out=[]
    for(const p of points){const prev=out.at(-1);if(!prev||prev.x!==p.x||prev.y!==p.y)out.push(p)}
    return out
  }
  const E={
    RelationPortSelector:{sideVector:side=>side==='right'?{x:1,y:0}:side==='left'?{x:-1,y:0}:side==='bottom'?{x:0,y:1}:{x:0,y:-1}},
    RelationRouteStrategies:{compact}
  }
  const context={window:null,console,Math,Number,Map,Set}
  context.window=context;context.window.ERDEditor=E
  vm.runInNewContext(read('editor-relation-fanout.js'),context,{filename:'editor-relation-fanout.js'})
  return E.RelationFanout
}

function edge(key,targetY){
  return {key,rel:{from:'A',to:`T_${key}`},direct:{port:{fromSide:'right',toSide:'left',p0:{x:100,y:50},p3:{x:300,y:targetY}}}}
}

test('three edges on one side receive symmetric fan-out lanes',()=>{
  const fanout=loadFanout()
  const lanes=fanout.assign([edge('a',10),edge('b',50),edge('c',90)])
  assert.equal(lanes.get('a').fromLane,-16)
  assert.equal(lanes.get('b').fromLane,0)
  assert.equal(lanes.get('c').fromLane,16)
  assert.equal(lanes.get('b').fromBundleSize,3)
  assert.equal(lanes.get('b').fromBundle,'A|right')
})

test('fan-out anchors keep semantic endpoints and diverge outside the card',()=>{
  const fanout=loadFanout()
  const port={fromSide:'right',toSide:'left',p0:{x:100,y:50},p3:{x:300,y:80}}
  const anchor=fanout.anchors(port,{fromLane:16,toLane:-16})
  assert.deepEqual({x:anchor.p0.x,y:anchor.p0.y},{x:100,y:50})
  assert.deepEqual({x:anchor.p3.x,y:anchor.p3.y},{x:300,y:80})
  assert.equal(anchor.sourceForward.x,128)
  assert.equal(anchor.start.y,66)
  assert.equal(anchor.targetForward.x,272)
  assert.equal(anchor.end.y,64)
})

test('composed soft bundle preserves both endpoints',()=>{
  const fanout=loadFanout()
  const port={fromSide:'right',toSide:'left',p0:{x:100,y:50},p3:{x:300,y:80}}
  const anchor=fanout.anchors(port,{fromLane:16,toLane:-16})
  const points=fanout.compose([anchor.start,{x:200,y:66},anchor.end],anchor)
  assert.deepEqual({x:points[0].x,y:points[0].y},{x:100,y:50})
  assert.deepEqual({x:points.at(-1).x,y:points.at(-1).y},{x:300,y:80})
  assert.ok(points.length>=5)
})

test('fan-out loads after port selector and before router modes',()=>{
  const main=read('src/main.jsx')
  const ports=main.indexOf("'/editor-relation-port-selector.js'")
  const fanout=main.indexOf("'/editor-relation-fanout.js'")
  const modes=main.indexOf("'/editor-relation-router-modes.js'")
  assert.ok(ports>=0&&fanout>ports&&modes>fanout)
})
