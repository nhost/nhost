import { createServerClient, type NhostClient } from "@nhost/nhost-js";
import { DEFAULT_SESSION_KEY, type Session } from "@nhost/nhost-js/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const key = DEFAULT_SESSION_KEY;

/**
 * Creates an Nhost client for use in server components.
 *
 * We rely on the vanilla createClient method from the Nhost JS SDK and a SessionStorage
 * customized to be able to retrieve the session from cookies in Next.js server components.
 *
 * IMPORTANT!!! We need to disable the auto-refresh token feature as we are handling it in
 * the middleware and server components are not allowed to write to cookies. Any session
 * refreshed in a server component will not be persisted and might lead to issues with the session.
 *
 */
export async function createNhostClient(): Promise<NhostClient> {
  const cookieStore = await cookies();

  const nhost = createServerClient({
    region: process.env["NHOST_REGION"] || "local",
    subdomain: process.env["NHOST_SUBDOMAIN"] || "local",
    storage: {
      // storage compatible with Next.js server components
      get: (): Session | null => {
        const s = cookieStore.get(key)?.value || null;
        if (!s) {
          return null;
        }
        const session = JSON.parse(s) as Session;
        return session;
      },
      set: (value: Session) => {
        cookieStore.set(key, JSON.stringify(value));
      },
      remove: () => {
        cookieStore.delete(key);
      },
    },
  });

  return nhost;
}

/**
 * Middleware function to handle Nhost authentication and session management.
 *
 * This function is designed to be used in Next.js middleware to manage user sessions
 * and refresh tokens. Refreshing the session needs to be done in the middleware
 * to ensure that the session is always up-to-date an accessible by both server and client components.
 *
 * @param {NextRequest} request - The incoming Next.js request object
 * @param {NextResponse} response - The outgoing Next.js response object
 */
export async function handleNhostMiddleware(
  request: NextRequest,
  response: NextResponse<unknown>,
): Promise<Session | null> {
  const nhost = createServerClient({
    region: process.env["NHOST_REGION"] || "local",
    subdomain: process.env["NHOST_SUBDOMAIN"] || "local",
    storage: {
      // storage compatible with Next.js middleware
      get: (): Session | null => {
        const raw = request.cookies.get(key)?.value || null;
        if (!raw) {
          return null;
        }
        const session = JSON.parse(raw) as Session;
        return session;
      },
      set: (value: Session) => {
        response.cookies.set({
          name: key,
          value: JSON.stringify(value),
          path: "/",
          httpOnly: false, //if set to true we can't access it in the client
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
        });
      },
      remove: () => {
        response.cookies.delete(key);
      },
    },
  });

  // we only want to refresh the session if  the token will
  // expire in the next 60 seconds
  return await nhost.refreshSession(60);
}
