import validateBillingUsageTimeRange from './validateBillingUsageTimeRange';

const BOUNDS = {
  min: '2026-08-02T00:00:00.000Z',
  max: '2026-09-30T20:00:00.000Z',
  currentBillingCycleStart: '2026-10-01T00:00:00.000Z',
};

describe('validateBillingUsageTimeRange', () => {
  it('accepts the current billing cycle before its first report', () => {
    expect(
      validateBillingUsageTimeRange(
        { kind: 'preset', preset: 'currentBillingCycle' },
        BOUNDS,
      ),
    ).toBeUndefined();
  });

  it('rejects a custom range that starts before the retained reports', () => {
    expect(
      validateBillingUsageTimeRange(
        {
          kind: 'absolute',
          from: '2026-08-01T00:00:00.000Z',
          to: '2026-08-10T00:00:00.000Z',
        },
        BOUNDS,
      ),
    ).toBe('Usage reports are retained for at most 60 days.');
  });
});
