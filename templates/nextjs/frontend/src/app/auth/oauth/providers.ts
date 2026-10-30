import type { SignInProvider } from '@nhost/nhost-js/auth';

/** The providers this page can offer. */
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
 * show its account picker.
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
 * The providers `NHOST_OAUTH_PROVIDERS` turns on, a comma-separated list of ids
 * such as `github,google`.
 */
export function configuredProviders(
  value = process.env.NHOST_OAUTH_PROVIDERS,
): Provider[] {
  const ids = new Set(
    (value ?? '').split(',').map((id) => id.trim().toLowerCase()),
  );

  return providers.filter((provider) => ids.has(provider.id));
}
