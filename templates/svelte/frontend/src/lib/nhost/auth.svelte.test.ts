import type { StoredSession } from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAuth, useAuth } from '$lib/nhost/auth.svelte';
import { linkErrorMessage } from '$lib/nhost/linkToken';

// Only paths that never reach the network, so the real client and its
// in-memory storage are enough.
describe('startAuth', () => {
  let location: URL;

  beforeEach(() => {
    location = new URL('http://localhost/protected');
    vi.stubGlobal(
      'window',
      Object.assign(new EventTarget(), {
        location,
        history: {
          state: null,
          replaceState: vi.fn((_state: unknown, _unused: string, url: URL) => {
            location.href = url.href;
          }),
        },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useAuth().clearLinkError();
  });

  // Redeeming takes the error off the URL, so it has to be read first or the
  // page the visitor lands on cannot say what went wrong.
  it('keeps the error a redirect brought back after taking it off the URL', async () => {
    location.search =
      '?error=invalid-ticket&errorDescription=Call+evil.example';
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await startAuth();

    expect(location.search).toBe('');
    expect(useAuth().linkError).toBe(linkErrorMessage('invalid-ticket'));
    expect(useAuth().linkError).not.toContain('evil.example');
  });

  it('leaves no error behind on an ordinary load', async () => {
    await startAuth();

    expect(useAuth().linkError).toBeNull();
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
