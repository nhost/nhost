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
  });
});
