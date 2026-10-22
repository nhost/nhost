import type {
  BillingUsageRangeBounds,
  BillingUsageRangePreset,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { previousBillingCycleStart } from '@/features/orgs/components/billing/BillingUsage/utils/previousBillingCycleStart';

const CYCLE_MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  year: 'numeric',
});

// Names the UTC calendar month a billing-cycle preset covers, e.g. "Sep 2026".
export default function getBillingUsagePresetCycleMonth(
  preset: BillingUsageRangePreset,
  bounds: BillingUsageRangeBounds,
): string | undefined {
  switch (preset) {
    case 'currentBillingCycle':
      return CYCLE_MONTH_FORMAT.format(
        new Date(bounds.currentBillingCycleStart),
      );
    case 'previousBillingCycle':
      return CYCLE_MONTH_FORMAT.format(
        new Date(previousBillingCycleStart(bounds.currentBillingCycleStart)),
      );
    default:
      return undefined;
  }
}
