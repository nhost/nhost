import type { Edge } from './types';

export const OFFSET_MIN = 8;
export const OFFSET_MAX = 92;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface Candidate {
  edge: Edge;
  distance: number;
  offset: number;
}

// Given a drop point in a viewport, pick the closest edge and the position
// along it (as a percentage, kept away from the corners).
export function nearestEdge(
  x: number,
  y: number,
  vw: number,
  vh: number,
): { edge: Edge; offset: number } {
  // A tuple rather than an array so the reduce below has something to start
  // from without an index access that could be undefined.
  const candidates: [Candidate, Candidate, Candidate, Candidate] = [
    { edge: 'left', distance: x, offset: (y / vh) * 100 },
    { edge: 'right', distance: vw - x, offset: (y / vh) * 100 },
    { edge: 'top', distance: y, offset: (x / vw) * 100 },
    { edge: 'bottom', distance: vh - y, offset: (x / vw) * 100 },
  ];
  const winner = candidates.reduce((best, candidate) =>
    candidate.distance < best.distance ? candidate : best,
  );
  return {
    edge: winner.edge,
    offset: clamp(winner.offset, OFFSET_MIN, OFFSET_MAX),
  };
}
