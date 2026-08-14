import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadDiagnostics(schema, unresolved = [], projection = null) {
  const actions = new Map()
  const E = {
    Advanced: { ensureDialog(){ return { showModal(){} } } },
    Actions: { register(action){ actions.set(action.id, action) } },
    Project: { state: { sources: { unresolvedRelations: unresolved } } },
    currentSchema: () => schema,
    tableId: table => table.id || table.name,
    columnArray: value => Array.isArray(value) ? value : [value],
    escapeHtml: value => String(value),
    ImportLayoutGuard: { physicalOverlapCount: () => 3 },
    ViewProjection: projection ? { build:() => projection } : undefined
  }
  const context = { window:null, console, Map, Set }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-project-diagnostics.js'), context, { filename:'editor-project-diagnostics.js' })
  return { E, actions }
}

test('diagnostics separates empty tables, relation participants and parallel pairs', () => {
  const schema = {
    tables:[
      { id:'A', columns:[{name:'ID'},{name:'ALT'}] },
      { id:'B', columns:[{name:'A_ID'},{name:'A_ALT'}] },
      { id:'EMPTY', columns:[] },
      { id:'FREE', columns:[] }
    ],
    relations:[
      { from:'A', fromCol:'ID', to:'B', toCol:'A_ID' },
      { from:'A', fromCol:'ALT', to:'B', toCol:'A_ALT' }
    ]
  }
  const { E } = loadDiagnostics(schema, [{ reason:'missing table' }])
  const report = E.ProjectDiagnostics.analyze()
  assert.equal(report.totalTables, 4)
  assert.equal(report.emptyTables, 2)
  assert.equal(report.definedTables, 2)
  assert.equal(report.relationCount, 2)
  assert.equal(report.relationParticipantCount, 2)
  assert.equal(report.parallelRelationPairs, 1)
  assert.equal(report.parallelRelationEdges, 2)
  assert.equal(report.physicalOverlaps, 3)
  assert.equal(report.unresolvedRelations, 1)
  assert.equal(report.missingTableRelations, 0)
  assert.equal(report.missingColumnRelations, 0)
})

test('diagnostics reports active projection and direct renderer below threshold', () => {
  const schema = {
    tables:Array.from({length:100}, (_,i) => ({id:`T${i}`, columns:[{name:'ID'}]})),
    relations:[]
  }
  const { E } = loadDiagnostics(schema, [], { projectedTableCount:45, projectedRelationCount:0 })
  const report = E.ProjectDiagnostics.analyze()
  assert.equal(report.projectedTables, 45)
  assert.equal(report.mountedCards, 45)
  assert.equal(report.rendererMode, 'Direct')
})

test('diagnostics marks large active projection as viewport virtualized', () => {
  const schema = { tables:Array.from({length:100}, (_,i) => ({id:`T${i}`, columns:[]})), relations:[] }
  const { E } = loadDiagnostics(schema, [], { projectedTableCount:100, projectedRelationCount:0 })
  assert.equal(E.ProjectDiagnostics.analyze().rendererMode, 'Viewport Virtualized')
})

test('diagnostics reports broken table and column references without mutating schema', () => {
  const schema = {
    tables:[
      { id:'A', columns:[{name:'ID'}] },
      { id:'B', columns:[{name:'A_ID'}] }
    ],
    relations:[
      { from:'A', fromCol:'NOPE', to:'B', toCol:'A_ID' },
      { from:'A', fromCol:'ID', to:'MISSING', toCol:'ID' }
    ]
  }
  const before = JSON.stringify(schema)
  const { E } = loadDiagnostics(schema)
  const report = E.ProjectDiagnostics.analyze()
  assert.equal(report.missingColumnRelations, 1)
  assert.equal(report.missingTableRelations, 1)
  assert.equal(JSON.stringify(schema), before)
})

test('diagnostics registers a read-only Tools action and parses', () => {
  const { actions } = loadDiagnostics({ tables:[], relations:[] })
  assert.ok(actions.get('tools.diagnostics'))
  assert.doesNotThrow(() => new vm.Script(read('editor-project-diagnostics.js'), { filename:'editor-project-diagnostics.js' }))
})

test('diagnostics loads after projection and before shell, and is in validation menu', () => {
  const main = read('src/main.jsx')
  const projection = main.indexOf("'/editor-view-projection.js'")
  const diagnostics = main.indexOf("'/editor-project-diagnostics.js'")
  const shell = main.indexOf("'/editor-desktop-shell.js'")
  assert.ok(projection >= 0 && diagnostics > projection && shell > diagnostics)
  assert.match(read('editor-desktop-shell.js'), /tools\.validate','tools\.nplus','tools\.diagnostics/)
})
