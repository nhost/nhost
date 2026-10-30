import type { BillingUsageRangeBounds } from '@/features/orgs/components/billing/BillingUsage/types';
import getBillingUsagePresetCycleLabel from './getBillingUsagePresetCycleLabel';

function boundsFor(
  start: string,
  end: string,
  min = '2026-08-07T00:00:00.000Z',
): BillingUsageRangeBounds {
  return {
    min,
    max: '2026-10-05T10:00:00.000Z',
    currentBillingCycle: { start, end },
  };
}

const OCTOBER_BOUNDS = boundsFor(
  '2026-10-01T00:00:00.000Z',
  '2026-11-01T00:00:00.000Z',
);

describe('getBillingUsagePresetCycleLabel', () => {
  it('names the months of cycles that start with one', () => {
    expect(
      getBillingUsagePresetCycleLabel(
        'currentBillingCycle',
        OCTOBER_BOUNDS,
        'UTC',
      ),
    ).toBe('Oct 2026');
    expect(
      getBillingUsagePresetCycleLabel(
        'previousBillingCycle',
        OCTOBER_BOUNDS,
        'UTC',
      ),
    ).toBe('Sep 2026');
    expect(
      getBillingUsagePresetCycleLabel('30d', OCTOBER_BOUNDS, 'UTC'),
    ).toBeUndefined();
  });

  it('names the days of cycles that start during a month', () => {
    const bounds = boundsFor(
      '2026-09-30T23:00:00.000Z',
      '2026-10-30T23:00:00.000Z',
    );

    expect(
      getBillingUsagePresetCycleLabel('currentBillingCycle', bounds, 'UTC'),
    ).toBe('Sep 30 – Oct 30');
    expect(
      getBillingUsagePresetCycleLabel('previousBillingCycle', bounds, 'UTC'),
    ).toBe('Aug 30 – Sep 30');
  });

  it('marks a cycle that starts before the oldest reports as partial, from their first day', () => {
    // On Aug 31 in Madrid, the reports go back to Jul 3, and the previous
    // cycle started on Jul 1.
    const bounds = boundsFor(
      '2026-08-01T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
      '2026-07-02T22:00:00.000Z',
    );

    expect(
      getBillingUsagePresetCycleLabel(
        'previousBillingCycle',
        bounds,
        'Europe/Madrid',
      ),
    ).toBe('Jul 3 – Aug 1 (partial)');
    expect(
      getBillingUsagePresetCycleLabel(
        'currentBillingCycle',
        bounds,
        'Europe/Madrid',
      ),
    ).toBe('Aug 2026');
  });
});
