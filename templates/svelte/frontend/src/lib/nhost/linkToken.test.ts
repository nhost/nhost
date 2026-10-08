import type { NhostClient } from '@nhost/nhost-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  linkErrorMessage,
  readLinkError,
  redeemLinkToken,
} from '$lib/nhost/linkToken';

// `replaceState` refuses a URL on another origin the way the browser does.
function stubWindow(url: string) {
  const location = new URL(url, 'http://localhost');
  const replaceState = vi.fn(
    (_state: unknown, _unused: string, target: string | URL) => {
      if (new URL(target, location).origin !== location.origin) {
        throw new DOMException('Not this origin', 'SecurityError');
      }
    },
  );

  vi.stubGlobal('window', {
    location,
    history: { state: null, replaceState },
  });

  return replaceState;
}

function strippedTo(replaceState: ReturnType<typeof stubWindow>) {
  const target = replaceState.mock.lastCall?.[2];

  return target && new URL(target, 'http://localhost').href;
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
  vi.restoreAllMocks();
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
    expect(strippedTo(replaceState)).toBe('http://localhost/?keep=1');
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
    expect(strippedTo(replaceState)).toBe(
      'http://localhost/protected?keep=1#top',
    );
  });

  it('leaves the visitor signed out when the token is refused', async () => {
    const replaceState = stubWindow('/?refreshToken=used');
    const { nhost } = clientWith(() => Promise.reject(new Error('expired')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(redeemLinkToken(nhost)).resolves.toBeUndefined();
    expect(strippedTo(replaceState)).toBe('http://localhost/');
  });

  // A failed redirect carries no token, and a reload would otherwise report
  // the same error again.
  it('takes an error off the URL without a request', async () => {
    const replaceState = stubWindow(
      '/protected?error=invalid-ticket&errorDescription=Expired&keep=1',
    );
    const { nhost, spy, refreshSession } = clientWith(async () => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await redeemLinkToken(nhost);

    expect(strippedTo(replaceState)).toBe('http://localhost/protected?keep=1');
    expect(warn).toHaveBeenCalledWith(
      'The auth service sent this page an error:',
      'invalid-ticket',
      'Expired',
    );
    expect(refreshSession).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  // A redirect to `/..//evil.example` lands on the path `//evil.example`, and
  // that path on its own is a URL for another origin.
  it('strips the token on a path that reads as another origin', async () => {
    const replaceState = stubWindow(
      'http://localhost//evil.example?refreshToken=abc',
    );
    const { nhost, spy } = clientWith(async () => undefined);

    await expect(redeemLinkToken(nhost)).resolves.toBeUndefined();
    expect(strippedTo(replaceState)).toBe('http://localhost//evil.example');
    expect(spy).toHaveBeenCalledWith({ refreshToken: 'abc' });
  });
});

describe('readLinkError', () => {
  it('is null on an ordinary load', () => {
    stubWindow('/protected?keep=1');

    expect(readLinkError()).toBeNull();
  });

  // Anyone can send a link with a description of their choosing, so the
  // visitor is shown the app's own sentence for the code.
  it('says what the code means, not what the link says', () => {
    stubWindow(
      '/?error=disabled-endpoint&errorDescription=Call+evil.example+now',
    );

    expect(readLinkError()).toBe(
      'That sign-in method is not enabled on the backend yet.',
    );
  });
});

describe('linkErrorMessage', () => {
  it('falls back for a code it does not know', () => {
    expect(linkErrorMessage('internal-server-error')).toBe(
      'Signing in did not work.',
    );
  });

  // An object lookup would find what every object inherits.
  it('falls back for a code named after an inherited property', () => {
    expect(linkErrorMessage('__proto__')).toBe('Signing in did not work.');
    expect(linkErrorMessage('toString')).toBe('Signing in did not work.');
  });
});
