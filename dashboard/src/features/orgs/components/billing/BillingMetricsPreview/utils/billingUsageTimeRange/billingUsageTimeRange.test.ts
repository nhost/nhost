import {
  type BillingUsageRangeBounds,
  getBillingUsagePresetCycleMonth,
  resolveBillingUsageTimeRange,
  toBillingUsageTimeAxis,
  validateBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/billingUsageTimeRange';

const PREVIOUS_CYCLE = {
  kind: 'preset',
  preset: 'previousBillingCycle',
} as const;

const OCTOBER_BOUNDS: BillingUsageRangeBounds = {
  min: '2026-08-07T00:00:00.000Z',
  max: '2026-10-05T10:00:00.000Z',
  currentBillingCycleStart: '2026-10-01T00:00:00.000Z',
};

describe('previous billing cycle range', () => {
  it('covers the previous UTC calendar month', () => {
    const resolved = resolveBillingUsageTimeRange(
      PREVIOUS_CYCLE,
      OCTOBER_BOUNDS,
    );

    expect(resolved.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(resolved.to.toISOString()).toBe('2026-09-30T23:59:59.999Z');
    expect(
      validateBillingUsageTimeRange(PREVIOUS_CYCLE, OCTOBER_BOUNDS),
    ).toBeUndefined();
  });

  it('is clipped to the retained reports', () => {
    const bounds: BillingUsageRangeBounds = {
      min: '2026-07-03T00:00:00.000Z',
      max: '2026-08-31T10:00:00.000Z',
      currentBillingCycleStart: '2026-08-01T00:00:00.000Z',
    };

    const resolved = resolveBillingUsageTimeRange(PREVIOUS_CYCLE, bounds);

    expect(resolved.from.toISOString()).toBe('2026-07-03T00:00:00.000Z');
    expect(resolved.to.toISOString()).toBe('2026-07-31T23:59:59.999Z');
    expect(
      validateBillingUsageTimeRange(PREVIOUS_CYCLE, bounds),
    ).toBeUndefined();
  });

  it('ends its time axis on the last day of the cycle', () => {
    const resolved = resolveBillingUsageTimeRange(
      PREVIOUS_CYCLE,
      OCTOBER_BOUNDS,
    );

    const axis = toBillingUsageTimeAxis(
      PREVIOUS_CYCLE,
      resolved,
      '2026-11-01T00:00:00.000Z',
    );

    expect(axis.ticks[0]).toBe(Date.UTC(2026, 8, 1));
    expect(axis.ticks[axis.ticks.length - 1]).toBe(Date.UTC(2026, 8, 30));
  });
});

describe('billing cycle preset months', () => {
  it('names the months of the billing-cycle presets', () => {
    expect(
      getBillingUsagePresetCycleMonth('currentBillingCycle', OCTOBER_BOUNDS),
    ).toBe('Oct 2026');
    expect(
      getBillingUsagePresetCycleMonth('previousBillingCycle', OCTOBER_BOUNDS),
    ).toBe('Sep 2026');
    expect(
      getBillingUsagePresetCycleMonth('30d', OCTOBER_BOUNDS),
    ).toBeUndefined();
  });

  it('wraps the previous cycle into the prior year in January', () => {
    expect(
      getBillingUsagePresetCycleMonth('previousBillingCycle', {
        ...OCTOBER_BOUNDS,
        currentBillingCycleStart: '2027-01-01T00:00:00.000Z',
      }),
    ).toBe('Dec 2026');
  });
});
