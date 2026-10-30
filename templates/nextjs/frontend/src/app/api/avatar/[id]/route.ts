import type { NextRequest } from 'next/server';
import { isAvatarType, isAvatarWidth, isFileId } from '@/app/account/avatar';
import { createNhostClient } from '@/lib/nhost/server';

// The storage service reads the session from an Authorization header, which an
// <img> cannot send, and it has no query-parameter token.

// Quality for a resized image, fixed rather than taken from the caller: one
// value per size means one cached variant per size. 80 is the usual place to
// stop paying bytes for detail an avatar cannot show.
const RESIZED_QUALITY = '80';

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

// `f=auto` picks AVIF, then WebP, then JPEG from what the browser said it
// takes, so a modern one gets the smaller format without this app deciding
// which.
const NEGOTIATED = 'accept';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // Before the session check, so a path that cannot be a file never reaches
  // storage, signed in or not.
  if (!isFileId(id)) {
    return new Response(null, { status: 404 });
  }

  // Same reasoning for the width: a value this app would never ask for is
  // refused here rather than handed to storage to render.
  const requested = request.nextUrl.searchParams.get('w');
  const width = requested === null ? undefined : Number(requested);

  if (width !== undefined && !isAvatarWidth(width)) {
    return new Response(null, { status: 400 });
  }

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

  // Built as a string, the way it always was: `id` is a UUID by here and the
  // transform values are this file's own, so there is nothing to escape and
  // nothing a parser would catch.
  let query = '';
  if (width !== undefined) {
    query = `?${new URLSearchParams({
      w: String(width),
      q: RESIZED_QUALITY,
      f: 'auto',
    })}`;

    const accept = request.headers.get(NEGOTIATED);
    if (accept) {
      headers.set(NEGOTIATED, accept);
    }
  }

  const upstream = await fetch(`${nhost.storage.baseURL}/files/${id}${query}`, {
    headers,
  });

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

  // This response is gated by the session cookie, so a shared cache between the
  // browser and this app must not hand it to another visitor.
  const cacheControl = response.get('cache-control');
  if (!cacheControl) {
    response.set('cache-control', 'private, no-cache');
  } else if (!/\bprivate\b/.test(cacheControl)) {
    response.set('cache-control', `private, ${cacheControl}`);
  }

  if (width !== undefined) {
    response.set('vary', NEGOTIATED);
  }

  return new Response(upstream.status === 304 ? null : upstream.body, {
    status: upstream.status,
    headers: response,
  });
}
