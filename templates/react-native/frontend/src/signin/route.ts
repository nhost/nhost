import type { Destination, Params } from '@/lib/navigation';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { DEFAULT_INTENT, type Intent } from '@/signin/intent';

/**
 * Where a sign-in link goes, carrying what has to survive the hop.
 *
 * `next` is where the user was going and `intent` is whether they came to sign
 * up or to sign in. Both have to survive every hop: the sign-in screen's links
 * out to each method, and each method's "Other ways to sign in" link back. A
 * hop that drops one sends someone who asked to sign in to a screen headed
 * "Create an account", or forgets the screen they were trying to reach.
 *
 * One function builds every such link so there is no second place for the two
 * to be assembled differently. Defaults are left off rather than spelled out,
 * and a link carrying neither is the bare path, so an ordinary visit puts no
 * parameters on the route at all.
 *
 * It only uses the seam's own types, so it works under either navigation
 * system.
 */
export function signInRoute(
  pathname: string,
  destination: string,
  intent: Intent,
): Destination {
  const params: Params = {};

  if (destination !== DEFAULT_DESTINATION) {
    params['next'] = destination;
  }

  if (intent !== DEFAULT_INTENT) {
    params['intent'] = intent;
  }

  return Object.keys(params).length > 0 ? { pathname, params } : pathname;
}
