/** ARGUS renderer lab: subjective engineering score overlay (runtime FPS stays in renderer HUDs). */
(() => {
  'use strict';

  const workspace = document.getElementById('workspace');
  if (!workspace) return;

  const profiles = {
    performance_lab_dom_1000: {
      name: 'DOM + SVG', difficulty: 4, failureRisk: 3, compactness: 7, readability: 8, performancePotential: 3,
      note: '전파 충돌까지 맞추니 spatial index + DOM 좌표 + SVG 선 갱신 관리가 추가됨'
    },
    performance_lab_webgl_geometry_100000: {
      name: 'Pure WebGL2 Geometry', difficulty: 6, failureRisk: 5, compactness: 7, readability: 6, performancePotential: 10,
      note: 'GPU 경로는 매우 단순하지만 buffer/shader/hit-test를 직접 관리'
    },
    performance_100000_raw: {
      name: 'WebGL2 + Canvas Detail', difficulty: 8, failureRisk: 7, compactness: 4, readability: 5, performancePotential: 9,
      note: '현재 기능성은 높지만 WebGL/Canvas/interaction 동기화 포인트가 많음'
    },
    performance_lab_webgl_lod_100000: {
      name: 'WebGL2 LOD / Cluster', difficulty: 9, failureRisk: 8, compactness: 3, readability: 4, performancePotential: 10,
      note: '초대형 확장성은 최고지만 LOD 경계/cluster 상태 관리가 가장 복잡'
    }
  };

  const panel = document.createElement('div');
  panel.id = 'argus-renderer-score';
  Object.assign(panel.style, {
    position: 'absolute', top: '44px', left: '12px', zIndex: '84', display: 'none',
    maxWidth: '520px', padding: '7px 10px', borderRadius: '7px',
    border: '1px solid var(--panel-border)', background: 'color-mix(in srgb, var(--panel-bg) 92%, transparent)',
    color: 'var(--text-muted)', font: "500 10px/1.5 'Fira Code', monospace", pointerEvents: 'none'
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
