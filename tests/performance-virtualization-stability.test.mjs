import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const source = fs.readFileSync(path.join(root, 'editor-performance.js'), 'utf8')

test('large ERD virtualization source parses', () => {
  assert.doesNotThrow(() => new Function(source))
})

test('virtualization uses a wider keep zone than its mount zone', () => {
  const mount = Number(source.match(/const MARGIN = (\d+)/)?.[1])
  const keep = Number(source.match(/const KEEP_MARGIN = (\d+)/)?.[1])
  assert.ok(Number.isFinite(mount))
  assert.ok(Number.isFinite(keep))
  assert.ok(keep > mount)
  assert.match(source, /intersectsViewport\(table, keepBounds\)/)
})

test('selected and interacting table cards are protected from culling churn', () => {
  assert.match(source, /protectedVirtualIds\(\)/)
  assert.match(source, /protectedIds\.has\(id\)/)
  assert.match(source, /performance\.now\(\) < retainCardsUntil/)
  assert.match(source, /cardsContainer\.addEventListener\('pointerdown', protectTableInteraction, true\)/)
  assert.match(source, /setTimeout\(scheduleCull, INTERACTION_GRACE_MS \+ 40\)/)
})

test('culling status reflects mounted cards after hysteresis retention', () => {
  assert.match(source, /const mountedIds = new Set/)
  assert.match(source, /virtualIds = mountedIds/)
  assert.match(source, /updateCullingStatus\(mountedIds\.size, candidates\.length\)/)
})
