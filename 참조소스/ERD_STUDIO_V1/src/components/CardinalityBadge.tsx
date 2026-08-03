import React from 'react';

interface Props {
  x: number;
  y: number;
  label: string;
  accentColor: string;
}

const CardinalityBadge: React.FC<Props> = ({ x, y, label, accentColor }) => {
  const badgeWidth = label.length * 8.5 + 16;
  const badgeHeight = 18;

  return (
    <g>
      <rect
        x={x - badgeWidth / 2}
        y={y - badgeHeight / 2}
        width={badgeWidth}
        height={badgeHeight}
        rx={4}
        fill="#090d16"
        stroke={accentColor}
        strokeWidth={1.2}
      />
      <text
        x={x}
        y={y + 3.5}
        fill={accentColor}
        fontSize="9.5px"
        fontFamily="'Fira Code', 'Courier New', monospace"
        fontWeight="bold"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
};

export default CardinalityBadge;
