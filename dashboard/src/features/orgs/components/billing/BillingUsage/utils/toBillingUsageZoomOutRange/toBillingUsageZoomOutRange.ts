import type {
  BillingUsageRangeBounds,
  BillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { resolveBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/utils/resolveBillingUsageTimeRange';
import { toBillingUsageZoomRange } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageZoomRange';

// Doubles the visible span around its midpoint, like the functions metrics,
// but shifted to stay within the retained reports instead of running past them.
// A range that already covers them is returned as it is.
export default function toBillingUsageZoomOutRange(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
  currentBillingCycleEnd: string,
): BillingUsageTimeRange {
  const { from, to } = resolveBillingUsageTimeRange(range, bounds);
  const min = new Date(bounds.min).getTime();
  const max = new Date(bounds.max).getTime();
  // The current cycle's chart runs to the cycle's end, past the latest report,
  // so zooming out widens the whole cycle, not only the days reported so far.
  const visibleTo =
    range.kind === 'preset' && range.preset === 'currentBillingCycle'
      ? new Date(currentBillingCycleEnd).getTime()
      : to.getTime();
  const currentSpan = visibleTo - from.getTime();
  const span = Math.min(currentSpan * 2, max - min);
  if (span <= currentSpan) {
    return range;
  }
  const midpoint = (from.getTime() + visibleTo) / 2;
  const start = Math.min(Math.max(midpoint - span / 2, min), max - span);
  return toBillingUsageZoomRange(start, start + span, bounds);
}
