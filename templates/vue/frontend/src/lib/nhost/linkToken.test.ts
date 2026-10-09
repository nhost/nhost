import type { NhostClient } from '@nhost/nhost-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  linkErrorMessage,
  readLinkError,
  redeemLinkToken,
} from '@/lib/nhost/linkToken';

const ROUTER_STATE = { back: null, current: '/protected', position: 0 };

const location = {
  pathname: '/',
  search: '',
  hash: '',
  get href() {
    return `http://localhost${this.pathname}${this.search}${this.hash}`;
  },
};

// Refuses a URL on another origin the way the browser does.
const replaceState = vi.fn(
  (_state: unknown, _title: string, url: string | URL) => {
    const next = new URL(url, location.href);
    if (next.origin !== 'http://localhost') {
      throw new DOMException('Not this origin', 'SecurityError');
    }
    location.pathname = next.pathname;
    location.search = next.search;
    location.hash = next.hash;
  },
);

const fakeClient = ({ stored }: { stored: boolean }) => {
  let session: object | null = stored ? { refreshToken: 'mine' } : null;

  return {
    refreshSession: vi.fn(async () => session),
    getUserSession: vi.fn(() => session),
    auth: {
      refreshToken: vi.fn(async () => {
        session = { refreshToken: 'from-link' };
        return { body: session };
      }),
    },
    // Lets a test drop the stored session the way a rejected refresh does.
    signOut: () => {
      session = null;
    },
  };
};

const asClient = (client: ReturnType<typeof fakeClient>) =>
  client as unknown as NhostClient;

describe('redeemLinkToken', () => {
  beforeEach(() => {
    Object.assign(location, {
      pathname: '/protected',
      search: '?refreshToken=link-token&tab=1',
      hash: '#top',
    });
    replaceState.mockClear();
    vi.stubGlobal('window', {
      location,
      history: { state: ROUTER_STATE, replaceState },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('signs in a signed-out visitor', async () => {
    const client = fakeClient({ stored: false });

    await redeemLinkToken(asClient(client));

    expect(client.auth.refreshToken).toHaveBeenCalledWith({
      refreshToken: 'link-token',
    });
  });

  // A crafted link would otherwise move whoever opens it into the sender's
  // account.
  it('does not replace a signed-in visitor', async () => {
    const client = fakeClient({ stored: true });

    await redeemLinkToken(asClient(client));

    expect(client.auth.refreshToken).not.toHaveBeenCalled();
    expect(client.getUserSession()).toEqual({ refreshToken: 'mine' });
    expect(location.search).toBe('?tab=1');
  });

  it('still redeems when the stored session turns out to be dead', async () => {
    const client = fakeClient({ stored: true });
    client.refreshSession.mockImplementation(async () => {
      client.signOut();
      return null;
    });

    await redeemLinkToken(asClient(client));

    expect(client.auth.refreshToken).toHaveBeenCalledOnce();
  });

  // Before the first await, so an interrupted exchange cannot leave it in
  // history.
  it('takes the token off the URL before anything is awaited', () => {
    const client = fakeClient({ stored: false });

    void redeemLinkToken(asClient(client));

    expect(client.refreshSession).toHaveBeenCalledOnce();
    expect(client.auth.refreshToken).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(
      ROUTER_STATE,
      '',
      expect.any(URL),
    );
    expect(location.href).toBe('http://localhost/protected?tab=1#top');
  });

  it('strips the token even when the link no longer works', async () => {
    const client = fakeClient({ stored: false });
    client.auth.refreshToken.mockRejectedValue(new Error('401'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await redeemLinkToken(asClient(client));

    expect(location.search).toBe('?tab=1');
  });

  // A redirect to `/..//evil.example` lands on the path `//evil.example`, and
  // that path on its own is a URL for another origin.
  it('strips the token on a path that reads as another origin', async () => {
    location.pathname = '//evil.example';
    const client = fakeClient({ stored: false });

    await expect(redeemLinkToken(asClient(client))).resolves.toBeUndefined();
    expect(location.href).toBe('http://localhost//evil.example?tab=1#top');
    expect(client.auth.refreshToken).toHaveBeenCalledWith({
      refreshToken: 'link-token',
    });
  });

  it('leaves the URL alone when there is no token', async () => {
    location.search = '?tab=1';
    const client = fakeClient({ stored: false });

    await redeemLinkToken(asClient(client));

    expect(replaceState).not.toHaveBeenCalled();
    expect(client.refreshSession).not.toHaveBeenCalled();
  });

  // What a disabled provider or an expired email link comes back with.
  describe('when the auth service sent an error instead', () => {
    beforeEach(() => {
      location.search =
        '?error=disabled-endpoint&errorDescription=This+endpoint+is+disabled&tab=1';
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('can be read before it is taken off the URL', () => {
      expect(readLinkError()).toBe(linkErrorMessage('disabled-endpoint'));
    });

    it('takes it off the URL and tries no exchange', async () => {
      const client = fakeClient({ stored: false });

      await redeemLinkToken(asClient(client));

      expect(location.search).toBe('?tab=1');
      expect(readLinkError()).toBeNull();
      expect(client.refreshSession).not.toHaveBeenCalled();
      expect(client.auth.refreshToken).not.toHaveBeenCalled();
    });

    it('hands the description to the console, not the page', async () => {
      await redeemLinkToken(asClient(fakeClient({ stored: false })));

      expect(console.warn).toHaveBeenCalledWith(
        expect.any(String),
        'disabled-endpoint',
        'This endpoint is disabled',
      );
    });
  });
});

describe('linkErrorMessage', () => {
  // The description is whatever the link says, so the page never shows it.
  it('never repeats what the link says', () => {
    expect(linkErrorMessage('Call us at evil.example')).not.toContain(
      'evil.example',
    );
  });

  it('explains the codes a fresh project runs into', () => {
    expect(linkErrorMessage('disabled-endpoint')).toMatch(/not enabled/);
    expect(linkErrorMessage('invalid-ticket')).toMatch(/expired/);
    expect(linkErrorMessage('unverified-user')).toMatch(/Verify/);
    expect(linkErrorMessage('signup-disabled')).toMatch(/sign-ups/);
  });

  // An object lookup would hand back what every object inherits, and a
  // template prints that as `{}` or as a function's source.
  it.each(['__proto__', 'toString', 'constructor', 'hasOwnProperty'])(
    'treats %s as an unknown code',
    (code) => {
      const message = linkErrorMessage(code);

      expect(typeof message).toBe('string');
      expect(message).toBe(linkErrorMessage('not-a-code'));
    },
  );
});
