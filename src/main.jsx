import React from 'react'
import ReactDOM from 'react-dom/client'
import projectManifest from '../projects/manifest.json'
import './index.css'
import '../editor-project.css'
import '../editor-project-dock-ux.css'
import '../editor-mybatis.css'
import '../editor-join-style.css'
import '../editor-relation-routing-ux.css'
import '../editor-table-visibility.css'
import '../editor-workspace.css'
import '../editor-desktop-shell.css'
import '../editor-welcome.css'

const projectDefinitionModules = import.meta.glob('../projects/*.project.json', {
  eager: true,
  import: 'default'
})

window.ERDSourceProjects = {
  manifest: projectManifest,
  definitions: Object.fromEntries(
    Object.entries(projectDefinitionModules).map(([path, definition]) => [path.split('/').pop(), definition])
  )
}

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
            loadClassic('/editor-import-layout-guard.js', 'import-layout-guard', () => {
              loadClassic('/editor-project-dock.js', 'project-dock', () => {
                loadClassic('/editor-project-dock-ux.js', 'project-dock-ux', () => {
                  loadClassic('/editor-workspace-ui.js', 'workspace-ui', () => {
                    loadClassic('/editor-project-library.js', 'project-library', () => {
                      // Install the final JOIN implementation before actions/menu markup.
                      // This avoids the legacy two-table generator being captured during startup.
                      loadClassic('/editor-join-style.js', 'join-style', () => {
                        loadClassic('/editor-actions.js', 'actions', () => {
                          loadClassic('/editor-sample-actions.js', 'sample-actions', () => {
                            loadClassic('/editor-join-actions.js', 'join-actions', () => {
                              loadClassic('/editor-relation-routing-ux.js', 'relation-routing-ux', () => {
                                loadClassic('/editor-relation-identity.js', 'relation-identity', () => {
                                  loadClassic('/editor-relation-router-v2.js', 'relation-router-v2', () => {
                                    loadClassic('/editor-relation-router-strategies.js', 'relation-router-strategies', () => {
                                      loadClassic('/editor-relation-router-modes.js', 'relation-router-modes', () => {
                                        loadClassic('/editor-table-visibility.js', 'table-visibility', () => {
                                          loadClassic('/editor-view-projection.js', 'view-projection', () => {
                                            loadClassic('/editor-project-diagnostics.js', 'project-diagnostics', () => {
                                              loadClassic('/editor-desktop-shell.js', 'desktop-shell', () => {
                                                loadClassic('/editor-welcome.js', 'welcome', () => {
                                                  loadClassic('/editor-responsive-ux.js', 'responsive-ux', () => {
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
