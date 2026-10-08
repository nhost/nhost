import type { NhostClient } from '@nhost/nhost-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { redeemLinkToken } from '$lib/nhost/linkToken';

function stubWindow(url: string) {
  const { pathname, search, hash } = new URL(url, 'http://localhost');
  const replaceState = vi.fn();

  vi.stubGlobal('window', {
    location: { pathname, search, hash },
    history: { state: null, replaceState },
  });

  return replaceState;
}

function clientWith(
  refreshToken: () => Promise<unknown>,
  { stored = false } = {},
) {
  let session: object | null = stored ? { refreshToken: 'mine' } : null;
  const spy = vi.fn(refreshToken);
  const refreshSession = vi.fn(async () => session);

  return {
    nhost: {
      refreshSession,
      getUserSession: () => session,
      auth: { refreshToken: spy },
    } as unknown as NhostClient,
    spy,
    refreshSession,
    // Drops the stored session the way a refresh the service rejects does.
    expire: () => {
      session = null;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('redeemLinkToken', () => {
  it('does nothing without a token on the URL', async () => {
    const replaceState = stubWindow('/protected?keep=1');
    const { nhost, spy, refreshSession } = clientWith(async () => undefined);

    await redeemLinkToken(nhost);

    expect(spy).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('signs in a signed-out visitor', async () => {
    stubWindow('/?refreshToken=abc');
    const { nhost, spy } = clientWith(async () => undefined);

    await redeemLinkToken(nhost);

    expect(spy).toHaveBeenCalledWith({ refreshToken: 'abc' });
  });

  // A crafted link would otherwise move whoever opens it into the sender's
  // account.
  it('does not replace a signed-in visitor', async () => {
    const replaceState = stubWindow('/?refreshToken=abc&keep=1');
    const { nhost, spy } = clientWith(async () => undefined, { stored: true });

    await redeemLinkToken(nhost);

    expect(spy).not.toHaveBeenCalled();
    expect(nhost.getUserSession()).toEqual({ refreshToken: 'mine' });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?keep=1');
  });

  it('still redeems when the stored session turns out to be dead', async () => {
    stubWindow('/?refreshToken=abc');
    const client = clientWith(async () => undefined, { stored: true });
    client.refreshSession.mockImplementation(async () => {
      client.expire();
      return null;
    });

    await redeemLinkToken(client.nhost);

    expect(client.spy).toHaveBeenCalledOnce();
  });

  // The strip has to land before anything is awaited, so a request that
  // hangs or fails cannot leave a live token in the address bar.
  it('takes the token off the URL before anything is awaited', () => {
    const replaceState = stubWindow('/protected?refreshToken=abc&keep=1#top');
    const { nhost, refreshSession } = clientWith(() => new Promise(() => {}));

    void redeemLinkToken(nhost);

    expect(refreshSession).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/protected?keep=1#top',
    );
  });

  it('leaves the visitor signed out when the token is refused', async () => {
    const replaceState = stubWindow('/?refreshToken=used');
    const { nhost } = clientWith(() => Promise.reject(new Error('expired')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(redeemLinkToken(nhost)).resolves.toBeUndefined();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });
});
