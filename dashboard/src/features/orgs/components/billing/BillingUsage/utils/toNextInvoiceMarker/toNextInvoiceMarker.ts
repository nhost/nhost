import { tz } from '@date-fns/tz';
import { addDays, format } from 'date-fns';
import { toBillingUsageBucket } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBucket';
import type { StackedBarReferenceLine } from '@/features/orgs/projects/common/metrics/components/StackedBarMetricChart/types';

// The marker sits between the current cycle's last bar and the next one's
// first, at the midnight that starts the next cycle's first day in the page's
// time zone. When the next cycle starts at another time, the label says when.
export default function toNextInvoiceMarker(
  currentBillingCycleEnd: string,
  timeZone: string,
): StackedBarReferenceLine {
  const inZone = { in: tz(timeZone) };
  const cycleEnd = new Date(currentBillingCycleEnd).getTime();
  const bucket = toBillingUsageBucket(
    cycleEnd,
    timeZone,
    currentBillingCycleEnd,
  );
  const firstDay =
    bucket.cycleStart === cycleEnd
      ? bucket.day
      : addDays(bucket.day, 1, inZone).getTime();
  const label =
    firstDay === cycleEnd
      ? format(cycleEnd, 'MMM d', inZone)
      : format(cycleEnd, 'MMM d, h:mm a', inZone);
  return { value: firstDay, label: `Next invoice · ${label}` };
}
