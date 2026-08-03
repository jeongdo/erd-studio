import React, { useRef } from 'react';
import { useSchemaStore } from '../store/schemaStore';
import { exportToJSON, exportToSQL, importFromJSON } from '../utils/exportImport';
import { generateSQL } from '../utils/sqlGenerator';
import { autoLayout } from '../utils/layout';
import { Table } from '../types/schema';
import { Undo, Redo, Plus, Download, Upload, Layout, Sun, Moon, Monitor } from 'lucide-react';

const Toolbar: React.FC = () => {
  const {
    schemaData, currentView, undo, redo, addTable, importSchema, theme, setTheme,
    updateViewState, viewState
  } = useSchemaStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTable = () => {
    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: 'NEW_TABLE',
      x: 100,
      y: 100,
      columns: [
        { name: 'id', type: 'INT', pk: true, fk: false },
        { name: 'name', type: 'VARCHAR(255)', pk: false, fk: false }
      ]
    };
    addTable(newTable);
  };

  const handleExportJSON = () => {
    exportToJSON(schemaData);
  };

  const handleExportSQL = () => {
    const view = schemaData[currentView];
    if (!view) return;
    const sql = generateSQL(view, 'mysql');
    exportToSQL(sql);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJSON(file);
      importSchema(data);
    } catch (err) {
      alert('Invalid JSON file');
    }
  };

  const handleAutoLayout = () => {
    const view = schemaData[currentView];
    if (!view) return;
    const newTables = autoLayout(view.tables, view.relations);
    newTables.forEach(t => {
      useSchemaStore.getState().updateTable(t.id, { x: t.x, y: t.y });
    });
  };

  const handleCenterFit = () => {
    const view = schemaData[currentView];
    if (!view || view.tables.length === 0) return;
    const { computeBoundingBox } = require('../utils/layout');
    const bbox = computeBoundingBox(view.tables);
    const contentW = bbox.maxX - bbox.minX;
    const contentH = bbox.maxY - bbox.minY;
    const workspaceW = window.innerWidth - 240;
    const workspaceH = window.innerHeight - 52;
    const paddingX = 120;
    const paddingY = 160;
    const newScale = Math.min((workspaceW - paddingX * 2) / contentW, (workspaceH - paddingY * 2) / contentH, 1);
    const finalScale = Math.max(newScale, 0.5);
    const cx = bbox.minX + contentW / 2;
    const cy = bbox.minY + contentH / 2;
    updateViewState({
      scale: finalScale,
      panX: workspaceW / 2 - cx * finalScale,
      panY: workspaceH / 2 - cy * finalScale
    });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-title">ERD Studio</div>
      <button className="toolbar-btn" onClick={handleAddTable}><Plus size={14} /> New Table</button>
      <button className="toolbar-btn" onClick={undo}><Undo size={14} /> Undo</button>
      <button className="toolbar-btn" onClick={redo}><Redo size={14} /> Redo</button>
      <div className="toolbar-sep" />
      <button className="toolbar-btn" onClick={handleAutoLayout}><Layout size={14} /> Auto Layout</button>
      <button className="toolbar-btn" onClick={handleCenterFit}><Monitor size={14} /> Fit</button>
      <div className="toolbar-sep" />
      <button className="toolbar-btn" onClick={handleExportJSON}><Download size={14} /> JSON</button>
      <button className="toolbar-btn" onClick={handleExportSQL}><Download size={14} /> SQL</button>
      <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Import</button>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImport} />
      <div className="toolbar-sep" />
      <button className="toolbar-btn" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>
      <button className="toolbar-btn" onClick={toggleFullscreen}><Monitor size={14} /></button>
    </div>
  );
};

export default Toolbar;
