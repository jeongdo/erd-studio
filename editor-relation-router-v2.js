/** Obstacle-aware relation routing: preserve clean curves, detour only when table cards block the path. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const Routing = E?.RelationRouting;
  const Identity = E?.RelationIdentity;
  const baseUpdateConnections = window.updateConnections;
  if (!E || !Routing || !Identity || typeof baseUpdateConnections !== 'function') return;

  const CARD_CLEARANCE = 18;
  const CORRIDOR_PAD = 42;
  const SAMPLE_STEPS = 24;
  const TURN_PENALTY = 24;

  function columnArray(value) {
    return E.columnArray ? E.columnArray(value) : (Array.isArray(value) ? value : [value]);
  }

  function parseCubic(d) {
    const nums = String(d || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    if (nums.length !== 8) return null;
    return {
      p0:{ x:nums[0], y:nums[1] },
      p1:{ x:nums[2], y:nums[3] },
      p2:{ x:nums[4], y:nums[5] },
      p3:{ x:nums[6], y:nums[7] }
    };
  }

  function cubicPoint(cubic, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * cubic.p0.x + b * cubic.p1.x + c * cubic.p2.x + d * cubic.p3.x,
      y: a * cubic.p0.y + b * cubic.p1.y + c * cubic.p2.y + d * cubic.p3.y
    };
  }

  function sampleCubic(d, steps = SAMPLE_STEPS) {
    const cubic = parseCubic(d);
    if (!cubic) return [];
    return Array.from({ length:steps + 1 }, (_, index) => cubicPoint(cubic, index / steps));
  }

  function pointInRect(point, rect) {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  function segmentHitsRect(a, b, rect) {
    if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let t0 = 0;
    let t1 = 1;
    const checks = [
      [-dx, a.x - rect.left],
      [ dx, rect.right - a.x],
      [-dy, a.y - rect.top],
      [ dy, rect.bottom - a.y]
    ];
    for (const [p, q] of checks) {
      if (p === 0) {
        if (q < 0) return false;
        continue;
      }
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
    return t0 <= t1;
  }

  function routeIntersections(points, obstacles = []) {
    let hits = 0;
    obstacles.forEach(rect => {
      for (let index = 0; index < points.length - 1; index += 1) {
        if (segmentHitsRect(points[index], points[index + 1], rect)) {
          hits += 1;
          break;
        }
      }
    });
    return hits;
  }

  function routeLength(points) {
    let length = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      length += Math.hypot(points[index + 1].x - points[index].x, points[index + 1].y - points[index].y);
    }
    return length;
  }

  function compactPoints(points) {
    const compact = [];
    points.forEach(point => {
      const previous = compact.at(-1);
      if (!previous || previous.x !== point.x || previous.y !== point.y) compact.push(point);
    });
    return compact;
  }

  function buildCandidates(p0, p3, obstacles = [], lane = 0) {
    const xs = [p0.x, p3.x, ...obstacles.flatMap(rect => [rect.left, rect.right])];
    const ys = [p0.y, p3.y, ...obstacles.flatMap(rect => [rect.top, rect.bottom])];
    const midX = (p0.x + p3.x) / 2 + lane;
    const midY = (p0.y + p3.y) / 2 + lane;
    const left = Math.min(...xs) - CORRIDOR_PAD + lane;
    const right = Math.max(...xs) + CORRIDOR_PAD + lane;
    const top = Math.min(...ys) - CORRIDOR_PAD + lane;
    const bottom = Math.max(...ys) + CORRIDOR_PAD + lane;

    return [
      { kind:'mid-x', points:compactPoints([p0, { x:midX, y:p0.y }, { x:midX, y:p3.y }, p3]) },
      { kind:'mid-y', points:compactPoints([p0, { x:p0.x, y:midY }, { x:p3.x, y:midY }, p3]) },
      { kind:'top', points:compactPoints([p0, { x:p0.x, y:top }, { x:p3.x, y:top }, p3]) },
      { kind:'bottom', points:compactPoints([p0, { x:p0.x, y:bottom }, { x:p3.x, y:bottom }, p3]) },
      { kind:'left', points:compactPoints([p0, { x:left, y:p0.y }, { x:left, y:p3.y }, p3]) },
      { kind:'right', points:compactPoints([p0, { x:right, y:p0.y }, { x:right, y:p3.y }, p3]) }
    ];
  }

  function chooseRoute(p0, p3, obstacles = [], lane = 0) {
    return buildCandidates(p0, p3, obstacles, lane)
      .map(candidate => {
        const intersections = routeIntersections(candidate.points, obstacles);
        const length = routeLength(candidate.points);
        const turns = Math.max(0, candidate.points.length - 2);
        return { ...candidate, intersections, length, score:intersections * 1_000_000 + length + turns * TURN_PENALTY };
      })
      .sort((a, b) => a.score - b.score || a.kind.localeCompare(b.kind))[0] || null;
  }

  function polylinePath(points) {
    if (!points.length) return '';
    return `M ${points[0].x} ${points[0].y} ${points.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ')}`;
  }

  function polylineMidpoint(points) {
    const total = routeLength(points);
    if (!total) return points[0] || { x:0, y:0 };
    let remaining = total / 2;
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (remaining <= length) {
        const ratio = length ? remaining / length : 0;
        return { x:a.x + (b.x - a.x) * ratio, y:a.y + (b.y - a.y) * ratio };
      }
      remaining -= length;
    }
    return points.at(-1);
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

  function worldRect(elementRect, canvasRect, scale, clearance = 0) {
    const safeScale = Math.max(scale || 1, 0.05);
    return {
      left:(elementRect.left - canvasRect.left) / safeScale - clearance,
      top:(elementRect.top - canvasRect.top) / safeScale - clearance,
      right:(elementRect.right - canvasRect.left) / safeScale + clearance,
      bottom:(elementRect.bottom - canvasRect.top) / safeScale + clearance
    };
  }

  function obstaclesFor(fromId, toId, canvasRect, scale) {
    const obstacles = [];
    document.querySelectorAll('#cards-container .table-card').forEach(card => {
      if (card.hidden) return;
      const id = card.id.replace(/^card-/, '');
      if (!id || id === fromId || id === toId) return;
      obstacles.push(worldRect(card.getBoundingClientRect(), canvasRect, scale, CARD_CLEARANCE / Math.max(scale, 0.05)));
    });
    return obstacles;
  }

  function directRoute(rel, index, relations, canvasLayer, scale) {
    const fromCol = columnArray(rel.fromCol)[0];
    const toCol = columnArray(rel.toCol)[0];
    const fromColumn = document.getElementById(`col-${rel.from}-${fromCol}`)?.getBoundingClientRect();
    const toColumn = document.getElementById(`col-${rel.to}-${toCol}`)?.getBoundingClientRect();
    const fromCard = document.getElementById(`card-${rel.from}`)?.getBoundingClientRect();
    const toCard = document.getElementById(`card-${rel.to}`)?.getBoundingClientRect();
    if (!fromColumn || !toColumn || !fromCard || !toCard) return null;

    const canvas = canvasLayer.getBoundingClientRect();
    const base = Routing.computeRoute({ fromColumn, toColumn, fromCard, toCard, canvas, scale });
    const lane = Identity.parallelLane?.(rel, index, relations) || 0;
    const routed = Identity.laneRoute?.(base, lane) || base;
    return { ...routed, lane, canvas };
  }

  function refineRenderedConnections() {
    const view = E.currentSchema?.();
    const relations = view?.relations || [];
    const canvasLayer = document.getElementById('canvas-layer');
    if (!canvasLayer || !relations.length) return;
    const scale = Routing.readCanvasScale?.(canvasLayer) || 1;

    document.querySelectorAll('#connections-svg .connection-line').forEach(path => {
      const resolved = Identity.resolveRelation?.(path, relations);
      const index = resolved?.index ?? Number(path.dataset.relationIndex);
      const rel = resolved?.relation || (Number.isInteger(index) ? relations[index] : null);
      if (!rel || !Number.isInteger(index)) return;

      const direct = directRoute(rel, index, relations, canvasLayer, scale);
      if (!direct) return;
      const sampled = sampleCubic(direct.d);
      if (!sampled.length) return;
      const obstacles = obstaclesFor(rel.from, rel.to, direct.canvas, scale);
      const directHits = routeIntersections(sampled, obstacles);

      if (!directHits) {
        path.setAttribute('d', direct.d);
        path.dataset.routeMode = 'direct';
        path.dataset.obstacleHits = '0';
        moveBadge(path, direct.mid);
        return;
      }

      const cubic = parseCubic(direct.d);
      if (!cubic) return;
      const detour = chooseRoute(cubic.p0, cubic.p3, obstacles, direct.lane);
      if (!detour) return;
      path.setAttribute('d', polylinePath(detour.points));
      path.dataset.routeMode = 'obstacle';
      path.dataset.routeKind = detour.kind;
      path.dataset.obstacleHits = String(detour.intersections);
      moveBadge(path, polylineMidpoint(detour.points));
    });
  }

  window.updateConnections = function(...args) {
    const result = baseUpdateConnections.apply(this, args);
    refineRenderedConnections();
    return result;
  };

  E.RelationRouterV2 = {
    parseCubic,
    sampleCubic,
    segmentHitsRect,
    routeIntersections,
    routeLength,
    buildCandidates,
    chooseRoute,
    polylinePath,
    polylineMidpoint,
    refine:refineRenderedConnections
  };

  document.addEventListener('erd:view-projection-changed', () => requestAnimationFrame(() => window.updateConnections?.()));
})();
