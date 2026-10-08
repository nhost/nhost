import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAuth, useAuth } from '@/lib/nhost/auth';
import { linkErrorMessage } from '@/lib/nhost/linkToken';

const location = { pathname: '/', search: '', hash: '' };

const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
  const next = new URL(url, 'http://localhost');
  location.pathname = next.pathname;
  location.search = next.search;
  location.hash = next.hash;
});

// Only the error path: it never reaches the network, so the real client and
// its in-memory storage are enough.
describe('startAuth', () => {
  beforeEach(() => {
    Object.assign(location, {
      pathname: '/protected',
      search: '?error=invalid-ticket&errorDescription=Call+evil.example',
      hash: '',
    });
    vi.stubGlobal('window', {
      location,
      history: { state: null, replaceState },
    });
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
});
