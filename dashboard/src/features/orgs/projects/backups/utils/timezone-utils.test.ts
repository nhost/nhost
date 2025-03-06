import {getDateTimeStringWithUTCOffset} from './timezone-utils';

test.only.each`
  dateTime                  | timezone              | dateInTimezone
  ${'2025-02-27T03:00:06Z'} | ${'America/Dominica'} | ${'26 Feb 2025, 23:00:06 (UTC-04:00)'}
  ${'2025-02-27T03:00:06Z'} | ${'Europe/Helsinki'}  | ${'27 Feb 2025, 05:00:06 (UTC+02:00)'}
  ${'2025-02-27T03:00:06Z'} | ${'Europe/Budapest'}  | ${'27 Feb 2025, 04:00:06 (UTC+01:00)'}
  ${'2025-05-27T03:00:06Z'} | ${'Europe/Budapest'}  | ${'27 May 2025, 05:00:06 (UTC+02:00)'}
  ${'2025-02-27T03:00:06Z'} | ${'UTC'}              | ${'27 Feb 2025, 03:00:06 (UTC+00:00)'}
  ${'2025-02-27T03:00:06Z'} | ${'utc'}              | ${'27 Feb 2025, 03:00:06 (UTC+00:00)'}
  ${'2025-02-27T03:00:06Z'} | ${'GMT'}              | ${'27 Feb 2025, 03:00:06 (UTC+00:00)'}
  ${'2025-02-28T15:00:06Z'} | ${'Pacific/Norfolk'}  | ${'01 Mar 2025, 03:00:06 (UTC+12:00)'}
  ${'2025-08-28T15:00:06Z'} | ${'Pacific/Norfolk'}  | ${'29 Aug 2025, 02:00:06 (UTC+11:00)'}
`(
  'getDateTimeStringWithUTCOffset($dateTime, $timezone) -> $dateInTimezone',
  ({ dateTime, timezone, dateInTimezone }) => {
    expect(getDateTimeStringWithUTCOffset(dateTime, timezone)).toBe(
      dateInTimezone,
    );
  },
);
