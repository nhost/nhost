import type { AccountSession } from '@/screens/account/actions';
import { formatSessionTime, sortSessions } from '@/screens/account/sessions';

describe('sortSessions', () => {
  const sessions: AccountSession[] = [
    { id: 'oldest-000', createdAt: '2026-10-10T08:00:00Z', current: false },
    { id: 'newest-000', createdAt: '2026-10-20T08:00:00Z', current: false },
    { id: 'this-00000', createdAt: '2026-10-01T08:00:00Z', current: true },
  ];

  it('puts this session first, then the most recently signed in', () => {
    expect(sortSessions(sessions).map(({ id }) => id)).toEqual([
      'this-00000',
      'newest-000',
      'oldest-000',
    ]);
  });
});

describe('formatSessionTime', () => {
  it.each([
    ['2026-10-26T12:24:00Z', 'Oct 26th 2026 12:24 PM'],
    ['2026-10-01T00:05:00Z', 'Oct 1st 2026 12:05 AM'],
    ['2026-10-02T09:00:00Z', 'Oct 2nd 2026 9:00 AM'],
    ['2026-10-03T13:00:00Z', 'Oct 3rd 2026 1:00 PM'],
    ['2026-10-11T13:00:00Z', 'Oct 11th 2026 1:00 PM'],
    ['2026-10-12T13:00:00Z', 'Oct 12th 2026 1:00 PM'],
    ['2026-10-13T13:00:00Z', 'Oct 13th 2026 1:00 PM'],
    ['2026-10-22T13:00:00Z', 'Oct 22nd 2026 1:00 PM'],
    ['2026-10-31T23:59:00Z', 'Oct 31st 2026 11:59 PM'],
  ])('reads %s as %s', (iso, expected) => {
    expect(formatSessionTime(iso, 'UTC')).toBe(expected);
  });

  it('uses the given zone', () => {
    expect(formatSessionTime('2026-10-26T12:24:00Z', 'America/New_York')).toBe(
      'Oct 26th 2026 8:24 AM',
    );
  });

  it('reads the time where a date and time format types it as literal, as Hermes on iOS does', () => {
    const real = Intl.DateTimeFormat.prototype.formatToParts;
    const spy = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
      .mockImplementation(function (this: Intl.DateTimeFormat, date) {
        const { year, hour } = this.resolvedOptions();
        return real
          .call(this, date)
          .map((part) =>
            year && hour && ['hour', 'minute', 'dayPeriod'].includes(part.type)
              ? { ...part, type: 'literal' as const }
              : part,
          );
      });
    try {
      expect(formatSessionTime('2026-10-26T12:24:00Z', 'UTC')).toBe(
        'Oct 26th 2026 12:24 PM',
      );
    } finally {
      spy.mockRestore();
    }
  });
});
