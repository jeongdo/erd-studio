import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadOracleHrJoinEngine() {
  const samples = { window:null, console, JSON }
  samples.window = samples
  vm.runInNewContext(read('editor-sample-catalog.js'), samples, { filename:'editor-sample-catalog.js' })
  const schema = samples.ERDStudioSamples.create('oracle_hr')

  const E = {
    currentSchema: () => schema,
    tableId: table => table.id || table.name,
    findTable: id => schema.tables.find(table => (table.id || table.name) === id),
    columnArray: value => Array.isArray(value) ? value : [value],
    selectedIds: new Set(),
    Project: { state: { project: { dbms:'oracle' } } },
    showOutput() {}
  }
  const storage = new Map()
  const context = {
    window:null,
    document:{ querySelector(){ return null }, querySelectorAll(){ return [] } },
    localStorage:{
      getItem:key => storage.get(key) ?? null,
      setItem:(key,value) => storage.set(key,String(value))
    },
    alert() {},
    CustomEvent: class {},
    console,
    Map,
    Set
  }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-join-style.js'), context, { filename:'editor-join-style.js' })
  return E.JoinStyle
}

function rect(left, top, width, height) {
  return { left, top, width, height, right:left + width, bottom:top + height }
}

function loadRoutingEngine() {
  const E = { currentSchema:() => ({ relations:[] }) }
  const context = {
    window:null,
    document:{
      getElementById(){ return null },
      querySelectorAll(){ return [] }
    },
    getComputedStyle(){ return { transform:'none' } },
    requestAnimationFrame() {},
    console,
    Math,
    Number
  }
  context.window = context
  context.window.ERDEditor = E
  context.window.updateConnections = () => {}
  vm.runInNewContext(read('editor-relation-routing-ux.js'), context, { filename:'editor-relation-routing-ux.js' })
  return E.RelationRouting
}

test('Oracle HR real sample joins five connected selected tables', () => {
  const join = loadOracleHrJoinEngine()
  const ids = ['REGIONS','COUNTRIES','LOCATIONS','DEPARTMENTS','EMPLOYEES']

  const ansi = join.buildSelectionJoinSql(ids, join.ANSI)
  assert.deepEqual([...ansi.plan.disconnectedIds], [])
  assert.equal(ansi.plan.steps.length, 4)
  assert.match(ansi.sql, /FROM REGIONS T1/)
  assert.match(ansi.sql, /JOIN COUNTRIES T2/)
  assert.match(ansi.sql, /JOIN LOCATIONS T3/)
  assert.match(ansi.sql, /JOIN DEPARTMENTS T4/)
  assert.match(ansi.sql, /JOIN EMPLOYEES T5/)

  const oracle = join.buildSelectionJoinSql(ids, join.ORACLE)
  assert.match(oracle.sql, /T1\.REGION_ID = T2\.REGION_ID\(\+\)/)
  assert.match(oracle.sql, /T2\.COUNTRY_ID = T3\.COUNTRY_ID\(\+\)/)
  assert.match(oracle.sql, /T3\.LOCATION_ID = T4\.LOCATION_ID\(\+\)/)
  assert.match(oracle.sql, /T4\.DEPARTMENT_ID = T5\.DEPARTMENT_ID\(\+\)/)
})

test('final join engine loads before action registry and desktop menu', () => {
  const main = read('src/main.jsx')
  const joinStyle = main.indexOf("'/editor-join-style.js'")
  const actions = main.indexOf("'/editor-actions.js'")
  const joinActions = main.indexOf("'/editor-join-actions.js'")
  const routing = main.indexOf("'/editor-relation-routing-ux.js'")
  const shell = main.indexOf("'/editor-desktop-shell.js'")

  assert.ok(joinStyle >= 0 && actions >= 0 && joinActions >= 0 && routing >= 0 && shell >= 0)
  assert.ok(joinStyle < actions)
  assert.ok(actions < joinActions)
  assert.ok(joinActions < shell)
  assert.ok(routing < shell)

  const joinActionSource = read('editor-join-actions.js')
  assert.match(joinActionSource, /selectedIds\?\.size \|\| 0\) >= 2/)
  assert.doesNotMatch(joinActionSource, /선택 2개 JOIN SQL/)
})

test('relation routing leaves a safe endpoint gap and avoids crossing close cards', () => {
  const routing = loadRoutingEngine()
  const canvas = rect(0, 0, 1200, 800)
  const fromCard = rect(0, 0, 360, 220)
  const fromColumn = rect(0, 60, 360, 24)

  const farToCard = rect(520, 0, 360, 220)
  const farToColumn = rect(520, 80, 360, 24)
  const far = routing.computeRoute({ fromColumn, toColumn:farToColumn, fromCard, toCard:farToCard, canvas, scale:1 })
  const farNums = far.d.match(/-?\d+(?:\.\d+)?/g).map(Number)
  assert.equal(far.axis, 'horizontal')
  assert.equal(farNums[0], 374)
  assert.equal(farNums[6], 506)

  const closeToCard = rect(380, 0, 360, 220)
  const closeToColumn = rect(380, 80, 360, 24)
  const close = routing.computeRoute({ fromColumn, toColumn:closeToColumn, fromCard, toCard:closeToCard, canvas, scale:1 })
  const closeNums = close.d.match(/-?\d+(?:\.\d+)?/g).map(Number)
  assert.equal(close.axis, 'horizontal')
  assert.ok(closeNums[0] < closeNums[6], `start ${closeNums[0]} should remain before end ${closeNums[6]}`)
  assert.ok(closeNums[0] > fromCard.right)
  assert.ok(closeNums[6] < closeToCard.left)
})

test('relation routing reads zoom scale from canvas transform', () => {
  const routing = loadRoutingEngine()
  assert.equal(routing.readCanvasScale({ style:{ transform:'translate(120px, 80px) scale(0.65)' } }), 0.65)
  assert.equal(routing.readCanvasScale({ style:{ transform:'translate(0px, 0px) scale(1.4)' } }), 1.4)
})

test('relation routing extension parses as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(read('editor-relation-routing-ux.js'), { filename:'editor-relation-routing-ux.js' }))
})
