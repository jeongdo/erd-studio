import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadVisibility(show = null) {
  const schema = {
    tables: [
      { id:'P1', name:'P1', desc:'MyBatis 참조 테이블 (P1)', columns:[] },
      { id:'EMPTY_REAL', name:'EMPTY_REAL', desc:'수동 빈 테이블', columns:[] },
      { id:'REAL', name:'REAL', desc:'실제 테이블', columns:[{ name:'ID' }] }
    ],
    relations:[{ from:'REAL', fromCol:'ID', to:'P1', toCol:'ID' }]
  }
  const storage = new Map()
  if (show !== null) storage.set('erd_show_mybatis_placeholders_v1', show ? '1' : '0')
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
    Map
  }
  context.window=context
  context.window.ERDEditor=E
  context.window.renderView=()=>{}
  context.window.updateConnections=()=>{}
  vm.runInNewContext(read('editor-table-visibility.js'), context, { filename:'editor-table-visibility.js' })
  return { E, schema, storage, actions }
}

test('only inferred MyBatis empty nodes are placeholders', () => {
  const { E, schema } = loadVisibility()
  assert.equal(E.TableVisibility.isPlaceholder(schema.tables[0]), true)
  assert.equal(E.TableVisibility.isPlaceholder(schema.tables[1]), false)
  assert.equal(E.TableVisibility.isPlaceholder(schema.tables[2]), false)
})

test('hiding placeholders keeps every project table in the schema', () => {
  const { E, schema } = loadVisibility(true)
  const before = schema.tables.map(t => t.id)
  E.TableVisibility.setShowPlaceholders(false, { announce:false })
  assert.deepEqual(schema.tables.map(t => t.id), before)
  assert.deepEqual(E.TableVisibility.visibleTables().map(t => t.id), ['EMPTY_REAL','REAL'])
  assert.equal(E.TableVisibility.placeholderCount(), 1)
})

test('view action toggles placeholder visibility without deleting data', () => {
  const { E, schema, actions } = loadVisibility(true)
  const action = actions.get('view.placeholders')
  assert.ok(action)
  assert.equal(action.checked(), true)
  action.run()
  assert.equal(action.checked(), false)
  assert.equal(schema.tables.length, 3)
})

test('table visibility extension parses as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(read('editor-table-visibility.js'), { filename:'editor-table-visibility.js' }))
})

test('placeholder visibility loads before shell and is exposed in the View menu', () => {
  const main = read('src/main.jsx')
  const identity = main.indexOf("'/editor-relation-identity.js'")
  const visibility = main.indexOf("'/editor-table-visibility.js'")
  const shellLoad = main.indexOf("'/editor-desktop-shell.js'")
  assert.ok(identity >= 0 && visibility > identity && shellLoad > visibility)
  assert.match(read('editor-desktop-shell.js'), /view\.minimap','view\.legend','view\.placeholders/)
})

test('relation focus projects only participating tables without mutating the project', () => {
  const { E, schema, actions } = loadVisibility(true)
  const before = schema.tables.map(t => t.id)
  const action = actions.get('view.relationFocus')
  assert.ok(action)
  action.run()
  assert.equal(action.checked(), true)
  assert.deepEqual(new Set(E.TableVisibility.visibleTables().map(t => t.id)), new Set(['P1','REAL']))
  assert.deepEqual(schema.tables.map(t => t.id), before)
  action.run()
  assert.equal(E.TableVisibility.visibleTables().length, 3)
})

test('relation focus is exposed next to placeholder visibility in the View menu', () => {
  assert.match(read('editor-desktop-shell.js'), /view\.placeholders','view\.relationFocus/)
})
