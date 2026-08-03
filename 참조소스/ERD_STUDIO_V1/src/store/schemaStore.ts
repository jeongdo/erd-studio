import { create } from 'zustand';
import { SchemaData, SchemaView, Table, Relation, Note, ViewState, SelectionState, Theme } from '../types/schema';
import { defaultSchemaData } from '../data/defaultSchema';

interface AppState {
  // Schema
  schemaData: SchemaData;
  currentView: string;

  // View
  viewState: ViewState;

  // Selection
  selection: SelectionState;

  // Theme
  theme: Theme;

  // Inspector
  inspectorOpen: boolean;
  selectedTableId: string | null;

  // Drag
  isPanning: boolean;
  isDraggingTable: boolean;
  dragTableId: string | null;
  dragOffset: { x: number; y: number };

  // Relation drag
  isRelDragging: boolean;
  relFrom: { tableId: string; colName: string } | null;
  relPreview: { x1: number; y1: number; x2: number; y2: number } | null;

  // Context menu
  contextMenu: { x: number; y: number; visible: boolean; targetId?: string; targetType?: 'table' | 'canvas' | 'column' } | null;

  // Search
  searchTerm: string;

  // History
  history: { past: SchemaData[]; future: SchemaData[] };

  // Notes
  notes: Note[];

  // Actions
  setSchemaData: (data: SchemaData) => void;
  setCurrentView: (view: string) => void;
  addTable: (table: Table) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  deleteTable: (tableId: string) => void;
  addColumn: (tableId: string, column: any) => void;
  updateColumn: (tableId: string, colName: string, updates: any) => void;
  deleteColumn: (tableId: string, colName: string) => void;
  addRelation: (relation: Relation) => void;
  deleteRelation: (from: string, to: string) => void;
  updateViewState: (updates: Partial<ViewState>) => void;
  setSelection: (updates: Partial<SelectionState>) => void;
  setTheme: (theme: Theme) => void;
  setInspectorOpen: (open: boolean) => void;
  setSelectedTableId: (id: string | null) => void;
  setPanning: (panning: boolean) => void;
  setDraggingTable: (dragging: boolean, tableId?: string | null, offset?: { x: number; y: number }) => void;
  setRelDragging: (dragging: boolean, from?: { tableId: string; colName: string } | null, preview?: any) => void;
  setContextMenu: (menu: any) => void;
  setSearchTerm: (term: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  addNote: (note: Note) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  deleteNote: (noteId: string) => void;
  duplicateTable: (tableId: string) => void;
  importSchema: (data: SchemaData) => void;
  exportSchema: () => SchemaData;
}

const getInitialView = (): string => {
  const keys = Object.keys(defaultSchemaData);
  return keys[0] || '';
};

const loadTheme = (): Theme => {
  const saved = localStorage.getItem('erd_theme') as Theme;
  return saved === 'light' ? 'light' : 'dark';
};

export const useSchemaStore = create<AppState>((set, get) => ({
  schemaData: { ...defaultSchemaData },
  currentView: getInitialView(),
  viewState: { scale: 1, panX: 0, panY: 0 },
  selection: { selectedIds: [], isAreaSelecting: false, areaStart: null, areaEnd: null },
  theme: loadTheme(),
  inspectorOpen: false,
  selectedTableId: null,
  isPanning: false,
  isDraggingTable: false,
  dragTableId: null,
  dragOffset: { x: 0, y: 0 },
  isRelDragging: false,
  relFrom: null,
  relPreview: null,
  contextMenu: null,
  searchTerm: '',
  history: { past: [], future: [] },
  notes: [],

  setSchemaData: (data) => set({ schemaData: data }),

  setCurrentView: (view) => set({ currentView: view, selectedTableId: null, selection: { selectedIds: [], isAreaSelecting: false, areaStart: null, areaEnd: null } }),

  addTable: (table) => {
    get().pushHistory();
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      const newTables = [...view.tables, table];
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, tables: newTables }
        }
      };
    });
  },

  updateTable: (tableId, updates) => {
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      const newTables = view.tables.map(t => t.id === tableId ? { ...t, ...updates } : t);
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, tables: newTables }
        }
      };
    });
  },

  deleteTable: (tableId) => {
    get().pushHistory();
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      const newTables = view.tables.filter(t => t.id !== tableId);
      const newRelations = view.relations.filter(r => r.from !== tableId && r.to !== tableId);
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, tables: newTables, relations: newRelations }
        },
        selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
        selection: { ...state.selection, selectedIds: state.selection.selectedIds.filter(id => id !== tableId) }
      };
    });
  },

  addColumn: (tableId, column) => {
    get().pushHistory();
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      const newTables = view.tables.map(t => {
        if (t.id !== tableId) return t;
        return { ...t, columns: [...t.columns, column] };
      });
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, tables: newTables }
        }
      };
    });
  },

  updateColumn: (tableId, colName, updates) => {
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      const newTables = view.tables.map(t => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.map(c => c.name === colName ? { ...c, ...updates } : c)
        };
      });
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, tables: newTables }
        }
      };
    });
  },

  deleteColumn: (tableId, colName) => {
    get().pushHistory();
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      const newTables = view.tables.map(t => {
        if (t.id !== tableId) return t;
        return { ...t, columns: t.columns.filter(c => c.name !== colName) };
      });
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, tables: newTables }
        }
      };
    });
  },

  addRelation: (relation) => {
    get().pushHistory();
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      // Prevent duplicate
      const exists = view.relations.some(r => r.from === relation.from && r.to === relation.to && r.fromCol === relation.fromCol && r.toCol === relation.toCol);
      if (exists) return state;
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, relations: [...view.relations, relation] }
        }
      };
    });
  },

  deleteRelation: (from, to) => {
    get().pushHistory();
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, relations: view.relations.filter(r => !(r.from === from && r.to === to)) }
        }
      };
    });
  },

  updateViewState: (updates) => set((state) => ({ viewState: { ...state.viewState, ...updates } })),

  setSelection: (updates) => set((state) => ({ selection: { ...state.selection, ...updates } })),

  setTheme: (theme) => {
    localStorage.setItem('erd_theme', theme);
    set({ theme });
  },

  setInspectorOpen: (open) => set({ inspectorOpen: open }),

  setSelectedTableId: (id) => set({ selectedTableId: id }),

  setPanning: (panning) => set({ isPanning: panning }),

  setDraggingTable: (dragging, tableId, offset) => set({
    isDraggingTable: dragging,
    dragTableId: tableId || null,
    dragOffset: offset || { x: 0, y: 0 }
  }),

  setRelDragging: (dragging, from, preview) => set({
    isRelDragging: dragging,
    relFrom: from || null,
    relPreview: preview || null
  }),

  setContextMenu: (menu) => set({ contextMenu: menu }),

  setSearchTerm: (term) => set({ searchTerm: term }),

  pushHistory: () => set((state) => {
    const past = [...state.history.past, JSON.parse(JSON.stringify(state.schemaData))];
    if (past.length > 50) past.shift();
    return { history: { past, future: [] } };
  }),

  undo: () => set((state) => {
    if (state.history.past.length === 0) return state;
    const previous = state.history.past[state.history.past.length - 1];
    const newPast = state.history.past.slice(0, -1);
    return {
      schemaData: previous,
      history: { past: newPast, future: [state.schemaData, ...state.history.future] }
    };
  }),

  redo: () => set((state) => {
    if (state.history.future.length === 0) return state;
    const next = state.history.future[0];
    const newFuture = state.history.future.slice(1);
    return {
      schemaData: next,
      history: { past: [...state.history.past, state.schemaData], future: newFuture }
    };
  }),

  addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),

  updateNote: (noteId, updates) => set((state) => ({
    notes: state.notes.map(n => n.id === noteId ? { ...n, ...updates } : n)
  })),

  deleteNote: (noteId) => set((state) => ({
    notes: state.notes.filter(n => n.id !== noteId)
  })),

  duplicateTable: (tableId) => {
    get().pushHistory();
    set((state) => {
      const view = state.schemaData[state.currentView];
      if (!view) return state;
      const table = view.tables.find(t => t.id === tableId);
      if (!table) return state;
      const newTable: Table = {
        ...table,
        id: `${table.id}_copy_${Date.now()}`,
        name: `${table.name}_copy`,
        x: table.x + 40,
        y: table.y + 40,
        columns: table.columns.map(c => ({ ...c, pk: false, fk: false }))
      };
      return {
        schemaData: {
          ...state.schemaData,
          [state.currentView]: { ...view, tables: [...view.tables, newTable] }
        }
      };
    });
  },

  importSchema: (data) => {
    get().pushHistory();
    set({ schemaData: data, currentView: Object.keys(data)[0] || '' });
  },

  exportSchema: () => get().schemaData,
}));
