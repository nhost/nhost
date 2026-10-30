import { BILLING_USAGE_RETENTION_MESSAGE } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingUsageRangeBounds,
  BillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { resolveBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/utils/resolveBillingUsageTimeRange';

export default function validateBillingUsageTimeRange(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
): string | undefined {
  // Presets are built from the retained reports, so they are always valid,
  // even for a current cycle with no reports yet.
  if (range.kind === 'preset') {
    return undefined;
  }

  const { from, to } = resolveBillingUsageTimeRange(range, bounds);
  const min = new Date(bounds.min);
  const max = new Date(bounds.max);
  const fromTime = from.getTime();
  const toTime = to.getTime();

  if (fromTime >= toTime) {
    return '“From” must be earlier than “To”.';
  }
  if (fromTime < min.getTime()) {
    return BILLING_USAGE_RETENTION_MESSAGE;
  }
  if (toTime > max.getTime()) {
    return 'The range ends after the latest usage report.';
  }
  return undefined;
}
