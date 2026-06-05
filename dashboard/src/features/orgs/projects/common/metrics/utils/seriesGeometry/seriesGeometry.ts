import type { ScaleFunction } from 'recharts';

export type Row = Record<string, number | null> & { timestamp: number };

// Squared distance from the point (cx,cy) to the segment (ax,ay)-(bx,by).
// Squared (no sqrt) because callers only compare distances; `t` is the clamped
// projection parameter so points beyond either end map to the nearest endpoint.
export function distanceSqPointToSegment(
  cx: number,
  cy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = 0;
  if (lengthSq > 0) {
    t = ((cx - ax) * dx + (cy - ay) * dy) / lengthSq;
    if (t < 0) {
      t = 0;
    } else if (t > 1) {
      t = 1;
    }
  }
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const px = cx - projX;
  const py = cy - projY;
  return px * px + py * py;
}

// Pixel coordinates of a series' datapoint at `row`, or null when the value is
// missing/non-numeric or a scale produces a non-finite pixel.
export function pixelAt(
  row: Row,
  key: string,
  xScale: ScaleFunction,
  yScale: ScaleFunction,
): { x: number; y: number } | null {
  const v = row[key];
  if (typeof v !== 'number') {
    return null;
  }
  const x = xScale(row.timestamp);
  const y = yScale(v);
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }
  return { x, y };
}

// Smallest squared pixel distance from the cursor to any segment of `key`'s
// polyline. Segments touching a null/missing point are skipped; a series with
// fewer than two plottable points yields POSITIVE_INFINITY.
export function distanceSqToSeries(
  key: string,
  cursorX: number,
  cursorY: number,
  rows: ReadonlyArray<Row>,
  xScale: ScaleFunction,
  yScale: ScaleFunction,
): number {
  let minDistSq = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rows.length - 1; i += 1) {
    const a = pixelAt(rows[i], key, xScale, yScale);
    const b = pixelAt(rows[i + 1], key, xScale, yScale);
    if (!a || !b) {
      continue;
    }
    const d = distanceSqPointToSegment(cursorX, cursorY, a.x, a.y, b.x, b.y);
    if (d < minDistSq) {
      minDistSq = d;
    }
  }
  return minDistSq;
}
