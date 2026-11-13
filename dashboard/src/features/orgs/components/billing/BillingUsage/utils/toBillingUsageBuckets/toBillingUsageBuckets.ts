import { tz } from '@date-fns/tz';
import { addDays, startOfDay } from 'date-fns';
import type {
  BillingUsageBucket,
  BillingUsagePeriod,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { toBillingUsageBucket } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBucket';

// One bucket per day of the period in the page's time zone.
export default function toBillingUsageBuckets(
  { periodStart, periodEnd }: BillingUsagePeriod,
  timeZone: string,
  currentBillingCycleEnd: string,
): BillingUsageBucket[] {
  const inZone = { in: tz(timeZone) };
  const end = new Date(periodEnd).getTime();
  const buckets: BillingUsageBucket[] = [];

  for (
    let day = startOfDay(periodStart, inZone);
    day.getTime() < end;
    day = addDays(day, 1, inZone)
  ) {
    buckets.push(toBillingUsageBucket(day, timeZone, currentBillingCycleEnd));
  }

  return buckets;
}
