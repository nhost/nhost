import { tz } from '@date-fns/tz';
import { startOfDay } from 'date-fns';
import type { BillingUsageRangeBounds } from '@/features/orgs/components/billing/BillingUsage/types';

// The bounds are midnights in the page's time zone, the one the calendar shows.
export default function isBillingUsageCalendarDayDisabled(
  date: Date,
  bounds: BillingUsageRangeBounds,
  timeZone: string,
): boolean {
  const dayStart = startOfDay(date, { in: tz(timeZone) }).getTime();
  return (
    dayStart < new Date(bounds.min).getTime() ||
    dayStart >= new Date(bounds.max).getTime()
  );
}
