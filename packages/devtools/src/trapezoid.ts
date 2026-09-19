import { setStyles, svgElement } from './dom';
import type { Edge } from './types';

const RADIUS = 12;
const SLANT = 8;

interface Point {
  x: number;
  y: number;
}

// Wraps around, so the corner before the first point is the last one.
function at(points: Point[], index: number): Point {
  const count = points.length;
  const point = points[((index % count) + count) % count];
  if (!point) {
    throw new Error('a polygon needs at least one point');
  }
  return point;
}

// A closed path through `points` with every corner rounded by `radius`,
// clamped so it never exceeds half of either adjacent edge.
export function roundedPath(points: Point[], radius: number): string {
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const prev = at(points, i - 1);
    const cur = at(points, i);
    const next = at(points, i + 1);

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
  offset: Record<string, string>;
  points: Point[];
}

// Lays out the trapezoid so its connected (edge) side is pushed `RADIUS` past
// the shell, keeping that side's rounded corners off-screen and the visible
// screen edge perfectly flush. `w`/`h` are the shell's visible pixel size.
export function layoutFor(edge: Edge, w: number, h: number): Layout {
  switch (edge) {
    case 'left':
      return {
        viewW: w + RADIUS,
        viewH: h,
        offset: { left: `${-RADIUS}px`, top: '0px' },
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
        offset: { left: '0px', top: `${-RADIUS}px` },
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
        offset: { left: '0px', top: '0px' },
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
        offset: { left: '0px', top: '0px' },
        points: [
          { x: 0, y: SLANT },
          { x: w + RADIUS, y: 0 },
          { x: w + RADIUS, y: h },
          { x: 0, y: h - SLANT },
        ],
      };
  }
}

// Every mounted toolbar draws its own gradient, and two of them on one page
// must not share an id: the second definition would win for both.
let gradientSeq = 0;

export function trapezoid(
  edge: Edge,
  w: number,
  h: number,
  from: string,
  to: string,
): SVGElement {
  const { viewW, viewH, offset, points } = layoutFor(edge, w, h);
  gradientSeq += 1;
  const gradientId = `ndt-gradient-${gradientSeq}`;

  const svg = svgElement('svg', {
    width: String(viewW),
    height: String(viewH),
    viewBox: `0 0 ${viewW} ${viewH}`,
    'aria-hidden': 'true',
  });
  setStyles(svg, {
    position: 'absolute',
    ...offset,
    overflow: 'visible',
    filter: 'drop-shadow(0 10px 24px rgba(0, 0, 0, 0.38))',
  });

  const defs = svgElement('defs');
  const gradient = svgElement('linearGradient', {
    id: gradientId,
    x1: '0',
    y1: '0',
    x2: '1',
    y2: '1',
  });
  gradient.appendChild(svgElement('stop', { offset: '0', 'stop-color': from }));
  gradient.appendChild(svgElement('stop', { offset: '1', 'stop-color': to }));
  defs.appendChild(gradient);
  svg.appendChild(defs);

  svg.appendChild(
    svgElement('path', {
      d: roundedPath(points, RADIUS),
      fill: `url(#${gradientId})`,
    }),
  );
  return svg;
}
