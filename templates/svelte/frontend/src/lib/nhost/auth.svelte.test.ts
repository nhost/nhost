import type { StoredSession } from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAuth, useAuth } from '$lib/nhost/auth.svelte';

// Only paths that never reach the network, so the real client and its
// in-memory storage are enough.
describe('startAuth', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'window',
      Object.assign(new EventTarget(), {
        location: new URL('http://localhost/protected'),
        history: { state: null, replaceState: vi.fn() },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Another tab's write reaches this one only as a `storage` event, so this is
  // what stops a tab rendering a visitor who signed out elsewhere.
  it('follows another tab signing in and out', async () => {
    await startAuth();
    const auth = useAuth();
    const theirs = { refreshToken: 'theirs' } as unknown as StoredSession;
    const stored = vi
      .spyOn(auth.nhost, 'getUserSession')
      .mockReturnValue(theirs);

    window.dispatchEvent(
      Object.assign(new Event('storage'), { key: 'nhostSession' }),
    );
    expect(auth.session).toEqual(theirs);

    stored.mockReturnValue(null);
    window.dispatchEvent(
      Object.assign(new Event('storage'), { key: 'nhostSession' }),
    );
    expect(auth.session).toBeNull();
  });
});
