import { isRedirect } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type FakeRequest,
  fakeEvent,
  isDeleted,
} from '#lib/testing/requestEvent.ts';
import { DEFAULT_DESTINATION } from '#routes/signin/destination.ts';
import { handle } from './hooks.server.ts';

const session = vi.hoisted(() => ({ current: null as object | null }));
const pendingReset = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('#lib/nhost/server.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#lib/nhost/server.ts')>()),
  handleNhostRequest: async () => ({
    session: session.current,
    pendingReset: pendingReset.current,
  }),
}));

afterEach(() => {
  session.current = null;
  pendingReset.current = null;
});

const resolve = vi.fn(async () => new Response('page'));

// Runs the hook for `path` and returns where it redirected, or null when it
// let the request through.
async function location(
  path: string,
  request: FakeRequest = {},
): Promise<string | null> {
  const { event } = fakeEvent({ ...request, url: `http://localhost${path}` });
  try {
    await handle({ event, resolve });
    return null;
  } catch (err) {
    if (isRedirect(err)) {
      return err.location;
    }
    throw err;
  }
}

describe('hook, link tokens', () => {
  // A redirectTo may be any path on this origin. Wherever it lands, the hook
  // has to see the token, or it stays live in the address bar.
  it('strips the token and its type wherever it lands', async () => {
    for (const path of ['/', '/account', '/api/x', '/auth/password/reset']) {
      expect(
        await location(`${path}?refreshToken=token&type=passwordReset&keep=1`),
      ).toBe(`${path}?keep=1`);
    }
  });

  // SvelteKit hands a thrown redirect on a remote endpoint's URL to the client
  // as JSON, which a browser sent there by a redirectTo would only display.
  it('sends a browser on from a remote endpoint URL', async () => {
    const { event } = fakeEvent({
      url: 'http://localhost/_app/remote/x?refreshToken=token&type=signinPasswordless',
      isRemoteRequest: true,
    });

    const response = await handle({ event, resolve });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/_app/remote/x');
  });
});

describe('hook, signed out on a protected route', () => {
  // A provider that is not enabled sends the visitor back to the page they
  // started from, which bounces them to sign-in again.
  it('shows a failed flow on sign-in rather than inside next', async () => {
    expect(
      await location('/account?error=disabled-endpoint&errorDescription=x'),
    ).toBe(
      '/signin?next=%2Faccount&error=disabled-endpoint&errorDescription=x',
    );
  });

  // SvelteKit turns the redirect into one the client router follows.
  it('redirects client-side navigations too', async () => {
    expect(await location('/account', { isDataRequest: true })).toBe(
      '/signin?next=%2Faccount',
    );
  });

  // Its URL is the page that made the call. The function checks the session
  // itself.
  it('lets remote calls through', async () => {
    expect(
      await location('/account', { method: 'POST', isRemoteRequest: true }),
    ).toBeNull();
  });
});

describe('hook for a signed-in visitor', () => {
  it('sends them where the sign-in page was going to', async () => {
    session.current = {};

    expect(await location('/signin?next=%2Fprotected&intent=sign-in')).toBe(
      '/protected',
    );
  });

  // `next` is attacker-controlled; it is held to a path on this site.
  it('never sends them off this origin', async () => {
    session.current = {};

    expect(await location('/signin?next=%2F%2Fevil.example')).toBe(
      DEFAULT_DESTINATION,
    );
  });
});

describe('hook, remembering the way in', () => {
  const ATTEMPT = 'nhostSignInAttempt';
  const LAST_USED = 'nhostLastSignIn';

  it('records the method a signed-out visitor opens', async () => {
    const { event, written } = fakeEvent({
      url: 'http://localhost/auth/magic-link/',
    });

    await handle({ event, resolve });

    expect(written.get(ATTEMPT)?.value).toBe('/auth/magic-link');
  });

  // Wherever the session first shows up: a form's redirect or a link token.
  it('keeps the attempt once a session starts', async () => {
    session.current = {};
    const { event, written } = fakeEvent({
      url: 'http://localhost/account',
      cookies: { [ATTEMPT]: '/auth/otp' },
    });

    await handle({ event, resolve });

    expect(written.get(LAST_USED)?.value).toBe('/auth/otp');
    expect(isDeleted(written.get(ATTEMPT))).toBe(true);
  });
});

describe('hook during a password reset', () => {
  // The link signed them in to choose a password, not to use the account.
  it('sends every other page back to the reset page', async () => {
    session.current = {};
    pendingReset.current = '/reset';

    for (const path of ['/', '/account', '/signin']) {
      expect(await location(path)).toBe('/reset');
    }
  });

  // The cookie is the visitor's own to edit.
  it('never sends them off this origin', async () => {
    session.current = {};
    pendingReset.current = '//evil.example';

    expect(await location('/')).toBe(DEFAULT_DESTINATION);
  });
});

describe('hook responses', () => {
  it('carry the security headers', async () => {
    const { event } = fakeEvent();

    const response = await handle({ event, resolve });

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
