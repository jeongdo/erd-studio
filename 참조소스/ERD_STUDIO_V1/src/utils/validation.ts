import { SchemaView } from '../types/schema';

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  tableId?: string;
}

export function validateSchema(view: SchemaView): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  view.tables.forEach(table => {
    // Check PK
    const hasPk = table.columns.some(c => c.pk);
    if (!hasPk) {
      issues.push({
        type: 'error',
        message: `Table "${table.name}" has no Primary Key`,
        tableId: table.id
      });
    }

    // Check duplicate column names
    const names = table.columns.map(c => c.name);
    const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
    if (duplicates.length > 0) {
      issues.push({
        type: 'error',
        message: `Table "${table.name}" has duplicate columns: ${[...new Set(duplicates)].join(', ')}`,
        tableId: table.id
      });
    }

    // Check orphan table (no relations)
    const hasRelation = view.relations.some(r => r.from === table.id || r.to === table.id);
    if (!hasRelation && view.tables.length > 1) {
      issues.push({
        type: 'warning',
        message: `Table "${table.name}" has no relations (orphan)`,
        tableId: table.id
      });
    }
  });

  // Check circular references
  const adj: Record<string, string[]> = {};
  view.tables.forEach(t => adj[t.id] = []);
  view.relations.forEach(r => {
    if (adj[r.from]) adj[r.from].push(r.to);
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    for (const neighbor of adj[node] || []) {
      if (!visited.has(neighbor) && hasCycle(neighbor)) return true;
      if (recStack.has(neighbor)) return true;
    }
    recStack.delete(node);
    return false;
  }

  Object.keys(adj).forEach(node => {
    if (!visited.has(node)) {
      if (hasCycle(node)) {
        issues.push({
          type: 'warning',
          message: 'Circular reference detected in relations'
        });
      }
    }
  });

  return issues;
}
