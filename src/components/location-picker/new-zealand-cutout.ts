// Raster coordinates for a broad sweep along the southeast lobe. The boundary
// is a parabola, represented exactly by a quadratic Bezier in the SVG mask.
// It stays east of Australia and Tasmania and continues through Antarctica.
const top = 280;
const bottom = 900;
const vertexX = 2030;
const vertexY = 420;
const curvature = 0.0019;

export function newZealandCutoutBoundary(y: number): number {
  return vertexX - curvature * (y - vertexY) ** 2;
}

const startX = newZealandCutoutBoundary(top);
const endX = newZealandCutoutBoundary(bottom);
const controlY = (top + bottom) / 2;
const controlX = startX - curvature * (top - vertexY) * (bottom - top);

export const newZealandCutoutPath =
  `M ${startX} ${top} Q ${controlX} ${controlY} ${endX} ${bottom} ` +
  `L 2058 ${bottom} L 2058 ${top} Z`;

export function isInNewZealandCutout(x: number, y: number): boolean {
  return y >= top && y <= bottom && x >= newZealandCutoutBoundary(y);
}
