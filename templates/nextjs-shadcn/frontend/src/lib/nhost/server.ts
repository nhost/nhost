import { createServerClient, type NhostClient } from '@nhost/nhost-js';
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from '@nhost/nhost-js/session';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

const key = DEFAULT_SESSION_KEY;

const region = (): string => process.env['NHOST_REGION'] || 'local';
const subdomain = (): string => process.env['NHOST_SUBDOMAIN'] || 'local';

const cookieOptions = {
  httpOnly: false,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30,
} as const;

export function decodeSessionCookie(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as StoredSession;
  } catch {
    return null;
  }
}

export function encodeSessionCookie(value: StoredSession): string {
  return encodeURIComponent(JSON.stringify(value));
}

/**
 * Creates an Nhost client for use in server components and server actions.
 *
 * It wires the SDK's session storage to Next.js cookies so the session can be
 * read on the server. Refreshing the session happens in the proxy (see
 * `proxy.ts`), where both the request and response cookies are available.
 */
export async function createNhostClient(): Promise<NhostClient> {
  const cookieStore = await cookies();

  return createServerClient({
    region: region(),
    subdomain: subdomain(),
    storage: {
      get: (): StoredSession | null =>
        decodeSessionCookie(cookieStore.get(key)?.value || null),
      set: (value: StoredSession) => {
        cookieStore.set(key, encodeSessionCookie(value), cookieOptions);
      },
      remove: () => {
        cookieStore.delete(key);
      },
    },
  });
}

/**
 * Refreshes the Nhost session from the Next.js proxy.
 *
 * Refreshing must happen in the proxy because it is the only place where the
 * refreshed session can be written back to a response cookie that is visible to
 * both server and client components on the next request.
 */
export async function handleNhostProxy(
  request: NextRequest,
  response: NextResponse<unknown>,
): Promise<StoredSession | null> {
  const nhost = createServerClient({
    region: region(),
    subdomain: subdomain(),
    storage: {
      get: (): StoredSession | null =>
        decodeSessionCookie(request.cookies.get(key)?.value || null),
      set: (value: StoredSession) => {
        response.cookies.set({
          name: key,
          value: encodeSessionCookie(value),
          ...cookieOptions,
        });
      },
      remove: () => {
        response.cookies.delete(key);
      },
    },
  });

  return nhost.refreshSession(60);
}
