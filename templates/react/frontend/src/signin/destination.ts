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

// A path written the way RFC 3986 says one is sent: unreserved characters,
// sub-delims, `:`, `@`, `/` and complete percent escapes, nothing else. Plus
// `[` and `]`, which RFC 3986 only allows in a host: the browser leaves
// them raw in `location.pathname`, so without them a `next` taken from the
// address would be lost for any path containing one, and neither the auth
// service nor the browser rewrites them.
const CANONICAL_PATH =
  /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/[\]]|%[0-9A-Fa-f]{2})*$/;

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
 * here with a path that would land here again. That second part is for dot
 * segments: `/..//evil.example` resolves to this site, but with the path
 * `//evil.example`, and once an auth email or OAuth redirect has sent the
 * browser to it that is what `location.pathname` holds. Read back as a URL of
 * its own, which is how anything rebuilding the address uses it, that path
 * names another origin.
 *
 * The path is resolved here once, but on the way back it is parsed again by
 * the auth service and then by the browser, and the check only says anything
 * if they all read the same path. A path in canonical form is one none of them
 * rewrites, so anything else is refused. Without that, a trailing space is
 * trimmed when it is resolved here, but the auth service encodes it to `%20`
 * first, so `/.//.. ` resolves to `/` and lands on `//..%20`. And a raw space or
 * `|` anywhere in the path makes the auth service re-encode it from its
 * decoded form, which turns `%2F` into `/`, so `/a b/..%2F..%2F%2Fevil.example`
 * lands on `//evil.example`. The query is not held to this: it never changes
 * the path, and `signInHref` round-trips it unencoded. So a `next` whose path
 * has a raw space, a non-ASCII character or anything else outside that set is
 * dropped for home; percent-encoded, as `location.pathname` has it, it is kept.
 *
 * What is returned is the original string rather than the parsed form:
 * re-serializing would percent-encode a query string that callers round-trip
 * through `signInHref`.
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

  if (!CANONICAL_PATH.test(next.split(/[?#]/, 1)[0] ?? '')) {
    return DEFAULT_DESTINATION;
  }

  let resolved: URL;
  try {
    resolved = new URL(next, RESOLUTION_BASE);
  } catch {
    return DEFAULT_DESTINATION;
  }

  if (
    resolved.origin !== RESOLUTION_BASE ||
    resolved.pathname.startsWith('//')
  ) {
    return DEFAULT_DESTINATION;
  }

  return next;
}
