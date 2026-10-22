import resolveBillingUsageTimeRange from './resolveBillingUsageTimeRange';

const PREVIOUS_CYCLE = {
  kind: 'preset',
  preset: 'previousBillingCycle',
} as const;

describe('resolveBillingUsageTimeRange', () => {
  it('covers the previous UTC calendar month for the previous billing cycle', () => {
    const resolved = resolveBillingUsageTimeRange(PREVIOUS_CYCLE, {
      min: '2026-08-07T00:00:00.000Z',
      max: '2026-10-05T10:00:00.000Z',
      currentBillingCycleStart: '2026-10-01T00:00:00.000Z',
    });

    expect(resolved.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(resolved.to.toISOString()).toBe('2026-09-30T23:59:59.999Z');
  });

  it('clips the previous billing cycle to the retained reports', () => {
    const resolved = resolveBillingUsageTimeRange(PREVIOUS_CYCLE, {
      min: '2026-07-03T00:00:00.000Z',
      max: '2026-08-31T10:00:00.000Z',
      currentBillingCycleStart: '2026-08-01T00:00:00.000Z',
    });

    expect(resolved.from.toISOString()).toBe('2026-07-03T00:00:00.000Z');
    expect(resolved.to.toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });
});
