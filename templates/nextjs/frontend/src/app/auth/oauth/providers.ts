import type { SignInProvider } from '@nhost/nhost-js/auth';

/**
 * The providers this page can offer. Adding one is a line here and a section
 * in `nhost.toml`; the button and the redirect are the same for all of them.
 */
export const providers = [
  { id: 'github', name: 'GitHub', label: 'Continue with GitHub' },
  { id: 'google', name: 'Google', label: 'Continue with Google' },
] as const satisfies ReadonlyArray<{
  id: SignInProvider;
  name: string;
  label: string;
}>;

export type Provider = (typeof providers)[number];

/**
 * Passed on to the provider on every trip there, signing in and linking, to
 * show its account picker. A provider the user has authorized before
 * otherwise answers at once with whichever account is signed in there, even
 * after the user unlinked it here, since that does not revoke the app on the
 * provider's side. The picker is the one step GitHub can be made to show,
 * and it lets the user choose which of their accounts to use.
 */
export const ACCOUNT_PICKER = { prompt: 'select_account' };

/**
 * Where a provider's button links: this app's own route, which notes the
 * attempt and sends the visitor on to the provider (see `[provider]/route.ts`).
 */
export function providerHref(id: SignInProvider): string {
  return `/auth/oauth/${id}`;
}

/**
 * Where a provider's Link account button on the account page goes, to add it to
 * the signed-in account (see `[provider]/connect/route.ts`).
 */
export function connectHref(id: SignInProvider): string {
  return `/auth/oauth/${id}/connect`;
}

/**
 * The providers `NHOST_OAUTH_PROVIDERS` turns on, a comma-separated list of
 * ids such as `github,google`.
 *
 * A provider only works once the backend has its credentials and `enabled =
 * true` in `nhost.toml`, and neither is anything this app can read, so the
 * deployment says which ones it set up. Unset, none are offered: a button for
 * a provider nobody configured only leads to the auth service refusing it.
 *
 * Read on the server at request time, so changing it needs a restart, not a
 * rebuild. Unknown ids are ignored, and the order is this file's, not the
 * variable's.
 */
export function configuredProviders(
  value = process.env.NHOST_OAUTH_PROVIDERS,
): Provider[] {
  const ids = new Set(
    (value ?? '').split(',').map((id) => id.trim().toLowerCase()),
  );

  return providers.filter((provider) => ids.has(provider.id));
}
