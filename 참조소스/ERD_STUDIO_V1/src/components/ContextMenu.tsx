import React from 'react';
import { useSchemaStore } from '../store/schemaStore';
import { Copy, Trash2, Eye } from 'lucide-react';

const ContextMenu: React.FC = () => {
  const { contextMenu, setContextMenu, duplicateTable, deleteTable, setSelectedTableId, setInspectorOpen } = useSchemaStore();

  if (!contextMenu?.visible) return null;

  const handleDuplicate = () => {
    if (contextMenu.targetId) duplicateTable(contextMenu.targetId);
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (contextMenu.targetId) deleteTable(contextMenu.targetId);
    setContextMenu(null);
  };

  const handleInspect = () => {
    if (contextMenu.targetId) {
      setSelectedTableId(contextMenu.targetId);
      setInspectorOpen(true);
    }
    setContextMenu(null);
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={() => setContextMenu(null)}
      />
      <div
        className="context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {contextMenu.targetType === 'table' && (
          <>
            <div className="context-item" onClick={handleInspect}><Eye size={14} /> Inspect</div>
            <div className="context-item" onClick={handleDuplicate}><Copy size={14} /> Duplicate</div>
            <div className="context-sep" />
            <div className="context-item danger" onClick={handleDelete}><Trash2 size={14} /> Delete</div>
          </>
        )}
        {contextMenu.targetType === 'canvas' && (
          <>
            <div className="context-item" onClick={() => setContextMenu(null)}>Add Table (use toolbar)</div>
          </>
        )}
      </div>
    </>
  );
};

export default ContextMenu;
