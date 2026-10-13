import { AsyncLocalStorage } from 'node:async_hooks';
import { beforeAll, describe, expect, it } from 'vitest';
import { LINK_TOKEN_PARAM } from '@/lib/nhost/server';
import { config } from '@/proxy';

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
