import { useEffect } from 'react';
import { useSchemaStore } from '../store/schemaStore';

export function useKeyboard() {
  const { deleteTable, selectedTableId, selection, updateTable, schemaData, currentView, duplicateTable } = useSchemaStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTableId) {
          deleteTable(selectedTableId);
        }
        if (selection.selectedIds.length > 0) {
          selection.selectedIds.forEach(id => deleteTable(id));
        }
      }

      // Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedTableId) {
          duplicateTable(selectedTableId);
        }
      }

      // Arrow keys to move selected table
      if (selectedTableId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const view = schemaData[currentView];
        const table = view?.tables.find(t => t.id === selectedTableId);
        if (!table) return;

        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        updateTable(selectedTableId, { x: table.x + dx, y: table.y + dy });
      }

      // Escape
      if (e.key === 'Escape') {
        useSchemaStore.getState().setSelectedTableId(null);
        useSchemaStore.getState().setSelection({ selectedIds: [] });
        useSchemaStore.getState().setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTable, selectedTableId, selection, updateTable, schemaData, currentView, duplicateTable]);
}
