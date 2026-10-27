/** Where signing in lands when nothing asked for somewhere else. */
export const DEFAULT_DESTINATION = '/account';

/** Link to sign-in that comes back to `destination` afterwards. */
export function signInHref(destination: string): string {
  return `/signin?next=${encodeURIComponent(destination)}`;
}

// Any absolute URL will do: resolving `next` against it is what says whether
// `next` stays on this site.
const RESOLUTION_BASE = 'https://placeholder.invalid';

// A path written the way RFC 3986 says one is sent: unreserved characters,
// sub-delims, `:`, `@`, `/` and complete percent escapes, nothing else.
const CANONICAL_PATH =
  /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/[\]]|%[0-9A-Fa-f]{2})*$/;

/**
 * Where to go after signing in, from an untrusted `?next=`: a path on this
 * site in canonical form, or the default. The README's design notes say why
 * the shape of the value is not enough to decide that.
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
