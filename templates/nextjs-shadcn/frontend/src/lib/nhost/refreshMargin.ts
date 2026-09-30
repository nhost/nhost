/**
 * How much life a token must have left before the proxy stops bothering to
 * rotate it, in seconds. `handleNhostProxy` hands this to
 * `nhost.refreshSession`, and `useSessionKeepalive` times its wake-up against
 * it: waking outside this window spends a request on a proxy that decides
 * there is nothing to do, and the token then expires anyway.
 *
 * It lives in a module of its own because it is one decision two files have to
 * agree on, and neither can import it from the other. `server.ts` reaches for
 * `next/headers`, so pulling it into `useSessionKeepalive.ts` puts server-only
 * code in the client graph and the build fails outright:
 *
 *   You're importing a module that depends on "next/headers". This API is
 *   only available in Server Components in the App Router.
 *
 * And the reverse is no better: `useSessionKeepalive.ts` is a `'use client'`
 * module, whose exports become client references rather than plain values when
 * server code reads them. A file with no imports of its own is reachable from
 * both sides, which is what turns "keep these two numbers in step" from a
 * comment into something the compiler enforces.
 */
export const PROXY_REFRESH_MARGIN_SECONDS = 60;
