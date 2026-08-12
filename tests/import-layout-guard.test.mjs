import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadGuard(schemaData = {}) {
  const listeners = new Map()
  const events = []
  let persisted = 0
  let rendered = 0
  let toast = ''

  const E = {
    persist() { persisted += 1 },
    updateMinimap() {},
    Advanced: { showToast(message) { toast = message } }
  }
  const context = {
    window: null,
    schemaData,
    currentView: Object.keys(schemaData)[0] || '',
    renderView() { rendered += 1 },
    document: {
      addEventListener(type, fn) { listeners.set(type, fn) },
      dispatchEvent(event) { events.push(event) }
    },
    CustomEvent: class {
      constructor(type, init) { this.type = type; this.detail = init?.detail }
    },
    console,
    Number,
    Math,
    Map,
    Set
  }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-import-layout-guard.js'), context, { filename: 'editor-import-layout-guard.js' })
  return { context, E, listeners, events, get persisted() { return persisted }, get rendered() { return rendered }, get toast() { return toast } }
}

function longStrip(count = 687, columns = 5) {
  return Array.from({ length: count }, (_, index) => ({
    id: `T_${index}`,
    name: `T_${index}`,
    x: 50 + (index % columns) * 360,
    y: 50 + Math.floor(index / columns) * 340,
    columns: []
  }))
}

test('layout guard preserves a healthy imported layout', () => {
  const tables = Array.from({ length: 100 }, (_, index) => ({
    id: `T_${index}`,
    x: 80 + (index % 10) * 430,
    y: 80 + Math.floor(index / 10) * 390,
    columns: []
  }))
  const { E } = loadGuard({ main: { tables, relations: [] } })
  const before = JSON.stringify(tables)
  const result = E.ImportLayoutGuard.guardSchema({ tables }, 'main')

  assert.equal(result.changed, false)
  assert.equal(result.before.pathological, false)
  assert.equal(JSON.stringify(tables), before)
})

test('layout guard repairs the 687-table five-column vertical strip', () => {
  const tables = longStrip()
  const { E } = loadGuard({ sei_fm_master: { tables, relations: [] } })
  const before = E.ImportLayoutGuard.layoutStats(tables)

  assert.ok(before.aspectRatio > 8)
  assert.ok(before.reasons.includes('extreme-aspect-ratio'))

  const result = E.ImportLayoutGuard.guardSchema({ tables }, 'sei_fm_master')
  assert.equal(result.changed, true)
  assert.equal(result.columns, 29)
  assert.equal(result.after.pathological, false)
  assert.ok(result.after.aspectRatio < 8)
  assert.equal(tables[0].x, 80)
  assert.equal(tables[0].y, 80)
  assert.equal(tables[29].x, 80)
  assert.equal(tables[29].y, 470)
})

test('project-loaded open-file event repairs and persists pathological coordinates', () => {
  const tables = longStrip(120, 3)
  const runtime = loadGuard({ imported: { tables, relations: [] } })
  const handler = runtime.listeners.get('erd:project-loaded')
  assert.ok(handler)

  handler({ detail: { reason: 'open-file' } })

  assert.equal(runtime.persisted, 1)
  assert.equal(runtime.rendered, 1)
  assert.match(runtime.toast, /자동 정리/)
  assert.ok(runtime.events.some(event => event.type === 'erd:import-layout-repaired'))
  assert.equal(runtime.E.ImportLayoutGuard.layoutStats(tables).pathological, false)
})

test('sample project events are ignored even when coordinates are unusual', () => {
  const tables = longStrip(120, 3)
  const runtime = loadGuard({ sample: { tables, relations: [] } })
  const before = JSON.stringify(tables)

  runtime.listeners.get('erd:project-loaded')({ detail: { reason: 'sample' } })

  assert.equal(JSON.stringify(tables), before)
  assert.equal(runtime.persisted, 0)
})

test('main loads import layout guard immediately after workspace lifecycle', () => {
  const main = read('src/main.jsx')
  const workspace = main.indexOf("loadClassic('/editor-workspace.js', 'workspace'")
  const guard = main.indexOf("loadClassic('/editor-import-layout-guard.js', 'import-layout-guard'")
  const dock = main.indexOf("loadClassic('/editor-project-dock.js', 'project-dock'")

  assert.ok(workspace >= 0)
  assert.ok(guard > workspace)
  assert.ok(dock > guard)
})
