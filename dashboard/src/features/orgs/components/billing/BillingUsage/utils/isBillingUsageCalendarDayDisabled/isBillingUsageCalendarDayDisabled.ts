import { addDays, startOfDay } from 'date-fns';
import type { BillingUsageRangeBounds } from '@/features/orgs/components/billing/BillingUsage/types';

// The calendar passes each day as midnight in the time zone it shows, so the
// whole local day is compared with the retained reports, not its UTC day.
export default function isBillingUsageCalendarDayDisabled(
  date: Date,
  bounds: BillingUsageRangeBounds,
): boolean {
  const dayStart = startOfDay(date);
  const nextDayStart = addDays(dayStart, 1);
  return (
    nextDayStart.getTime() <= new Date(bounds.min).getTime() ||
    dayStart.getTime() > new Date(bounds.max).getTime()
  );
}
