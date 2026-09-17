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

/**
 * Where to go after signing in, from an untrusted `?next=`.
 *
 * Anything that is not a path on this site falls back to the default. The
 * `//` case is the one worth spelling out: a browser reads `//evil.example`
 * as another origin, so a bare "starts with a slash" check would hand someone
 * an open redirect off the back of your sign-in page.
 */
export function signInDestination(
  value: string | string[] | undefined,
): string {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }

  return next;
}
