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
      name: 'WebGL2 + Viewport Culling',
      difficulty: 7, failureRisk: 5, compactness: 6, readability: 7, performancePotential: 9,
      note: 'semantic tile/cluster를 제거하고 실제 테이블만 viewport culling해 RAW와 직접 비교'
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

/**
 * Visual-parity layer for the CULL benchmark.
 * Reuses the existing CULL canvas draw calls and adds the same visual language
 * as the regular Oracle example card without changing culling/interaction logic.
 */
(() => {
  'use strict';

  const VIEW = 'performance_lab_webgl_lod_100000';
  const OVERLAY_ID = 'argus-cull-overlay';
  const W = 360, HEADER = 52, ROW = 34, BOTTOM = 12;
  if (typeof schemaData === 'undefined') return;

  const overlay = document.getElementById(OVERLAY_ID);
  const cullCtx = overlay?.getContext('2d');
  if (!cullCtx) return;

  const originalFillText = cullCtx.fillText.bind(cullCtx);
  let tableByName = null;

  const css = (name, fallback) =>
    getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

  function tables() {
    return schemaData?.[VIEW]?.tables || [];
  }

  function ensureLookup() {
    const source = tables();
    if (!tableByName || tableByName.size !== source.length) {
      tableByName = new Map(source.map(table => [table.name, table]));
    }
    return tableByName;
  }

  function heightOf(table) {
    return HEADER + (table?.columns?.length || 0) * ROW + BOTTOM;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function rgbaFromCss(value, alpha, fallback) {
    const raw = String(value || fallback || '').trim();
    if (raw.startsWith('#')) {
      let hex = raw.slice(1);
      if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
      if (hex.length >= 6) {
        const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
        if (rgb.every(Number.isFinite)) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
      }
    }
    const match = raw.match(/rgba?\(([^)]+)\)/i);
    if (match) {
      const rgb = match[1].split(/[, ]+/).filter(Boolean).slice(0, 3).map(Number);
      if (rgb.length === 3 && rgb.every(Number.isFinite)) {
        return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
      }
    }
    return fallback || `rgba(56,189,248,${alpha})`;
  }

  function drawCardChrome(ctx, table) {
    const x = table.x;
    const y = table.y;
    const height = heightOf(table);
    const card = css('--card-bg', 'rgba(15,23,42,.88)');
    const panel = css('--panel-bg', 'rgba(30,41,59,.75)');
    const border = css('--panel-border', 'rgba(255,255,255,.12)');
    const accent = css('--accent-blue', '#38bdf8');

    ctx.save();

    // Card body and Oracle-style header.
    ctx.fillStyle = card;
    ctx.fillRect(x, y, W, height);

    const gradient = ctx.createLinearGradient(x, y, x + W, y + HEADER);
    gradient.addColorStop(0, panel);
    gradient.addColorStop(1, card);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, W, HEADER);

    ctx.strokeStyle = border;
    ctx.lineWidth = 1 / Math.max(scale, .34);
    ctx.beginPath();
    ctx.moveTo(x, y + HEADER);
    ctx.lineTo(x + W, y + HEADER);
    ctx.stroke();

    // Column row separators.
    if (scale >= .34) {
      ctx.globalAlpha = .55;
      ctx.lineWidth = .75 / Math.max(scale, .34);
      for (let i = 1; i < (table.columns || []).length; i += 1) {
        const rowY = y + HEADER + i * ROW;
        ctx.beginPath();
        ctx.moveTo(x + 14, rowY);
        ctx.lineTo(x + W - 14, rowY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // TABLE badge.
    const badgeW = 46, badgeH = 20;
    const badgeX = x + W - 16 - badgeW;
    const badgeY = y + 16;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 5);
    ctx.fillStyle = rgbaFromCss(accent, .12, 'rgba(56,189,248,.12)');
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1 / Math.max(scale, .34);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "700 9px 'Fira Code', monospace";
    ctx.textAlign = 'center';
    originalFillText('TABLE', badgeX + badgeW / 2, badgeY + badgeH / 2 + .5);
    ctx.textAlign = 'start';

    // Redraw selection because the regular CULL border is painted before the title.
    if (typeof selectedTableId !== 'undefined' && selectedTableId === (table.id || table.name)) {
      roundRect(ctx, x, y, W, height, 12);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3 / Math.max(scale, .08);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawKeyPill(ctx, key, x, y) {
    const isPk = key === 'PK';
    const color = isPk
      ? css('--accent-rose', '#f43f5e')
      : css('--accent-blue', '#38bdf8');

    ctx.save();
    roundRect(ctx, x - 2, y - 8, 24, 16, 3);
    ctx.fillStyle = rgbaFromCss(color, .16, isPk ? 'rgba(244,63,94,.16)' : 'rgba(56,189,248,.16)');
    ctx.fill();
    ctx.strokeStyle = rgbaFromCss(color, .48, isPk ? 'rgba(244,63,94,.48)' : 'rgba(56,189,248,.48)');
    ctx.lineWidth = 1 / Math.max(scale, .34);
    ctx.stroke();
    ctx.restore();
  }

  cullCtx.fillText = function(text, x, y, maxWidth) {
    if (typeof currentView !== 'undefined' && currentView === VIEW) {
      const zoom = typeof scale === 'number' ? scale : 1;

      if (zoom >= .16) {
        const table = ensureLookup().get(String(text));
        if (table && Math.abs(x - (table.x + 16)) < 2 && Math.abs(y - (table.y + 18)) < 2) {
          drawCardChrome(cullCtx, table);
        }
      }

      if (zoom >= .34 && (text === 'PK' || text === 'FK')) {
        drawKeyPill(cullCtx, text, x, y);
      }
    }

    return maxWidth === undefined
      ? originalFillText(text, x, y)
      : originalFillText(text, x, y, maxWidth);
  };
})();
