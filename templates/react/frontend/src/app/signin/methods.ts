import type { User } from '@nhost/nhost-js/auth';
import type { ReactNode } from 'react';

export type AccountSetting = (props: { user: User }) => ReactNode;

export type SignInMethod = {
  href: string;
  title: string;
  description: string;
  account?: Record<string, AccountSetting>;
  signedOutPaths?: string[];
};

/**
 * A method that signs in from the sign-in list itself rather than from a page
 * of its own, because it has nothing to type first.
 */
export type SignInButtons = (props: {
  destination: string;
  lastUsed: string | null;
}) => ReactNode;

export const buttons: SignInButtons[] = [];

/**
 * The account-page rows of the methods in `buttons`, which have no entry in
 * `methods` to carry an `account`.
 */
export const buttonSettings: AccountSetting[] = [];

/** The sign-in methods this app offers, one entry each. */
export const methods: SignInMethod[] = [
  {
    href: '/auth/magic-link',
    title: 'Magic link',
    description: 'Get a sign-in link by email.',
  },
];
