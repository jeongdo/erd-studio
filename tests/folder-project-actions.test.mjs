import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadActions({ folder = true } = {}) {
  const actions = new Map()
  let legacyOpen = 0
  let legacySave = 0
  const E = {
    Project: {
      Workspace: { openProjectFile() { legacyOpen += 1 } },
      exportFile() { legacySave += 1 }
    },
    Actions: { register(action) { actions.set(action.id, action) } }
  }
  if (folder) {
    E.FolderProject = {
      openFolder() { return false },
      async saveFolder() { return false }
    }
  }
  const context = { window:null, console }
  context.window = context
  context.window.ERDEditor = E
  vm.runInNewContext(read('editor-folder-project-actions.js'), context, { filename:'editor-folder-project-actions.js' })
  return { actions, get legacyOpen(){ return legacyOpen }, get legacySave(){ return legacySave } }
}

test('folder actions do not launch legacy pickers when a folder action returns false', async () => {
  const runtime = loadActions()
  assert.equal(runtime.actions.get('file.open').run(), false)
  assert.equal(runtime.legacyOpen, 0)
  assert.equal(await runtime.actions.get('file.save').run(), false)
  assert.equal(runtime.legacySave, 0)
})

test('folder actions fall back only when the folder feature is unavailable', () => {
  const runtime = loadActions({ folder:false })
  runtime.actions.get('file.open').run()
  runtime.actions.get('file.save').run()
  assert.equal(runtime.legacyOpen, 1)
  assert.equal(runtime.legacySave, 1)
})

test('folder action override loads immediately after the central action registry', () => {
  const main = read('src/main.jsx')
  const base = main.indexOf("'/editor-actions.js'")
  const override = main.indexOf("'/editor-folder-project-actions.js'")
  const samples = main.indexOf("'/editor-sample-actions.js'")
  assert.ok(base >= 0 && override > base && samples > override)
})
