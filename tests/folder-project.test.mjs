import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadFolderProject() {
  const nodes = new Map()
  let applied = null
  const body = { appendChild(node) { nodes.set(node.id, node) } }
  const document = {
    body,
    getElementById(id) { return nodes.get(id) || null },
    createElement(tag) {
      assert.equal(tag, 'input')
      const listeners = new Map()
      return {
        setAttribute(name, value) { this[name] = value },
        addEventListener(name, fn) { listeners.set(name, fn) },
        click() { this.clicked = true },
        async emit(name) { return listeners.get(name)?.() }
      }
    }
  }
  const Project = {
    format:'erd-studio-project',
    version:1,
    payload() { return samplePayload() },
    Workspace: {
      validateProjectFile(payload) {
        assert.equal(payload.format, 'erd-studio-project')
        assert.ok(payload.schemas && Object.keys(payload.schemas).length)
      },
      applyProjectFilePayload(payload) { applied = payload },
      confirmReplace() { return true }
    }
  }
  const context = {
    window:null,
    document,
    alert() {},
    console,
    Blob,
    URL,
    Map,
    Set,
    Date,
    Array,
    JSON,
    Object,
    String,
    Error
  }
  context.window = context
  context.window.ERDEditor = { Project, Advanced:{ showToast(){} } }
  vm.runInNewContext(read('editor-folder-project.js'), context, { filename:'editor-folder-project.js' })
  return { E:context.window.ERDEditor, document, nodes, get applied(){ return applied } }
}

function samplePayload() {
  return {
    format:'erd-studio-project', version:1, exportedAt:'2026-08-13T00:00:00.000Z',
    project:{ id:'p1', name:'Orders', dbms:'oracle' },
    schemas:{
      main:{
        tabName:'MAIN', title:'Main schema', icon:'db',
        tables:[
          { id:'CUSTOMER', name:'CUSTOMER', x:10, y:20, columns:[{name:'ID',type:'NUMBER',pk:true}] },
          { id:'ORDERS', name:'ORDERS', x:400, y:20, columns:[{name:'ID',type:'NUMBER',pk:true},{name:'CUSTOMER_ID',type:'NUMBER',fk:true}] }
        ],
        relations:[{ from:'CUSTOMER', fromCol:'ID', to:'ORDERS', toCol:'CUSTOMER_ID', identifying:false }]
      },
      audit:{ tabName:'AUDIT', tables:[], relations:[] }
    },
    areas:[{id:'a1',name:'Sales',schemaKey:'main',tableIds:['CUSTOMER','ORDERS']}],
    activeAreaBySchema:{main:'a1',audit:null},
    sources:{mybatis:{files:[]},mybatisIndexes:{}}
  }
}

function mockFile(relativePath, value) {
  return {
    name:relativePath.split('/').pop(),
    webkitRelativePath:`orders/${relativePath}`,
    async text() { return typeof value === 'string' ? value : JSON.stringify(value) }
  }
}

function partsAsFiles(parts) {
  return [
    mockFile('project.json', parts.projectFile),
    mockFile('relations.json', parts.relationFile),
    ...parts.tableFiles.map(item => mockFile(item.path, item.value))
  ]
}

test('folder project round-trips portable payload through separate table files', async () => {
  const { E } = loadFolderProject()
  const source = samplePayload()
  const parts = E.FolderProject.splitPayload(source)

  assert.equal(parts.projectFile.format, 'erd-studio-folder-project')
  assert.deepEqual(Object.keys(parts.projectFile.schemas), ['main','audit'])
  assert.equal('tables' in parts.projectFile.schemas.main, false)
  assert.deepEqual(Array.from(parts.projectFile.schemas.main.tableFiles), [
    'tables/main__CUSTOMER.json',
    'tables/main__ORDERS.json'
  ])
  assert.equal(parts.projectFile.schemas.audit.tableFiles.length, 0)
  assert.equal(parts.tableFiles.length, 2)
  assert.ok(parts.tableFiles.every(item => item.path.startsWith('tables/main__')))

  const restored = await E.FolderProject.assembleFiles(partsAsFiles(parts))
  assert.equal(restored.format, 'erd-studio-project')
  assert.equal(restored.project.name, 'Orders')
  assert.deepEqual(Array.from(restored.schemas.main.tables, table => table.id), ['CUSTOMER','ORDERS'])
  assert.equal(JSON.stringify(restored.schemas.main.relations), JSON.stringify(source.schemas.main.relations))
  assert.equal(restored.schemas.audit.tables.length, 0)
})

test('strict loader rejects duplicate tables and broken relation endpoints', async () => {
  const { E } = loadFolderProject()
  const parts = E.FolderProject.splitPayload(samplePayload())
  const duplicate = structuredClone(parts.tableFiles[0])
  duplicate.path = 'tables/main__CUSTOMER-copy.json'
  parts.projectFile.schemas.main.tableFiles.push(duplicate.path)
  await assert.rejects(
    E.FolderProject.assembleFiles(partsAsFiles({ ...parts, tableFiles:[...parts.tableFiles, duplicate] })),
    /중복 테이블/
  )

  parts.projectFile.schemas.main.tableFiles.pop()
  parts.relationFile.schemas.main[0].to = 'MISSING'

  await assert.rejects(E.FolderProject.assembleFiles(partsAsFiles(parts)), /to 테이블을 찾을 수 없습니다/)
})

test('strict loader reports malformed JSON with its path', async () => {
  const { E } = loadFolderProject()
  const parts = E.FolderProject.splitPayload(samplePayload())
  const files = partsAsFiles(parts)
  files[2] = mockFile(parts.tableFiles[0].path, '{broken')
  await assert.rejects(E.FolderProject.assembleFiles(files), /tables\/main__CUSTOMER\.json: JSON을 읽을 수 없습니다/)
})

test('loader ignores stale JSON that is not registered in project manifest', async () => {
  const { E } = loadFolderProject()
  const parts = E.FolderProject.splitPayload(samplePayload())
  const files = [...partsAsFiles(parts), mockFile('tables/stale.json', '{broken')]

  const restored = await E.FolderProject.assembleFiles(files)
  assert.deepEqual(Array.from(restored.schemas.main.tables, table => table.id), ['CUSTOMER','ORDERS'])
})

test('manifest rejects path traversal, absolute paths and schema escape', async () => {
  const { E } = loadFolderProject()
  for (const path of ['tables/../escape.json', '/tables/main__CUSTOMER.json', 'tables/audit__ACCESS_LOG.json']) {
    const parts = E.FolderProject.splitPayload(samplePayload())
    parts.projectFile.schemas.main.tableFiles[0] = path
    await assert.rejects(E.FolderProject.assembleFiles(partsAsFiles(parts)), /경로 이탈|범위 밖/)
  }
})

test('folder input is persistent, multiple and webkitdirectory-enabled', () => {
  const runtime = loadFolderProject()
  const first = runtime.E.FolderProject.ensureFolderInput()
  const second = runtime.E.FolderProject.ensureFolderInput()
  assert.equal(first, second)
  assert.equal(first.id, 'erd-project-folder-input')
  assert.equal(first.type, 'file')
  assert.equal(first.multiple, true)
  assert.equal(first.webkitdirectory, '')
  assert.equal(runtime.document.body, runtime.document.body)
})

function directoryHandle(name = 'root') {
  const files = new Map()
  const directories = new Map()
  return {
    kind:'directory', name, files, directories,
    async getDirectoryHandle(child, { create } = {}) {
      if (!directories.has(child) && create) directories.set(child, directoryHandle(child))
      return directories.get(child)
    },
    async getFileHandle(filename, { create } = {}) {
      if (!files.has(filename) && create) files.set(filename, { content:'' })
      const file = files.get(filename)
      return {
        async createWritable() {
          return { async write(value){ file.content = value }, async close(){} }
        }
      }
    },
    async *entries() {
      for (const item of directories) yield [item[0], item[1]]
      for (const item of files) yield [item[0], {kind:'file'}]
    },
    async removeEntry(child) { directories.delete(child); files.delete(child) }
  }
}

test('File System Access writer creates canonical folder layout', async () => {
  const { E } = loadFolderProject()
  const rootHandle = directoryHandle()
  rootHandle.files.set('README.md', {content:'keep me'})
  const existingTables = await rootHandle.getDirectoryHandle('tables', {create:true})
  existingTables.files.set('stale.json', {content:'keep stale'})
  existingTables.directories.set('notes', directoryHandle('notes'))

  const result = await E.FolderProject.saveToDirectory(rootHandle, samplePayload())

  assert.equal(result.tableCount, 2)
  assert.equal(result.schemaCount, 2)
  assert.ok(rootHandle.files.has('project.json'))
  assert.ok(rootHandle.files.has('relations.json'))
  const tables = rootHandle.directories.get('tables')
  assert.ok(tables.files.has('main__CUSTOMER.json'))
  assert.ok(tables.files.has('main__ORDERS.json'))
  assert.equal(rootHandle.files.get('README.md').content, 'keep me')
  assert.equal(tables.files.get('stale.json').content, 'keep stale')
  assert.ok(tables.directories.has('notes'))
  const manifest = JSON.parse(rootHandle.files.get('project.json').content)
  assert.equal(manifest.format, 'erd-studio-folder-project')
  assert.deepEqual(manifest.schemas.main.tableFiles, ['tables/main__CUSTOMER.json','tables/main__ORDERS.json'])
})

test('loader, actions and menus prefer folder projects while retaining legacy JSON', () => {
  const main = read('src/main.jsx')
  const actions = read('editor-actions.js')
  const shell = read('editor-desktop-shell.js')
  assert.match(main, /editor-folder-project\.js/)
  assert.match(actions, /FolderProject\?\.openFolder/)
  assert.match(actions, /FolderProject\?\.saveFolder/)
  assert.match(actions, /file\.open\.legacy/)
  assert.match(actions, /file\.save\.legacy/)
  assert.match(shell, /file\.open\.legacy','file\.save\.legacy/)
  assert.match(shell, /view\.placeholders\.compact','view\.placeholders\.smart/)
  assert.doesNotThrow(() => new vm.Script(read('editor-folder-project.js'), {filename:'editor-folder-project.js'}))
})
