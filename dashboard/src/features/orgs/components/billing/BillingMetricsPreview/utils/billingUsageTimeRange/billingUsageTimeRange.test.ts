import {
  type BillingUsageRangeBounds,
  DEFAULT_BILLING_USAGE_TIME_RANGE,
  isBillingUsageCalendarDayDisabled,
  resolveBillingUsageTimeRange,
  validateBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/billingUsageTimeRange';

const bounds: BillingUsageRangeBounds = {
  min: '2026-06-28T00:00:00.000Z',
  max: '2026-08-26T13:37:00.000Z',
  currentBillingCycleStart: '2026-08-01T00:00:00.000Z',
};

describe('billingUsageTimeRange', () => {
  it('defaults to the current billing cycle capped at the latest report', () => {
    expect(
      resolveBillingUsageTimeRange(DEFAULT_BILLING_USAGE_TIME_RANGE, bounds),
    ).toEqual({
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-08-26T13:37:00.000Z'),
    });
  });

  it('resolves retained rolling presets without exceeding the bounds', () => {
    expect(
      resolveBillingUsageTimeRange({ kind: 'preset', preset: '7d' }, bounds)
        .from,
    ).toEqual(new Date('2026-08-20T00:00:00.000Z'));
    expect(
      resolveBillingUsageTimeRange({ kind: 'preset', preset: '60d' }, bounds)
        .from,
    ).toEqual(new Date(bounds.min));
  });

  it('rejects future, expired, inverted, and overlong custom ranges', () => {
    expect(
      validateBillingUsageTimeRange(
        {
          kind: 'absolute',
          from: '2026-08-01T00:00:00.000Z',
          to: '2026-08-27T00:00:00.000Z',
        },
        bounds,
      ),
    ).toMatch(/future/);
    expect(
      validateBillingUsageTimeRange(
        {
          kind: 'absolute',
          from: '2026-06-27T00:00:00.000Z',
          to: '2026-08-01T00:00:00.000Z',
        },
        bounds,
      ),
    ).toMatch(/retained/);
    expect(
      validateBillingUsageTimeRange(
        {
          kind: 'absolute',
          from: '2026-08-20T00:00:00.000Z',
          to: '2026-08-19T00:00:00.000Z',
        },
        bounds,
      ),
    ).toMatch(/earlier/);
  });

  it('disables calendar days outside the retained, non-future bounds', () => {
    expect(
      isBillingUsageCalendarDayDisabled(
        new Date('2026-06-27T12:00:00.000Z'),
        bounds,
      ),
    ).toBe(true);
    expect(
      isBillingUsageCalendarDayDisabled(
        new Date('2026-08-10T12:00:00.000Z'),
        bounds,
      ),
    ).toBe(false);
    expect(
      isBillingUsageCalendarDayDisabled(
        new Date('2026-08-27T00:00:00.000Z'),
        bounds,
      ),
    ).toBe(true);
  });
});
