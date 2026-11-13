/** Whether the visitor came here to sign up or to sign in. */
export type Intent = 'sign-in' | 'sign-up';

/** Sign up by default. */
export const DEFAULT_INTENT: Intent = 'sign-up';

export function signInIntent(value: string | string[] | undefined): Intent {
  const intent = Array.isArray(value) ? value[0] : value;

  return intent === 'sign-in' ? 'sign-in' : DEFAULT_INTENT;
}
