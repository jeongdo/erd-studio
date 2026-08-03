import React, { useState } from 'react';
import { useSchemaStore } from '../store/schemaStore';
import { X, Copy, Trash2, Plus } from 'lucide-react';

const Inspector: React.FC = () => {
  const {
    inspectorOpen, setInspectorOpen, selectedTableId, schemaData, currentView,
    updateTable, deleteTable, addColumn, deleteColumn, duplicateTable
  } = useSchemaStore();

  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('VARCHAR(255)');

  const view = schemaData[currentView];
  const table = view?.tables.find(t => t.id === selectedTableId);

  if (!inspectorOpen || !table) {
    return <div className={`inspector ${inspectorOpen ? 'open' : ''}`} />;
  }

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    addColumn(table.id, {
      name: newColName.trim(),
      type: newColType,
      pk: false,
      fk: false
    });
    setNewColName('');
  };

  const togglePk = (colName: string) => {
    const col = table.columns.find(c => c.name === colName);
    if (!col) return;
    updateTable(table.id, {
      columns: table.columns.map(c => c.name === colName ? { ...c, pk: !c.pk } : c)
    });
  };

  return (
    <div className="inspector open">
      <div className="inspector-header">
        <h3>Inspector</h3>
        <button className="inspector-close" onClick={() => setInspectorOpen(false)}><X size={16} /></button>
      </div>
      <div className="inspector-content">
        <div className="inspector-section">
          <h4>Table</h4>
          <input
            className="inspector-input"
            value={table.name}
            onChange={(e) => updateTable(table.id, { name: e.target.value })}
          />
          <input
            className="inspector-input"
            value={table.desc || ''}
            placeholder="Description"
            onChange={(e) => updateTable(table.id, { desc: e.target.value })}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="inspector-btn" onClick={() => duplicateTable(table.id)}><Copy size={12} /> Duplicate</button>
            <button className="inspector-btn danger" onClick={() => deleteTable(table.id)}><Trash2 size={12} /> Delete</button>
          </div>
        </div>

        <div className="inspector-section">
          <h4>Columns</h4>
          {table.columns.map(col => (
            <div key={col.name} className="inspector-row">
              <span
                className={`inspector-key ${col.pk ? 'key-pk' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => togglePk(col.name)}
              >
                {col.pk ? 'PK' : '·'}
              </span>
              <span className="inspector-col">{col.name}</span>
              <span className="inspector-type">{col.type}</span>
              <button
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                onClick={() => deleteColumn(table.id, col.name)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              className="inspector-input"
              style={{ flex: 1 }}
              placeholder="Column name"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
            />
            <input
              className="inspector-input"
              style={{ width: 100 }}
              value={newColType}
              onChange={(e) => setNewColType(e.target.value)}
            />
            <button className="inspector-btn" style={{ width: 40 }} onClick={handleAddColumn}><Plus size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inspector;
