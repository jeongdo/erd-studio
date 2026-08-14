import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function makeScenario({ total, emptyTables, relationCount, participants }) {
  const defined = total - emptyTables
  const tables = []
  for (let i = 0; i < defined; i += 1) {
    tables.push({
      id:`REAL_${String(i).padStart(3,'0')}`,
      name:`REAL_${String(i).padStart(3,'0')}`,
      desc:'defined table',
      x:50 + (i % 5) * 360,
      y:50 + Math.floor(i / 5) * 340,
      columns:Array.from({ length:i % 11 === 0 ? 16 : 3 }, (_, c) => ({ name:c === 0 ? 'ID' : `C_${c}` }))
    })
  }
  for (let i = 0; i < emptyTables; i += 1) {
    const index = defined + i
    tables.push({
      id:`EMPTY_${String(i).padStart(3,'0')}`,
      name:`EMPTY_${String(i).padStart(3,'0')}`,
      desc:'table without column metadata',
      x:50 + (index % 5) * 360,
      y:50 + Math.floor(index / 5) * 340,
      columns:[]
    })
  }

  const participantIds = Array.from({ length:participants }, (_, i) => `REAL_${String(i).padStart(3,'0')}`)
  const relations = []
  for (let p = 0; p < 3; p += 1) {
    const from = participantIds[p * 2]
    const to = participantIds[p * 2 + 1]
    relations.push({ from, fromCol:'ID', to, toCol:'ID' })
    relations.push({ from, fromCol:'C_1', to, toCol:'C_1' })
  }
  const usedPairs = new Set(relations.map(rel => [rel.from, rel.to].sort().join('|')))
  let cursor = 0
  while (relations.length < relationCount) {
    const fromIndex = cursor % participantIds.length
    const step = 2 + Math.floor(cursor / participantIds.length)
    const toIndex = (fromIndex + step) % participantIds.length
    const from = participantIds[fromIndex]
    const to = participantIds[toIndex]
    const key = [from, to].sort().join('|')
    cursor += 1
    if (from === to || usedPairs.has(key)) continue
    usedPairs.add(key)
    relations.push({ from, fromCol:'ID', to, toCol:'ID' })
  }
  return { tables, relations }
}

function loadGuard(schema) {
  const E = { Advanced:{ showToast(){} }, persist(){}, updateMinimap(){} }
  const context = {
    window:null, schemaData:{ main:schema }, currentView:'main', renderView(){},
    document:{ addEventListener(){}, dispatchEvent(){} }, CustomEvent:class {}, console, Number, Math, Map, Set
  }
  context.window=context
  context.window.ERDEditor=E
  vm.runInNewContext(read('editor-import-layout-guard.js'), context, { filename:'editor-import-layout-guard.js' })
  return E.ImportLayoutGuard
}

function loadVisibility(schema) {
  const actions = new Map()
  const storage = new Map()
  const E = {
    Advanced:{ showToast(){} },
    Actions:{ register(a){ actions.set(a.id,a) } },
    currentSchema:()=>schema,
    tableId:t=>t.id||t.name,
    updateMinimap(){}
  }
  const context = {
    window:null,
    document:{ getElementById(){return null}, querySelectorAll(){return []}, addEventListener(){}, dispatchEvent(){} },
    localStorage:{ getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,String(v)) },
    requestAnimationFrame(){return 1}, CustomEvent:class {}, MutationObserver:class{observe(){}}, console, Map, Set
  }
  context.window=context; context.window.ERDEditor=E; context.window.renderView=()=>{}; context.window.updateConnections=()=>{}
  vm.runInNewContext(read('editor-table-visibility.js'), context, { filename:'editor-table-visibility.js' })
  return { visibility:E.TableVisibility, E }
}

function loadProjection(schema, visibility) {
  const E = {
    tableId:t=>t.id||t.name,
    currentSchema:()=>schema,
    selectedIds:new Set(),
    refreshSelection(){},
    updateMinimap(){},
    Advanced:{ showToast(){} },
    Project:{ activeArea:()=>null },
    TableVisibility:visibility
  }
  const context = {
    window:null, schemaData:{main:schema}, currentView:'main', renderView(){},
    requestAnimationFrame(){return 1}, cancelAnimationFrame(){},
    document:{addEventListener(){},dispatchEvent(){}}, CustomEvent:class{}, console, Set, Map
  }
  context.window=context; context.window.ERDEditor=E
  vm.runInNewContext(read('editor-view-projection.js'), context, { filename:'editor-view-projection.js' })
  return E.ViewProjection
}

function loadIdentity(relations) {
  const E = {
    Advanced:{ relationKey:r=>`${r.from}|${[].concat(r.fromCol).join(',')}|${r.to}|${[].concat(r.toCol).join(',')}` },
    RelationRouting:{ computeRoute:()=>({axis:'horizontal',d:'M 0 0 C 1 0, 2 0, 3 0',mid:{x:1.5,y:0}}), readCanvasScale:()=>1 },
    currentSchema:()=>({relations}), columnArray:v=>Array.isArray(v)?v:[v]
  }
  const context={ window:null, document:{getElementById(){return null},querySelectorAll(){return[]}}, requestAnimationFrame(){}, console, Number, Math }
  context.window=context; context.window.ERDEditor=E; context.window.updateConnections=()=>{}
  vm.runInNewContext(read('editor-relation-identity.js'), context, { filename:'editor-relation-identity.js' })
  return E.RelationIdentity
}

function loadRouter() {
  const E = {
    currentSchema:()=>({relations:[]}), columnArray:v=>Array.isArray(v)?v:[v],
    RelationRouting:{computeRoute:()=>({axis:'horizontal',d:'M 0 50 C 100 50, 200 50, 300 50',mid:{x:150,y:50}}),readCanvasScale:()=>1},
    RelationIdentity:{resolveRelation:()=>null,parallelLane:()=>0,laneRoute:r=>r}
  }
  const context={window:null,document:{getElementById(){return null},querySelectorAll(){return[]},addEventListener(){}},requestAnimationFrame(){},console,Number,Math}
  context.window=context; context.window.ERDEditor=E; context.window.updateConnections=()=>{}
  vm.runInNewContext(read('editor-relation-router-v2.js'), context, {filename:'editor-relation-router-v2.js'})
  return E.RelationRouterV2
}

for (const spec of [
  { name:'master-scale', total:687, emptyTables:642, relationCount:35, participants:20 },
  { name:'analysis-scale', total:692, emptyTables:641, relationCount:37, participants:24 }
]) {
  test(`${spec.name} acceptance: Relation Focus preserves source data`, () => {
    const schema = makeScenario(spec)
    const sourceTables = schema.tables
    const before = JSON.stringify(schema)
    const { visibility } = loadVisibility(schema)
    const projection = loadProjection(schema, visibility)

    assert.equal(schema.tables.length, spec.total)
    assert.equal(schema.relations.length, spec.relationCount)
    assert.equal(projection.build(schema,'main').projectedTableCount, spec.total)

    visibility.setRelationFocus(true, { announce:false })
    const focused = projection.build(schema,'main')
    assert.equal(focused.projectedTableCount, spec.participants)
    assert.equal(focused.projectedRelationCount, spec.relationCount)
    assert.equal(schema.tables, sourceTables)
    assert.equal(JSON.stringify(schema), before)

    visibility.setRelationFocus(false, { announce:false })
    assert.equal(projection.build(schema,'main').projectedTableCount, spec.total)
    assert.equal(schema.tables, sourceTables)
    assert.equal(JSON.stringify(schema), before)
  })

  test(`${spec.name} acceptance: pathological imported layout repairs to zero card overlap`, () => {
    const schema = makeScenario(spec)
    const guard = loadGuard(schema)
    const before = guard.layoutStats(schema.tables)
    assert.equal(before.pathological, true)
    const repaired = guard.guardSchema(schema, 'main')
    assert.equal(repaired.changed, true)
    assert.equal(repaired.columns, 29)
    assert.equal(repaired.after.physicalOverlaps, 0)
    assert.equal(repaired.after.pathological, false)
  })
}

test('large scenario parallel relations retain unique identity and balanced lanes', () => {
  const schema = makeScenario({ total:687, emptyTables:642, relationCount:35, participants:20 })
  const identity = loadIdentity(schema.relations)
  const firstPair = schema.relations.slice(0,2)
  assert.notEqual(identity.relationKey(firstPair[0]), identity.relationKey(firstPair[1]))
  assert.notEqual(identity.relationDomId(firstPair[0],0), identity.relationDomId(firstPair[1],1))
  assert.equal(identity.parallelLane(firstPair[0],0,schema.relations), -12)
  assert.equal(identity.parallelLane(firstPair[1],1,schema.relations), 12)
})

test('large scenario obstacle router can detour around an intermediate table without moving endpoints', () => {
  const router = loadRouter()
  const p0={x:0,y:50}, p3={x:300,y:50}
  const obstacle={left:120,top:20,right:180,bottom:80}
  const route=router.chooseRoute(p0,p3,[obstacle],0)
  assert.equal(route.intersections,0)
  assert.deepEqual(route.points[0],p0)
  assert.deepEqual(route.points.at(-1),p3)
})
