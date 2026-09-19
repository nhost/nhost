import { describe, expect, it } from '@jest/globals';
import { clamp, nearestEdge, OFFSET_MAX, OFFSET_MIN } from '../snap';
import { roundedPath } from '../trapezoid';

const VW = 1000;
const VH = 800;

describe('nearestEdge', () => {
  it('snaps to the closest edge', () => {
    expect(nearestEdge(10, 400, VW, VH).edge).toBe('left');
    expect(nearestEdge(990, 400, VW, VH).edge).toBe('right');
    expect(nearestEdge(500, 10, VW, VH).edge).toBe('top');
    expect(nearestEdge(500, 790, VW, VH).edge).toBe('bottom');
  });

  it('reports the position along vertical edges as a percentage of height', () => {
    expect(nearestEdge(990, 400, VW, VH).offset).toBe(50);
  });

  it('reports the position along horizontal edges as a percentage of width', () => {
    expect(nearestEdge(250, 10, VW, VH).offset).toBe(25);
  });

  it('keeps the offset away from the corners', () => {
    expect(nearestEdge(998, 40, VW, VH).offset).toBe(OFFSET_MIN);
    expect(nearestEdge(998, 760, VW, VH).offset).toBe(OFFSET_MAX);
  });
});

describe('clamp', () => {
  it('bounds a value to the given range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('roundedPath', () => {
  it('closes the path it draws', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const path = roundedPath(square, 12);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    // One quadratic per corner, and no NaN reaching the attribute.
    expect(path.match(/Q /g)).toHaveLength(4);
    expect(path).not.toContain('NaN');
  });

  it('never rounds a corner past half of its shorter side', () => {
    const sliver = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ];
    // A radius of 12 on a 6px side would fold the corner through itself; the
    // clamp keeps every control point inside the shape.
    for (const value of roundedPath(sliver, 12).match(/-?\d+(\.\d+)?/g) ?? []) {
      expect(Number(value)).toBeGreaterThanOrEqual(0);
      expect(Number(value)).toBeLessThanOrEqual(6);
    }
  });
});
