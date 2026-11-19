import type { Cookies, RequestEvent } from '@sveltejs/kit';

type CookieOptions = Parameters<Cookies['set']>[2];

export type WrittenCookie = { value: string; options: CookieOptions };

export type FakeRequest = {
  url?: string;
  method?: string;
  cookies?: Record<string, string>;
  clientAddress?: string;
  isDataRequest?: boolean;
  isRemoteRequest?: boolean;
};

/**
 * A request as SvelteKit hands it to hooks, loads and remote functions, with a
 * cookie jar that reads back its own writes, as SvelteKit's does, and keeps
 * each write the way the response would send it.
 */
export function fakeEvent({
  url = 'http://localhost:3000/',
  method = 'GET',
  cookies: initial = {},
  clientAddress = '203.0.113.7',
  isDataRequest = false,
  isRemoteRequest = false,
}: FakeRequest = {}): {
  event: RequestEvent;
  written: Map<string, WrittenCookie>;
} {
  const jar = new Map(Object.entries(initial));
  const written = new Map<string, WrittenCookie>();

  const cookies: Cookies = {
    get: (name) => jar.get(name),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name, value, options) => {
      jar.set(name, value);
      written.set(name, { value, options });
    },
    delete: (name, options) => {
      jar.delete(name);
      written.set(name, { value: '', options: { ...options, maxAge: 0 } });
    },
    serialize: () => '',
    parse: () => {
      throw new Error('not faked');
    },
  };

  // Only the fields the app reads.
  const event = {
    url: new URL(url),
    request: new Request(url, { method }),
    cookies,
    locals: { session: null, pendingReset: null, sessionRejected: false },
    getClientAddress: () => clientAddress,
    isDataRequest,
    isRemoteRequest,
    isSubRequest: false,
    params: {},
    route: { id: null },
    setHeaders: () => undefined,
  } as unknown as RequestEvent;

  return { event, written };
}

/** Whether the cookie was deleted, as a response deletes one. */
export const isDeleted = (cookie: WrittenCookie | undefined): boolean =>
  cookie?.value === '' && cookie.options?.maxAge === 0;
