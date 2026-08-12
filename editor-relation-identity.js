/** Stable relation identity and post-routing correction for parallel FK edges. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const A = E?.Advanced;
  const routing = E?.RelationRouting;
  const baseUpdateConnections = window.updateConnections;
  if (!E || !A || !routing || typeof baseUpdateConnections !== 'function') return;

  function columnArray(value) {
    return E.columnArray ? E.columnArray(value) : (Array.isArray(value) ? value : [value]);
  }

  function relationKey(rel) {
    return A.relationKey?.(rel)
      || `${rel.from}|${columnArray(rel.fromCol).join(',')}|${rel.to}|${columnArray(rel.toCol).join(',')}`;
  }

  function hashKey(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function relationDomId(rel, index = 0) {
    return `line-rel-${hashKey(relationKey(rel))}-${index}`;
  }

  function resolveRelation(path, relations) {
    const index = Number(path?.dataset?.relationIndex);
    if (Number.isInteger(index) && index >= 0 && relations[index]) {
      return { relation: relations[index], index };
    }

    const key = path?.dataset?.relationKey;
    if (key) {
      const byKey = relations.findIndex(rel => relationKey(rel) === key);
      if (byKey >= 0) return { relation: relations[byKey], index: byKey };
    }

    const legacyId = path?.dataset?.legacyRelationId || path?.id || '';
    const byLegacy = relations.findIndex(rel =>
      legacyId === `line-${rel.from}-${rel.to}` || legacyId === `line-${rel.to}-${rel.from}`);
    return byLegacy >= 0 ? { relation: relations[byLegacy], index: byLegacy } : null;
  }

  const PARALLEL_LANE_GAP = 24;

  function pairKey(rel) {
    return [rel.from, rel.to].sort().join('|');
  }

  function parallelLane(rel, index, relations) {
    const siblings = relations
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(item => pairKey(item.candidate) === pairKey(rel));
    const position = siblings.findIndex(item => item.candidateIndex === index);
    if (position < 0 || siblings.length <= 1) return 0;
    return (position - (siblings.length - 1) / 2) * PARALLEL_LANE_GAP;
  }

  function laneRoute(route, lane) {
    if (!lane) return route;
    const nums = route.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    if (nums.length !== 8) return route;
    const [x0, y0, x1, y1, x2, y2, x3, y3] = nums;
    if (route.axis === 'horizontal') {
      const d = `M ${x0} ${y0} C ${x1} ${y1 + lane}, ${x2} ${y2 + lane}, ${x3} ${y3}`;
      return { ...route, d, mid: { x: route.mid.x, y: route.mid.y + lane * 0.75 } };
    }
    const d = `M ${x0} ${y0} C ${x1 + lane} ${y1}, ${x2 + lane} ${y2}, ${x3} ${y3}`;
    return { ...route, d, mid: { x: route.mid.x + lane * 0.75, y: route.mid.y } };
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

  function correctRoute(path, rel, index, relations, canvasLayer, scale) {
    const fromCol = columnArray(rel.fromCol)[0];
    const toCol = columnArray(rel.toCol)[0];
    const fromColumn = document.getElementById(`col-${rel.from}-${fromCol}`)?.getBoundingClientRect();
    const toColumn = document.getElementById(`col-${rel.to}-${toCol}`)?.getBoundingClientRect();
    const fromCard = document.getElementById(`card-${rel.from}`)?.getBoundingClientRect();
    const toCard = document.getElementById(`card-${rel.to}`)?.getBoundingClientRect();
    if (!fromColumn || !toColumn || !fromCard || !toCard) return false;

    const canvas = canvasLayer.getBoundingClientRect();
    const baseRoute = routing.computeRoute({ fromColumn, toColumn, fromCard, toCard, canvas, scale });
    const lane = parallelLane(rel, index, relations);
    const route = laneRoute(baseRoute, lane);
    path.removeAttribute('transform');
    const badge = path.nextElementSibling;
    if (badge?.tagName?.toLowerCase() === 'g') badge.removeAttribute('transform');
    path.setAttribute('d', route.d);
    path.dataset.routeAxis = route.axis;
    path.dataset.parallelLane = String(lane);
    moveBadge(path, route.mid);
    return true;
  }

  function decorateStableRelations() {
    const relations = E.currentSchema?.()?.relations || [];
    const canvasLayer = document.getElementById('canvas-layer');
    if (!relations.length || !canvasLayer) return;

    const scale = routing.readCanvasScale?.(canvasLayer) || 1;
    const paths = [...document.querySelectorAll('#connections-svg .connection-line')];
    paths.forEach(path => {
      const resolved = resolveRelation(path, relations);
      if (!resolved) return;
      const { relation: rel, index } = resolved;
      const key = relationKey(rel);
      const legacyId = path.dataset.legacyRelationId || path.id;

      path.dataset.relationIndex = String(index);
      path.dataset.relationKey = key;
      path.dataset.legacyRelationId = legacyId;
      path.id = relationDomId(rel, index);
      correctRoute(path, rel, index, relations, canvasLayer, scale);
    });
  }

  window.updateConnections = function(...args) {
    const result = baseUpdateConnections.apply(this, args);
    decorateStableRelations();
    return result;
  };

  E.RelationIdentity = {
    relationKey,
    relationDomId,
    resolveRelation,
    parallelLane,
    laneRoute,
    decorate: decorateStableRelations
  };

  requestAnimationFrame(() => window.updateConnections?.());
})();
