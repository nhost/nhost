/**
 * Whether the visitor came here to sign up or to sign in.
 *
 * Signing up and signing in are different things, and which one someone wants
 * is not something this app can work out: a password form has to open on one
 * of them. So the link that sent them here says, and that answer rides along
 * on `?intent=` the same way `?next=` does.
 *
 * It only ever changes which mode a form opens in. Nothing is gated on it, so
 * a crafted or missing value costs nothing.
 */
export type Intent = 'sign-in' | 'sign-up';

/**
 * Sign up by default.
 *
 * Anyone running this against a fresh local backend has no account yet, so
 * opening on a sign-in form is a dead end: they would have to notice the
 * "Create an account" link before anything worked. Someone who does have an
 * account arrives through a link that says `intent=sign-in`.
 */
export const DEFAULT_INTENT: Intent = 'sign-up';

export function signInIntent(value: string | string[] | undefined): Intent {
  const intent = Array.isArray(value) ? value[0] : value;

  return intent === 'sign-in' ? 'sign-in' : DEFAULT_INTENT;
}
