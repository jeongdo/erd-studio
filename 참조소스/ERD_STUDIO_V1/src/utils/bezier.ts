import { Point } from '../types/schema';

export function computeBezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
  type: 'vertical' | 'horizontal',
  direction: number
): string {
  if (type === 'vertical') {
    const distY = Math.abs(y2 - y1);
    const cdy = distY * 0.5;
    const midX = (x1 + x2) / 2;
    const cy1 = y1 + (direction > 0 ? cdy : -cdy);
    const cy2 = y2 + (direction > 0 ? -cdy : cdy);
    return `M ${x1} ${y1} C ${midX} ${cy1}, ${midX} ${cy2}, ${x2} ${y2}`;
  } else {
    const distX = Math.abs(x2 - x1);
    const cdx = Math.max(distX * 0.6, 40);
    const midY = (y1 + y2) / 2;
    const cx1 = x1 + (direction > 0 ? cdx : -cdx);
    const cx2 = x2 + (direction > 0 ? -cdx : cdx);
    return `M ${x1} ${y1} C ${cx1} ${midY}, ${cx2} ${midY}, ${x2} ${y2}`;
  }
}

export function computeBezierMidpoint(
  x1: number, y1: number,
  cx1: number, cy1: number,
  cx2: number, cy2: number,
  x2: number, y2: number
): Point {
  // Cubic bezier at t=0.5
  const t = 0.5;
  const mt = 1 - t;
  const mx = mt * mt * mt * x1 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x2;
  const my = mt * mt * mt * y1 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y2;
  return { x: mx, y: my };
}

export function snapToGrid(value: number, gridSize: number = 20): number {
  return Math.round(value / gridSize) * gridSize;
}
