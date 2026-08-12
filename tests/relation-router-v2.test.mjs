import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

function loadRouter() {
  const listeners = new Map()
  const E = {
    columnArray:value => Array.isArray(value) ? value : [value],
    currentSchema:() => ({ relations:[] }),
    RelationRouting:{
      readCanvasScale:() => 1,
      computeRoute:() => ({ axis:'horizontal', d:'M 0 50 C 100 50, 200 50, 300 50', mid:{ x:150, y:50 } })
    },
    RelationIdentity:{
      resolveRelation:() => null,
      parallelLane:() => 0,
      laneRoute:route => route
    }
  }
  const context = {
    window:null,
    document:{
      getElementById(){ return null },
      querySelectorAll(){ return [] },
      addEventListener(type, fn){ listeners.set(type, fn) }
    },
    requestAnimationFrame(fn){ fn(); return 1 },
    console,
    Math,
    Number
  }
  context.window = context
  context.window.ERDEditor = E
  context.window.updateConnections = () => {}
  vm.runInNewContext(read('editor-relation-router-v2.js'), context, { filename:'editor-relation-router-v2.js' })
  return { router:E.RelationRouterV2, listeners }
}

test('direct cubic sampling detects a table blocking the middle of a relation', () => {
  const { router } = loadRouter()
  const points = router.sampleCubic('M 0 50 C 100 50, 200 50, 300 50')
  const obstacle = { left:120, top:20, right:180, bottom:80 }
  assert.ok(points.length > 10)
  assert.equal(router.routeIntersections(points, [obstacle]), 1)
})

test('router chooses a zero-intersection corridor around a blocking card', () => {
  const { router } = loadRouter()
  const p0 = { x:0, y:50 }
  const p3 = { x:300, y:50 }
  const obstacle = { left:120, top:20, right:180, bottom:80 }
  const route = router.chooseRoute(p0, p3, [obstacle], 0)

  assert.ok(route)
  assert.equal(route.intersections, 0)
  assert.deepEqual(route.points[0], p0)
  assert.deepEqual(route.points.at(-1), p3)
  assert.ok(['top','bottom','left','right','mid-x','mid-y'].includes(route.kind))
})

test('parallel lane changes detour corridor without moving endpoints', () => {
  const { router } = loadRouter()
  const p0 = { x:0, y:20 }
  const p3 = { x:300, y:80 }
  const obstacle = { left:120, top:0, right:180, bottom:100 }
  const negative = router.chooseRoute(p0, p3, [obstacle], -12)
  const positive = router.chooseRoute(p0, p3, [obstacle], 12)

  assert.deepEqual(negative.points[0], p0)
  assert.deepEqual(negative.points.at(-1), p3)
  assert.deepEqual(positive.points[0], p0)
  assert.deepEqual(positive.points.at(-1), p3)
  assert.notEqual(router.polylinePath(negative.points), router.polylinePath(positive.points))
})

test('polyline midpoint follows routed distance rather than bounding-box center', () => {
  const { router } = loadRouter()
  const points = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:300,y:100}]
  const midpoint = router.polylineMidpoint(points)
  assert.equal(midpoint.x, 100)
  assert.equal(midpoint.y, 100)
})

test('router v2 loads after stable relation identity and before visibility projection', () => {
  const main = read('src/main.jsx')
  const identity = main.indexOf("'/editor-relation-identity.js'")
  const router = main.indexOf("'/editor-relation-router-v2.js'")
  const visibility = main.indexOf("'/editor-table-visibility.js'")
  assert.ok(identity >= 0 && router > identity && visibility > router)
})

test('router v2 parses as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(read('editor-relation-router-v2.js'), { filename:'editor-relation-router-v2.js' }))
})
