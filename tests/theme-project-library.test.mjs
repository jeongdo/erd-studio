import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const json = name => JSON.parse(read(name))

function classList(initial = []) {
  const values = new Set(initial)
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item)
  }
}

test('theme switching preserves desktop application state classes', () => {
  const source = read('editor-theme-ux.js')
  assert.equal(source.includes('document.body.className ='), false)

  const classes = classList(['theme-cyber-navy', 'erd-desktop-shell', 'erd-hide-minimap'])
  const context = {
    window: null,
    document: {
      body: { classList: classes },
      getElementById() { return null },
      dispatchEvent() {}
    },
    localStorage: { setItem() {} },
    getComputedStyle() { return { getPropertyValue() { return '#38bdf8' } } },
    CustomEvent: class {},
    console
  }
  context.window = context

  vm.runInNewContext(source, context, { filename: 'editor-theme-ux.js' })
  context.changeTheme('theme-paper-light')

  assert.equal(classes.contains('theme-paper-light'), true)
  assert.equal(classes.contains('theme-cyber-navy'), false)
  assert.equal(classes.contains('erd-desktop-shell'), true)
  assert.equal(classes.contains('erd-hide-minimap'), true)
})

test('source project folder exposes Oracle default and Performance 300', () => {
  const manifest = json('projects/manifest.json')
  assert.equal(manifest.format, 'erd-studio-project-library')
  assert.deepEqual(manifest.projects.map(project => project.id), ['sei_fm_master', 'analysis_20260812', 'oracle-default', 'performance-300'])

  const oracle = json('projects/oracle-default.project.json')
  assert.equal(oracle.format, 'erd-studio-builtin-project')
  assert.deepEqual(oracle.schemas.map(schema => schema.sampleId), ['oracle_hr', 'oracle_scott'])

  const performance = json('projects/performance-300.project.json')
  assert.deepEqual(performance.schemas.map(schema => schema.sampleId), ['performance_300'])
})

test('Vite bundles source project definitions before project library loads', () => {
  const main = read('src/main.jsx')
  const library = read('editor-project-library.js')
  const actions = read('editor-actions.js')

  assert.match(main, /import projectManifest from '\.\.\/projects\/manifest\.json'/)
  assert.match(main, /import\.meta\.glob\('\.\.\/projects\/\*\.project\.json'/)
  assert.match(main, /window\.ERDSourceProjects/)
  assert.ok(main.indexOf("'/editor-project-library.js'") < main.indexOf("'/editor-actions.js'"))

  assert.match(library, /window\.ERDSourceProjects/)
  assert.match(library, /W\.openLocalProjectFile = originalOpenLocalFile/)
  assert.match(library, /W\.openProjectFile = openProjectLibrary/)
  assert.match(library, /내 파일에서 열기/)
  assert.match(actions, /P\.Workspace\?\.openProjectFile/)
})

test('theme and project library scripts parse as JavaScript', () => {
  for (const file of ['editor-theme-ux.js', 'editor-project-library.js']) {
    assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }))
  }
})
