import React from 'react';
import { useSchemaStore } from '../store/schemaStore';
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';

const ZoomControls: React.FC = () => {
  const { viewState, updateViewState } = useSchemaStore();

  const zoomIn = () => {
    updateViewState({ scale: Math.min(viewState.scale * 1.1, 2.5) });
  };

  const zoomOut = () => {
    updateViewState({ scale: Math.max(viewState.scale * 0.9, 0.4) });
  };

  const reset = () => {
    updateViewState({ scale: 1, panX: 0, panY: 0 });
  };

  return (
    <div className="zoom-controls">
      <button onClick={zoomIn} title="Zoom In"><ZoomIn size={16} /></button>
      <span className="zoom-text">{Math.round(viewState.scale * 100)}%</span>
      <button onClick={zoomOut} title="Zoom Out"><ZoomOut size={16} /></button>
      <button onClick={reset} title="Reset"><RotateCcw size={16} /></button>
    </div>
  );
};

export default ZoomControls;
