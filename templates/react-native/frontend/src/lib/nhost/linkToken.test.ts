import type { NhostClient } from '@nhost/nhost-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  linkErrorMessage,
  linkToken,
  readLinkError,
  redeemLinkToken,
} from '@/lib/nhost/linkToken';

afterEach(() => {
  vi.restoreAllMocks();
});

// The shapes a deep link actually arrives in. Under Expo Go it is the
// development server's URL with a `--` separator; in a real build it is the
// app's own scheme. Neither is something a URL parser reads the same way on
// both platforms, which is why the query is taken by hand.
describe('linkToken', () => {
  it('reads the token from a custom scheme link', () => {
    expect(linkToken('nhoststarter:///auth/callback?refreshToken=abc123')).toBe(
      'abc123',
    );
  });

  it('reads the token from an Expo Go link', () => {
    expect(
      linkToken('exp://10.0.0.2:8081/--/protected?refreshToken=abc123'),
    ).toBe('abc123');
  });

  it('finds it among other parameters', () => {
    expect(
      linkToken('nhoststarter:///?type=signin&refreshToken=abc123&x=1'),
    ).toBe('abc123');
  });

  it('is null for a link that carries no token', () => {
    expect(linkToken('nhoststarter:///protected')).toBeNull();
    expect(linkToken('nhoststarter:///protected?next=%2Fhome')).toBeNull();
    expect(linkToken('')).toBeNull();
  });
});

describe('readLinkError', () => {
  // Any web page or app can open the scheme with a description of its
  // choosing, so the user is shown the app's own sentence for the code.
  it('says what the code means, not what the link says', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const url of [
      'nhoststarter:///protected?error=disabled-endpoint&errorDescription=Call+evil.example',
      'exp://10.0.0.2:8081/--/protected?error=disabled-endpoint&errorDescription=Call+evil.example',
    ]) {
      expect(readLinkError(url)).toBe(
        'That sign-in method is not enabled on the backend yet.',
      );
    }

    expect(warn).toHaveBeenCalledWith(
      'The auth service sent this app an error:',
      'disabled-endpoint',
      'Call evil.example',
    );
  });

  it('is null for a link that carries no error', () => {
    expect(readLinkError('nhoststarter:///protected?refreshToken=abc')).toBe(
      null,
    );
    expect(readLinkError('nhoststarter:///protected')).toBeNull();
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

const LINK = 'nhoststarter:///protected?refreshToken=link-token';

// A fresh client per test: redemptions are chained per client.
const fakeClient = ({ stored }: { stored: boolean }) => {
  let session: object | null = stored ? { refreshToken: 'mine' } : null;
  let used = false;

  return {
    refreshSession: vi.fn(async () => session),
    getUserSession: vi.fn(() => session),
    auth: {
      // Single use, like the real one.
      refreshToken: vi.fn(async () => {
        await Promise.resolve();
        if (used) {
          throw new Error('invalid-ticket');
        }
        used = true;
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
  it('signs in a signed-out user', async () => {
    const client = fakeClient({ stored: false });

    await redeemLinkToken(asClient(client), LINK);

    expect(client.auth.refreshToken).toHaveBeenCalledWith({
      refreshToken: 'link-token',
    });
    expect(client.getUserSession()).toEqual({ refreshToken: 'from-link' });
  });

  // A crafted link would otherwise move whoever opens it into the sender's
  // account.
  it('does not replace a signed-in user', async () => {
    const client = fakeClient({ stored: true });

    await redeemLinkToken(asClient(client), LINK);

    expect(client.auth.refreshToken).not.toHaveBeenCalled();
    expect(client.getUserSession()).toEqual({ refreshToken: 'mine' });
  });

  it('still redeems when the stored session turns out to be dead', async () => {
    const client = fakeClient({ stored: true });
    client.refreshSession.mockImplementation(async () => {
      client.signOut();
      return null;
    });

    await redeemLinkToken(asClient(client), LINK);

    expect(client.auth.refreshToken).toHaveBeenCalledOnce();
  });

  // The OAuth screen and a link event both handed the same callback.
  it('redeems a link once when two callers are handed it', async () => {
    const client = fakeClient({ stored: false });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await Promise.all([
      redeemLinkToken(asClient(client), LINK),
      redeemLinkToken(asClient(client), LINK),
    ]);

    expect(client.auth.refreshToken).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('keeps going after a link that no longer works', async () => {
    const client = fakeClient({ stored: false });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    client.auth.refreshToken.mockRejectedValueOnce(new Error('401'));

    await redeemLinkToken(asClient(client), LINK);
    await redeemLinkToken(asClient(client), LINK);

    expect(client.auth.refreshToken).toHaveBeenCalledTimes(2);
    expect(client.getUserSession()).toEqual({ refreshToken: 'from-link' });
    error.mockRestore();
  });

  it('touches nothing for a link without a token', async () => {
    const client = fakeClient({ stored: false });

    await redeemLinkToken(asClient(client), 'nhoststarter:///protected');

    expect(client.refreshSession).not.toHaveBeenCalled();
    expect(client.auth.refreshToken).not.toHaveBeenCalled();
  });
});
