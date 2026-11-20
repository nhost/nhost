import toBillingUsageZoomOutRange from './toBillingUsageZoomOutRange';

// Aug 22 to Oct 20 in UTC.
const BOUNDS = {
  min: '2026-08-22T00:00:00.000Z',
  max: '2026-10-21T00:00:00.000Z',
  currentBillingCycle: {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-11-01T00:00:00.000Z',
  },
};

describe('toBillingUsageZoomOutRange', () => {
  it('keeps a range that already covers the retained reports', () => {
    const range = { kind: 'preset', preset: '60d' } as const;

    expect(toBillingUsageZoomOutRange(range, BOUNDS, 'UTC')).toBe(range);
  });

  it('doubles a range around its midpoint in whole days', () => {
    expect(
      toBillingUsageZoomOutRange(
        { kind: 'absolute', from: '2026-09-10', to: '2026-09-11' },
        BOUNDS,
        'UTC',
      ),
    ).toEqual({ kind: 'absolute', from: '2026-09-09', to: '2026-09-12' });
  });

  it('widens the whole current billing cycle, not only its reported days', () => {
    expect(
      toBillingUsageZoomOutRange(
        { kind: 'preset', preset: 'currentBillingCycle' },
        {
          ...BOUNDS,
          min: '2026-08-07T00:00:00.000Z',
          max: '2026-10-06T00:00:00.000Z',
        },
        'UTC',
      ),
    ).toEqual({ kind: 'absolute', from: '2026-08-07', to: '2026-10-05' });
  });
});
