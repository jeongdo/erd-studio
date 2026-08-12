import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadIdentity(relations) {
  const E = {
    Advanced: {
      relationKey: rel => `${rel.from}|${[].concat(rel.fromCol).join(',')}|${rel.to}|${[].concat(rel.toCol).join(',')}`
    },
    RelationRouting: {
      computeRoute: () => ({ axis: 'horizontal', d: 'M 0 0 C 1 0, 2 0, 3 0', mid: { x: 1.5, y: 0 } }),
      readCanvasScale: () => 1
    },
    currentSchema: () => ({ relations }),
    columnArray: value => Array.isArray(value) ? value : [value]
  }
  const context = {
    window: null,
    document: {
      getElementById() { return null },
      querySelectorAll() { return [] }
    },
    requestAnimationFrame() {},
    console,
    Number,
    Math
  }
  context.window = context
  context.window.ERDEditor = E
  context.window.updateConnections = () => {}
  vm.runInNewContext(read('editor-relation-identity.js'), context, { filename: 'editor-relation-identity.js' })
  return E.RelationIdentity
}

const parallel = [
  { from: 'AUDIT_A', fromCol: 'USER_ID', to: 'AUDIT_B', toCol: 'USER_ID' },
  { from: 'AUDIT_A', fromCol: 'EMP_NO', to: 'AUDIT_B', toCol: 'EMP_NO' }
]

test('parallel FKs between the same table pair have distinct structural identities', () => {
  const identity = loadIdentity(parallel)
  assert.notEqual(identity.relationKey(parallel[0]), identity.relationKey(parallel[1]))
  assert.notEqual(identity.relationDomId(parallel[0], 0), identity.relationDomId(parallel[1], 1))
})

test('relationIndex wins over duplicate legacy table-pair ids', () => {
  const identity = loadIdentity(parallel)
  const first = identity.resolveRelation({ id: 'line-AUDIT_A-AUDIT_B', dataset: { relationIndex: '0' } }, parallel)
  const second = identity.resolveRelation({ id: 'line-AUDIT_A-AUDIT_B', dataset: { relationIndex: '1' } }, parallel)
  assert.equal(first.relation.fromCol, 'USER_ID')
  assert.equal(second.relation.fromCol, 'EMP_NO')
})

test('relation identity module parses as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(read('editor-relation-identity.js'), { filename: 'editor-relation-identity.js' }))
})

test('relation identity loads after routing and before desktop shell', () => {
  const main = read('src/main.jsx')
  const routing = main.indexOf("'/editor-relation-routing-ux.js'")
  const identity = main.indexOf("'/editor-relation-identity.js'")
  const shell = main.indexOf("'/editor-desktop-shell.js'")
  assert.ok(routing >= 0 && identity > routing && shell > identity)
})
