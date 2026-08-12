import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

test('performance benchmark is loaded as a sample project, not a transient top tab', () => {
  const main = read('src/main.jsx')
  const mode = read('editor-sample-project-mode.js')
  const actions = read('editor-sample-actions.js')

  assert.equal(main.includes('editor-performance-tab.js'), false)
  assert.equal(main.includes('editor-performance-tab.css'), false)
  assert.match(main, /editor-sample-project-mode\.js/)
  assert.match(main, /editor-sample-actions\.js/)
  assert.match(mode, /performance\.transient = false/)
  assert.match(mode, /delete schema\.transient/)
  assert.match(actions, /W\.loadSample\('performance_300'\)/)
  assert.equal(fs.existsSync(path.join(root, 'editor-performance-tab.js')), false)
  assert.equal(fs.existsSync(path.join(root, 'editor-performance-tab.css')), false)
})

test('project open uses a persistent DOM file input and accepts project json', () => {
  const workspace = read('editor-workspace.js')

  assert.match(workspace, /PROJECT_FILE_INPUT_ID = 'erd-project-file-input'/)
  assert.match(workspace, /document\.body\.appendChild\(input\)/)
  assert.match(workspace, /\.erdproject\.json/)
  assert.match(workspace, /application\/json/)
  assert.match(workspace, /input\.value = ''/)
  assert.match(workspace, /input\.click\(\)/)
  assert.match(workspace, /applyProjectFilePayload\(payload\)/)
})

test('new lifecycle scripts parse as JavaScript', () => {
  for (const file of ['editor-sample-project-mode.js', 'editor-sample-actions.js', 'editor-workspace.js']) {
    assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }))
  }
})
