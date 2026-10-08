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

function clientWith(refreshToken: () => Promise<unknown>) {
  const spy = vi.fn(refreshToken);

  return {
    nhost: { auth: { refreshToken: spy } } as unknown as NhostClient,
    spy,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('redeemLinkToken', () => {
  it('does nothing without a token on the URL', async () => {
    const replaceState = stubWindow('/protected?keep=1');
    const { nhost, spy } = clientWith(async () => undefined);

    await redeemLinkToken(nhost);

    expect(spy).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  // The strip has to land before the exchange settles, so a request that
  // hangs or fails cannot leave a live token in the address bar.
  it('takes the token off the URL before redeeming it', async () => {
    const replaceState = stubWindow('/protected?refreshToken=abc&keep=1#top');
    const { nhost, spy } = clientWith(() => new Promise(() => {}));

    void redeemLinkToken(nhost);

    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/protected?keep=1#top',
    );
    expect(spy).toHaveBeenCalledWith({ refreshToken: 'abc' });
  });

  it('leaves the visitor signed out when the token is refused', async () => {
    const replaceState = stubWindow('/?refreshToken=used');
    const { nhost } = clientWith(() => Promise.reject(new Error('expired')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(redeemLinkToken(nhost)).resolves.toBeUndefined();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });
});
