import type { StoredSession } from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAuth, useAuth } from '@/lib/nhost/auth';
import { linkErrorMessage } from '@/lib/nhost/linkToken';

const location = {
  pathname: '/',
  search: '',
  hash: '',
  get href() {
    return `http://localhost${this.pathname}${this.search}${this.hash}`;
  },
};

const replaceState = vi.fn(
  (_state: unknown, _title: string, url: string | URL) => {
    const next = new URL(url, location.href);
    location.pathname = next.pathname;
    location.search = next.search;
    location.hash = next.hash;
  },
);

// Only paths that never reach the network, so the real client and its
// in-memory storage are enough.
describe('startAuth', () => {
  beforeEach(() => {
    Object.assign(location, {
      pathname: '/protected',
      search: '?error=invalid-ticket&errorDescription=Call+evil.example',
      hash: '',
    });
    vi.stubGlobal(
      'window',
      Object.assign(new EventTarget(), {
        location,
        history: { state: null, replaceState },
      }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useAuth().clearLinkError();
  });

  // Redeeming takes the error off the URL, so it has to be read first or the
  // page the visitor lands on cannot say what went wrong.
  it('keeps the error a redirect brought back after taking it off the URL', async () => {
    await startAuth();

    expect(location.search).toBe('');
    expect(useAuth().linkError.value).toBe(linkErrorMessage('invalid-ticket'));
  });

  it('shows the app its own sentence, not the description', async () => {
    await startAuth();

    expect(useAuth().linkError.value).not.toContain('evil.example');
  });

  it('leaves no error behind on an ordinary load', async () => {
    location.search = '';

    await startAuth();

    expect(useAuth().linkError.value).toBeNull();
  });

  // Another tab's write reaches this one only as a `storage` event, so this is
  // what stops a tab rendering a visitor who signed out elsewhere.
  it('follows another tab signing in and out', async () => {
    location.search = '';
    await startAuth();
    const { nhost, session } = useAuth();
    const theirs = { refreshToken: 'theirs' } as unknown as StoredSession;
    const stored = vi.spyOn(nhost, 'getUserSession').mockReturnValue(theirs);

    window.dispatchEvent(
      Object.assign(new Event('storage'), { key: 'nhostSession' }),
    );
    expect(session.value).toEqual(theirs);

    stored.mockReturnValue(null);
    window.dispatchEvent(
      Object.assign(new Event('storage'), { key: 'nhostSession' }),
    );
    expect(session.value).toBeNull();
  });
});
