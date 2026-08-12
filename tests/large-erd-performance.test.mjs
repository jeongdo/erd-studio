import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dragSource = fs.readFileSync(path.join(root, 'editor-drag-ux.js'), 'utf8')
const performanceSource = fs.readFileSync(path.join(root, 'editor-performance.js'), 'utf8')

function loadDragUx() {
  const listeners = new Map()
  const context = {
    window: null,
    document: {
      getElementById() { return null },
      dispatchEvent() {}
    },
    CustomEvent: class {
      constructor(type, init) { this.type = type; this.detail = init?.detail }
    },
    performance: { now: () => 0 },
    requestAnimationFrame: fn => { fn(); return 1 },
    cancelAnimationFrame() {},
    schemaData: {},
    currentView: 'main',
    panX: 0,
    panY: 0,
    scale: 1,
    Map,
    Set,
    Math,
    Number,
    console
  }
  context.window = context
  context.window.addEventListener = (type, fn) => listeners.set(type, fn)
  context.window.removeEventListener = () => {}
  context.window.startDragCard = () => {}
  context.window.ERDEditor = {
    tableId: table => table.id || table.name,
    pushUndo() {},
    persist() {},
    updateMinimap() {}
  }

  vm.runInNewContext(dragSource, context, { filename: 'editor-drag-ux.js' })
  return context.window.ERDEditor.LargeDragUX
}

test('large drag UX source parses without legacy all-pairs or neighbor displacement', () => {
  assert.doesNotThrow(() => new Function(dragSource))
  assert.doesNotMatch(dragSource, /for\s*\(\s*let i\s*=\s*0;\s*i\s*<\s*tables\.length/)
  assert.doesNotMatch(dragSource, /resolveLocalCollisions/)
  assert.doesNotMatch(dragSource, /other\.(x|y)\s*=/)
  assert.match(dragSource, /const LARGE_SCHEMA_THRESHOLD = 80/)
  assert.match(dragSource, /findNearestFreePosition/)
})

test('spatial collision index narrows 1000 tables to nearby candidates', () => {
  const ux = loadDragUx()
  const tables = Array.from({ length: 1000 }, (_, index) => ({
    id: `T_${index}`,
    x: (index % 40) * 500,
    y: Math.floor(index / 40) * 400,
    columns: []
  }))

  const index = ux.createSpatialIndex(tables)
  const nearby = index.query(ux.tableRect(tables[500], 60))

  assert.ok(nearby.length > 0)
  assert.ok(nearby.length < 30, `expected local candidates, got ${nearby.length}`)
})

test('large drop moves only the dragged table to a nearby free slot', () => {
  const ux = loadDragUx()
  const dragged = { id: 'DRAG', x: 0, y: 0, columns: [] }
  const neighbor = { id: 'NEAR', x: 300, y: 0, columns: [] }
  const far = { id: 'FAR', x: 5000, y: 5000, columns: [] }
  const index = ux.createSpatialIndex([neighbor, far])
  const neighborBefore = { x: neighbor.x, y: neighbor.y }
  const farBefore = { x: far.x, y: far.y }

  assert.equal(ux.positionIsFree(dragged, index), false)
  const resolved = ux.findNearestFreePosition(dragged, index, { x: -1000, y: -1000 })

  assert.equal(resolved.adjusted, true)
  const probe = { ...dragged, x: resolved.x, y: resolved.y }
  assert.equal(ux.positionIsFree(probe, index), true)
  assert.deepEqual({ x: neighbor.x, y: neighbor.y }, neighborBefore)
  assert.deepEqual({ x: far.x, y: far.y }, farBefore)
})

test('a free large-ERD drop stays exactly where the user placed it', () => {
  const ux = loadDragUx()
  const dragged = { id: 'DRAG', x: 100, y: 100, columns: [] }
  const index = ux.createSpatialIndex([
    { id: 'FAR', x: 5000, y: 5000, columns: [] }
  ])

  const resolved = ux.findNearestFreePosition(dragged, index)
  assert.deepEqual({ x: resolved.x, y: resolved.y }, { x: 100, y: 100 })
  assert.equal(resolved.adjusted, false)
})

test('large drag mode begins at the same virtualization threshold', () => {
  const ux = loadDragUx()
  assert.equal(ux.isLargeSchema({ tables: Array.from({ length: 79 }) }), false)
  assert.equal(ux.isLargeSchema({ tables: Array.from({ length: 80 }) }), true)
})

test('large ERD performance layer parses', () => {
  assert.doesNotThrow(() => new Function(performanceSource))
})

test('viewport culling uses a cached spatial index for large schemas', () => {
  assert.match(performanceSource, /const SPATIAL_CELL = 900/)
  assert.match(performanceSource, /function buildSpatialIndex\(view\)/)
  assert.match(performanceSource, /function ensureSpatialIndex\(view\)/)
  assert.match(performanceSource, /function querySpatialIndex\(view, bounds\)/)
  assert.match(performanceSource, /return querySpatialIndex\(view, bounds\)/)
  assert.match(performanceSource, /const index = ensureSpatialIndex\(view\)/)
  assert.match(performanceSource, /const tableById = index\.tableById/)
})

test('large pan and zoom bypass synchronous legacy redraw work', () => {
  assert.match(performanceSource, /if \(\(view\?\.tables\?\.length \|\| 0\) < THRESHOLD\) \{\s*baseTransform\(\)/)
  assert.match(performanceSource, /Large ERDs bypass the legacy transform wrapper/)
  assert.match(performanceSource, /scheduleCull\(\);\s*scheduleConnections\(\);\s*updateMinimapViewport\(\)/)
})

test('relation and minimap refreshes are frame-coalesced', () => {
  assert.match(performanceSource, /function scheduleConnections\(\)/)
  assert.match(performanceSource, /cancelAnimationFrame\(connectionFrame\)/)
  assert.match(performanceSource, /function scheduleMinimapRender\(\)/)
  assert.match(performanceSource, /E\.updateMinimap = scheduleMinimapRender/)
})

test('spatial index is invalidated when table positions or workspace scope change', () => {
  assert.match(performanceSource, /erd:table-position-changed/)
  assert.match(performanceSource, /erd:project-scope-changed/)
  assert.match(performanceSource, /erd:workspace-changed/)
  assert.match(performanceSource, /invalidateSpatialIndex/)
})
