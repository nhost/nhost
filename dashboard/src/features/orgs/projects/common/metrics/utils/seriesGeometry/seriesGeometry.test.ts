import type { ScaleFunction } from 'recharts';
import {
  distanceSqPointToSegment,
  distanceSqToSeries,
  pixelAt,
  type Row,
} from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';

// jsdom has no chart, so stub the recharts scales with simple pixel mappings.
const identityScale = ((v: number) => v) as unknown as ScaleFunction;
const nanScale = (() => Number.NaN) as unknown as ScaleFunction;

describe('distanceSqPointToSegment', () => {
  it('projects onto the interior of a segment', () => {
    // (5,3) projects to (5,0) on segment (0,0)-(10,0): 3^2 = 9.
    expect(distanceSqPointToSegment(5, 3, 0, 0, 10, 0)).toBe(9);
  });

  it('returns 0 for a point lying on the segment', () => {
    expect(distanceSqPointToSegment(5, 0, 0, 0, 10, 0)).toBe(0);
  });

  it('clamps to the start endpoint when the projection falls before it (t < 0)', () => {
    // (-4,3) clamps to (0,0): 4^2 + 3^2 = 25.
    expect(distanceSqPointToSegment(-4, 3, 0, 0, 10, 0)).toBe(25);
  });

  it('clamps to the end endpoint when the projection falls past it (t > 1)', () => {
    // (14,3) clamps to (10,0): 4^2 + 3^2 = 25.
    expect(distanceSqPointToSegment(14, 3, 0, 0, 10, 0)).toBe(25);
  });

  it('handles a degenerate zero-length segment', () => {
    // Both endpoints at (5,5); distance from (8,9) is 3^2 + 4^2 = 25.
    expect(distanceSqPointToSegment(8, 9, 5, 5, 5, 5)).toBe(25);
  });
});

describe('pixelAt', () => {
  it('maps a numeric datapoint through the scales', () => {
    const row: Row = { timestamp: 100, a: 5 };
    expect(pixelAt(row, 'a', identityScale, identityScale)).toEqual({
      x: 100,
      y: 5,
    });
  });

  it('returns null for a null datapoint', () => {
    const row: Row = { timestamp: 100, a: null };
    expect(pixelAt(row, 'a', identityScale, identityScale)).toBeNull();
  });

  it('returns null when the series key is absent from the row', () => {
    const row: Row = { timestamp: 100, a: 5 };
    expect(pixelAt(row, 'missing', identityScale, identityScale)).toBeNull();
  });

  it('returns null when a scale yields a non-finite pixel', () => {
    const row: Row = { timestamp: 100, a: 5 };
    expect(pixelAt(row, 'a', identityScale, nanScale)).toBeNull();
  });
});

describe('distanceSqToSeries', () => {
  it('returns POSITIVE_INFINITY for a single-point series', () => {
    const rows: Row[] = [{ timestamp: 0, a: 1 }];
    expect(
      distanceSqToSeries('a', 0, 0, rows, identityScale, identityScale),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns POSITIVE_INFINITY when no segment has two plottable points', () => {
    // The only segment touches a null endpoint, so it is skipped.
    const rows: Row[] = [
      { timestamp: 0, a: null },
      { timestamp: 10, a: 5 },
    ];
    expect(
      distanceSqToSeries('a', 0, 0, rows, identityScale, identityScale),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns the minimum squared distance across all segments', () => {
    // Flat line y=0 from x=0 to x=20; cursor (5,4) is nearest the first
    // segment at (5,0), giving 4^2 = 16 (the second segment is farther).
    const rows: Row[] = [
      { timestamp: 0, a: 0 },
      { timestamp: 10, a: 0 },
      { timestamp: 20, a: 0 },
    ];
    expect(
      distanceSqToSeries('a', 5, 4, rows, identityScale, identityScale),
    ).toBe(16);
  });
});
