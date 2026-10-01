/**
 * The sign-in methods this app offers, one line each.
 *
 * Every method is its own directory under `app/auth/`, and nothing outside that
 * directory imports from it. To drop a method: delete its directory, then
 * delete its line here. That is the whole procedure - see README.md.
 *
 * This file has no imports on purpose: it is what lets the sign-in page list
 * the methods without depending on any of them.
 */
export type SignInMethod = {
  href: string;
  title: string;
  description: string;
};

export const methods: SignInMethod[] = [
  {
    href: '/auth/password',
    title: 'Email and password',
    description: 'Sign up or sign in with a password.',
  },
  {
    href: '/auth/magic-link',
    title: 'Magic link',
    description: 'Get a sign-in link by email.',
  },
  {
    href: '/auth/otp',
    title: 'Email code',
    description: 'Get a one-time code by email.',
  },
  {
    href: '/auth/oauth',
    title: 'GitHub or Google',
    description: 'Sign in with a provider account.',
  },
];
