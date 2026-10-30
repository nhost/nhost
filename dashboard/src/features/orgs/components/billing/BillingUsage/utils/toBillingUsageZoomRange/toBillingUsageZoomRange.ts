import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import type {
  BillingUsageRangeBounds,
  BillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';

// The days, in the page's time zone, from the one holding `first` to the one
// holding `last`, kept within the retained reports.
export default function toBillingUsageZoomRange(
  first: number,
  last: number,
  bounds: BillingUsageRangeBounds,
  timeZone: string,
): BillingUsageTimeRange | undefined {
  const inZone = { in: tz(timeZone) };
  const from = Math.max(first, new Date(bounds.min).getTime());
  const to = Math.min(last, new Date(bounds.max).getTime() - 1);
  if (from > to) {
    return undefined;
  }
  return {
    kind: 'absolute',
    from: format(from, 'yyyy-MM-dd', inZone),
    to: format(to, 'yyyy-MM-dd', inZone),
  };
}
