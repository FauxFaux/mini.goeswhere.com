export type SizeNode = { name: string; size: number; children?: SizeNode[]; detail?: string };
export type Tile = { node: SizeNode; x: number; y: number; width: number; height: number };

/** Search descendants as leaves, so an archive/path match never double-counts its children. */
export function searchTree(root: SizeNode, query: string): SizeNode[] {
  if (!query) return [...(root.children ?? [])];
  const result: SizeNode[] = [];
  const needle = query.toLowerCase();
  function visit(node: SizeNode, path: string[]) {
    if (node.size <= 0) return;
    if (node.children?.length) {
      for (const child of node.children) visit(child, [...path, child.name]);
    } else {
      const name = path.join(" / ");
      if (`${name} ${node.detail ?? ""}`.toLowerCase().includes(needle))
        result.push({ ...node, name });
    }
  }
  for (const child of root.children ?? []) visit(child, [child.name]);
  return result;
}

/** Bruls/Huizing/van Wijk squarification: greedily minimize the row's worst aspect ratio. */
export function squarify(nodes: SizeNode[], width: number, height: number): Tile[] {
  const sorted = nodes.filter((node) => node.size > 0).sort((a, b) => b.size - a.size);
  const total = sorted.reduce((sum, node) => sum + node.size, 0);
  if (!total || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;
  const tiles: Tile[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let row: SizeNode[] = [];
  let rowArea = 0;
  function worst(items: SizeNode[], area: number, side: number): number {
    if (!items.length) return Infinity;
    const max = items[0].size * scale;
    const min = items[items.length - 1].size * scale;
    return Math.max((side * side * max) / (area * area), (area * area) / (side * side * min));
  }
  function place() {
    const vertical = w >= h;
    const side = vertical ? h : w;
    const thickness = rowArea / side;
    let along = 0;
    row.forEach((node, index) => {
      const length = index === row.length - 1 ? side - along : (node.size * scale) / thickness;
      tiles.push({
        node,
        x: x + (vertical ? 0 : along),
        y: y + (vertical ? along : 0),
        width: vertical ? thickness : length,
        height: vertical ? length : thickness,
      });
      along += length;
    });
    if (vertical) {
      x += thickness;
      w = Math.max(0, w - thickness);
    } else {
      y += thickness;
      h = Math.max(0, h - thickness);
    }
    row = [];
    rowArea = 0;
  }
  for (const node of sorted) {
    const area = node.size * scale;
    const side = Math.min(w, h);
    if (row.length && worst([...row, node], rowArea + area, side) > worst(row, rowArea, side))
      place();
    row.push(node);
    rowArea += area;
  }
  if (row.length) place();
  return tiles;
}

export function pathTree(
  entries: { path: string[]; size: number; detail?: string }[],
  name: string,
): SizeNode {
  const root: SizeNode = { name, size: 0, children: [] };
  // Keep lookup maps outside nodes so the result is serializable and renderable.
  const indexes = new Map<SizeNode, Map<string, SizeNode>>();
  for (const entry of entries) {
    if (entry.size <= 0) continue;
    root.size += entry.size;
    let node = root;
    for (const part of entry.path) {
      let index = indexes.get(node);
      if (!index) {
        index = new Map();
        indexes.set(node, index);
      }
      let child = index.get(part);
      if (!child) {
        child = { name: part, size: 0, children: [] };
        index.set(part, child);
        node.children!.push(child);
      }
      child.size += entry.size;
      node = child;
    }
    if (entry.detail) node.detail = entry.detail;
  }
  return root;
}
