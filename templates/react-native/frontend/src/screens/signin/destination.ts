import { first, type SearchParam } from '@/lib/utils';

/** Where signing in lands when nothing asked for somewhere else. */
export const DEFAULT_DESTINATION = '/account';

/** Link to sign-in that comes back to `destination` afterwards. */
export function signInHref(destination: string): string {
  return `/signin?next=${encodeURIComponent(destination)}`;
}

// A path written the way RFC 3986 says one is sent: unreserved characters,
// sub-delims, `:`, `@`, `/` and complete percent escapes, nothing else.
const CANONICAL_PATH =
  /^(?:[A-Za-z0-9\-._~!$&'()*+,;=:@/[\]]|%[0-9A-Fa-f]{2})*$/;

// `.` or `..`, including their percent-encoded spellings, which a URL parser
// removes along with the segment before them.
const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i;

/**
 * Where to go after signing in, from an untrusted `?next=`: a path in this app
 * in canonical form, or the default. React Native's global `URL` does not
 * resolve paths the way the URL standard does, so the forms that a resolver
 * would turn into another host (`//host`, `/\host`, `/..//host`) are refused by
 * their spelling instead.
 */
export function signInDestination(value: SearchParam): string {
  const next = first(value);

  // A path, not merely a link into the app: without this, `evil.example`
  // would be read as a relative path and kept.
  if (!next?.startsWith('/') || next.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }

  const path = next.split(/[?#]/, 1)[0] ?? '';

  if (!CANONICAL_PATH.test(path)) {
    return DEFAULT_DESTINATION;
  }

  if (path.split('/').some((segment) => DOT_SEGMENT.test(segment))) {
    return DEFAULT_DESTINATION;
  }

  return next;
}
