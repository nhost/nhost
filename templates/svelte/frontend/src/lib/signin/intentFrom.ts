import { page } from '$app/state';
import { type Intent, signInIntent } from '$lib/signin/intent';

/**
 * Whether the link that opened this page asked to sign up or to sign in.
 *
 * Beside `nextDestination` for the same reason: every method that opens a form
 * needs it, and none of them should be re-deriving it. Read through
 * `$app/state`, so calling this inside a `$derived` re-runs it when the query
 * changes.
 */
export function pageIntent(): Intent {
  return signInIntent(page.url.searchParams.get('intent') ?? undefined);
}
