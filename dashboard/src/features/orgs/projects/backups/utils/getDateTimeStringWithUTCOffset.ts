import { isEmptyValue } from '@/lib/utils';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns-v4';

// This is the only one that is related to the feature
export function getDateTimeStringWithUTCOffset(
  dateTime: string | undefined,
  timezone: string,
) {
  if (isEmptyValue(dateTime)) {
    return '';
  }

  const date = new TZDate(dateTime, timezone);

  return format(date, 'dd MMM yyyy, HH:mm:ss (OOOO)').replace('GMT', 'UTC');
}
