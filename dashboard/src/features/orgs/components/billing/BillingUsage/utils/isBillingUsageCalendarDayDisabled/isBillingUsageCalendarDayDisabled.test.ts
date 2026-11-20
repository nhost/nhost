import { TZDate } from '@date-fns/tz';
import isBillingUsageCalendarDayDisabled from './isBillingUsageCalendarDayDisabled';

// Aug 22 to Oct 20 in Tokyo.
const BOUNDS = {
  min: '2026-08-21T15:00:00.000Z',
  max: '2026-10-20T15:00:00.000Z',
  currentBillingCycle: {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-11-01T00:00:00.000Z',
  },
};

describe('isBillingUsageCalendarDayDisabled', () => {
  it.each([
    ['disables Aug 21, before the retained reports', 7, 21, true],
    ['enables Aug 22, the first retained day', 7, 22, false],
    ['enables Oct 20, the day of the latest report', 9, 20, false],
    ['disables Oct 21, after the latest report', 9, 21, true],
  ])('%s', (_description, month, day, disabled) => {
    expect(
      isBillingUsageCalendarDayDisabled(
        new TZDate(2026, month, day, 'Asia/Tokyo'),
        BOUNDS,
        'Asia/Tokyo',
      ),
    ).toBe(disabled);
  });
});
