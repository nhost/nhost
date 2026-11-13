import { describe, expect, it } from 'vitest';
import type { AccountSession } from '@/app/account/actions';
import { sortSessions } from '@/app/account/sessions';

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
