import { AsyncLocalStorage } from 'node:async_hooks';
import { NextRequest, type NextResponse } from 'next/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { LINK_TOKEN_PARAM } from '@/lib/nhost/server';
import { config, proxy } from '@/proxy';

const session = vi.hoisted(() => ({ current: null as object | null }));

vi.mock('@/lib/nhost/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nhost/server')>()),
  handleNhostProxy: async () => ({
    session: session.current,
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
  it('leaves static files and api routes alone', () => {
    for (const url of ['/favicon.ico', '/api/x', '/_next/static/chunk.js']) {
      expect(matches(url)).toBe(false);
    }
  });

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

  it('keeps the rest of the query in next', async () => {
    const url = new URL(
      (await location('/account?tab=email&error=invalid-ticket')) ?? '',
    );

    expect(url.searchParams.get('next')).toBe('/account?tab=email');
    expect(url.searchParams.get('error')).toBe('invalid-ticket');
  });

  it('carries the query untouched when nothing failed', async () => {
    const url = new URL((await location('/account?a=b%20c&d')) ?? '');

    expect(url.searchParams.get('next')).toBe('/account?a=b%20c&d');
    expect(url.searchParams.has('error')).toBe(false);
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

  it('sends them on from the sign-in pages', async () => {
    session.current = {};

    for (const path of ['/signin', '/auth/password', '/auth/otp/']) {
      expect(await location(path)).toBe(
        `http://localhost${DEFAULT_DESTINATION}`,
      );
    }
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

  // The reset page is reached with the session the reset link created.
  it('leaves the pages under a method alone', async () => {
    session.current = {};

    expect(await location('/auth/password/reset')).toBeNull();
  });

  it('leaves a signed-out visitor on the sign-in pages', async () => {
    expect(await location('/signin')).toBeNull();
    expect(await location('/auth/password')).toBeNull();
  });
});
