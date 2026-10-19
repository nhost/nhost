import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/avatar/[id]/route';

const client = vi.hoisted(() => ({
  session: null as { accessToken: string } | null,
  storage: { baseURL: 'https://storage.test/v1' },
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    storage: client.storage,
  }),
}));

const fetchMock = vi.fn();

const FILE_ID = '0b5e3f6c-8d2a-4c1e-9f7b-3a6d2e1c4b5a';

const get = (
  id: string,
  headers: Record<string, string> = {},
  query = '',
): Promise<Response> =>
  GET(
    new NextRequest(`http://app.test/api/avatar/${id}${query}`, { headers }),
    {
      params: Promise.resolve({ id }),
    },
  );

const calledURL = (): string => (fetchMock.mock.calls[0] as [string])[0];

const upstream = (
  status: number,
  headers: Record<string, string>,
  body: string | null = 'png-bytes',
): Response => new Response(body, { status, headers });

describe('avatar route', () => {
  beforeEach(() => {
    client.session = { accessToken: 'access-token' };
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses without a session, before touching storage', async () => {
    client.session = null;

    expect((await get(FILE_ID)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the file from storage with the session token', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, {}));

    await get(FILE_ID);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://storage.test/v1/files/${FILE_ID}`);
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
  });

  // `files/..` would resolve to the storage root and carry the token there.
  it.each(['..', '../other', 'file-1', ''])(
    'answers 404 for %j without touching storage',
    async (id) => {
      expect((await get(id)).status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('refuses a non-file id before asking for a session', async () => {
    client.session = null;

    expect((await get('..')).status).toBe(404);
  });

  it('takes an uppercase id', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, {}));

    await get(FILE_ID.toUpperCase());

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      `https://storage.test/v1/files/${FILE_ID.toUpperCase()}`,
    );
  });

  it('passes the caching headers through, marked private', async () => {
    fetchMock.mockResolvedValueOnce(
      upstream(200, {
        'content-type': 'image/png',
        'cache-control': 'max-age=3600',
        etag: '"abc"',
        'x-request-id': 'should-not-pass',
      }),
    );

    const response = await get(FILE_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(response.headers.get('x-request-id')).toBeNull();
    expect(await response.text()).toBe('png-bytes');
  });

  // Without an explicit freshness a shared cache may keep a response on the
  // strength of Last-Modified alone, cookie or not.
  it('marks the response private when storage sent no cache-control', async () => {
    fetchMock.mockResolvedValueOnce(
      upstream(200, {
        'content-type': 'image/png',
        etag: '"abc"',
        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
      }),
    );

    const response = await get(FILE_ID);

    expect(response.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('serves a raster type that carries parameters', async () => {
    fetchMock.mockResolvedValueOnce(
      upstream(200, { 'content-type': 'image/png; charset=binary' }),
    );

    const response = await get(FILE_ID);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('png-bytes');
  });

  // Storage takes any file into the bucket and the account's avatar_url can
  // name any of them, so the type is checked here rather than trusted.
  it.each(['text/html; charset=utf-8', 'image/svg+xml'])(
    'refuses %s without its body',
    async (type) => {
      fetchMock.mockResolvedValueOnce(
        upstream(200, { 'content-type': type }, '<script>alert(1)</script>'),
      );

      const response = await get(FILE_ID);

      expect(response.status).toBe(415);
      expect(response.body).toBeNull();
      expect(response.headers.get('content-type')).toBeNull();
    },
  );

  it('forwards the conditional headers and relays a 304', async () => {
    fetchMock.mockResolvedValueOnce(upstream(304, { etag: '"abc"' }, null));

    const response = await get(FILE_ID, { 'if-none-match': '"abc"' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('if-none-match')).toBe('"abc"');
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(response.headers.get('etag')).toBe('"abc"');
  });

  it('relays a refusal from storage as it is', async () => {
    fetchMock.mockResolvedValueOnce(upstream(403, {}, 'forbidden'));

    expect((await get(FILE_ID)).status).toBe(403);
  });

  // Storage resizes on the way out, so the 5 MB a visitor may have uploaded
  // never has to cross the wire to fill a 96px circle.
  describe('resizing', () => {
    it('asks storage for the width, a fixed quality and a negotiated format', async () => {
      fetchMock.mockResolvedValueOnce(upstream(200, {}));

      await get(FILE_ID, {}, '?w=192');

      const url = new URL(calledURL());
      expect(url.searchParams.get('w')).toBe('192');
      expect(url.searchParams.get('q')).toBe('80');
      expect(url.searchParams.get('f')).toBe('auto');
    });

    // `f=auto` reads Accept to choose AVIF or WebP, so it has to go upstream,
    // and the answer varies by it, so the response has to say so.
    it('forwards Accept and marks the response as varying on it', async () => {
      fetchMock.mockResolvedValueOnce(
        upstream(200, { 'content-type': 'image/webp' }),
      );

      const response = await get(
        FILE_ID,
        { accept: 'image/avif,image/webp,*/*' },
        '?w=64',
      );

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get('accept')).toBe(
        'image/avif,image/webp,*/*',
      );
      expect(response.headers.get('vary')).toBe('accept');
    });

    // An open `w` would let anyone make storage render any size of every
    // avatar they can see, and fill a cache with the results.
    it.each(['?w=97', '?w=0', '?w=-1', '?w=abc', '?w=', '?w=64.5'])(
      'refuses %s without touching storage',
      async (query) => {
        expect((await get(FILE_ID, {}, query)).status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    // The plain URL is what `avatar_url` holds, so it still answers with the
    // file exactly as it was uploaded.
    it('transforms nothing when no width is asked for', async () => {
      fetchMock.mockResolvedValueOnce(
        upstream(200, { 'content-type': 'image/png' }),
      );

      const response = await get(FILE_ID);

      expect(calledURL()).toBe(`https://storage.test/v1/files/${FILE_ID}`);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get('accept')).toBeNull();
      expect(response.headers.get('vary')).toBeNull();
    });

    // A resized AVIF or WebP is still a raster image, so it passes the same
    // check the original does.
    it('serves a format storage negotiated into', async () => {
      fetchMock.mockResolvedValueOnce(
        upstream(200, { 'content-type': 'image/avif' }),
      );

      const response = await get(FILE_ID, { accept: 'image/avif' }, '?w=192');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/avif');
    });
  });
});
