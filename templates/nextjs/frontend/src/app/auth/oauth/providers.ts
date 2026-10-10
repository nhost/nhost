import type { SignInProvider } from '@nhost/nhost-js/auth';

/**
 * The providers this page offers. Adding one is a line here and a section in
 * `nhost.toml`; the button and the redirect are the same for all of them.
 */
export const providers = [
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'google', label: 'Continue with Google' },
] as const satisfies ReadonlyArray<{ id: SignInProvider; label: string }>;
