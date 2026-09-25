import {
  type BillingUsageRangeBounds,
  DEFAULT_BILLING_USAGE_TIME_RANGE,
  isBillingUsageCalendarDayDisabled,
  resolveBillingUsageTimeRange,
  toBillingUsageTimeAxis,
  validateBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/billingUsageTimeRange';

const bounds: BillingUsageRangeBounds = {
  min: '2026-06-28T00:00:00.000Z',
  max: '2026-08-26T13:37:00.000Z',
  currentBillingCycleStart: '2026-08-01T00:00:00.000Z',
};

const CURRENT_CYCLE_END = '2026-09-01T00:00:00.000Z';

function utc(iso: string): number {
  return new Date(iso).getTime();
}

describe('toBillingUsageTimeAxis', () => {
  it('pads rolling ranges by half a day so the edge bars are fully drawn', () => {
    const range = { kind: 'preset', preset: '30d' } as const;

    const axis = toBillingUsageTimeAxis(
      range,
      resolveBillingUsageTimeRange(range, bounds),
      CURRENT_CYCLE_END,
    );

    expect(axis.domain).toEqual([
      utc('2026-07-27T12:00:00.000Z'),
      utc('2026-08-26T12:00:00.000Z'),
    ]);
    expect(axis.ticks).toEqual([
      utc('2026-07-28T00:00:00.000Z'),
      utc('2026-08-04T00:00:00.000Z'),
      utc('2026-08-11T00:00:00.000Z'),
      utc('2026-08-18T00:00:00.000Z'),
      utc('2026-08-26T00:00:00.000Z'),
    ]);
  });

  it('extends the current billing cycle past the next invoice date', () => {
    const axis = toBillingUsageTimeAxis(
      DEFAULT_BILLING_USAGE_TIME_RANGE,
      resolveBillingUsageTimeRange(DEFAULT_BILLING_USAGE_TIME_RANGE, bounds),
      CURRENT_CYCLE_END,
    );

    expect(axis.domain).toEqual([
      utc('2026-07-31T12:00:00.000Z'),
      utc('2026-09-03T12:00:00.000Z'),
    ]);
    expect(axis.ticks).toEqual([
      utc('2026-08-01T00:00:00.000Z'),
      utc('2026-08-08T00:00:00.000Z'),
      utc('2026-08-15T00:00:00.000Z'),
      utc('2026-08-22T00:00:00.000Z'),
      utc('2026-08-29T00:00:00.000Z'),
      utc('2026-09-03T00:00:00.000Z'),
    ]);
  });

  it('aligns custom ranges to whole UTC days and keeps both end ticks', () => {
    const range = {
      kind: 'absolute',
      from: '2026-08-10T05:00:00.000Z',
      to: '2026-08-12T00:00:00.000Z',
    } as const;

    const axis = toBillingUsageTimeAxis(
      range,
      resolveBillingUsageTimeRange(range, bounds),
      CURRENT_CYCLE_END,
    );

    expect(axis.domain).toEqual([
      utc('2026-08-09T12:00:00.000Z'),
      utc('2026-08-12T12:00:00.000Z'),
    ]);
    expect(axis.ticks).toEqual([
      utc('2026-08-10T00:00:00.000Z'),
      utc('2026-08-12T00:00:00.000Z'),
    ]);
  });
});

describe('billingUsageTimeRange', () => {
  it('defaults to the current billing cycle capped at the latest report', () => {
    expect(
      resolveBillingUsageTimeRange(DEFAULT_BILLING_USAGE_TIME_RANGE, bounds),
    ).toEqual({
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-08-26T13:37:00.000Z'),
    });
  });

  it('clamps the current billing cycle to the retained history', () => {
    expect(
      resolveBillingUsageTimeRange(DEFAULT_BILLING_USAGE_TIME_RANGE, {
        ...bounds,
        min: '2026-08-05T00:00:00.000Z',
      }).from,
    ).toEqual(new Date('2026-08-05T00:00:00.000Z'));
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
