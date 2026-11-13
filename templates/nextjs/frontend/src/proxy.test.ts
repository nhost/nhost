import { AsyncLocalStorage } from 'node:async_hooks';
import { NextRequest, type NextResponse } from 'next/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { LINK_TOKEN_PARAM } from '@/lib/nhost/server';
import { config, proxy } from '@/proxy';

const session = vi.hoisted(() => ({ current: null as object | null }));
const pendingReset = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('@/lib/nhost/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nhost/server')>()),
  handleNhostProxy: async () => ({
    session: session.current,
    pendingReset: pendingReset.current,
    applySessionCookies: (response: NextResponse) => response,
  }),
}));

let matches: (url: string) => boolean;

beforeAll(async () => {
  // Next's server sets this global before loading anything that reads it, and
  // its matcher helper is one of those.
  Object.assign(globalThis, { AsyncLocalStorage });
  const { unstable_doesMiddlewareMatch } = await import(
    'next/experimental/testing/server'
  );
  matches = (url) => unstable_doesMiddlewareMatch({ config, url });
});

describe('proxy matcher', () => {
  // A redirectTo may be any path on this origin. Wherever it lands, the
  // proxy has to see the token, or it stays live in the address bar.
  it('runs wherever a link token lands', () => {
    for (const path of [
      '/',
      '/favicon.ico',
      '/api/x',
      '/_next/static/chunk.js',
      '/_next/image',
    ]) {
      expect(matches(`${path}?${LINK_TOKEN_PARAM}=token`)).toBe(true);
    }
  });
});

describe('proxy, signed out on a protected route', () => {
  const location = async (path: string) =>
    (await proxy(new NextRequest(`http://localhost${path}`))).headers.get(
      'location',
    );

  // A provider that is not enabled sends the visitor back to the page they
  // started from, which bounces them to sign-in again.
  it('shows a failed flow on sign-in rather than inside next', async () => {
    expect(
      await location('/account?error=disabled-endpoint&errorDescription=x'),
    ).toBe(
      'http://localhost/signin?next=%2Faccount&error=disabled-endpoint&errorDescription=x',
    );
  });
});

describe('proxy for a signed-in visitor', () => {
  const location = async (path: string) =>
    (await proxy(new NextRequest(`http://localhost${path}`))).headers.get(
      'location',
    );

  afterEach(() => {
    session.current = null;
  });

  it('sends them where the sign-in page was going to', async () => {
    session.current = {};

    expect(await location('/signin?next=%2Fprotected&intent=sign-in')).toBe(
      'http://localhost/protected',
    );
  });

  // `next` is attacker-controlled; it is held to a path on this site.
  it('never sends them off this origin', async () => {
    session.current = {};

    expect(await location('/signin?next=%2F%2Fevil.example')).toBe(
      `http://localhost${DEFAULT_DESTINATION}`,
    );
  });
});

describe('proxy, remembering the way in', () => {
  const ATTEMPT = 'nhostSignInAttempt';
  const LAST_USED = 'nhostLastSignIn';

  const visit = (path: string, headers: Record<string, string> = {}) =>
    proxy(new NextRequest(`http://localhost${path}`, { headers }));

  afterEach(() => {
    session.current = null;
  });

  // Wherever the session first shows up: a form's redirect or a link token.
  it('keeps the attempt once a session starts', async () => {
    session.current = {};

    const response = await visit('/account', {
      cookie: `${ATTEMPT}=/auth/otp`,
    });

    expect(response.cookies.get(LAST_USED)?.value).toBe('/auth/otp');
    expect(response.cookies.get(ATTEMPT)?.value).toBe('');
  });
});

describe('proxy during a password reset', () => {
  const location = async (path: string) =>
    (await proxy(new NextRequest(`http://localhost${path}`))).headers.get(
      'location',
    );

  afterEach(() => {
    session.current = null;
    pendingReset.current = null;
  });

  // The link signed them in to choose a password, not to use the account.
  it('sends every other page back to the reset page', async () => {
    session.current = {};
    pendingReset.current = '/reset';

    for (const path of ['/', '/account', '/signin']) {
      expect(await location(path)).toBe('http://localhost/reset');
    }
  });

  // The cookie is the visitor's own to edit.
  it('never sends them off this origin', async () => {
    session.current = {};
    pendingReset.current = '//evil.example';

    expect(await location('/')).toBe(`http://localhost${DEFAULT_DESTINATION}`);
  });
});
