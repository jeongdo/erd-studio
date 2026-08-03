import React, { useRef, useCallback, useState } from 'react';
import { useSchemaStore } from '../store/schemaStore';
import EntityCard from './EntityCard';
import ConnectionLine from './ConnectionLine';
import DragPreviewLine from './DragPreviewLine';
import Minimap from './Minimap';
import { usePanZoom } from '../hooks/usePanZoom';
import { useSelection } from '../hooks/useSelection';
import { useContextMenu } from '../hooks/useContextMenu';
import { validateSchema } from '../utils/validation';

const ERDCanvas: React.FC = () => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const {
    schemaData, currentView, viewState, selectedTableId, setSelectedTableId,
    setInspectorOpen, isRelDragging, relFrom, relPreview, setRelDragging,
    addRelation, searchTerm, selection
  } = useSchemaStore();
  const { handleWheel, handleMouseDown, handleMouseMove, handleMouseUp } = usePanZoom(workspaceRef);
  const { handleAreaStart, handleAreaMove, handleAreaEnd } = useSelection(workspaceRef);
  const { showMenu } = useContextMenu();
  const [hoveredRel] = useState<string | null>(null);
  const view = schemaData[currentView];
  if (!view) return null;

  const validationIssues = validateSchema(view);
  const issuesByTable = new Map<string, typeof validationIssues>();
  validationIssues.forEach(issue => {
    if (issue.tableId) {
      const issues = issuesByTable.get(issue.tableId) || [];
      issues.push(issue);
      issuesByTable.set(issue.tableId, issues);
    }
  });

  const searchLower = searchTerm.toLowerCase();
  const matchedTableIds = searchLower
    ? view.tables.filter(t => t.name.toLowerCase().includes(searchLower) || t.columns.some(c => c.name.toLowerCase().includes(searchLower))).map(t => t.id)
    : [];

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      showMenu(e, 'canvas');
      return;
    }
    handleMouseDown(e);
    handleAreaStart(e);
  }, [handleMouseDown, handleAreaStart, showMenu]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    handleMouseMove(e);
    handleAreaMove(e);
    if (isRelDragging && relFrom && workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      const x2 = (e.clientX - rect.left - viewState.panX) / viewState.scale;
      const y2 = (e.clientY - rect.top - viewState.panY) / viewState.scale;
      const fromElem = document.getElementById('col-' + relFrom.tableId + '-' + relFrom.colName);
      if (fromElem) {
        const fromRect = fromElem.getBoundingClientRect();
        const x1 = (fromRect.left + fromRect.width / 2 - rect.left) / viewState.scale;
        const y1 = (fromRect.top + fromRect.height / 2 - rect.top) / viewState.scale;
        useSchemaStore.getState().setRelDragging(true, relFrom, { x1, y1, x2, y2 });
      }
    }
  }, [handleMouseMove, handleAreaMove, isRelDragging, relFrom, viewState]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    handleMouseUp();
    handleAreaEnd();
    if (isRelDragging && relFrom) {
      const colMatch = (e.target as HTMLElement).closest('[id^="col-"]') as HTMLElement;
      if (colMatch) {
        const parts = colMatch.id.replace('col-', '').split('-');
        const toTableId = parts[0];
        const toColName = parts.slice(1).join('-');
        if (toTableId !== relFrom.tableId) {
          addRelation({ from: relFrom.tableId, to: toTableId, fromCol: relFrom.colName, toCol: toColName, identifying: !e.shiftKey, cardinality: '1 : N' });
        }
      }
      setRelDragging(false, null, null);
    }
  }, [handleMouseUp, handleAreaEnd, isRelDragging, relFrom, addRelation, setRelDragging]);

  const handleTableSelect = useCallback((table: typeof view.tables[0]) => {
    setSelectedTableId(table.id);
    setInspectorOpen(true);
  }, [setSelectedTableId, setInspectorOpen]);

  const connections = view.relations.map(rel => {
    const fromCol = Array.isArray(rel.fromCol) ? rel.fromCol[0] : rel.fromCol;
    const toCol = Array.isArray(rel.toCol) ? rel.toCol[0] : rel.toCol;
    const fromColElem = document.getElementById('col-' + rel.from + '-' + fromCol);
    const toColElem = document.getElementById('col-' + rel.to + '-' + toCol);
    const fromCard = document.getElementById('card-' + rel.from);
    const toCard = document.getElementById('card-' + rel.to);
    if (!fromColElem || !toColElem || !fromCard || !toCard || !workspaceRef.current) return null;
    const fromRect = fromColElem.getBoundingClientRect();
    const toRect = toColElem.getBoundingClientRect();
    const fromCardRect = fromCard.getBoundingClientRect();
    const toCardRect = toCard.getBoundingClientRect();
    const canvasRect = workspaceRef.current.getBoundingClientRect();
    const cardDx = toCardRect.left + toCardRect.width / 2 - (fromCardRect.left + fromCardRect.width / 2);
    const cardDy = toCardRect.top + toCardRect.height / 2 - (fromCardRect.top + fromCardRect.height / 2);
    const offset = 8 / viewState.scale;
    let x1: number, y1: number, x2: number, y2: number, type: 'vertical' | 'horizontal', direction: number;
    if (Math.abs(cardDy) > Math.abs(cardDx) * 1.2) {
      type = 'vertical';
      x1 = (fromRect.left + fromRect.width / 2 - canvasRect.left) / viewState.scale;
      x2 = (toRect.left + toRect.width / 2 - canvasRect.left) / viewState.scale;
      direction = cardDy > 0 ? 1 : -1;
      y1 = (cardDy > 0 ? fromRect.bottom : fromRect.top) - canvasRect.top;
      y2 = (cardDy > 0 ? toRect.top : toRect.bottom) - canvasRect.top;
      y1 = y1 / viewState.scale + (cardDy > 0 ? offset : -offset);
      y2 = y2 / viewState.scale + (cardDy > 0 ? -offset : offset);
    } else {
      type = 'horizontal';
      y1 = (fromRect.top + fromRect.height / 2 - canvasRect.top) / viewState.scale;
      y2 = (toRect.top + toRect.height / 2 - canvasRect.top) / viewState.scale;
      const rightX = (fromRect.right - canvasRect.left) / viewState.scale;
      const leftX = (toRect.left - canvasRect.left) / viewState.scale;
      if (rightX < leftX) {
        x1 = rightX + offset; x2 = leftX - offset; direction = 1;
      } else {
        x1 = (fromRect.left - canvasRect.left) / viewState.scale - offset;
        x2 = (toRect.right - canvasRect.left) / viewState.scale + offset;
        direction = -1;
      }
    }
    const isHighlighted = hoveredRel === rel.from + '-' + rel.to || matchedTableIds.includes(rel.from) || matchedTableIds.includes(rel.to);
    return { rel, x1, y1, x2, y2, type, direction, isHighlighted, isDimmed: searchTerm.length > 0 && !isHighlighted };
  }).filter(Boolean);

  const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-blue').trim() || '#3b82f6';
  return (
    <div ref={workspaceRef} className="canvas-wrapper" onWheel={handleWheel} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onContextMenu={e => e.preventDefault()}>
      <div className="canvas-grid" />
      <div className="canvas-layer" style={{ transform: 'translate(' + viewState.panX + 'px, ' + viewState.panY + 'px) scale(' + viewState.scale + ')' }}>
        <svg className="connections-svg" style={{ width: '100%', height: '100%' }}>
          <defs><marker id="marker-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M 2,2 L 10,6 L 2,10 Z" fill={accentColor} stroke={accentColor} strokeWidth="1.5" strokeLinejoin="round" /></marker></defs>
          {connections.map((conn, idx) => conn && <ConnectionLine key={idx} relation={conn.rel} x1={conn.x1} y1={conn.y1} x2={conn.x2} y2={conn.y2} type={conn.type} direction={conn.direction} accentColor={accentColor} isHighlighted={conn.isHighlighted} isDimmed={conn.isDimmed} />)}
          {relPreview && <DragPreviewLine {...relPreview} />}
        </svg>
        {view.tables.map(table => {
          const isMatched = matchedTableIds.includes(table.id);
          const isDimmed = searchTerm.length > 0 && !isMatched && !matchedTableIds.some(id => view.relations.filter(r => r.from === id || r.to === id).some(r => r.from === table.id || r.to === table.id));
          const tableIssues = issuesByTable.get(table.id) || [];
          return <React.Fragment key={table.id}>
            <EntityCard table={table} isSelected={selectedTableId === table.id} isMatched={isMatched} isDimmed={isDimmed} onSelect={handleTableSelect} onContextMenu={e => showMenu(e, 'table', table.id)} />
            {tableIssues.length > 0 && <div className={'validation-badge ' + tableIssues[0].type} style={{ left: table.x + 280, top: table.y - 8 }}>!</div>}
          </React.Fragment>;
        })}
      </div>
      {selection.isAreaSelecting && selection.areaStart && selection.areaEnd && <div className="area-select-box" style={{
        left: Math.min(selection.areaStart.x, selection.areaEnd.x) * viewState.scale + viewState.panX,
        top: Math.min(selection.areaStart.y, selection.areaEnd.y) * viewState.scale + viewState.panY,
        width: Math.abs(selection.areaEnd.x - selection.areaStart.x) * viewState.scale,
        height: Math.abs(selection.areaEnd.y - selection.areaStart.y) * viewState.scale
      }} />}
      <Minimap />
    </div>
  );
};

export default ERDCanvas;
