import React from 'react';
import { Column } from '../types/schema';

interface Props {
  column: Column;
  tableId: string;
  onHandleMouseDown: (e: React.MouseEvent, colName: string) => void;
}

const ColumnRow: React.FC<Props> = ({ column, tableId, onHandleMouseDown }) => {
  return (
    <div className="column-row" id={`col-${tableId}-${column.name}`}>
      <div className="column-left">
        <span className={`key-badge ${column.pk ? 'key-pk' : column.fk ? 'key-fk' : 'key-none'}`}>
          {column.pk ? 'PK' : column.fk ? 'FK' : ''}
        </span>
        <span className="col-name">{column.name}</span>
      </div>
      <span className="col-type">{column.type}</span>
      <div
        className="col-handle"
        onMouseDown={(e) => onHandleMouseDown(e, column.name)}
        title="Drag to create relation"
      />
    </div>
  );
};

export default ColumnRow;
