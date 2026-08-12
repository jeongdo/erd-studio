import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '../editor-project.css'
import '../editor-project-dock-ux.css'
import '../editor-mybatis.css'
import '../editor-join-style.css'
import '../editor-workspace.css'
import '../editor-desktop-shell.css'
import '../editor-welcome.css'

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
  loadClassic('/editor-header-ux.js', 'header-ux')
  loadClassic('/editor-theme-ux.js', 'theme-ux', () => {
    loadClassic('/editor-sample-catalog.js', 'sample-catalog', () => {
      loadClassic('/editor-sample-project-mode.js', 'sample-project-mode', () => {
        loadClassic('/editor-project.js', 'project', () => {
          loadClassic('/editor-workspace.js', 'workspace', () => {
            loadClassic('/editor-project-dock.js', 'project-dock', () => {
              loadClassic('/editor-project-dock-ux.js', 'project-dock-ux', () => {
                loadClassic('/editor-workspace-ui.js', 'workspace-ui', () => {
                  loadClassic('/editor-actions.js', 'actions', () => {
                    loadClassic('/editor-sample-actions.js', 'sample-actions', () => {
                      loadClassic('/editor-desktop-shell.js', 'desktop-shell', () => {
                        loadClassic('/editor-welcome.js', 'welcome', () => {
                          loadClassic('/editor-responsive-ux.js', 'responsive-ux', () => {
                            loadClassic('/editor-join-style.js', 'join-style', () => {
                              loadClassic('/editor-mybatis.js', 'mybatis', () => {
                                loadClassic('/editor-ai-context.js', 'ai-context')
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
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
