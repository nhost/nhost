/**
 * Where signing in lands when nothing asked for somewhere else.
 *
 * Home, not the protected view: signing in is not by itself a request to go
 * anywhere. Somewhere specific only happens when the link that started it
 * carried a `next`, which `signInRoute` puts there.
 */
export const DEFAULT_DESTINATION = '/';

// Any absolute URL will do: resolving `next` against it is what says whether
// `next` stays a path inside this app. `.invalid` is reserved by RFC 2606 and
// can never be a real origin, so no `next` can be crafted to match it.
const RESOLUTION_BASE = 'https://placeholder.invalid';

/**
 * Where to go after signing in, from an untrusted `next`.
 *
 * Anything that is not a path inside this app falls back to the default. The
 * value is navigated to, under either navigation system, and put into the deep
 * link an auth email comes back on. Telling a path inside this app from
 * anything else takes the URL parser rather than a pattern, because a parser
 * reads more things as another origin than they look. `//evil.example` is the
 * familiar one, but `/\evil.example` parses to the same URL, and a raw tab or
 * newline is stripped before parsing, so the two characters `/` and a literal
 * tab ahead of `/evil.example` do too. Percent-encoded they do not:
 * `/%09/evil.example` stays a path inside the app. Each of the reachable ones
 * passes a "starts with one slash but not two" check and resolves off the base.
 *
 * So resolve it the way a URL parser will, and keep it only if it landed back
 * on the base.
 *
 * Then keep it only if resolving left its path as written and it has no
 * fragment, because the two navigation systems read it differently and agree
 * only then. Expo Router parses it as a URL, which resolves dot segments and
 * turns a fragment into a parameter; React Navigation matches each segment as
 * written and has no fragment. So `/auth/../protected` or `/protected#top`
 * would land on the protected screen under one and on the home screen under
 * the other. The query is not held to this: both read it into parameters.
 * A path with a character the parser percent-encodes, like `/notes/café` or
 * `/notes/my note`, changes too, so it also falls back to the default.
 *
 * What is returned is the original string rather than the parsed form: a
 * value that resolves to the base resolves to it again wherever it is used,
 * and re-serializing would percent-encode its query string.
 */
export function signInDestination(
  value: string | string[] | undefined,
): string {
  const next = Array.isArray(value) ? value[0] : value;

  // A path, not merely same-origin: without this, `evil.example` would resolve
  // as a relative path onto the base and be kept.
  if (!next?.startsWith('/')) {
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
    resolved.pathname !== next.split('?', 1)[0] ||
    next.includes('#')
  ) {
    return DEFAULT_DESTINATION;
  }

  return next;
}
