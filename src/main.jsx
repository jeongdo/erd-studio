import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Keep table selection independent from the Inspector drawer.
// Selecting a table updates Inspector content, but only an explicit Inspector
// toggle should open the drawer.
function keepInspectorClosedOnSelection() {
  const originalSelectTable = window.selectTable
  if (typeof originalSelectTable !== 'function') return

  window.selectTable = function selectTableWithoutAutoOpen(table) {
    const inspector = document.getElementById('inspector')
    const wasOpen = inspector?.classList.contains('open') ?? false
    const result = originalSelectTable.call(this, table)

    if (!wasOpen) inspector?.classList.remove('open')
    return result
  }
}

keepInspectorClosedOnSelection()

// Currently, React is just initializing the environment.
// The actual DOM rendering is handled by the legacy app.js.
// Future React components can be mounted here.
console.log('React + Vite + Tailwind Environment Initialized');
