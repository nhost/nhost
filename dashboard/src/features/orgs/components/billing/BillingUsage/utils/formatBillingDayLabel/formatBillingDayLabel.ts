import { tz } from '@date-fns/tz';
import { addDays, format, isSameDay } from 'date-fns';
import type { BillingUsageBucket } from '@/features/orgs/components/billing/BillingUsage/types';

export default function formatBillingDayLabel(
  { day, start, end }: BillingUsageBucket,
  timeZone: string,
): string {
  const inZone = { in: tz(timeZone) };
  const label = format(day, 'MMM d, yyyy', inZone);
  const formatTime = (instant: number) =>
    isSameDay(instant, day, inZone)
      ? format(instant, 'h:mm a', inZone)
      : format(instant, 'MMM d, h:mm a', inZone);

  if (start !== day) {
    return `${label}, from ${formatTime(start)}`;
  }
  if (end !== addDays(day, 1, inZone).getTime()) {
    return `${label}, until ${formatTime(end)}`;
  }
  return label;
}
