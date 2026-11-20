import type { SignInProvider } from '@nhost/nhost-js/auth';
import { oauthProviders } from '@/lib/nhost/env';

/** The providers this app can offer. */
const providers = [
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
 * How the sign-in list names a provider when it marks the way the visitor last
 * signed in. The other methods are named by their screen; a provider has none.
 */
export function providerHref(id: SignInProvider): string {
  return `/auth/oauth/${id}`;
}

/**
 * The providers `EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS` turns on, a
 * comma-separated list of ids such as `github,google`.
 */
export function configuredProviders(value = oauthProviders()): Provider[] {
  const ids = new Set(
    (value ?? '').split(',').map((id) => id.trim().toLowerCase()),
  );

  return providers.filter((provider) => ids.has(provider.id));
}
