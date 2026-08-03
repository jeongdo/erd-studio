import { Table, Relation } from '../types/schema';

export function autoLayout(tables: Table[], relations: Relation[]): Table[] {
  // Simple topological layering
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  tables.forEach(t => {
    inDegree[t.id] = 0;
    adj[t.id] = [];
  });

  relations.forEach(r => {
    if (adj[r.from]) adj[r.from].push(r.to);
    if (inDegree[r.to] !== undefined) inDegree[r.to]++;
  });

  const queue: string[] = [];
  const layers: Record<string, number> = {};

  Object.keys(inDegree).forEach(id => {
    if (inDegree[id] === 0) {
      queue.push(id);
      layers[id] = 0;
    }
  });

  while (queue.length > 0) {
    const curr = queue.shift()!;
    adj[curr].forEach(next => {
      layers[next] = Math.max(layers[next] || 0, layers[curr] + 1);
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    });
  }

  // If cycle exists, fallback to grid
  const maxLayer = Math.max(...Object.values(layers), 0);
  const layerCounts: number[] = new Array(maxLayer + 1).fill(0);

  const newTables = tables.map(t => {
    const layer = layers[t.id] ?? 0;
    const col = layerCounts[layer]++;
    return {
      ...t,
      x: 60 + layer * 540,
      y: 80 + col * 400
    };
  });

  return newTables;
}

export function computeBoundingBox(tables: Table[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  tables.forEach(t => {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + 300); // approximate width
    maxY = Math.max(maxY, t.y + 200 + t.columns.length * 28); // approximate height
  });
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  return { minX, minY, maxX, maxY };
}
