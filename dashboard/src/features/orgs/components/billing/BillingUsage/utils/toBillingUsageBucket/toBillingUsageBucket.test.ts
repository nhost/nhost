import { TZDate } from '@date-fns/tz';
import toBillingUsageBucket from './toBillingUsageBucket';

const SEPTEMBER = 8;
const OCTOBER = 9;

function bucketOf(timeZone: string, month: number, day: number) {
  const { start, end } = toBillingUsageBucket(
    new TZDate(2026, month, day, timeZone),
    timeZone,
    '2026-11-01T00:00:00.000Z',
  );
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}

describe('toBillingUsageBucket', () => {
  it('covers the whole day when no billing cycle starts during it', () => {
    expect(bucketOf('UTC', OCTOBER, 15)).toEqual({
      start: '2026-10-15T00:00:00.000Z',
      end: '2026-10-16T00:00:00.000Z',
    });
  });

  it('ends the day when a billing cycle starts in its second half', () => {
    expect(bucketOf('America/Los_Angeles', SEPTEMBER, 30)).toEqual({
      start: '2026-09-30T07:00:00.000Z',
      end: '2026-10-01T00:00:00.000Z',
    });
  });

  it('starts the day when a billing cycle starts in its first half', () => {
    expect(bucketOf('Europe/London', OCTOBER, 1)).toEqual({
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-10-01T23:00:00.000Z',
    });
  });
});
