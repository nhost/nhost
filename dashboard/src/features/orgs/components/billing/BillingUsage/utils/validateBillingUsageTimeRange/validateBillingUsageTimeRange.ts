import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import type {
  BillingUsageRangeBounds,
  BillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { getBillingUsagePresetCycle } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsagePresetCycle';
import { resolveBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/utils/resolveBillingUsageTimeRange';

export default function validateBillingUsageTimeRange(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
  timeZone: string,
): string | undefined {
  // Presets are built from the retained reports, so they are valid even for a
  // current cycle with no reports yet. Only a previous cycle can have none.
  if (range.kind === 'preset') {
    return getBillingUsagePresetCycle(range.preset, bounds)?.hasReports ===
      false
      ? 'There are no usage reports for the previous billing cycle.'
      : undefined;
  }

  // The calendar only picks valid ranges, but a shared link can hold any.
  const { from, to } = resolveBillingUsageTimeRange(range, bounds, timeZone);
  if (from.getTime() >= to.getTime()) {
    return 'The first day must not be after the last day.';
  }
  if (from.getTime() < new Date(bounds.min).getTime()) {
    return `There are no usage reports before ${format(bounds.min, 'MMM d, yyyy', { in: tz(timeZone) })}.`;
  }
  if (to.getTime() > new Date(bounds.max).getTime()) {
    return 'The range ends after the latest usage report.';
  }
  return undefined;
}
