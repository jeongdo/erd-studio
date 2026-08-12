/** Refine legacy relation geometry after it renders: safer arrow gaps and calmer close-table curves. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const baseUpdateConnections = window.updateConnections;
  if (!E || typeof baseUpdateConnections !== 'function') return;

  const TARGET_GAP_PX = 14;
  const MIN_GAP_PX = 3;
  const SWITCH_CLEARANCE_PX = 34;
  const HANDLE_MIN_PX = 8;
  const HANDLE_MAX_PX = 92;

  const centerX = rect => rect.left + rect.width / 2;
  const centerY = rect => rect.top + rect.height / 2;

  function gapForClearance(clearancePx) {
    if (!Number.isFinite(clearancePx) || clearancePx <= 0) return TARGET_GAP_PX;
    return Math.max(MIN_GAP_PX, Math.min(TARGET_GAP_PX, clearancePx * 0.28));
  }

  function controlHandle(distance, scale) {
    const min = HANDLE_MIN_PX / scale;
    const max = HANDLE_MAX_PX / scale;
    return Math.min(max, Math.max(Math.min(min, distance * 0.5), distance * 0.42));
  }

  function cubicMidpoint(p0, p1, p2, p3) {
    return {
      x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
      y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8
    };
  }

  function computeRoute({ fromColumn, toColumn, fromCard, toCard, canvas, scale }) {
    const safeScale = Math.max(scale || 1, 0.05);
    const dx = centerX(toCard) - centerX(fromCard);
    const dy = centerY(toCard) - centerY(fromCard);
    const horizontalClearance = dx >= 0
      ? toCard.left - fromCard.right
      : fromCard.left - toCard.right;
    const verticalClearance = dy >= 0
      ? toCard.top - fromCard.bottom
      : fromCard.top - toCard.bottom;

    const preferVertical = Math.abs(dy) > Math.abs(dx) * 1.15 ||
      (horizontalClearance < SWITCH_CLEARANCE_PX && verticalClearance > horizontalClearance);

    if (preferVertical) {
      const direction = dy >= 0 ? 1 : -1;
      const gap = gapForClearance(verticalClearance) / safeScale;
      const p0 = {
        x: (centerX(fromColumn) - canvas.left) / safeScale,
        y: ((direction > 0 ? fromCard.bottom : fromCard.top) - canvas.top) / safeScale + direction * gap
      };
      const p3 = {
        x: (centerX(toColumn) - canvas.left) / safeScale,
        y: ((direction > 0 ? toCard.top : toCard.bottom) - canvas.top) / safeScale - direction * gap
      };
      const distance = Math.abs(p3.y - p0.y);
      const handle = controlHandle(distance, safeScale);
      const p1 = { x: p0.x, y: p0.y + direction * handle };
      const p2 = { x: p3.x, y: p3.y - direction * handle };
      const mid = cubicMidpoint(p0, p1, p2, p3);
      return {
        axis: 'vertical',
        d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`,
        mid
      };
    }

    const direction = dx >= 0 ? 1 : -1;
    const gap = gapForClearance(horizontalClearance) / safeScale;
    const p0 = {
      x: ((direction > 0 ? fromCard.right : fromCard.left) - canvas.left) / safeScale + direction * gap,
      y: (centerY(fromColumn) - canvas.top) / safeScale
    };
    const p3 = {
      x: ((direction > 0 ? toCard.left : toCard.right) - canvas.left) / safeScale - direction * gap,
      y: (centerY(toColumn) - canvas.top) / safeScale
    };
    const distance = Math.abs(p3.x - p0.x);
    const handle = controlHandle(distance, safeScale);
    const p1 = { x: p0.x + direction * handle, y: p0.y };
    const p2 = { x: p3.x - direction * handle, y: p3.y };
    const mid = cubicMidpoint(p0, p1, p2, p3);
    return {
      axis: 'horizontal',
      d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`,
      mid
    };
  }

  function tuneMarker() {
    const marker = document.getElementById('marker-arrow');
    if (!marker) return;
    // Default SVG markers scale by stroke width. Keep that behavior, but use a
    // smaller box so the arrow head no longer visually collides with cards.
    marker.setAttribute('markerUnits', 'strokeWidth');
    marker.setAttribute('markerWidth', '4.4');
    marker.setAttribute('markerHeight', '4.4');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '6');
    marker.setAttribute('orient', 'auto');
  }

  function relationForPath(path, relations) {
    return relations.find(rel =>
      path.id === `line-${rel.from}-${rel.to}` || path.id === `line-${rel.to}-${rel.from}`) || null;
  }

  function moveBadge(path, mid) {
    const badge = path.nextElementSibling;
    if (!badge || badge.tagName?.toLowerCase() !== 'g') return;
    const rect = badge.querySelector('rect');
    const text = badge.querySelector('text');
    if (rect) {
      const width = Number(rect.getAttribute('width')) || 0;
      const height = Number(rect.getAttribute('height')) || 0;
      rect.setAttribute('x', mid.x - width / 2);
      rect.setAttribute('y', mid.y - height / 2);
    }
    if (text) {
      text.setAttribute('x', mid.x);
      text.setAttribute('y', mid.y + 3.5);
    }
  }

  function refineRenderedConnections() {
    tuneMarker();
    const view = E.currentSchema?.();
    const relations = view?.relations || [];
    const canvasLayer = document.getElementById('canvas-layer');
    if (!canvasLayer || !relations.length) return;

    const canvas = canvasLayer.getBoundingClientRect();
    const scale = Number(window.scale) || 1;

    document.querySelectorAll('#connections-svg .connection-line').forEach(path => {
      const rel = relationForPath(path, relations);
      if (!rel) return;
      const fromCol = Array.isArray(rel.fromCol) ? rel.fromCol[0] : rel.fromCol;
      const toCol = Array.isArray(rel.toCol) ? rel.toCol[0] : rel.toCol;
      const fromColumn = document.getElementById(`col-${rel.from}-${fromCol}`)?.getBoundingClientRect();
      const toColumn = document.getElementById(`col-${rel.to}-${toCol}`)?.getBoundingClientRect();
      const fromCard = document.getElementById(`card-${rel.from}`)?.getBoundingClientRect();
      const toCard = document.getElementById(`card-${rel.to}`)?.getBoundingClientRect();
      if (!fromColumn || !toColumn || !fromCard || !toCard) return;

      const route = computeRoute({ fromColumn, toColumn, fromCard, toCard, canvas, scale });
      path.setAttribute('d', route.d);
      path.dataset.routeAxis = route.axis;
      moveBadge(path, route.mid);
    });
  }

  window.updateConnections = function(...args) {
    const result = baseUpdateConnections.apply(this, args);
    refineRenderedConnections();
    return result;
  };

  E.RelationRouting = {
    computeRoute,
    refine: refineRenderedConnections,
    gapForClearance
  };

  tuneMarker();
  requestAnimationFrame(() => window.updateConnections?.());
})();
