import type { BillingUsageRangeBounds } from '@/features/orgs/components/billing/BillingUsage/types';
import getBillingUsagePresetCycleMonth from './getBillingUsagePresetCycleMonth';

const OCTOBER_BOUNDS: BillingUsageRangeBounds = {
  min: '2026-08-07T00:00:00.000Z',
  max: '2026-10-05T10:00:00.000Z',
  currentBillingCycleStart: '2026-10-01T00:00:00.000Z',
};

describe('getBillingUsagePresetCycleMonth', () => {
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
});
