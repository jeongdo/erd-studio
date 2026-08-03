import { useCallback, useRef } from 'react';
import { useSchemaStore } from '../store/schemaStore';
import { Point } from '../types/schema';

export function useSelection(workspaceRef: React.RefObject<HTMLDivElement>) {
  const { selection, setSelection, viewState } = useSchemaStore();
  const areaStartRef = useRef<Point | null>(null);

  const handleAreaStart = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) return;
    if (e.target === workspaceRef.current || (e.target as HTMLElement).dataset?.canvas === 'true') {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - viewState.panX) / viewState.scale;
      const y = (e.clientY - rect.top - viewState.panY) / viewState.scale;
      areaStartRef.current = { x, y };
      setSelection({
        isAreaSelecting: true,
        areaStart: { x, y },
        areaEnd: { x, y },
        selectedIds: []
      });
    }
  }, [viewState, setSelection, workspaceRef]);

  const handleAreaMove = useCallback((e: React.MouseEvent) => {
    if (!selection.isAreaSelecting || !areaStartRef.current) return;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - viewState.panX) / viewState.scale;
    const y = (e.clientY - rect.top - viewState.panY) / viewState.scale;
    setSelection({ areaEnd: { x, y } });
  }, [selection.isAreaSelecting, viewState, setSelection, workspaceRef]);

  const handleAreaEnd = useCallback(() => {
    if (!selection.isAreaSelecting) return;

    // Compute selected tables
    const start = selection.areaStart;
    const end = selection.areaEnd;
    if (!start || !end) {
      setSelection({ isAreaSelecting: false, areaStart: null, areaEnd: null });
      return;
    }

    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const { schemaData, currentView } = useSchemaStore.getState();
    const view = schemaData[currentView];
    if (!view) {
      setSelection({ isAreaSelecting: false, areaStart: null, areaEnd: null });
      return;
    }

    const selectedIds = view.tables
      .filter(t => {
        const tw = 300; // approximate
        const th = 60 + t.columns.length * 28;
        return t.x < maxX && t.x + tw > minX && t.y < maxY && t.y + th > minY;
      })
      .map(t => t.id);

    setSelection({
      isAreaSelecting: false,
      areaStart: null,
      areaEnd: null,
      selectedIds
    });
    areaStartRef.current = null;
  }, [selection.isAreaSelecting, selection.areaStart, selection.areaEnd, setSelection]);

  return {
    handleAreaStart,
    handleAreaMove,
    handleAreaEnd
  };
}
