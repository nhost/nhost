import type { SignInProvider } from '@nhost/nhost-js/auth';
import { oauthProviders } from '@/lib/nhost/env';

/** The providers this page can offer. */
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
 * Where a provider's button links: this app's own page, which notes the
 * attempt and sends the visitor on to the provider (see `[provider]/index.vue`).
 */
export function providerHref(id: SignInProvider): string {
  return `/auth/oauth/${id}`;
}

/**
 * Where a provider's Link account button on the account page goes, to add it to
 * the signed-in account (see `[provider]/connect/index.vue`).
 */
export function connectHref(id: SignInProvider): string {
  return `/auth/oauth/${id}/connect`;
}

/**
 * The providers `VITE_NHOST_OAUTH_PROVIDERS` turns on, a comma-separated list
 * of ids such as `github,google`.
 */
export function configuredProviders(value = oauthProviders()): Provider[] {
  const ids = new Set(
    (value ?? '').split(',').map((id) => id.trim().toLowerCase()),
  );

  return providers.filter((provider) => ids.has(provider.id));
}
