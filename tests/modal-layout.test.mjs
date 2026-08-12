import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

test('Tailwind reset is explicitly countered by the centered dialog rule', () => {
  const tailwind = read('src/index.css')
  const css = read('editor.css')

  assert.match(tailwind, /\*\s*\{[\s\S]*@apply box-border m-0 p-0/)
  assert.match(css, /dialog\.editor-dialog\s*\{[\s\S]*position:fixed;[\s\S]*inset:0;[\s\S]*margin:auto;/)
  assert.match(css, /max-height:calc\(100dvh - 32px\)/)
  assert.match(css, /\.editor-dialog-body\s*\{[\s\S]*overflow:auto;/)
})

test('all application dialogs use the shared editor-dialog convention', () => {
  const advanced = read('editor-advanced-core.js')
  const html = read('index.html')

  assert.match(advanced, /dialog\.className = `editor-dialog advanced-dialog/)
  assert.match(html, /<dialog class="editor-dialog" id="table-editor-dialog">/)
})

test('persistent work panels remain outside the modal dialog convention', () => {
  const html = read('index.html')
  const css = read('editor.css')

  assert.match(html, /<div class="inspector-drawer" id="inspector">/)
  assert.match(html, /<section class="editor-output" id="editor-output">/)
  assert.match(html, /<div class="editor-context-menu" id="editor-context-menu">/)
  assert.match(css, /\.editor-output\s*\{\s*position:fixed;/)
  assert.doesNotMatch(css, /dialog\.editor-output/)
  assert.doesNotMatch(css, /dialog\.inspector-drawer/)
})
