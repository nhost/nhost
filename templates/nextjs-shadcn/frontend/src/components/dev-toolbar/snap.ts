import type { Edge } from './useToolbarSettings';

export const OFFSET_MIN = 8;
export const OFFSET_MAX = 92;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Given a drop point in a viewport, pick the closest edge and the position
// along it (as a percentage, kept away from the corners).
export function nearestEdge(
  x: number,
  y: number,
  vw: number,
  vh: number,
): { edge: Edge; offset: number } {
  const candidates: Array<{ edge: Edge; distance: number; offset: number }> = [
    { edge: 'left', distance: x, offset: (y / vh) * 100 },
    { edge: 'right', distance: vw - x, offset: (y / vh) * 100 },
    { edge: 'top', distance: y, offset: (x / vw) * 100 },
    { edge: 'bottom', distance: vh - y, offset: (x / vw) * 100 },
  ];
  candidates.sort((a, b) => a.distance - b.distance);
  const winner = candidates[0];
  return {
    edge: winner.edge,
    offset: clamp(winner.offset, OFFSET_MIN, OFFSET_MAX),
  };
}
