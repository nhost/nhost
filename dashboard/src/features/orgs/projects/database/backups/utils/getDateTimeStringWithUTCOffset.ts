import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export function getDateTimeStringWithUTCOffset(
  dateTime: string,
  timezone: string,
) {
  const date = new TZDate(dateTime, timezone);

  return format(date, 'dd MMM yyyy, HH:mm:ss (OOOO)').replace('GMT', 'UTC');
}
