import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('folder-project branch validation includes the action override', () => {
  assert.equal(fs.existsSync(new URL('../editor-folder-project-actions.js', import.meta.url)), true)
})
