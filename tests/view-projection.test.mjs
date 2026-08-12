import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function makeSchema(total = 687) {
  const tables = Array.from({ length: total }, (_, index) => ({
    id: `T_${index}`,
    name: `T_${index}`,
    columns: index < 45 ? [{ name:'ID' }] : []
  }))
  const relations = Array.from({ length: 20 }, (_, index) => ({
    from:`T_${index}`,
    fromCol:'ID',
    to:`T_${(index + 1) % 20}`,
    toCol:'ID'
  }))
  return { tables, relations }
}

function loadProjection({ visibleIds = null, areaIds = null } = {}) {
  const schema = makeSchema()
  let rendered = 0
  let refreshed = 0
  const listeners = new Map()
  const selectedIds = new Set(['T_0','T_600'])

  const E = {
    tableId: table => table.id || table.name,
    currentSchema: () => schema,
    selectedIds,
    refreshSelection() { refreshed += 1 },
    updateMinimap() {},
    Advanced: { showToast() {} },
    Project: {
      activeArea: () => areaIds ? { tableIds:[...areaIds] } : null
    },
    TableVisibility: {
      visibleTables: view => visibleIds
        ? view.tables.filter(table => visibleIds.has(table.id))
        : [...view.tables],
      apply() {}
    }
  }

  const context = {
    window:null,
    currentView:'main',
    schemaData:{ main:schema },
    renderView() { rendered += 1 },
    requestAnimationFrame(fn) { fn(); return 1 },
    cancelAnimationFrame() {},
    CustomEvent:class { constructor(type, init) { this.type=type; this.detail=init?.detail } },
    document:{
      addEventListener(type, fn) { listeners.set(type, fn) },
      dispatchEvent() {}
    },
    console,
    Set,
    Map
  }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-view-projection.js'), context, { filename:'editor-view-projection.js' })
  return { E, schema, listeners, get rendered(){ return rendered }, get refreshed(){ return refreshed } }
}

test('projection reduces canvas candidates without mutating 687-table project data', () => {
  const visible = new Set(Array.from({ length:45 }, (_, i) => `T_${i}`))
  const runtime = loadProjection({ visibleIds:visible })
  const before = runtime.schema.tables
  const projection = runtime.E.ViewProjection.build(runtime.schema, 'main')

  assert.equal(projection.totalTables, 687)
  assert.equal(projection.projectedTableCount, 45)
  assert.equal(projection.projectedRelationCount, 20)
  assert.equal(projection.active, true)
  assert.equal(runtime.schema.tables, before)
  assert.equal(runtime.schema.tables.length, 687)
})

test('subject area intersects visibility projection instead of deleting tables', () => {
  const visible = new Set(Array.from({ length:45 }, (_, i) => `T_${i}`))
  const area = new Set(['T_0','T_1','T_2','T_100'])
  const runtime = loadProjection({ visibleIds:visible, areaIds:area })
  const projection = runtime.E.ViewProjection.build(runtime.schema, 'main')

  assert.deepEqual([...projection.tableIds], ['T_0','T_1','T_2'])
  assert.equal(projection.projectedRelationCount, 2)
  assert.equal(runtime.schema.tables.length, 687)
})

test('projection refresh removes hidden selection and rerenders once', () => {
  const visible = new Set(['T_0','T_1'])
  const runtime = loadProjection({ visibleIds:visible })
  runtime.E.ViewProjection.refresh()

  assert.deepEqual([...runtime.E.selectedIds], ['T_0'])
  assert.equal(runtime.refreshed, 1)
  assert.equal(runtime.rendered, 1)
})

test('projection reacts to subject-area lifecycle changes', () => {
  const runtime = loadProjection()
  assert.ok(runtime.listeners.has('erd:project-scope-changed'))
  assert.ok(runtime.listeners.has('erd:project-areas-changed'))
})

test('projection layer loads after visibility and before diagnostics', () => {
  const main = read('src/main.jsx')
  const visibility = main.indexOf("'/editor-table-visibility.js'")
  const projection = main.indexOf("'/editor-view-projection.js'")
  const diagnostics = main.indexOf("'/editor-project-diagnostics.js'")
  assert.ok(visibility >= 0 && projection > visibility && diagnostics > projection)
})

test('visibility toggles request projection rerender when projection is available', () => {
  const source = read('editor-table-visibility.js')
  assert.match(source, /E\.ViewProjection\?\.refresh/)
})
