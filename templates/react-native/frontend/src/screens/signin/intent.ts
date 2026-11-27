import { first, type SearchParam } from '@/lib/utils';

/** Whether the visitor came here to sign up or to sign in. */
export type Intent = 'sign-in' | 'sign-up';

/** Sign up by default. */
export const DEFAULT_INTENT: Intent = 'sign-up';

export function signInIntent(value: SearchParam): Intent {
  return first(value) === 'sign-in' ? 'sign-in' : DEFAULT_INTENT;
}
