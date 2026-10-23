import { TZDate } from '@date-fns/tz';
import isBillingUsageCalendarDayDisabled from './isBillingUsageCalendarDayDisabled';

const BOUNDS = {
  min: '2026-08-22T00:00:00.000Z',
  max: '2026-10-20T13:00:00.000Z',
  currentBillingCycleStart: '2026-10-01T00:00:00.000Z',
};

describe('isBillingUsageCalendarDayDisabled', () => {
  it.each([
    [
      'enables Aug 22 in Tokyo, the first retained day',
      22,
      'Asia/Tokyo',
      false,
    ],
    [
      'enables Aug 21 in Los Angeles, whose evening is retained',
      21,
      'America/Los_Angeles',
      false,
    ],
    [
      'disables Aug 21 in Tokyo, before the retained reports',
      21,
      'Asia/Tokyo',
      true,
    ],
  ])('%s', (_description, day, timeZone, disabled) => {
    expect(
      isBillingUsageCalendarDayDisabled(
        new TZDate(2026, 7, day, timeZone),
        BOUNDS,
      ),
    ).toBe(disabled);
  });
});
