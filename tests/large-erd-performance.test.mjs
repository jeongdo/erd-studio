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

test('large drag UX source parses without all-pairs, neighbor displacement, or auto-search', () => {
  assert.doesNotThrow(() => new Function(dragSource))
  assert.doesNotMatch(dragSource, /for\s*\(\s*let i\s*=\s*0;\s*i\s*<\s*tables\.length/)
  assert.doesNotMatch(dragSource, /resolveLocalCollisions/)
  assert.doesNotMatch(dragSource, /other\.(x|y)\s*=/)
  assert.doesNotMatch(dragSource, /findNearestFreePosition/)
  assert.doesNotMatch(dragSource, /SEARCH_STEP|MAX_SEARCH_RINGS|perimeterOffsets/)
  assert.match(dragSource, /const LARGE_SCHEMA_THRESHOLD = 80/)
  assert.match(dragSource, /const COLLISION_GAP = 12/)
  assert.match(dragSource, /resolveDropPosition/)
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
  const nearby = index.query(ux.tableRect(tables[500], 12))

  assert.ok(nearby.length > 0)
  assert.ok(nearby.length < 30, `expected local candidates, got ${nearby.length}`)
})

test('colliding large drop returns exactly to its start position', () => {
  const ux = loadDragUx()
  const dragged = { id: 'DRAG', x: 0, y: 0, columns: [] }
  const neighbor = { id: 'NEAR', x: 300, y: 0, columns: [] }
  const index = ux.createSpatialIndex([neighbor])
  const neighborBefore = { x: neighbor.x, y: neighbor.y }
  const start = { x: -1000, y: -800 }

  assert.equal(ux.positionIsFree(dragged, index), false)
  const resolved = ux.resolveDropPosition(dragged, index, start)

  assert.deepEqual({ x: resolved.x, y: resolved.y }, start)
  assert.equal(resolved.accepted, false)
  assert.equal(resolved.reverted, true)
  assert.deepEqual({ x: neighbor.x, y: neighbor.y }, neighborBefore)
})

test('free large drop stays exactly where the user placed it', () => {
  const ux = loadDragUx()
  const dragged = { id: 'DRAG', x: 100, y: 100, columns: [] }
  const index = ux.createSpatialIndex([
    { id: 'FAR', x: 5000, y: 5000, columns: [] }
  ])

  const resolved = ux.resolveDropPosition(dragged, index, { x: 0, y: 0 })
  assert.deepEqual({ x: resolved.x, y: resolved.y }, { x: 100, y: 100 })
  assert.equal(resolved.accepted, true)
  assert.equal(resolved.reverted, false)
})

test('large drag mode begins at the same virtualization threshold', () => {
  const ux = loadDragUx()
  assert.equal(ux.isLargeSchema({ tables: Array.from({ length: 79 }) }), false)
  assert.equal(ux.isLargeSchema({ tables: Array.from({ length: 80 }) }), true)
})

test('large drag uses frame-coalesced relation refresh when performance layer exposes it', () => {
  assert.match(dragSource, /function scheduleConnections\(\)/)
  assert.match(dragSource, /typeof E\.Performance\?\.scheduleConnections === 'function'/)
  assert.doesNotMatch(dragSource, /scheduleConnections\?\.\(\) \|\|/)
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
