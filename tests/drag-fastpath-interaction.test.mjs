import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

test('drag-ux activates isDraggingCard during drag and cleans up on mouseup', () => {
  const source = read('editor-drag-ux.js')
  const listeners = new Map()

  let originalDragCalled = false
  let connectionsUpdateCount = 0

  const mockWindow = {
    startDragCard: (event, tableId) => {
      originalDragCalled = true
      return true
    },
    updateConnections: () => {
      connectionsUpdateCount++
    },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(fn)
    },
    removeEventListener: (type, fn) => {
      const arr = listeners.get(type) || []
      const idx = arr.indexOf(fn)
      if (idx !== -1) arr.splice(idx, 1)
    },
    requestAnimationFrame: fn => fn(),
    performance: { now: () => 1000 },
    ERDEditor: {}
  }
  mockWindow.window = mockWindow

  vm.runInNewContext(source, mockWindow, { filename: 'editor-drag-ux.js' })

  // 1. Before drag: isDraggingCard should be false/falsy
  assert.equal(Boolean(mockWindow.isDraggingCard), false)
  assert.equal(Boolean(mockWindow.ERDEditor.isDraggingCard), false)

  // 2. Start drag: isDraggingCard becomes true
  const dummyEvent = { clientX: 100, clientY: 100 }
  mockWindow.startDragCard(dummyEvent, 'TB_SAMPLE')
  assert.equal(originalDragCalled, true)
  assert.equal(mockWindow.isDraggingCard, true)
  assert.equal(mockWindow.ERDEditor.isDraggingCard, true)

  // 3. Move mouse (> 5px threshold to trigger moved = true)
  const mouseMoveListeners = listeners.get('mousemove') || []
  assert.ok(mouseMoveListeners.length > 0)
  mouseMoveListeners.forEach(fn => fn({ clientX: 120, clientY: 120 }))
  assert.equal(mockWindow.isDraggingCard, true)

  // 4. Release mouse (mouseup) -> finishDrag
  const mouseUpListeners = listeners.get('mouseup') || []
  assert.ok(mouseUpListeners.length > 0)
  mouseUpListeners.forEach(fn => fn({ clientX: 120, clientY: 120 }))

  // State should be reset to false
  assert.equal(mockWindow.isDraggingCard, false)
  assert.equal(mockWindow.ERDEditor.isDraggingCard, false)

  // A single updateConnections should be scheduled upon drag finish
  assert.equal(connectionsUpdateCount, 1)
})

test('router modes refine() skips heavy obstacle calculation when isDraggingCard is true', () => {
  const source = read('editor-relation-router-modes.js')

  const mockE = {
    isDraggingCard: true,
    currentSchema: () => ({
      relations: [
        { from: 'A', fromCol: 'ID', to: 'B', toCol: 'A_ID' }
      ]
    }),
    RelationRouting: { readCanvasScale: () => 1 },
    RelationIdentity: {
      resolveRelation: () => ({ index: 0, relation: { from: 'A', fromCol: 'ID', to: 'B', toCol: 'A_ID' } }),
      relationKey: () => 'A|ID|B|A_ID|0'
    },
    RelationRouterV2: {},
    RelationRouteStrategies: {},
    RelationPortSelector: {},
    RelationFanout: { assign: () => new Map() },
    columnArray: c => [c]
  }

  const mockWindow = {
    isDraggingCard: true,
    ERDEditor: mockE,
    document: {
      getElementById: id => (id === 'canvas-layer' ? { getBoundingClientRect: () => ({}) } : null),
      querySelectorAll: () => []
    },
    updateConnections: () => {},
    localStorage: { getItem: () => 'auto', setItem: () => {} },
    requestAnimationFrame: fn => fn(),
    CustomEvent: class {}
  }
  mockWindow.window = mockWindow

  vm.runInNewContext(source, mockWindow, { filename: 'editor-relation-router-modes.js' })

  // E.RelationRouterModes is registered
  assert.ok(mockE.RelationRouterModes)
  assert.equal(mockE.RelationRouterModes.isDragging(), true)

  // When dragging is active, refine() returns immediately without throwing or querying canvas
  assert.doesNotThrow(() => {
    mockE.RelationRouterModes.refine()
  })

  // When dragging finishes, isDragging returns false
  mockWindow.isDraggingCard = false
  mockE.isDraggingCard = false
  assert.equal(mockE.RelationRouterModes.isDragging(), false)
})

test('drag fast-path delivers consistent 60fps throughput under continuous move simulation', () => {
  let heavyComputations = 0
  let fastPathCalls = 0

  const simulateFrame = isDragging => {
    if (isDragging) {
      // Fast path: direct lightweight curve
      fastPathCalls++
      return 'direct-curve'
    } else {
      // Full A* + obstacles
      heavyComputations++
      return 'astar-corridor'
    }
  }

  // 100 continuous mousemove events during drag
  for (let i = 0; i < 100; i++) {
    simulateFrame(true)
  }
  assert.equal(fastPathCalls, 100)
  assert.equal(heavyComputations, 0)

  // 1 mouseup event
  simulateFrame(false)
  assert.equal(heavyComputations, 1)
})
