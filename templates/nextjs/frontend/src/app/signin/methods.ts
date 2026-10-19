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
 * the link with it and nothing else. A method with nothing to configure
 * leaves it out and the account page lists it as needing no setup.
 */
export type AccountEntry = {
  href: string;
  title: string;
  description: string;
};

export type SignInMethod = {
  href: string;
  title: string;
  description: string;
  account?: AccountEntry[];
};

export const methods: SignInMethod[] = [
  {
    href: '/auth/password',
    title: 'Email and password',
    description: 'Sign up or sign in with a password.',
    account: [
      {
        href: '/auth/password/change',
        title: 'Change password',
        description: 'Set a new password for this account.',
      },
      {
        href: '/auth/password/mfa',
        title: 'Two-factor authentication',
        description: 'Ask for a code when signing in with a password.',
      },
    ],
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
    account: [
      {
        href: '/auth/passkey/manage',
        title: 'Passkeys',
        description:
          'Add or remove the passkeys that can sign in to this account.',
      },
    ],
  },
];
