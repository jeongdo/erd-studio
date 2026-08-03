import React from 'react';

interface Props {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const DragPreviewLine: React.FC<Props> = ({ x1, y1, x2, y2 }) => {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--accent-blue)"
      strokeWidth={2}
      strokeDasharray="6,4"
      opacity={0.7}
    />
  );
};

export default DragPreviewLine;
