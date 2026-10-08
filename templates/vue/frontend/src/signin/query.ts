import { DEFAULT_DESTINATION } from '@/signin/destination';
import { DEFAULT_INTENT, type Intent } from '@/signin/intent';

/**
 * The query a sign-in link carries, or '' when both parts are the default.
 *
 * `next` is where the visitor was going and `intent` is whether they came to
 * sign up or to sign in. Both have to survive every hop: the sign-in page's
 * links out to each method, and each method's "Other ways to sign in" link
 * back. A hop that drops one sends someone who asked to sign in to a page
 * headed "Create an account", or forgets the page they were trying to reach.
 *
 * One function builds the whole query so there is no second place for the two
 * to be assembled differently. Defaults are left off rather than spelled out,
 * so an ordinary visit leaves a clean URL and only a deliberate choice shows
 * up in it.
 */
export function signInQuery(destination: string, intent: Intent): string {
  const params = new URLSearchParams();

  if (destination !== DEFAULT_DESTINATION) {
    params.set('next', destination);
  }

  if (intent !== DEFAULT_INTENT) {
    params.set('intent', intent);
  }

  return params.size > 0 ? `?${params}` : '';
}
