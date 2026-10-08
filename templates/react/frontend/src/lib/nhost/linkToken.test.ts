import type { NhostClient } from '@nhost/nhost-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redeemLinkToken } from '@/lib/nhost/linkToken';

const ROUTER_STATE = { idx: 0, key: 'default', usr: null };

const location = { pathname: '/', search: '', hash: '' };

const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
  const next = new URL(url, 'http://localhost');
  location.pathname = next.pathname;
  location.search = next.search;
  location.hash = next.hash;
});

// A fresh client per test: redemptions are remembered per client.
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
  // history and a second caller cannot read it again.
  it('takes the token off the URL before anything is awaited', () => {
    const client = fakeClient({ stored: false });

    void redeemLinkToken(asClient(client));

    expect(client.refreshSession).toHaveBeenCalledOnce();
    expect(client.auth.refreshToken).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(
      ROUTER_STATE,
      '',
      '/protected?tab=1#top',
    );
  });

  it('strips the token even when the link no longer works', async () => {
    const client = fakeClient({ stored: false });
    client.auth.refreshToken.mockRejectedValue(new Error('401'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await redeemLinkToken(asClient(client));

    expect(location.search).toBe('?tab=1');
  });

  // What StrictMode does to `AuthProvider`'s effect in development: the second
  // call must wait for the first exchange, not resolve early on a clean URL.
  it('exchanges once and makes a second caller wait for it', async () => {
    const client = fakeClient({ stored: false });

    const first = redeemLinkToken(asClient(client));
    const second = redeemLinkToken(asClient(client));

    expect(second).toBe(first);

    await second;

    expect(client.auth.refreshToken).toHaveBeenCalledOnce();
    expect(client.getUserSession()).toEqual({ refreshToken: 'from-link' });
  });

  it('leaves the URL alone when there is no token', async () => {
    location.search = '?tab=1';
    const client = fakeClient({ stored: false });

    await redeemLinkToken(asClient(client));

    expect(replaceState).not.toHaveBeenCalled();
    expect(client.refreshSession).not.toHaveBeenCalled();
  });
});
