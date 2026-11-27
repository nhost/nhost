import { DEFAULT_DESTINATION } from '@/screens/signin/destination';
import { DEFAULT_INTENT, type Intent } from '@/screens/signin/intent';

/** The query a sign-in link carries, or '' when both parts are the default. */
export function signInQuery(destination: string, intent: Intent): string {
  const params = new URLSearchParams();

  if (destination !== DEFAULT_DESTINATION) {
    params.set('next', destination);
  }

  if (intent !== DEFAULT_INTENT) {
    params.set('intent', intent);
  }

  const search = params.toString();

  return search === '' ? '' : `?${search}`;
}
