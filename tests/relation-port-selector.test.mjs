import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'..')
const read=name=>fs.readFileSync(path.join(root,name),'utf8')

function loadSelector(){
  const E={
    RelationRouterV2:{
      sampleCubic(d){
        const n=String(d).match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[]
        return n.length===8?[{x:n[0],y:n[1]},{x:n[6],y:n[7]}]:[]
      }
    },
    RelationRouteStrategies:{
      intersections(){return 0},
      length(points){return points.slice(0,-1).reduce((sum,p,i)=>sum+Math.hypot(points[i+1].x-p.x,points[i+1].y-p.y),0)}
    }
  }
  const context={window:null,console,Math,Number,Set,Map}
  context.window=context
  context.window.ERDEditor=E
  vm.runInNewContext(read('editor-relation-port-selector.js'),context,{filename:'editor-relation-port-selector.js'})
  return E.RelationPortSelector
}

const canvas={left:0,top:0,right:1000,bottom:1000}
const col=(left,top,right=left+80,bottom=top+20)=>({left,top,right,bottom})
const card=(left,top,right,bottom)=>({left,top,right,bottom})

test('horizontal neighbors prefer facing right-left ports',()=>{
  const selector=loadSelector()
  const selected=selector.select({
    fromColumn:col(10,40),toColumn:col(310,40),
    fromCard:card(0,0,100,120),toCard:card(300,0,400,120),
    canvas,scale:1,obstacles:[]
  })
  assert.equal(selected.signature,'right-left')
  assert.equal(selected.p0.x,112)
  assert.equal(selected.p3.x,288)
})

test('vertical neighbors prefer facing bottom-top ports',()=>{
  const selector=loadSelector()
  const selected=selector.select({
    fromColumn:col(10,40),toColumn:col(10,340),
    fromCard:card(0,0,100,120),toCard:card(0,300,100,420),
    canvas,scale:1,obstacles:[]
  })
  assert.equal(selected.signature,'bottom-top')
  assert.equal(selected.p0.y,132)
  assert.equal(selected.p3.y,288)
})

test('near-axis movement keeps the previous port inside hysteresis',()=>{
  const selector=loadSelector()
  const options={
    fromColumn:col(10,40),toColumn:col(120,55),
    fromCard:card(0,0,100,120),toCard:card(110,15,210,135),
    canvas,scale:1,obstacles:[]
  }
  const best=selector.select(options)
  const stable=selector.select({...options,previous:'bottom-top'})
  assert.equal(best.signature,'right-left')
  assert.equal(stable.signature,'bottom-top')
})

test('port selector loads after strategies and before router modes',()=>{
  const main=read('src/main.jsx')
  const strategies=main.indexOf("'/editor-relation-router-strategies.js'")
  const ports=main.indexOf("'/editor-relation-port-selector.js'")
  const modes=main.indexOf("'/editor-relation-router-modes.js'")
  assert.ok(strategies>=0&&ports>strategies&&modes>ports)
})

test('port selector parses as JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(read('editor-relation-port-selector.js'),{filename:'editor-relation-port-selector.js'}))
})
