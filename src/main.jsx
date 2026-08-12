import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Legacy ERD modules are still classic scripts. Load the project layer after the
// parser has executed those scripts, while keeping Vite/React available for
// incremental UI migration.
function loadProjectLayer() {
  if (document.querySelector('script[data-erd-project-layer]')) return
  const script = document.createElement('script')
  script.src = '/editor-project.js'
  script.dataset.erdProjectLayer = 'true'
  document.body.appendChild(script)
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', loadProjectLayer, { once: true })
} else {
  loadProjectLayer()
}

console.log('React + Vite + Tailwind Environment Initialized')
