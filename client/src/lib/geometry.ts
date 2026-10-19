// Canvas geometry helpers: compute a board layout that fits the available
// space and convert between grid intersections and canvas pixels.

export interface BoardLayout {
  width: number; // CSS width of the board in px
  height: number; // CSS height of the board in px
  cellSize: number;
  offsetX: number; // top-left pixel of intersection (0,0)
  offsetY: number;
  dpr: number; // device pixel ratio
}

export function computeBoardLayout(
  rows: number,
  cols: number,
  availWidth: number,
  availHeight: number,
  margin = 40,
): BoardLayout {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const innerW = Math.max(0, availWidth - margin * 2);
  const innerH = Math.max(0, availHeight - margin * 2);
  const cellSize = Math.min(innerW / Math.max(1, cols - 1), innerH / Math.max(1, rows - 1));
  const size = Math.max(cellSize, 6);
  const boardWidth = size * (cols - 1) + margin * 2;
  const boardHeight = size * (rows - 1) + margin * 2;
  return {
    width: boardWidth,
    height: boardHeight,
    cellSize: size,
    offsetX: margin,
    offsetY: margin,
    dpr,
  };
}

export function pointToPixel(layout: BoardLayout, r: number, c: number): { x: number; y: number } {
  return {
    x: layout.offsetX + c * layout.cellSize,
    y: layout.offsetY + r * layout.cellSize,
  };
}

// Convert a pointer pixel to the nearest grid intersection, or null if the
// point is closer than 45% of the cell to some other intersection.
export function pixelToPoint(
  layout: BoardLayout,
  rows: number,
  cols: number,
  x: number,
  y: number,
): { r: number; c: number } | null {
  const c = Math.round((x - layout.offsetX) / layout.cellSize);
  const r = Math.round((y - layout.offsetY) / layout.cellSize);
  const cx = layout.offsetX + c * layout.cellSize;
  const cy = layout.offsetY + r * layout.cellSize;
  const dx = x - cx;
  const dy = y - cy;
  const half = layout.cellSize * 0.45;
  if (Math.abs(dx) > half || Math.abs(dy) > half) return null;
  if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
  return { r, c };
}
