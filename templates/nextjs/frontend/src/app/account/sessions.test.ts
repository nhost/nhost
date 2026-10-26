import { describe, expect, it } from 'vitest';
import type { AccountSession } from '@/app/account/actions';
import { formatSessionTime, summarizeSessions } from '@/app/account/sessions';

const chromeOnMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const safariOnIphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('formatSessionTime', () => {
  it.each([
    ['2026-10-26T12:24:00Z', 'Oct 26th 2026 12:24'],
    ['2026-10-01T09:05:00Z', 'Oct 1st 2026 09:05'],
    ['2026-10-22T00:00:00Z', 'Oct 22nd 2026 00:00'],
    ['2026-10-23T23:59:00Z', 'Oct 23rd 2026 23:59'],
    ['2026-10-11T18:30:00Z', 'Oct 11th 2026 18:30'],
  ])('%s reads "%s"', (iso, expected) => {
    expect(formatSessionTime(iso, 'UTC')).toBe(expected);
  });

  it('reads the time in the zone it is given', () => {
    expect(formatSessionTime('2026-10-26T12:24:00Z', 'Europe/Stockholm')).toBe(
      'Oct 26th 2026 13:24',
    );
  });
});

describe('summarizeSessions', () => {
  const sessions: AccountSession[] = [
    {
      id: 'stale-0000',
      createdAt: '2026-10-10T08:00:00Z',
      metadata: null,
      current: false,
    },
    {
      id: 'phone-0000',
      createdAt: '2026-10-20T08:00:00Z',
      metadata: {
        userAgent: safariOnIphone,
        ip: '198.51.100.7',
        city: 'Stockholm',
        country: 'SE',
        seenAt: '2026-10-26T11:00:00Z',
      },
      current: false,
    },
    {
      id: 'laptop-000',
      createdAt: '2026-10-01T08:00:00Z',
      metadata: {
        userAgent: chromeOnMac,
        ip: '::1',
        seenAt: '2026-10-26T10:00:00Z',
      },
      current: true,
    },
  ];

  it('puts this session first, then the most recently used', () => {
    expect(summarizeSessions(sessions).map(({ id }) => id)).toEqual([
      'laptop-000',
      'phone-0000',
      'stale-0000',
    ]);
  });

  it('names where, from which address and on what it was last used', () => {
    expect(summarizeSessions(sessions)[1]).toEqual({
      id: 'phone-0000',
      details: 'Stockholm, 198.51.100.7, Safari - iOS',
      lastActive: '2026-10-26T11:00:00Z',
      current: false,
    });
  });

  // Running locally, the address is the machine's own, which says nothing.
  it('leaves out the loopback address', () => {
    expect(summarizeSessions(sessions)[0].details).toBe('Chrome - macOS');
  });

  it('falls back to when a session started when nothing was recorded', () => {
    expect(summarizeSessions(sessions)[2]).toMatchObject({
      details: 'Unknown device',
      lastActive: '2026-10-10T08:00:00Z',
    });
  });
});
