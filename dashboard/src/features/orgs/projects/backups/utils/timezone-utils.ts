import dayjs from '@/lib/dayjs';
import { isEmptyValue } from '@/lib/utils';
import timezones from 'timezones-list';

// TODO: Remove this once typescript has been updated to v5
declare namespace Intl {
  type Key =
    | 'calendar'
    | 'collation'
    | 'currency'
    | 'numberingSystem'
    | 'timeZone'
    | 'unit';

  function supportedValuesOf(input: Key): string[];
}

export const UTC_GMT_TIMEZONE = {
  label: 'UTC, GMT (UTC+00:00)',
  value: 'UTC',
  key: 'UTC',
};

function convertUTCOffsetToStrings(offset: number): string {
  const sign = offset >= 0 ? '+' : '-';

  const absOffsetMinutes = Math.abs(offset);

  const hours = Math.floor(absOffsetMinutes / 60);
  const minutes = absOffsetMinutes % 60;

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  return `${sign}${formattedHours}:${formattedMinutes}`;
}

export function createTimezoneOptions(dateTime: string) {
  const validTimezones = new Set(Intl.supportedValuesOf('timeZone'));

  const dayjsInstance = dayjs(dateTime);

  const timeZoneOptions = timezones
    .filter((tz) => validTimezones.has(tz.tzCode))
    .map((tz) => {
      const utcOffset = convertUTCOffsetToStrings(
        dayjsInstance.tz(tz.tzCode).utcOffset(),
      );

      return {
        label: `${tz.tzCode} (UTC${utcOffset})`,
        value: tz.tzCode,
        key: tz.tzCode,
      };
    });

  const browserTimezone = dayjs.tz.guess();

  const browserTimezoneOffset = convertUTCOffsetToStrings(
    dayjsInstance.tz(browserTimezone).utcOffset(),
  );
  const browserTimezoneOption = {
    label: `Browser time (UTC${browserTimezoneOffset})`,
    value: browserTimezone,
    key: 'browserTime',
  };

  return [UTC_GMT_TIMEZONE, browserTimezoneOption, ...timeZoneOptions];
}

export function getDateTimeStringWithUTCOffset(
  dateTime: string | undefined,
  timezone: string,
) {
  if (isEmptyValue(dateTime)) {
    return '';
  }

  const dateTimeInTimezone = dayjs(dateTime).tz(timezone);
  const utcOffset = convertUTCOffsetToStrings(dateTimeInTimezone.utcOffset());
  const dateTimeStr = dateTimeInTimezone.format('DD MMM YYYY, HH:mm:ss');

  return `${dateTimeStr} (UTC${utcOffset})`;
}
