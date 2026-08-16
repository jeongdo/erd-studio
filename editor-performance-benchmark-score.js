/** ARGUS renderer engineering score overlay for active candidates. */
(() => {
  'use strict';
  const workspace = document.getElementById('workspace');
  if (!workspace) return;

  const profiles = {
    performance_100000_raw: {
      name: 'WebGL2 + Canvas Detail',
      difficulty: 8, failureRisk: 7, compactness: 4, readability: 5, performancePotential: 9,
      note: '현재 기능성 기준점. WebGL/Canvas/interaction 동기화 비용이 큼'
    },
    performance_lab_webgl_lod_100000: {
      name: 'WebGL2 LOD / Cluster',
      difficulty: 9, failureRisk: 7, compactness: 4, readability: 5, performancePotential: 10,
      note: 'v0 semantic 구현을 기준으로 색상/테이블/관계선/drag/collision을 복구한 후보'
    }
  };

  const panel = document.createElement('div');
  panel.id = 'argus-renderer-score';
  Object.assign(panel.style, {
    position: 'absolute', top: '44px', left: '12px', zIndex: '84', display: 'none',
    maxWidth: '540px', padding: '7px 10px', borderRadius: '7px',
    border: '1px solid var(--panel-border)',
    background: 'color-mix(in srgb, var(--panel-bg) 92%, transparent)',
    color: 'var(--text-muted)', font: "500 10px/1.5 'Fira Code', monospace",
    pointerEvents: 'none'
  });
  workspace.appendChild(panel);

  let lastView = null;
  function render() {
    const profile = profiles[currentView];
    if (!profile) {
      panel.style.display = 'none';
      lastView = currentView;
      requestAnimationFrame(render);
      return;
    }
    if (lastView !== currentView) {
      panel.style.display = 'block';
      panel.innerHTML = `<b style="color:var(--accent-blue)">ARGUS SCORE · ${profile.name}</b><br>`
        + `난이도 ${profile.difficulty}/10 · 실패위험 ${profile.failureRisk}/10 · `
        + `압축성 ${profile.compactness}/10 · 가독성 ${profile.readability}/10 · `
        + `성능잠재력 ${profile.performancePotential}/10<br>`
        + `<span style="opacity:.78">${profile.note}</span>`;
      lastView = currentView;
    }
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
  window.ARGUSRendererScores = profiles;
})();
