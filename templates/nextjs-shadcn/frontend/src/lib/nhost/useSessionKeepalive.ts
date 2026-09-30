'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { nhost } from './client';
import { PROXY_REFRESH_MARGIN_SECONDS } from './refreshMargin';

/**
 * The margin `handleNhostProxy` hands to `nhost.refreshSession`, in the units
 * the wake-up below is computed in.
 *
 * Derived from the shared constant rather than restated, because the wake-up
 * is only correct relative to it: the proxy declines to rotate a token with
 * more than this long to live, so waking earlier spends a request on a proxy
 * that decides there is nothing to do, and the token dies anyway. `server.ts`
 * reads the same constant when it calls `refreshSession`, so the two cannot
 * drift apart - there is one number, not two that have to be kept in step.
 */
export const PROXY_REFRESH_MARGIN_MS = PROXY_REFRESH_MARGIN_SECONDS * 1000;

/**
 * How long before expiry to ask for a refresh.
 *
 * Inside the proxy's margin so the rotation actually happens, and far enough
 * inside it to leave the round trip time to complete before the token is dead.
 */
export const REFRESH_WITHIN_MS = 45_000;

// How long to wait before looking again after asking for a refresh. Long
// enough for the request to come back and put the rotated token in the cookie,
// so the next look reads the new expiry rather than the old one and asks a
// second time.
const AFTER_REFRESH_MS = 10_000;

// Signed out there is nothing to keep alive, but signing in does not remount
// this, so it keeps looking rather than stopping.
const IDLE_MS = 30_000;

// Never sleep longer than this, however far off the expiry is. A timer is not
// a clock: a suspended laptop, a changed system time, or a throttled
// background tab all make a long sleep land somewhere other than where it was
// aimed, and a bounded one is simply wrong for less time.
const MAX_SLEEP_MS = 60_000;

/** What the keepalive should do the moment it looks at the session. */
export type KeepaliveStep =
  | { action: 'refresh' }
  | { action: 'sleep'; ms: number };

/**
 * Decides whether the session needs refreshing now, or how long to wait before
 * asking again.
 *
 * Split out from the effect so the timing - the part that is easy to get
 * subtly wrong and impossible to notice for fifteen minutes - can be tested
 * without timers or a router.
 *
 * @param expiresAt - When the access token expires, in epoch milliseconds, or
 *   undefined when nobody is signed in. `decodeUserSession` stores this in
 *   milliseconds, not the seconds the JWT itself carries.
 * @param now - Epoch milliseconds.
 */
export function planKeepalive(
  expiresAt: number | undefined,
  now: number,
): KeepaliveStep {
  if (typeof expiresAt !== 'number') {
    return { action: 'sleep', ms: IDLE_MS };
  }

  const msLeft = expiresAt - now;

  // Already inside the window, or past it: a token that has expired still gets
  // one ask, because the refresh token it is stored beside long outlives it,
  // so the proxy can still trade it for a live session.
  if (msLeft <= REFRESH_WITHIN_MS) {
    return { action: 'refresh' };
  }

  return {
    action: 'sleep',
    ms: Math.min(msLeft - REFRESH_WITHIN_MS, MAX_SLEEP_MS),
  };
}

/**
 * Keeps the session from expiring under a page nobody is navigating away from.
 *
 * The browser client does not refresh: `client.ts` builds it without the SDK's
 * auto-refresh middleware on purpose, so that the proxy is the only thing in
 * the app that ever rotates a refresh token. Two rotators racing on a
 * single-use token is what used to sign people out at random.
 *
 * That leaves a gap this closes. The proxy only runs on a request to the
 * server, so a tab sitting on one page refreshes nothing, and once the access
 * token passes its lifetime (`AUTH_ACCESS_TOKEN_EXPIRES_IN`, 15 minutes by
 * default) the next client-side request - a TanStack Query refetch, a refetch
 * on window focus, any mutation - sends a dead token and Hasura answers
 * "Could not verify JWT: JWTExpired".
 *
 * So this asks for the current page again shortly before the token dies.
 * `router.refresh()` makes a new request to the server, which means it runs the
 * proxy, which rotates and writes the new session cookie; `CookieStorage` reads
 * that cookie fresh on every request, so the browser client picks the new token
 * up with no further help. The proxy stays the only rotator.
 */
export function useSessionKeepalive(): void {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function sleep(ms: number): void {
      if (stopped) {
        return;
      }

      timer = setTimeout(tick, Math.max(ms, 0));
    }

    function tick(): void {
      if (stopped) {
        return;
      }

      const step = planKeepalive(
        nhost.sessionStorage.get()?.decodedToken?.exp,
        Date.now(),
      );

      if (step.action === 'sleep') {
        sleep(step.ms);
        return;
      }

      router.refresh();
      sleep(AFTER_REFRESH_MS);
    }

    tick();

    // A background tab's timers are throttled and a sleeping machine's do not
    // run at all, so coming back to the tab is its own reason to look - and it
    // is exactly when the next request is about to be made.
    function handleVisibilityChange(): void {
      if (document.visibilityState !== 'visible') {
        return;
      }

      clearTimeout(timer);
      tick();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);
}
