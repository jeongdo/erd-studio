/** Stable relation port selection: choose the cleanest card sides before route search. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  const V2 = E?.RelationRouterV2;
  const S = E?.RelationRouteStrategies;
  if (!E || !V2 || !S) return;

  const PORT_GAP_PX = 12;
  const HANDLE_MIN = 20;
  const HANDLE_MAX = 120;
  const FACING_PENALTY = 260;
  const AXIS_PENALTY = 90;
  const PORT_SWITCH_PENALTY = 170;
  const HYSTERESIS = 140;
  const PAIRS = [
    ['right','left'],
    ['left','right'],
    ['bottom','top'],
    ['top','bottom']
  ];

  const center = rect => ({ x:(rect.left + rect.right) / 2, y:(rect.top + rect.bottom) / 2 });
  const sideVector = side => side === 'left' ? {x:-1,y:0}
    : side === 'right' ? {x:1,y:0}
      : side === 'top' ? {x:0,y:-1} : {x:0,y:1};

  function worldPoint(x, y, canvas, scale) {
    const safe = Math.max(scale || 1, .05);
    return { x:(x - canvas.left) / safe, y:(y - canvas.top) / safe };
  }

  function worldRect(rect, canvas, scale) {
    const safe = Math.max(scale || 1, .05);
    return {
      left:(rect.left - canvas.left) / safe,
      top:(rect.top - canvas.top) / safe,
      right:(rect.right - canvas.left) / safe,
      bottom:(rect.bottom - canvas.top) / safe
    };
  }

  function port(side, cardRect, columnRect, canvas, scale) {
    const card = worldRect(cardRect, canvas, scale);
    const column = worldPoint((columnRect.left + columnRect.right) / 2, (columnRect.top + columnRect.bottom) / 2, canvas, scale);
    const gap = PORT_GAP_PX / Math.max(scale || 1, .05);
    if (side === 'left') return { x:card.left-gap, y:column.y };
    if (side === 'right') return { x:card.right+gap, y:column.y };
    if (side === 'top') return { x:column.x, y:card.top-gap };
    return { x:column.x, y:card.bottom+gap };
  }

  function cubic(from, to, fromSide, toSide) {
    const fv = sideVector(fromSide);
    const tv = sideVector(toSide);
    const distance = Math.hypot(to.x-from.x, to.y-from.y);
    const handle = Math.max(HANDLE_MIN, Math.min(HANDLE_MAX, distance * .34));
    const p1 = { x:from.x + fv.x*handle, y:from.y + fv.y*handle };
    const p2 = { x:to.x + tv.x*handle, y:to.y + tv.y*handle };
    const d = `M ${from.x} ${from.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${to.x} ${to.y}`;
    return {
      axis:(fromSide === 'left' || fromSide === 'right') ? 'horizontal' : 'vertical',
      d,
      mid:{
        x:(from.x + 3*p1.x + 3*p2.x + to.x) / 8,
        y:(from.y + 3*p1.y + 3*p2.y + to.y) / 8
      }
    };
  }

  function facingPenalty(fromSide, toSide, fromCard, toCard) {
    const a = center(fromCard), b = center(toCard);
    const dx = b.x-a.x, dy = b.y-a.y;
    const fv = sideVector(fromSide), tv = sideVector(toSide);
    const fromFaces = fv.x*dx + fv.y*dy > 0;
    const toFaces = tv.x*(-dx) + tv.y*(-dy) > 0;
    return (fromFaces ? 0 : FACING_PENALTY) + (toFaces ? 0 : FACING_PENALTY);
  }

  function axisPenalty(fromSide, fromCard, toCard) {
    const a = center(fromCard), b = center(toCard);
    const horizontal = Math.abs(b.x-a.x) >= Math.abs(b.y-a.y);
    const sideHorizontal = fromSide === 'left' || fromSide === 'right';
    return horizontal === sideHorizontal ? 0 : AXIS_PENALTY;
  }

  function candidates({fromColumn,toColumn,fromCard,toCard,canvas,scale,obstacles=[]}) {
    return PAIRS.map(([fromSide,toSide]) => {
      const p0 = port(fromSide, fromCard, fromColumn, canvas, scale);
      const p3 = port(toSide, toCard, toColumn, canvas, scale);
      const route = cubic(p0,p3,fromSide,toSide);
      const points = V2.sampleCubic(route.d);
      const hits = S.intersections(points, obstacles);
      const distance = S.length(points);
      const signature = `${fromSide}-${toSide}`;
      return {
        fromSide,toSide,p0,p3,route,points,signature,hits,distance,
        score:hits*1_000_000 + distance + facingPenalty(fromSide,toSide,fromCard,toCard) + axisPenalty(fromSide,fromCard,toCard)
      };
    });
  }

  function select(options = {}) {
    const all = candidates(options).sort((a,b) => a.score-b.score || a.signature.localeCompare(b.signature));
    const best = all[0] || null;
    if (!best) return null;
    const previous = options.previous || '';
    if (!previous) return best;
    const prior = all.find(item => item.signature === previous);
    if (!prior) return best;
    const adjusted = prior.score + PORT_SWITCH_PENALTY;
    return adjusted <= best.score + HYSTERESIS ? prior : best;
  }

  E.RelationPortSelector = { port, cubic, candidates, select, sideVector, worldPoint, worldRect };
})();
