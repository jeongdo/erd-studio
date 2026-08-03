export interface Column {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  nullable?: boolean;
  default?: string;
  desc?: string;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface Table {
  id: string;
  name: string;
  desc?: string;
  x: number;
  y: number;
  columns: Column[];
  indexes?: TableIndex[];
  color?: string;
}

export interface Relation {
  from: string;
  to: string;
  fromCol: string | string[];
  toCol: string | string[];
  identifying: boolean;
  cardinality?: string;
}

export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
  width: number;
  height: number;
}

export interface SchemaView {
  name: string;
  icon?: string;
  title?: string;
  tables: Table[];
  relations: Relation[];
  notes?: Note[];
}

export interface SchemaData {
  [key: string]: SchemaView;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewState {
  scale: number;
  panX: number;
  panY: number;
}

export interface DragState {
  isDragging: boolean;
  tableId: string | null;
  offsetX: number;
  offsetY: number;
}

export interface SelectionState {
  selectedIds: string[];
  isAreaSelecting: boolean;
  areaStart: Point | null;
  areaEnd: Point | null;
}

export interface HistoryState {
  past: SchemaData[];
  future: SchemaData[];
}

export type Theme = 'dark' | 'light';
