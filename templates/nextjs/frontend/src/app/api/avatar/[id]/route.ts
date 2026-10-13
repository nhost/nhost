import type { NextRequest } from 'next/server';
import { isAvatarType } from '@/app/account/avatar';
import { createNhostClient } from '@/lib/nhost/server';

// The storage service reads the session from an Authorization header, which
// an <img> cannot send, and it has no query-parameter token. So the avatar is
// read here, server-side, with the session cookie's token, and streamed back.
// The caching headers come through intact, so the browser caches the image
// and revalidates it by ETag the same as it would against storage directly.

// What the browser's cache needs, as the storage service set them.
const PASS_THROUGH = [
  'content-type',
  'content-length',
  'etag',
  'last-modified',
  'cache-control',
  'cdn-cache-control',
];

// What the browser sends to ask whether its copy is still good.
const CONDITIONAL = ['if-none-match', 'if-modified-since'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session) {
    return new Response(null, { status: 401 });
  }

  const headers = new Headers({
    authorization: `Bearer ${session.accessToken}`,
  });
  for (const name of CONDITIONAL) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const upstream = await fetch(
    `${nhost.storage.baseURL}/files/${encodeURIComponent(id)}`,
    { headers },
  );

  // A 304 carries no body and no type, and a refusal is storage's own, so
  // only a file actually being served is checked.
  if (upstream.ok && !isAvatarType(upstream.headers.get('content-type'))) {
    await upstream.body?.cancel();
    return new Response(null, { status: 415 });
  }

  const response = new Headers();
  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) {
      response.set(name, value);
    }
  }

  // This response is gated by the session cookie, so a shared cache between
  // the browser and this app must not hand it to another visitor. The
  // browser's own cache still keeps it for the max-age storage set.
  const cacheControl = response.get('cache-control');
  if (cacheControl && !/\bprivate\b/.test(cacheControl)) {
    response.set('cache-control', `private, ${cacheControl}`);
  }

  return new Response(upstream.status === 304 ? null : upstream.body, {
    status: upstream.status,
    headers: response,
  });
}
