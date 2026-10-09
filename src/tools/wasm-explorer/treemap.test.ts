import { describe, expect, it } from "vitest";
import { pathTree, searchTree, squarify } from "./treemap.ts";

describe("squarified treemap", () => {
  it("conserves area without overlaps for thousands of uneven contributions", () => {
    const nodes = Array.from({ length: 5000 }, (_, index) => ({
      name: `${index}`,
      size: index === 0 ? 100_000 : 1 + (index % 31),
    }));
    const tiles = squarify(nodes, 1000, 550);
    const total = nodes.reduce((sum, node) => sum + node.size, 0);
    expect(tiles).toHaveLength(nodes.length);
    expect(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)).toBeCloseTo(550000, 4);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(1000 + 1e-7);
      expect(tile.y + tile.height).toBeLessThanOrEqual(550 + 1e-7);
      expect((tile.width * tile.height) / 550000).toBeCloseTo(tile.node.size / total, 9);
    }
    // Check pairwise overlap on a smaller case independently of the layout algorithm.
    const small = squarify(nodes.slice(1, 50), 300, 500);
    for (let i = 0; i < small.length; i++)
      for (let j = i + 1; j < small.length; j++) {
        const a = small[i];
        const b = small[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(overlapX < 1e-7 || overlapY < 1e-7).toBe(true);
      }
  });
  it("handles empty, zero and singleton datasets", () => {
    expect(squarify([{ name: "zero", size: 0 }], 100, 100)).toEqual([]);
    expect(squarify([{ name: "one", size: 5 }], 100, 100)[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });
  it("groups exact paths without treating special names as object properties", () => {
    const root = pathTree(
      [
        { path: ["lib", "__proto__"], size: 5 },
        { path: ["lib", "__proto__"], size: 10 },
        { path: ["lib", "other"], size: 7 },
      ],
      "root",
    );
    expect(root.size).toBe(22);
    expect(root.children![0].children!.map((node) => [node.name, node.size])).toEqual([
      ["__proto__", 15],
      ["other", 7],
    ]);
    expect(searchTree(root, "lib").map((node) => node.size)).toEqual([15, 7]);
    expect(searchTree(root, "other")[0]).toMatchObject({ name: "lib / other", size: 7 });
  });
});
