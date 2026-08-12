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

  function correctRoute(path, rel, canvasLayer, scale) {
    const fromCol = columnArray(rel.fromCol)[0];
    const toCol = columnArray(rel.toCol)[0];
    const fromColumn = document.getElementById(`col-${rel.from}-${fromCol}`)?.getBoundingClientRect();
    const toColumn = document.getElementById(`col-${rel.to}-${toCol}`)?.getBoundingClientRect();
    const fromCard = document.getElementById(`card-${rel.from}`)?.getBoundingClientRect();
    const toCard = document.getElementById(`card-${rel.to}`)?.getBoundingClientRect();
    if (!fromColumn || !toColumn || !fromCard || !toCard) return false;

    const canvas = canvasLayer.getBoundingClientRect();
    const route = routing.computeRoute({ fromColumn, toColumn, fromCard, toCard, canvas, scale });
    path.setAttribute('d', route.d);
    path.dataset.routeAxis = route.axis;
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
      correctRoute(path, rel, canvasLayer, scale);
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
    decorate: decorateStableRelations
  };

  requestAnimationFrame(() => window.updateConnections?.());
})();
