import { afterEach, describe, expect, it } from 'vitest';
import { clamp, nearestEdge, OFFSET_MAX, OFFSET_MIN } from './snap';
import { isLocalBackend, localServiceUrls } from './useToolbarSettings';

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

describe('localServiceUrls', () => {
  it('builds the local nhost.run URLs for each service', () => {
    expect(localServiceUrls()).toEqual({
      dashboard: 'https://local.dashboard.local.nhost.run',
      mailhog: 'https://local.mailhog.local.nhost.run',
    });
  });
});

// Everything the toolbar links to belongs to `nhost up`, so a development
// build pointed at a deployed backend must not show it: those hostnames do not
// resolve there.
describe('isLocalBackend', () => {
  const region = process.env['NEXT_PUBLIC_NHOST_REGION'];

  afterEach(() => {
    process.env['NEXT_PUBLIC_NHOST_REGION'] = region;
  });

  it('is true for the local stack, including when nothing is set', () => {
    process.env['NEXT_PUBLIC_NHOST_REGION'] = 'local';
    expect(isLocalBackend()).toBe(true);

    process.env['NEXT_PUBLIC_NHOST_REGION'] = '';
    expect(isLocalBackend()).toBe(true);
  });

  it('is false for a real region', () => {
    process.env['NEXT_PUBLIC_NHOST_REGION'] = 'eu-central-1';
    expect(isLocalBackend()).toBe(false);
  });
});
