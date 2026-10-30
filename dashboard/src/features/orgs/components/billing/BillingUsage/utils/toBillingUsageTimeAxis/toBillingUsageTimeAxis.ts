import { tz } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import type {
  BillingUsageTimeAxis,
  BillingUsageTimeRange,
  ResolvedBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { getBillingUsageRangeDays } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsageRangeDays';

const INVOICE_MARKER_PADDING_DAYS = 2;
const MIN_END_TICK_GAP_DAYS = 3;
// Up to this many days, every day is labelled; above it, every week.
const MAX_DAILY_TICK_DAYS = 14;

// The axis covers whole days in the page's time zone, so bars sit inside the
// plot instead of half behind the axes. Ticks mark the middle of a day, where
// its bar is drawn: every day of a short range, otherwise every week and the
// last day.
export default function toBillingUsageTimeAxis(
  range: BillingUsageTimeRange,
  resolved: ResolvedBillingUsageTimeRange,
  currentBillingCycleEnd: string,
  timeZone: string,
): BillingUsageTimeAxis {
  const inZone = { in: tz(timeZone) };
  const days = getBillingUsageRangeDays(
    resolved,
    timeZone,
    currentBillingCycleEnd,
  );
  const firstDay = days.first;
  // The current cycle's axis runs past its end, so the next invoice shows.
  const lastDay =
    range.kind === 'preset' && range.preset === 'currentBillingCycle'
      ? addDays(
          startOfDay(currentBillingCycleEnd, inZone),
          INVOICE_MARKER_PADDING_DAYS,
          inZone,
        )
      : days.last;

  const dayCount = differenceInCalendarDays(lastDay, firstDay, inZone) + 1;
  const step = dayCount <= MAX_DAILY_TICK_DAYS ? 1 : 7;
  const tickDays: Date[] = [];
  for (let day = firstDay; day < lastDay; day = addDays(day, step, inZone)) {
    tickDays.push(day);
  }
  const lastStepDay = tickDays[tickDays.length - 1];
  if (
    step > 1 &&
    tickDays.length > 1 &&
    differenceInCalendarDays(lastDay, lastStepDay, inZone) <
      MIN_END_TICK_GAP_DAYS
  ) {
    tickDays.pop();
  }

  const middleOfDay = (day: Date) =>
    (day.getTime() + addDays(day, 1, inZone).getTime()) / 2;

  return {
    domain: [firstDay.getTime(), addDays(lastDay, 1, inZone).getTime()],
    ticks: [...tickDays, lastDay].map(middleOfDay),
  };
}
