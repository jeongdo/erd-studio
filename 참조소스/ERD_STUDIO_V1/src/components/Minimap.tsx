import React from 'react';
import { useSchemaStore } from '../store/schemaStore';
import { computeBoundingBox } from '../utils/layout';

const Minimap: React.FC = () => {
  const { schemaData, currentView, viewState, updateViewState } = useSchemaStore();
  const view = schemaData[currentView];
  if (!view) return null;

  const bbox = computeBoundingBox(view.tables);
  const contentW = bbox.maxX - bbox.minX || 800;
  const contentH = bbox.maxY - bbox.minY || 600;

  const mapW = 200;
  const mapH = 140;
  const scaleX = mapW / contentW;
  const scaleY = mapH / contentH;
  const miniScale = Math.min(scaleX, scaleY, 1);

  const vpW = (window.innerWidth - 240) * miniScale / viewState.scale;
  const vpH = (window.innerHeight - 52) * miniScale / viewState.scale;
  const vpX = (-viewState.panX / viewState.scale - bbox.minX) * miniScale;
  const vpY = (-viewState.panY / viewState.scale - bbox.minY) * miniScale;

  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / miniScale + bbox.minX;
    const y = (e.clientY - rect.top) / miniScale + bbox.minY;
    const workspaceW = window.innerWidth - 240;
    const workspaceH = window.innerHeight - 52;
    updateViewState({
      panX: -(x * viewState.scale - workspaceW / 2),
      panY: -(y * viewState.scale - workspaceH / 2)
    });
  };

  return (
    <div className="minimap" onClick={handleClick}>
      <div className="minimap-title">Minimap</div>
      <svg width={mapW} height={mapH} style={{ position: 'absolute', inset: 0 }}>
        {view.tables.map(t => (
          <rect
            key={t.id}
            x={(t.x - bbox.minX) * miniScale}
            y={(t.y - bbox.minY) * miniScale}
            width={300 * miniScale}
            height={(60 + t.columns.length * 28) * miniScale}
            fill="rgba(59, 130, 246, 0.2)"
            rx={4}
          />
        ))}
      </svg>
      <div
        className="minimap-viewport"
        style={{
          left: Math.max(0, vpX),
          top: Math.max(0, vpY),
          width: Math.min(vpW, mapW),
          height: Math.min(vpH, mapH)
        }}
      />
    </div>
  );
};

export default Minimap;
