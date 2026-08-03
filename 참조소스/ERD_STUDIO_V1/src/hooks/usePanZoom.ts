import { useCallback, useRef } from 'react';
import { useSchemaStore } from '../store/schemaStore';

export function usePanZoom(workspaceRef: React.RefObject<HTMLDivElement>) {
  const { viewState, updateViewState, setPanning } = useSchemaStore();
  const panStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.4, viewState.scale * factor), 2.5);
    updateViewState({ scale: newScale });
  }, [viewState.scale, updateViewState]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === workspaceRef.current || (e.target as HTMLElement).dataset?.canvas === 'true') {
      setPanning(true);
      panStart.current = { x: e.clientX - viewState.panX, y: e.clientY - viewState.panY };
    }
  }, [viewState.panX, viewState.panY, setPanning, workspaceRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!useSchemaStore.getState().isPanning) return;
    updateViewState({
      panX: e.clientX - panStart.current.x,
      panY: e.clientY - panStart.current.y
    });
  }, [updateViewState]);

  const handleMouseUp = useCallback(() => {
    setPanning(false);
  }, [setPanning]);

  const resetZoom = useCallback(() => {
    updateViewState({ scale: 1, panX: 0, panY: 0 });
  }, [updateViewState]);

  return {
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom
  };
}
