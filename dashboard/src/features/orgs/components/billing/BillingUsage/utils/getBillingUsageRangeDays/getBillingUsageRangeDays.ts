import { tz } from '@date-fns/tz';
import { addDays, startOfDay, subDays } from 'date-fns';
import type { ResolvedBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/types';
import { isBillingUsageBucketInRange } from '@/features/orgs/components/billing/BillingUsage/utils/isBillingUsageBucketInRange';
import { toBillingUsageBucket } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBucket';

// The first and last day whose bars a range shows. A range that starts or
// ends when a billing cycle does can do so during a day, whose bar is on the
// other side of the boundary. An empty range shows its first day only.
export default function getBillingUsageRangeDays(
  range: ResolvedBillingUsageTimeRange,
  timeZone: string,
  currentBillingCycleEnd: string,
): { first: Date; last: Date } {
  const inZone = { in: tz(timeZone) };
  const isShown = (day: Date) =>
    isBillingUsageBucketInRange(
      toBillingUsageBucket(day, timeZone, currentBillingCycleEnd),
      range,
    );

  const firstCandidate = startOfDay(range.from, inZone);
  const first = isShown(firstCandidate)
    ? firstCandidate
    : addDays(firstCandidate, 1, inZone);
  const lastCandidate = startOfDay(range.to.getTime() - 1, inZone);
  const last = isShown(lastCandidate)
    ? lastCandidate
    : subDays(lastCandidate, 1, inZone);

  return { first, last: last < first ? first : last };
}
