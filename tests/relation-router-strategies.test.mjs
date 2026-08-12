import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadStrategies() {
  const E = {}
  const context = { window:null, console, Math, Number, Map, Set }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-relation-router-strategies.js'), context, { filename:'editor-relation-router-strategies.js' })
  return E.RelationRouteStrategies
}

const directPoints = Array.from({ length:25 }, (_,i)=>({x:i*12.5,y:50}))
const p0={x:0,y:50}, p3={x:300,y:50}
const obstacle={left:120,top:20,right:180,bottom:80}

test('A* beats a simple corridor on the blocked relation example', () => {
  const S=loadStrategies()
  const d=S.direct(directPoints,[obstacle])
  const c=S.corridor(p0,p3,[obstacle])
  const a=S.astar(p0,p3,[obstacle])
  const auto=S.choose({directPoints,p0,p3,obstacles:[obstacle],mode:'auto'})
  assert.equal(d.intersections,1)
  assert.equal(c.intersections,0)
  assert.equal(a.intersections,0)
  assert.ok(a.length < c.length)
  assert.equal(auto.algorithm,'astar')
})

test('clean direct relation stays direct in Auto', () => {
  const S=loadStrategies()
  const auto=S.choose({directPoints,p0,p3,obstacles:[],mode:'auto'})
  assert.equal(auto.algorithm,'direct')
  assert.equal(auto.intersections,0)
})

test('forced modes remain selectable', () => {
  const S=loadStrategies()
  assert.equal(S.choose({directPoints,p0,p3,obstacles:[obstacle],mode:'direct'}).algorithm,'direct')
  assert.equal(S.choose({directPoints,p0,p3,obstacles:[obstacle],mode:'corridor'}).algorithm,'corridor')
  assert.equal(S.choose({directPoints,p0,p3,obstacles:[obstacle],mode:'astar'}).algorithm,'astar')
})

test('strategy engine tracks crossing cost for already routed edges', () => {
  const S=loadStrategies()
  const routed=[{a:{x:150,y:-100},b:{x:150,y:100}}]
  const c=S.corridor(p0,p3,[obstacle],0,routed)
  assert.equal(c.intersections,0)
  assert.ok(c.crossings >= 0)
})

test('strategy layers load between Router v2 and table visibility', () => {
  const main=read('src/main.jsx')
  const v2=main.indexOf("'/editor-relation-router-v2.js'")
  const strategies=main.indexOf("'/editor-relation-router-strategies.js'")
  const modes=main.indexOf("'/editor-relation-router-modes.js'")
  const visibility=main.indexOf("'/editor-table-visibility.js'")
  assert.ok(v2>=0 && strategies>v2 && modes>strategies && visibility>modes)
})

test('router strategy and controller scripts parse as JavaScript', () => {
  assert.doesNotThrow(()=>new vm.Script(read('editor-relation-router-strategies.js')))
  assert.doesNotThrow(()=>new vm.Script(read('editor-relation-router-modes.js')))
  assert.doesNotThrow(()=>new vm.Script(read('editor-relation-router-menu.js')))
})
