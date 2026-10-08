import { page } from '$app/state';
import { signInDestination } from '$lib/signin/destination';

/**
 * Where the current page should land once it has signed someone in.
 *
 * Every sign-in method needs this and none of them should be re-deriving it,
 * so it lives beside `signInDestination` rather than inside any one of them.
 * The value is always a path on this site: see `destination.ts` for why that
 * takes the URL parser rather than a pattern.
 *
 * Read `page.url` through `$app/state`, so calling this inside a `$derived`
 * re-runs it when the query changes.
 */
export function nextDestination(): string {
  return signInDestination(page.url.searchParams.get('next') ?? undefined);
}
