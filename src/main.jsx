import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '../editor-project.css'
import '../editor-mybatis.css'

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
  loadClassic('/editor-project.js', 'project', () => {
    loadClassic('/editor-project-dock.js', 'project-dock', () => {
      loadClassic('/editor-mybatis.js', 'mybatis')
    })
  })
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', loadProjectLayer, { once: true })
} else {
  loadProjectLayer()
}

console.log('React + Vite + Tailwind Environment Initialized')
