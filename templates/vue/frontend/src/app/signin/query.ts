import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { DEFAULT_INTENT, type Intent } from '@/app/signin/intent';

/** The query a sign-in link carries, or '' when both parts are the default. */
export function signInQuery(destination: string, intent: Intent): string {
  const params = new URLSearchParams();

  if (destination !== DEFAULT_DESTINATION) {
    params.set('next', destination);
  }

  if (intent !== DEFAULT_INTENT) {
    params.set('intent', intent);
  }

  // Not `params.size`: Safari 16, which these builds still target, does not
  // have it, and reading it there would drop the whole query.
  const search = params.toString();

  return search === '' ? '' : `?${search}`;
}
