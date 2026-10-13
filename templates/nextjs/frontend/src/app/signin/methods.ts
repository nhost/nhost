/**
 * The sign-in methods this app offers, one line each.
 *
 * Every method is its own directory under `src/app/auth/`, and nothing
 * outside that directory imports from it. To drop a method: delete its
 * directory, then delete its line here. That is the whole procedure.
 *
 * This file has no imports on purpose: it is what lets the sign-in page list
 * the methods without depending on any of them.
 *
 * `account` is how a method puts something on the account page. The page
 * links to it as data rather than importing it, so deleting the method takes
 * the link with it and nothing else.
 */
export type SignInMethod = {
  href: string;
  title: string;
  description: string;
  account?: { href: string; title: string; description: string };
};

export const methods: SignInMethod[] = [
  {
    href: '/auth/password',
    title: 'Email and password',
    description: 'Sign up or sign in with a password.',
    account: {
      href: '/auth/password/mfa',
      title: 'Two-factor authentication',
      description: 'Ask for a code from an authenticator app at sign-in.',
    },
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
  {
    href: '/auth/passkey',
    title: 'Passkey',
    description: 'Use Touch ID, Windows Hello or a security key.',
  },
];
