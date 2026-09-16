import type { StoredSession } from '@nhost/nhost-js/session';
import { NextRequest, type NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { handleNhostProxy } from '@/lib/nhost/server';
import { config, proxy } from '@/proxy';

vi.mock('@/lib/nhost/server', () => ({ handleNhostProxy: vi.fn() }));

// Next.js compiles config.matcher into a full-path matcher. We approximate it
// here to guard against the matcher silently skipping real application routes,
// which is what an unanchored exclusion term (e.g. a bare "public") caused.
const [pattern = ''] = config.matcher;
const matcher = new RegExp(`^${pattern}$`);

describe('proxy route matcher', () => {
  it('runs on application routes', () => {
    for (const path of [
      '/',
      '/protected',
      '/signin',
      '/publications',
      '/public-profile',
    ]) {
      expect(matcher.test(path)).toBe(true);
    }
  });

  it('skips framework internals and static assets', () => {
    for (const path of [
      '/_next/static/chunk.js',
      '/_next/image',
      '/api/todos',
      '/favicon.ico',
      '/icon.svg',
    ]) {
      expect(matcher.test(path)).toBe(false);
    }
  });
});

const session = { accessToken: 'header.payload.signature' } as StoredSession;

const request = (path: string): NextRequest =>
  new NextRequest(`http://localhost:3000${path}`);

const stubNhostProxy = (
  value: StoredSession | null,
  mutations: {
    request?: (request: NextRequest) => void;
    response?: (response: NextResponse) => void;
  } = {},
): void => {
  vi.mocked(handleNhostProxy).mockImplementation(async (request) => {
    mutations.request?.(request);

    return {
      session: value,
      applySessionCookies: (response) => {
        mutations.response?.(response);
        return response;
      },
    };
  });
};

// `NextResponse.next()` is a sentinel rather than a real response: Next.js
// recognises it by the `x-middleware-next` header and continues routing.
const expectPassthrough = (response: NextResponse): void => {
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('location')).toBeNull();
};

const expectSignInRedirect = (response: NextResponse): void => {
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get('location') ?? '').pathname).toBe(
    '/signin',
  );
};

describe('proxy access control', () => {
  it('redirects an anonymous request to a protected route', async () => {
    stubNhostProxy(null);

    expectSignInRedirect(await proxy(request('/protected')));
  });

  it('redirects an anonymous request to a protected sub-route', async () => {
    stubNhostProxy(null);

    expectSignInRedirect(await proxy(request('/protected/settings')));
  });

  it('does not gate routes that only share a protected prefix', async () => {
    stubNhostProxy(null);

    expectPassthrough(await proxy(request('/protected-preview')));
  });

  it('lets an anonymous request reach a public route', async () => {
    stubNhostProxy(null);

    expectPassthrough(await proxy(request('/signin')));
  });

  it('lets an authenticated request reach a protected route', async () => {
    stubNhostProxy(session);

    expectPassthrough(await proxy(request('/protected')));
  });
});

describe('proxy session cookie propagation', () => {
  it('forwards a refreshed cookie to the render of the same request', async () => {
    stubNhostProxy(session, {
      request: (request) => {
        request.cookies.set('nhostSession', 'refreshed');
      },
    });

    const response = await proxy(request('/'));

    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'nhostSession=refreshed',
    );
  });

  it('sets a refreshed cookie on a passthrough response', async () => {
    stubNhostProxy(session, {
      response: (response) => {
        response.cookies.set('nhostSession', 'refreshed');
      },
    });

    const response = await proxy(request('/protected'));

    expect(response.headers.getSetCookie()).toContainEqual(
      expect.stringContaining('nhostSession=refreshed'),
    );
  });

  it('sets a session deletion on a redirect response', async () => {
    stubNhostProxy(null, {
      response: (response) => {
        response.cookies.delete('nhostSession');
      },
    });

    const response = await proxy(request('/protected'));

    expectSignInRedirect(response);
    expect(response.headers.getSetCookie()).toContainEqual(
      expect.stringContaining('nhostSession=;'),
    );
  });
});
