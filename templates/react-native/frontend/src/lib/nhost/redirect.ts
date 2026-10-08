import { redirectURL } from '@/lib/nhost/env';
import { signInDestination } from '@/signin/destination';

/**
 * The deep link an auth email or an OAuth callback should come back to.
 *
 * Every sign-in method that hands the backend a `redirectTo` builds it here,
 * and this is the only place that decides what `next` is allowed to be. The
 * screen that read `next` has already validated it; this validates it again
 * because the value ends up in an email, and a link into this app can carry
 * any `next` someone cares to put in it. One helper rather than the same two
 * lines in four methods, so the rule holds in one place and is tested once.
 */
export function authRedirectURL(next: string): string {
  return redirectURL(signInDestination(next));
}
