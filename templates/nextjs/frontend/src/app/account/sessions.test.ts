import { describe, expect, it } from 'vitest';
import type { AccountSession } from '@/app/account/actions';
import { summarizeSessions } from '@/app/account/sessions';

const chromeOnMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const safariOnIphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

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
});
