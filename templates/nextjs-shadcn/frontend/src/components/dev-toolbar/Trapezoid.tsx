import { type CSSProperties, useId } from 'react';
import type { Edge } from './useToolbarSettings';

const RADIUS = 12;
const SLANT = 8;

interface Point {
  x: number;
  y: number;
}

// A closed path through `points` with every corner rounded by `radius`,
// clamped so it never exceeds half of either adjacent edge.
function roundedPath(points: Point[], radius: number): string {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];

    const toPrev = { x: prev.x - cur.x, y: prev.y - cur.y };
    const toNext = { x: next.x - cur.x, y: next.y - cur.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y);
    const lenNext = Math.hypot(toNext.x, toNext.y);
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);

    const p1 = {
      x: cur.x + (toPrev.x / lenPrev) * r,
      y: cur.y + (toPrev.y / lenPrev) * r,
    };
    const p2 = {
      x: cur.x + (toNext.x / lenNext) * r,
      y: cur.y + (toNext.y / lenNext) * r,
    };

    d += i === 0 ? `M ${p1.x} ${p1.y} ` : `L ${p1.x} ${p1.y} `;
    d += `Q ${cur.x} ${cur.y} ${p2.x} ${p2.y} `;
  }
  return `${d}Z`;
}

interface Layout {
  viewW: number;
  viewH: number;
  offset: CSSProperties;
  points: Point[];
}

// Lays out the trapezoid so its connected (edge) side is pushed `RADIUS` past
// the shell, keeping that side's rounded corners off-screen and the visible
// screen edge perfectly flush. `w`/`h` are the shell's visible pixel size.
function layoutFor(edge: Edge, w: number, h: number): Layout {
  switch (edge) {
    case 'left':
      return {
        viewW: w + RADIUS,
        viewH: h,
        offset: { left: -RADIUS, top: 0 },
        points: [
          { x: 0, y: 0 },
          { x: w + RADIUS, y: SLANT },
          { x: w + RADIUS, y: h - SLANT },
          { x: 0, y: h },
        ],
      };
    case 'top':
      return {
        viewW: w,
        viewH: h + RADIUS,
        offset: { left: 0, top: -RADIUS },
        points: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w - SLANT, y: h + RADIUS },
          { x: SLANT, y: h + RADIUS },
        ],
      };
    case 'bottom':
      return {
        viewW: w,
        viewH: h + RADIUS,
        offset: { left: 0, top: 0 },
        points: [
          { x: SLANT, y: 0 },
          { x: w - SLANT, y: 0 },
          { x: w, y: h + RADIUS },
          { x: 0, y: h + RADIUS },
        ],
      };
    default:
      return {
        viewW: w + RADIUS,
        viewH: h,
        offset: { left: 0, top: 0 },
        points: [
          { x: 0, y: SLANT },
          { x: w + RADIUS, y: 0 },
          { x: w + RADIUS, y: h },
          { x: 0, y: h - SLANT },
        ],
      };
  }
}

interface TrapezoidProps {
  edge: Edge;
  w: number;
  h: number;
  from: string;
  to: string;
}

export function Trapezoid({ edge, w, h, from, to }: TrapezoidProps) {
  const gradientId = useId();
  const { viewW, viewH, offset, points } = layoutFor(edge, w, h);

  return (
    <svg
      width={viewW}
      height={viewH}
      viewBox={`0 0 ${viewW} ${viewH}`}
      aria-hidden="true"
      style={{
        position: 'absolute',
        ...offset,
        overflow: 'visible',
        filter: 'drop-shadow(0 10px 24px rgba(0, 0, 0, 0.38))',
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d={roundedPath(points, RADIUS)} fill={`url(#${gradientId})`} />
    </svg>
  );
}
