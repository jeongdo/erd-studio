import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadVisibility({ focused = false } = {}) {
  const schema = {
    tables: [
      { id:'A', name:'A', columns:[{ name:'ID' }] },
      { id:'B', name:'B', columns:[{ name:'A_ID' }] },
      { id:'FREE', name:'FREE', columns:[] }
    ],
    relations:[{ from:'A', fromCol:'ID', to:'B', toCol:'A_ID' }]
  }
  const storage = new Map()
  if (focused) storage.set('erd_relation_focus_v1', '1')
  const actions = new Map()
  const E = {
    Advanced:{ showToast(){} },
    Actions:{ register(action){ actions.set(action.id, action) } },
    currentSchema:() => schema,
    tableId:t => t.id || t.name,
    updateMinimap() {}
  }
  const context = {
    window:null,
    document:{
      getElementById(){ return null },
      querySelectorAll(){ return [] },
      addEventListener(){},
      dispatchEvent(){}
    },
    localStorage:{
      getItem:key => storage.get(key) ?? null,
      setItem:(key,value) => storage.set(key,String(value))
    },
    requestAnimationFrame(){ return 1 },
    CustomEvent:class {},
    MutationObserver:class { observe(){} },
    console,
    Map,
    Set
  }
  context.window=context
  context.window.ERDEditor=E
  context.window.renderView=()=>{}
  context.window.updateConnections=()=>{}
  vm.runInNewContext(read('editor-table-visibility.js'), context, { filename:'editor-table-visibility.js' })
  return { E, schema, storage, actions }
}

test('default view keeps every project table visible', () => {
  const { E, schema } = loadVisibility()
  assert.deepEqual(E.TableVisibility.visibleTables().map(t => t.id), ['A','B','FREE'])
  assert.equal(E.TableVisibility.relationFocus(), false)
  assert.equal(schema.tables.length, 3)
})

test('relation focus projects only participating tables without mutating project data', () => {
  const { E, schema } = loadVisibility()
  const before = JSON.stringify(schema)
  E.TableVisibility.setRelationFocus(true, { announce:false })
  assert.equal(E.TableVisibility.relationFocus(), true)
  assert.deepEqual(new Set(E.TableVisibility.visibleTables().map(t => t.id)), new Set(['A','B']))
  assert.equal(JSON.stringify(schema), before)
})

test('relation focus action toggles state and persists preference', () => {
  const { E, actions, storage } = loadVisibility()
  const action = actions.get('view.relationFocus')
  assert.ok(action)
  assert.equal(action.checked(), false)
  action.run()
  assert.equal(action.checked(), true)
  assert.equal(storage.get('erd_relation_focus_v1'), '1')
  action.run()
  assert.equal(action.checked(), false)
  assert.equal(storage.get('erd_relation_focus_v1'), '0')
  assert.equal(E.TableVisibility.visibleTables().length, 3)
})

test('stored relation focus preference restores focused projection', () => {
  const { E } = loadVisibility({ focused:true })
  assert.equal(E.TableVisibility.relationFocus(), true)
  assert.deepEqual(new Set(E.TableVisibility.visibleTables().map(t => t.id)), new Set(['A','B']))
})

test('table visibility extension parses as JavaScript and shell exposes only relation focus', () => {
  assert.doesNotThrow(() => new vm.Script(read('editor-table-visibility.js'), { filename:'editor-table-visibility.js' }))
  const shell = read('editor-desktop-shell.js')
  assert.match(shell, /view\.minimap','view\.legend','view\.relationFocus/)
  assert.equal(shell.includes('view.placeholders'), false)
  const main = read('src/main.jsx')
  assert.equal(main.includes('editor-table-visibility.css'), false)
})
