/**
 * Where signing in lands when nothing asked for somewhere else.
 *
 * Home, not the protected view: signing in is not by itself a request to go
 * anywhere. Somewhere specific only happens when the link that started it said
 * so, which is what `signInHref` is for.
 */
export const DEFAULT_DESTINATION = '/';

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

// Any absolute URL will do: resolving `next` against it is what says whether
// `next` stays on this site. `.invalid` is reserved by RFC 2606 and can never
// be a real origin, so no `next` can be crafted to match it.
const RESOLUTION_BASE = 'https://placeholder.invalid';

/**
 * Where to go after signing in, from an untrusted `?next=`.
 *
 * Anything that is not a path on this site falls back to the default. Deciding
 * that takes the URL parser rather than a pattern, because the browser is what
 * ultimately resolves this value and it reads more things as another origin
 * than they look. `//evil.example` is the familiar one, but `/\evil.example`
 * parses to the same URL, and a raw tab or newline is stripped before parsing,
 * so the two characters `/` and a literal tab ahead of `/evil.example` do too.
 * Percent-encoded they do not: `/%09/evil.example` stays a path on this site.
 * Each of the reachable ones passes a "starts with one slash but not two"
 * check and leaves the site.
 *
 * So resolve it the way the browser will, and keep it only if it landed back
 * here. What is returned is the original string rather than the parsed form: a
 * value that resolves to this origin resolves to it again wherever it is used,
 * and re-serializing would percent-encode a query string that callers
 * round-trip through `signInHref`.
 */
export function signInDestination(
  value: string | string[] | undefined,
): string {
  const next = Array.isArray(value) ? value[0] : value;

  // A path, not merely same-origin: without this, `evil.example` would resolve
  // to a relative path on this site and be kept.
  if (!next?.startsWith('/')) {
    return DEFAULT_DESTINATION;
  }

  let resolved: URL;
  try {
    resolved = new URL(next, RESOLUTION_BASE);
  } catch {
    return DEFAULT_DESTINATION;
  }

  if (resolved.origin !== RESOLUTION_BASE) {
    return DEFAULT_DESTINATION;
  }

  return next;
}
