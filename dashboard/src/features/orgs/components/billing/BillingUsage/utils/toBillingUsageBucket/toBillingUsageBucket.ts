import { tz } from '@date-fns/tz';
import { addDays, startOfDay, subDays } from 'date-fns';
import type { BillingUsageBucket } from '@/features/orgs/components/billing/BillingUsage/types';
import { getBillingCycle } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingCycle';

export default function toBillingUsageBucket(
  day: Date | number,
  timeZone: string,
  currentBillingCycleEnd: string,
): BillingUsageBucket {
  const inZone = { in: tz(timeZone) };
  const dayStart = startOfDay(day, inZone).getTime();
  const nextDay = addDays(dayStart, 1, inZone).getTime();
  const middle = (dayStart + nextDay) / 2;
  const previousMiddle =
    (subDays(dayStart, 1, inZone).getTime() + dayStart) / 2;
  const nextMiddle = (nextDay + addDays(nextDay, 1, inZone).getTime()) / 2;
  const cycle = getBillingCycle(middle, currentBillingCycleEnd);

  return {
    day: dayStart,
    start: cycle.start > previousMiddle ? cycle.start : dayStart,
    end: cycle.end <= nextMiddle ? cycle.end : nextDay,
    cycleStart: cycle.start,
    timestamp: middle,
  };
}
