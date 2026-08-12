import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'..')
const read=name=>fs.readFileSync(path.join(root,name),'utf8')

function loadModes(){
  const actions=new Map(),storage=new Map(),listeners=new Map()
  const E={
    RelationRouting:{readCanvasScale:()=>1,computeRoute:()=>({d:'M 0 0 C 1 0, 2 0, 3 0',mid:{x:1.5,y:0}})},
    RelationIdentity:{relationKey:()=> 'r',parallelLane:()=>0,laneRoute:r=>r,resolveRelation:()=>null},
    RelationRouterV2:{sampleCubic:()=>[],parseCubic:()=>null,polylinePath:()=>'',polylineMidpoint:()=>({x:0,y:0})},
    RelationRouteStrategies:{choose:()=>null,corridor:()=>null,astar:()=>null,score:x=>x},
    RelationPortSelector:{select:()=>null,cubic:()=>({d:'M 0 0 C 1 0, 2 0, 3 0',mid:{x:1.5,y:0}})},
    RelationFanout:{assign:()=>new Map(),active:()=>false,anchors:()=>null,compose:points=>points},
    Actions:{register:a=>actions.set(a.id,a)},
    Advanced:{showToast(){}},currentSchema:()=>({relations:[]}),columnArray:v=>[v]
  }
  const context={window:null,document:{getElementById(){return null},querySelectorAll(){return[]},addEventListener(type,fn){listeners.set(type,fn)},dispatchEvent(){}},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},requestAnimationFrame:fn=>{fn();return 1},CustomEvent:class{},console,Math,Number,Map,Set,Object}
  context.window=context;context.window.ERDEditor=E;context.window.updateConnections=()=>{}
  vm.runInNewContext(read('editor-relation-router-modes.js'),context,{filename:'editor-relation-router-modes.js'})
  return {E,actions,storage,listeners}
}

test('router modes default to Auto and persist explicit selection',()=>{
  const {E,actions,storage}=loadModes()
  assert.equal(E.RelationRouterModes.mode(),'auto')
  actions.get('view.router.astar').run()
  assert.equal(E.RelationRouterModes.mode(),'astar')
  assert.equal(storage.get('erd_relation_router_mode_v1'),'astar')
  assert.equal(actions.get('view.router.astar').checked(),true)
  assert.equal(actions.get('view.router.auto').checked(),false)
})

test('router controller registers all four strategies and benchmark action',()=>{
  const {actions}=loadModes()
  for(const id of ['view.router.auto','view.router.direct','view.router.corridor','view.router.astar','tools.routerBenchmark']) assert.ok(actions.get(id),id)
})

test('router controller keeps separate route and port histories and clears them on project changes',()=>{
  const {E,listeners}=loadModes()
  E.RelationRouterModes.routeHistory.set('r','astar:visibility-grid')
  E.RelationRouterModes.portHistory.set('r','right-left')
  listeners.get('erd:project-loaded')?.()
  assert.equal(E.RelationRouterModes.routeHistory.size,0)
  assert.equal(E.RelationRouterModes.portHistory.size,0)
})

test('soft bundle is accepted only when obstacle and crossing quality do not regress',()=>{
  const {E}=loadModes()
  const plain={intersections:0,crossings:2,score:100}
  assert.equal(E.RelationRouterModes.preferBundled(plain,{intersections:0,crossings:1,score:250}),true)
  assert.equal(E.RelationRouterModes.preferBundled(plain,{intersections:1,crossings:0,score:10}),false)
  assert.equal(E.RelationRouterModes.preferBundled(plain,{intersections:0,crossings:3,score:10}),false)
})

test('router menu extension loads after desktop shell and exposes strategy actions',()=>{
  const main=read('src/main.jsx')
  const shell=main.indexOf("'/editor-desktop-shell.js'")
  const menu=main.indexOf("'/editor-relation-router-menu.js'")
  const welcome=main.indexOf("'/editor-welcome.js'")
  assert.ok(shell>=0&&menu>shell&&welcome>menu)
  const source=read('editor-relation-router-menu.js')
  for(const id of ['view.router.auto','view.router.direct','view.router.corridor','view.router.astar','tools.routerBenchmark']) assert.match(source,new RegExp(id.replaceAll('.','\\.')))
})
