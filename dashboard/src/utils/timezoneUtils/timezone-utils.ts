import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns-v4';
import timezones from 'timezones-list';

export const UTC_GMT_TIMEZONE = {
  label: 'UTC, GMT (UTC+00:00)',
  value: 'UTC',
  key: 'UTC',
};

export function guessTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getUTCOffsetInHours(
  timezone: string,
  dateTime: string,
  dateFormat = '(OOOO)',
) {
  const date = new TZDate(dateTime, timezone);
  return format(date, dateFormat).replace('GMT', 'UTC');
}

export function createTimezoneOptions(dateTime: string) {
  const validTimezones = new Set(Intl.supportedValuesOf('timeZone'));

  const timeZoneOptions = timezones
    .filter((tz) => validTimezones.has(tz.tzCode))
    .map((tz) => {
      const utcOffset = getUTCOffsetInHours(tz.tzCode, dateTime);

      return {
        label: `${tz.tzCode} ${utcOffset}`,
        value: tz.tzCode,
        key: tz.tzCode,
      };
    });

  const browserTimezone = guessTimezone();

  const browserTimezoneOffset = getUTCOffsetInHours(browserTimezone, dateTime);

  const browserTimezoneOption = {
    label: `Browser time ${browserTimezoneOffset}`,
    value: browserTimezone,
    key: 'browserTime',
  };

  return [UTC_GMT_TIMEZONE, browserTimezoneOption, ...timeZoneOptions];
}
