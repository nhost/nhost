import toBillingUsageZoomOutRange from './toBillingUsageZoomOutRange';

const BOUNDS = {
  min: '2026-08-22T00:00:00.000Z',
  max: '2026-10-20T13:00:00.000Z',
  currentBillingCycleStart: '2026-10-01T00:00:00.000Z',
};

const CYCLE_END = '2026-11-01T00:00:00.000Z';

describe('toBillingUsageZoomOutRange', () => {
  it('keeps a range that already covers the retained reports', () => {
    const range = { kind: 'preset', preset: '60d' } as const;

    expect(toBillingUsageZoomOutRange(range, BOUNDS, CYCLE_END)).toBe(range);
  });

  it('doubles a range around its midpoint in whole UTC days', () => {
    expect(
      toBillingUsageZoomOutRange(
        {
          kind: 'absolute',
          from: '2026-09-10T00:00:00.000Z',
          to: '2026-09-11T23:59:59.999Z',
        },
        BOUNDS,
        CYCLE_END,
      ),
    ).toEqual({
      kind: 'absolute',
      from: '2026-09-09T00:00:00.000Z',
      to: '2026-09-12T23:59:59.999Z',
    });
  });

  it('widens the whole current billing cycle, not only its reported days', () => {
    expect(
      toBillingUsageZoomOutRange(
        { kind: 'preset', preset: 'currentBillingCycle' },
        {
          ...BOUNDS,
          min: '2026-08-07T00:00:00.000Z',
          max: '2026-10-05T12:00:00.000Z',
        },
        CYCLE_END,
      ),
    ).toEqual({
      kind: 'absolute',
      from: '2026-08-07T00:00:00.000Z',
      to: '2026-10-05T12:00:00.000Z',
    });
  });
});
