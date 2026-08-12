import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function classList(initial = []) {
  const values = new Set(initial)
  return {
    contains: value => values.has(value),
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    toggle(value, force) {
      if (force === true) values.add(value)
      else if (force === false) values.delete(value)
      else if (values.has(value)) values.delete(value)
      else values.add(value)
      return values.has(value)
    }
  }
}

test('desktop action registry exposes canonical project commands', () => {
  let opened = 0
  let saved = 0
  const storage = new Map()
  const listeners = new Map()
  const E = {
    Advanced: { showToast() {}, ensureDialog() { return { showModal() {} } } },
    Project: {
      state: { project: { name: 'Test Project' } },
      Workspace: { openProjectFile() { opened += 1 } },
      exportFile() { saved += 1 },
      editInfo() {}
    },
    selectedIds: new Set(),
    escapeHtml: value => String(value)
  }
  const context = {
    window: null,
    document: {
      body: { classList: classList(['theme-cyber-navy']) },
      getElementById() { return null },
      querySelector() { return null },
      dispatchEvent() {},
      addEventListener(type, fn) { listeners.set(type, fn) }
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } },
    Map,
    Set,
    console
  }
  context.window = context
  context.window.ERDEditor = E

  vm.runInNewContext(read('editor-actions.js'), context, { filename: 'editor-actions.js' })

  assert.ok(E.Actions.get('file.new'))
  assert.ok(E.Actions.get('file.open'))
  assert.ok(E.Actions.get('file.save'))
  assert.ok(E.Actions.get('file.settings'))
  assert.equal(E.Actions.enabled('tools.join'), false)
  E.selectedIds.add('A'); E.selectedIds.add('B')
  assert.equal(E.Actions.enabled('tools.join'), true)

  assert.equal(E.Actions.invoke('file.open'), true)
  assert.equal(E.Actions.invoke('file.save'), true)
  assert.equal(opened, 1)
  assert.equal(saved, 1)

  const keydown = listeners.get('keydown')
  assert.ok(keydown)
  let prevented = false
  keydown({ ctrlKey:true, metaKey:false, altKey:false, key:'s', preventDefault(){ prevented = true } })
  assert.equal(prevented, true)
  assert.equal(saved, 2)
})

test('desktop menu references registered actions and keeps dock navigation-only', () => {
  const actions = read('editor-actions.js')
  const shell = read('editor-desktop-shell.js')
  const actionIds = new Set([...actions.matchAll(/id:'([^']+)'/g)].map(match => match[1]))
  const menuIds = [...shell.matchAll(/'((?:file|edit|view|tools|help)\.[^']+)'/g)].map(match => match[1])
  const missing = [...new Set(menuIds)].filter(id => !actionIds.has(id))
  assert.deepEqual(missing, [])

  for (const selector of ['data-project-open','data-project-save','data-project-settings-explicit','data-mybatis-import','data-ai-context-export']) {
    assert.match(shell, new RegExp(selector))
  }
})

test('legacy tool capabilities remain reachable through canonical actions', () => {
  const actions = read('editor-actions.js')
  const globals = [
    'addNoteAt','createSubjectArea','changeTableColor','generateCode','analyzeRelations','transactionScopeGuide',
    'generateJoinForSelected','generateJoinPath','showDependencyOrder','detectNPlusOneRisk','validateSchema',
    'openDdlImportDialog','exportDdl','exportSchemaJson','importSchemaJson','openTemplateManager',
    'manualVersionSave','openVersionHistory','exportDiagram','exportSpecification','resetSavedSchema',
    'openMyBatisImport','openMyBatisIndex','showMapperUsage','exportAiScopeContext','exportAiProjectContext'
  ]
  for (const name of globals) assert.equal(actions.includes(`callGlobal('${name}'`), true, name)
})

test('welcome hub is limited to blank workspaces and exposes project entry paths', () => {
  const welcome = read('editor-welcome.js')
  assert.match(welcome, /isBlankWorkspace/)
  assert.match(welcome, /file\.new/)
  assert.match(welcome, /file\.open/)
  assert.match(welcome, /file\.import\.ddl/)
  assert.match(welcome, /file\.import\.mybatis/)
  assert.match(welcome, /ERDStudioSamples/)
  assert.match(welcome, /document\.readyState === 'complete'/)
})

test('extension loader orders actions before desktop shell and welcome', () => {
  const main = read('src/main.jsx')
  const positions = [
    main.indexOf("'/editor-workspace-ui.js'"),
    main.indexOf("'/editor-actions.js'"),
    main.indexOf("'/editor-desktop-shell.js'"),
    main.indexOf("'/editor-welcome.js'"),
    main.indexOf("'/editor-responsive-ux.js'")
  ]
  assert.ok(positions.every(pos => pos >= 0))
  assert.deepEqual([...positions].sort((a,b) => a-b), positions)
})

test('browser extension scripts parse as JavaScript', () => {
  for (const file of ['editor-actions.js','editor-desktop-shell.js','editor-welcome.js']) {
    assert.doesNotThrow(() => new vm.Script(read(file), { filename:file }))
  }
})
