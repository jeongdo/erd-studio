import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadVisibility({ mode = null, legacyShow = null } = {}) {
  const schema = {
    tables: [
      { id:'P1', name:'P1', desc:'MyBatis 참조 테이블 (P1)', columns:[] },
      { id:'EMPTY_REAL', name:'EMPTY_REAL', desc:'수동 빈 테이블', columns:[] },
      { id:'REAL', name:'REAL', desc:'실제 테이블', columns:[{ name:'ID' }] }
    ],
    relations:[{ from:'REAL', fromCol:'ID', to:'P1', toCol:'ID' }]
  }
  const storage = new Map()
  if (mode !== null) storage.set('erd_mybatis_placeholder_mode_v1', mode)
  if (legacyShow !== null) storage.set('erd_show_mybatis_placeholders_v1', legacyShow ? '1' : '0')
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

test('smart mode is the default and hides only unconnected placeholders', () => {
  const { E, schema } = loadVisibility()
  schema.tables.push({ id:'P2', name:'P2', desc:'MyBatis 참조 테이블 (P2)', columns:[] })
  const before = schema.tables.map(table => table.id)

  assert.equal(E.TableVisibility.placeholderMode(), 'smart')
  assert.deepEqual(E.TableVisibility.visibleTables().map(table => table.id), ['P1','EMPTY_REAL','REAL'])
  assert.deepEqual(schema.tables.map(table => table.id), before)
})

test('hidden mode keeps every project table while removing placeholders from projection', () => {
  const { E, schema } = loadVisibility({ mode:'full' })
  const before = schema.tables.map(t => t.id)
  E.TableVisibility.setPlaceholderMode('hidden', { announce:false })
  assert.deepEqual(schema.tables.map(t => t.id), before)
  assert.deepEqual(E.TableVisibility.visibleTables().map(t => t.id), ['EMPTY_REAL','REAL'])
  assert.equal(E.TableVisibility.placeholderCount(), 1)
  assert.equal(E.TableVisibility.placeholderMode(), 'hidden')
})

test('compact mode keeps placeholders in the render projection without mutating data', () => {
  const { E, schema } = loadVisibility({ mode:'full' })
  const before = schema.tables.map(t => t.id)
  E.TableVisibility.setPlaceholderMode('compact', { announce:false })
  assert.equal(E.TableVisibility.placeholderMode(), 'compact')
  assert.deepEqual(E.TableVisibility.visibleTables().map(t => t.id), ['P1','EMPTY_REAL','REAL'])
  assert.deepEqual(schema.tables.map(t => t.id), before)
})

test('legacy placeholder toggle remains Full/Hidden compatible', () => {
  const { E, schema, actions } = loadVisibility({ mode:'full' })
  const action = actions.get('view.placeholders')
  assert.ok(action)
  assert.equal(action.checked(), true)
  action.run()
  assert.equal(action.checked(), false)
  assert.equal(E.TableVisibility.placeholderMode(), 'hidden')
  action.run()
  assert.equal(E.TableVisibility.placeholderMode(), 'full')
  assert.equal(schema.tables.length, 3)
})

test('old show-placeholder preference migrates to hidden mode', () => {
  const { E } = loadVisibility({ legacyShow:false })
  assert.equal(E.TableVisibility.placeholderMode(), 'hidden')
  assert.equal(E.TableVisibility.showPlaceholders(), false)
})

test('Full Compact Smart Hidden actions are mutually checked by mode', () => {
  const { E, actions } = loadVisibility({ mode:'full' })
  const full = actions.get('view.placeholders.full')
  const compact = actions.get('view.placeholders.compact')
  const smart = actions.get('view.placeholders.smart')
  const hidden = actions.get('view.placeholders.hidden')
  assert.ok(full && compact && smart && hidden)
  assert.equal(full.checked(), true)
  compact.run()
  assert.equal(compact.checked(), true)
  assert.equal(full.checked(), false)
  smart.run()
  assert.equal(smart.checked(), true)
  hidden.run()
  assert.equal(hidden.checked(), true)
  assert.equal(E.TableVisibility.visibleTables().length, 2)
})

test('table visibility extension parses as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(read('editor-table-visibility.js'), { filename:'editor-table-visibility.js' }))
})

test('placeholder mode styles and menu are wired into the desktop shell', () => {
  const main = read('src/main.jsx')
  assert.match(main, /editor-table-visibility\.css/)
  const shell = read('editor-desktop-shell.js')
  assert.match(shell, /view\.placeholders\.full','view\.placeholders\.compact','view\.placeholders\.smart','view\.placeholders\.hidden','view\.relationFocus/)
  const css = read('editor-table-visibility.css')
  assert.match(css, /erd-placeholder-compact/)
  assert.match(css, /width: 240px/)
})

test('relation focus projects only participating tables without mutating the project', () => {
  const { E, schema, actions } = loadVisibility({ mode:'full' })
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
