import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function createJoinContext() {
  const tables = [
    { id:'A', name:'A', columns:[{ name:'ID' }, { name:'TYPE' }] },
    { id:'B', name:'B', columns:[{ name:'ID' }, { name:'A_ID' }, { name:'A_TYPE' }] },
    { id:'C', name:'C', columns:[{ name:'ID' }, { name:'B_ID' }] },
    { id:'X', name:'X', columns:[{ name:'ID' }] }
  ]
  const schema = {
    tables,
    relations: [
      { from:'A', fromCol:['ID','TYPE'], to:'B', toCol:['A_ID','A_TYPE'] },
      { from:'B', fromCol:'ID', to:'C', toCol:'B_ID' }
    ]
  }
  const outputs = []
  const E = {
    currentSchema: () => schema,
    findTable: id => tables.find(table => table.id === id),
    tableId: table => table.id,
    columnArray: value => Array.isArray(value) ? value : [value],
    Project: { state: { project: { dbms:'oracle' } } },
    selectedIds: new Set(),
    showOutput(title, content) { outputs.push({ title, content }) }
  }
  const storage = new Map()
  const context = {
    window: null,
    document: {
      querySelector() { return null },
      querySelectorAll() { return [] },
      dispatchEvent() {}
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    CustomEvent: class {},
    alert() {},
    console,
    Map,
    Set
  }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-join-style.js'), context, { filename:'editor-join-style.js' })
  return { E, context, outputs }
}

test('connected selections of 3+ tables generate ANSI and Oracle joins', () => {
  const { E } = createJoinContext()
  const ansi = E.JoinStyle.buildSelectionJoinSql(['A','B','C'], E.JoinStyle.ANSI)
  assert.equal(ansi.plan.disconnectedIds.length, 0)
  assert.match(ansi.sql, /FROM A T1\nJOIN B T2/)
  assert.match(ansi.sql, /JOIN C T3/)
  assert.match(ansi.sql, /T1\.ID = T2\.A_ID AND T1\.TYPE = T2\.A_TYPE/)
  assert.match(ansi.sql, /T2\.ID = T3\.B_ID/)

  const oracle = E.JoinStyle.buildSelectionJoinSql(['A','B','C'], E.JoinStyle.ORACLE)
  assert.match(oracle.sql, /FROM A T1,\n     B T2,\n     C T3/)
  assert.match(oracle.sql, /T1\.ID = T2\.A_ID\(\+\)/)
  assert.match(oracle.sql, /T1\.TYPE = T2\.A_TYPE\(\+\)/)
  assert.match(oracle.sql, /T2\.ID = T3\.B_ID\(\+\)/)
})

test('disconnected selected tables are reported instead of silently cross joined', () => {
  const { E } = createJoinContext()
  const result = E.JoinStyle.buildSelectionJoinSql(['A','B','X'], E.JoinStyle.ANSI)
  assert.equal(result.sql, '')
  assert.deepEqual([...result.plan.connectedIds], ['A','B'])
  assert.deepEqual([...result.plan.disconnectedIds], ['X'])
})

test('Join Path Finder supports ANSI and Oracle legacy syntax across intermediate tables', () => {
  const { E, context, outputs } = createJoinContext()
  const paths = E.JoinStyle.allJoinPaths('A','C')
  assert.equal(paths.length, 1)
  assert.deepEqual([...E.JoinStyle.pathNodeIds(paths[0])], ['A','B','C'])
  assert.match(E.JoinStyle.buildPathSql(paths[0], E.JoinStyle.ANSI), /JOIN B T2[\s\S]*JOIN C T3/)
  assert.match(E.JoinStyle.buildPathSql(paths[0], E.JoinStyle.ORACLE), /T1\.ID = T2\.A_ID\(\+\)/)
  assert.match(E.JoinStyle.buildPathSql(paths[0], E.JoinStyle.ORACLE), /T2\.ID = T3\.B_ID\(\+\)/)

  E.selectedIds.add('A')
  E.selectedIds.add('C')
  context.generateJoinPath()
  assert.equal(outputs.at(-1).title, 'Join Path Finder · Oracle (+)')
  assert.match(outputs.at(-1).content, /A → B → C/)
  assert.match(outputs.at(-1).content, /\(\+\)/)
})

test('canonical JOIN menu action stays enabled for more than two selected tables', () => {
  const actions = new Map()
  const E = {
    Actions: { register(action) { actions.set(action.id, action) } },
    selectedIds: new Set(['A','B','C'])
  }
  const context = { window:null, console }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-join-actions.js'), context, { filename:'editor-join-actions.js' })

  const join = actions.get('tools.join')
  assert.equal(join.label, '선택 테이블 JOIN SQL')
  assert.equal(join.when(), true)

  const main = read('src/main.jsx')
  assert.ok(main.indexOf("'/editor-join-actions.js'") < main.indexOf("'/editor-desktop-shell.js'"))
})

test('JOIN extension scripts parse as JavaScript', () => {
  for (const file of ['editor-join-style.js','editor-join-actions.js']) {
    assert.doesNotThrow(() => new vm.Script(read(file), { filename:file }))
  }
})
