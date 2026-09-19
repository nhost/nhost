/**
 * Where signing in lands when nothing asked for somewhere else.
 *
 * Home, not the protected view: signing in is not by itself a request to go
 * anywhere. Somewhere specific only happens when the link that started it said
 * so, which is what `signInHref` is for.
 */
export const DEFAULT_DESTINATION = '/';

/**
 * Throwaway origin `next` is resolved against so the URL parser, not this code,
 * decides whether a value stays a same-site path. `.invalid` is reserved by RFC
 * 6761 and never resolves, so it can never collide with a real destination.
 */
const RESOLUTION_ORIGIN = 'http://placeholder.invalid';

/**
 * Link to sign-in that comes back to `destination` afterwards.
 *
 * Anything that would otherwise send a signed-out visitor to a protected page
 * should point here instead. Following the link gets the modal over the page
 * they are on; a protected page's own redirect uses it too, so arriving the
 * long way round still ends up where they were going.
 */
export function signInHref(destination: string): string {
  return `/signin?next=${encodeURIComponent(destination)}`;
}

/**
 * Where to go after signing in, from an untrusted `?next=`.
 *
 * Anything that is not a path on this site falls back to the default. The
 * browser, not this string, decides where `next` lands: `SignInForm` hands it
 * to `window.location.replace`, and a special-scheme URL parser reads
 * `//evil.example`, `/\evil.example`, and even a `/<tab>/evil.example` that
 * survives whitespace stripping as another origin. So a bare "starts with a
 * slash" check, or one that only rejects a literal `//`, would hand someone an
 * open redirect off the back of your sign-in page.
 *
 * Resolving `next` against a throwaway origin defers to the same parser the
 * browser uses, and the resolved same-origin path is what comes back, not the
 * raw string. A value whose authority the parser reads as another host resolves
 * to a different origin and falls back. A path that stays on the throwaway
 * origin but is itself protocol-relative, which is what a `..` can collapse a
 * pathname into, starts with `//` or `/\` and falls back too, because a browser
 * reads that leading slash pair as an authority on a real origin.
 */
export function signInDestination(
  value: string | string[] | undefined,
): string {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next?.startsWith('/')) {
    return DEFAULT_DESTINATION;
  }

  let resolved: URL;
  try {
    resolved = new URL(next, RESOLUTION_ORIGIN);
  } catch {
    return DEFAULT_DESTINATION;
  }

  const path = resolved.pathname + resolved.search + resolved.hash;

  if (
    resolved.origin !== RESOLUTION_ORIGIN ||
    path.startsWith('//') ||
    path.startsWith('/\\')
  ) {
    return DEFAULT_DESTINATION;
  }

  return path;
}
