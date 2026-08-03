import React, { useCallback } from 'react';
import { Table } from '../types/schema';
import { useSchemaStore } from '../store/schemaStore';
import ColumnRow from './ColumnRow';
import { snapToGrid } from '../utils/bezier';

interface Props {
  table: Table;
  isSelected: boolean;
  isMatched: boolean;
  isDimmed: boolean;
  onSelect: (table: Table) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const EntityCard: React.FC<Props> = ({ table, isSelected, isMatched, isDimmed, onSelect, onContextMenu }) => {
  const { updateTable, setSelectedTableId, setInspectorOpen, setRelDragging } = useSchemaStore();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.col-handle')) return;
    e.stopPropagation();
    setSelectedTableId(table.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = table.x;
    const initialY = table.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / useSchemaStore.getState().viewState.scale;
      const dy = (moveEvent.clientY - startY) / useSchemaStore.getState().viewState.scale;
      updateTable(table.id, {
        x: snapToGrid(initialX + dx),
        y: snapToGrid(initialY + dy)
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [table, updateTable, setSelectedTableId]);

  const handleColHandleMouseDown = useCallback((e: React.MouseEvent, colName: string) => {
    e.stopPropagation();
    e.preventDefault();
    setRelDragging(true, { tableId: table.id, colName }, null);
  }, [table.id, setRelDragging]);

  const className = `table-card ${isSelected ? 'selected' : ''} ${isMatched ? 'matched' : ''} ${isDimmed ? 'dimmed' : ''}`;

  return (
    <div
      className={className}
      id={`card-${table.id}`}
      style={{ left: table.x, top: table.y }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onSelect(table); }}
      onContextMenu={onContextMenu}
    >
      <div className="table-header">
        <div className="table-title">
          <span className="table-name">{table.name}</span>
          {table.desc && <span className="table-desc">{table.desc}</span>}
        </div>
        <span className="table-badge">TABLE</span>
      </div>
      <div className="column-list">
        {table.columns.map(col => (
          <ColumnRow
            key={col.name}
            column={col}
            tableId={table.id}
            onHandleMouseDown={handleColHandleMouseDown}
          />
        ))}
      </div>
    </div>
  );
};

export default EntityCard;
