import React, { useState } from 'react';
import { Relation } from '../types/schema';
import { computeBezierPath, computeBezierMidpoint } from '../utils/bezier';
import CardinalityBadge from './CardinalityBadge';

interface Props {
  relation: Relation;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'vertical' | 'horizontal';
  direction: number;
  accentColor: string;
  isHighlighted: boolean;
  isDimmed: boolean;
}

const ConnectionLine: React.FC<Props> = ({
  relation, x1, y1, x2, y2, type, direction, accentColor, isHighlighted, isDimmed
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const pathData = computeBezierPath(x1, y1, x2, y2, type, direction);

  // Compute control points for midpoint
  let cx1: number, cy1: number, cx2: number, cy2: number;
  if (type === 'vertical') {
    const distY = Math.abs(y2 - y1);
    const cdy = distY * 0.5;
    const midX = (x1 + x2) / 2;
    cx1 = midX;
    cy1 = y1 + (direction > 0 ? cdy : -cdy);
    cx2 = midX;
    cy2 = y2 + (direction > 0 ? -cdy : cdy);
  } else {
    const distX = Math.abs(x2 - x1);
    const cdx = Math.max(distX * 0.6, 40);
    const midY = (y1 + y2) / 2;
    cx1 = x1 + (direction > 0 ? cdx : -cdx);
    cy1 = midY;
    cx2 = x2 + (direction > 0 ? -cdx : cdx);
    cy2 = midY;
  }

  const mid = computeBezierMidpoint(x1, y1, cx1, cy1, cx2, cy2, x2, y2);

  const cardBase = relation.cardinality || '1 : N';
  const isComposite = Array.isArray(relation.fromCol);
  const badgeLabel = isComposite ? `${(relation.fromCol as string[]).join(', ')} (${cardBase})` : cardBase;

  const tooltipText = `${relation.from}.${Array.isArray(relation.fromCol) ? relation.fromCol[0] : relation.fromCol} → ${relation.to}.${Array.isArray(relation.toCol) ? relation.toCol[0] : relation.toCol} (${cardBase})`;

  return (
    <g>
      <path
        d={pathData}
        className={`connection-line ${isHighlighted ? 'highlighted' : ''} ${isDimmed ? 'dimmed' : ''}`}
        markerEnd="url(#marker-arrow)"
        strokeDasharray={relation.identifying ? 'none' : '8, 5'}
        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY - 30, text: tooltipText })}
        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY - 30, text: tooltipText })}
        onMouseLeave={() => setTooltip(null)}
      />
      <CardinalityBadge x={mid.x} y={mid.y} label={badgeLabel} accentColor={accentColor} />
      {tooltip && (
        <foreignObject x={mid.x - 100} y={mid.y - 40} width="200" height="40">
          <div className="conn-tooltip" style={{ textAlign: 'center' }}>
            {tooltip.text}
          </div>
        </foreignObject>
      )}
    </g>
  );
};

export default ConnectionLine;
