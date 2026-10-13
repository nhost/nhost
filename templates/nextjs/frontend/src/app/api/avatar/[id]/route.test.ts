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

const get = (
  id: string,
  headers: Record<string, string> = {},
): Promise<Response> =>
  GET(new NextRequest(`http://app.test/api/avatar/${id}`, { headers }), {
    params: Promise.resolve({ id }),
  });

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

    expect((await get('file-1')).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the file from storage with the session token', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, {}));

    await get('file-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://storage.test/v1/files/file-1');
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
  });

  // The id lands in a path, so anything that would escape it is encoded
  // rather than passed along.
  it('encodes the id into the path', async () => {
    fetchMock.mockResolvedValueOnce(upstream(404, {}));

    await get('../other');

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://storage.test/v1/files/..%2Fother',
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

    const response = await get('file-1');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(response.headers.get('x-request-id')).toBeNull();
    expect(await response.text()).toBe('png-bytes');
  });

  it('forwards the conditional headers and relays a 304', async () => {
    fetchMock.mockResolvedValueOnce(upstream(304, { etag: '"abc"' }, null));

    const response = await get('file-1', { 'if-none-match': '"abc"' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('if-none-match')).toBe('"abc"');
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });

  it('relays a refusal from storage as it is', async () => {
    fetchMock.mockResolvedValueOnce(upstream(403, {}, 'forbidden'));

    expect((await get('theirs')).status).toBe(403);
  });
});
