import { tz } from '@date-fns/tz';
import { format } from 'date-fns';

export default function formatBillingDayTick(
  timestamp: number,
  timeZone: string,
): string {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  return format(timestamp, 'MMM d', { in: tz(timeZone) });
}
