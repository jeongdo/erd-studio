import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '../editor-project.css'
import '../editor-project-dock-ux.css'
import '../editor-mybatis.css'
import '../editor-performance-tab.css'

// Legacy ERD modules are still classic scripts. Load project extensions in
// dependency order after the parser has executed the legacy editor scripts.
function loadClassic(src, marker, onload) {
  if (document.querySelector(`script[data-erd-layer="${marker}"]`)) {
    onload?.()
    return
  }
  const script = document.createElement('script')
  script.src = src
  script.dataset.erdLayer = marker
  script.onload = () => onload?.()
  document.body.appendChild(script)
}

function loadProjectLayer() {
  loadClassic('/editor-drag-ux.js', 'drag-ux')
  loadClassic('/editor-project.js', 'project', () => {
    loadClassic('/editor-project-dock.js', 'project-dock', () => {
      loadClassic('/editor-project-dock-ux.js', 'project-dock-ux', () => {
        loadClassic('/editor-mybatis.js', 'mybatis', () => {
          loadClassic('/editor-ai-context.js', 'ai-context', () => {
            loadClassic('/editor-performance-tab.js', 'performance-tab')
          })
        })
      })
    })
  })
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', loadProjectLayer, { once: true })
} else {
  loadProjectLayer()
}

console.log('React + Vite + Tailwind Environment Initialized')
